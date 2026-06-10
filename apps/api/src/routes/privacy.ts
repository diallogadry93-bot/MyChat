import { eq, and, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db }    from '../db/client.js'
import { users } from '../db/schema.js'
import { redis } from '../utils/redis.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'

// ── Ghost mode ─────────────────────────────────────────────
// User appears offline to everyone EXCEPT their allowlist

const GhostModeBody = z.object({
  enabled:     z.boolean(),
  allowedIds:  z.array(z.string().uuid()).optional().default([]),
})

// ── Read receipts ──────────────────────────────────────────
const ReadReceiptsBody = z.object({
  chatId:  z.string().uuid().optional(),  // per-chat override
  enabled: z.boolean(),
})

// ── Message retention ──────────────────────────────────────
const RetentionBody = z.object({
  chatId:  z.string().uuid(),
  days:    z.union([z.literal(7), z.literal(30), z.literal(90), z.literal(0)]), // 0 = never
})

export async function privacyRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /privacy/settings ──────────────────────────────
  app.get('/privacy/settings', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)

    const [ghostMode, readReceipts, retention] = await Promise.all([
      redis.get(`privacy:ghost:${userId}`),
      redis.get(`privacy:receipts:${userId}`),
      redis.get(`privacy:retention:${userId}`),
    ])

    return reply.send({
      ghostMode:    ghostMode    ? JSON.parse(ghostMode)    : { enabled: false, allowedIds: [] },
      readReceipts: readReceipts ? JSON.parse(readReceipts) : { enabled: true },
      retention:    retention    ? JSON.parse(retention)    : {},
    })
  })

  // ── POST /privacy/ghost-mode ───────────────────────────
  app.post('/privacy/ghost-mode', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed = GhostModeBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { enabled, allowedIds } = parsed.data

    await redis.set(
      `privacy:ghost:${userId}`,
      JSON.stringify({ enabled, allowedIds }),
    )

    // Update online status for ghost users
    if (enabled) {
      await db.update(users).set({ isOnline: false }).where(eq(users.id, userId))
    }

    // Broadcast real online status only to allowed users via socket
    const io = app.io
    if (io) {
      if (enabled) {
        // Emit offline to everyone except allowedIds
        io.emit('user:offline', { userId })
        // Emit online only to allowed contacts
        for (const allowedId of allowedIds) {
          io.to(`user:${allowedId}`).emit('user:online', { userId })
        }
      } else {
        // Coming out of ghost — broadcast online to everyone
        io.emit('user:online', { userId })
      }
    }

    return reply.send({ ghostMode: { enabled, allowedIds } })
  })

  // ── POST /privacy/read-receipts ────────────────────────
  app.post('/privacy/read-receipts', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed = ReadReceiptsBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { chatId, enabled } = parsed.data
    const key = chatId
      ? `privacy:receipts:${userId}:${chatId}`
      : `privacy:receipts:${userId}`

    await redis.set(key, JSON.stringify({ enabled, chatId: chatId ?? null }))

    return reply.send({ readReceipts: { enabled, chatId: chatId ?? null } })
  })

  // ── POST /privacy/retention ────────────────────────────
  app.post('/privacy/retention', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed = RetentionBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { chatId, days } = parsed.data
    await redis.hset(`privacy:retention:${userId}`, chatId, String(days))

    return reply.send({ retention: { chatId, days } })
  })

  // ── GET /privacy/online/:userId ────────────────────────
  // Check if a user is "really" online (respects ghost mode)
  app.get('/privacy/online/:targetId', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: viewerId } = getCurrentUser(request)
    const { targetId }      = request.params as { targetId: string }

    // Check if target is in ghost mode
    const ghostData = await redis.get(`privacy:ghost:${targetId}`)
    if (ghostData) {
      const ghost = JSON.parse(ghostData) as { enabled: boolean; allowedIds: string[] }
      if (ghost.enabled && !ghost.allowedIds.includes(viewerId)) {
        return reply.send({ online: false, ghost: true })
      }
    }

    const presenceKey = `presence:${targetId}`
    const present     = await redis.exists(presenceKey)
    return reply.send({ online: present === 1, ghost: false })
  })
}
