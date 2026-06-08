import { eq, and, desc, lt, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '../db/client.js'
import {
  messages, chatMembers, messageReactions, messageEdits, attachments,
} from '../db/schema.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'
import { scheduleSelfDestruct } from '../jobs/queues.js'
import { getUploadUrl } from '../utils/storage.js'
import type { MediaFolder } from '../utils/storage.js'

const SELF_DESTRUCT_OPTIONS = [5, 30, 60, 300, 3600, 86400] // seconds
const PAGE_SIZE = 50

const SendMessageBody = z.object({
  type:                z.enum(['text', 'image', 'video', 'file', 'voice', 'system']).default('text'),
  bodyEncrypted:       z.string().min(1),   // AES-256-GCM ciphertext (base64)
  iv:                  z.string().min(1),   // GCM IV (base64)
  selfDestructSeconds: z.number().int().positive().optional(),
  replyToId:           z.string().uuid().optional(),
})

const EditMessageBody = z.object({
  bodyEncrypted: z.string().min(1),
  iv:            z.string().min(1),
})

const ReactBody = z.object({
  emoji: z.string().min(1).max(8),
})

const UploadUrlBody = z.object({
  filename:    z.string().min(1),
  contentType: z.string().min(1),
  folder:      z.enum(['avatars', 'attachments', 'voice', 'thumbnails']),
})

export async function messageRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /chats/:chatId/messages — paginated history ────
  app.get('/chats/:chatId/messages', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { chatId }      = request.params as { chatId: string }
    const { before, limit } = request.query as { before?: string; limit?: string }

    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const pageSize = Math.min(parseInt(limit ?? '50', 10), 100)

    const msgs = await db.query.messages.findMany({
      where: and(
        eq(messages.chatId, chatId),
        isNull(messages.deletedAt),
        before ? lt(messages.createdAt, new Date(before)) : undefined,
      ),
      orderBy: [desc(messages.createdAt)],
      limit: pageSize,
      with: {
        reactions: true,
        attachments: true,
        sender: { columns: { id: true, displayName: true, avatarUrl: true } },
      },
    })

    return reply.send({
      messages: msgs.reverse(),
      hasMore:  msgs.length === pageSize,
      nextCursor: msgs[0]?.createdAt.toISOString() ?? null,
    })
  })

  // ── POST /chats/:chatId/messages — send a message ──────
  app.post('/chats/:chatId/messages', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { chatId }      = request.params as { chatId: string }

    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const parsed = SendMessageBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })

    const { type, bodyEncrypted, iv, selfDestructSeconds } = parsed.data

    let selfDestructAt: Date | null = null
    if (selfDestructSeconds !== undefined) {
      if (!SELF_DESTRUCT_OPTIONS.includes(selfDestructSeconds) && selfDestructSeconds > 0) {
        return reply.status(400).send({ error: `selfDestructSeconds must be one of: ${SELF_DESTRUCT_OPTIONS.join(', ')}` })
      }
      selfDestructAt = new Date(Date.now() + selfDestructSeconds * 1000)
    }

    const [message] = await db.insert(messages).values({
      chatId,
      senderId: userId,
      type,
      bodyEncrypted,
      iv,
      selfDestructAt,
    }).returning()

    if (!message) return reply.status(500).send({ error: 'Failed to send message' })

    // Schedule self-destruct job
    if (selfDestructAt) {
      await scheduleSelfDestruct(
        { messageId: message.id, chatId, storageKeys: [] },
        selfDestructSeconds! * 1000,
      )
    }

    // Broadcast to all chat room members via Socket.io
    const io = app.io
    if (io) {
      io.to(`chat:${chatId}`).emit('message:new', {
        ...message,
        sender: { id: userId },
      })
    }

    return reply.status(201).send({ message })
  })

  // ── PATCH /messages/:messageId — edit a message ─────────
  app.patch('/messages/:messageId', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId }   = getCurrentUser(request)
    const { messageId }     = request.params as { messageId: string }

    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!message)              return reply.status(404).send({ error: 'Message not found' })
    if (message.senderId !== userId) return reply.status(403).send({ error: 'Cannot edit another user\'s message' })
    if (message.deletedAt)     return reply.status(410).send({ error: 'Message was deleted' })

    const parsed = EditMessageBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })

    // Save edit history
    await db.insert(messageEdits).values({
      messageId,
      previousBodyEncrypted: message.bodyEncrypted,
    })

    const [updated] = await db.update(messages)
      .set({ bodyEncrypted: parsed.data.bodyEncrypted, iv: parsed.data.iv, editedAt: new Date() })
      .where(eq(messages.id, messageId))
      .returning()

    const io = app.io
    if (io) io.to(`chat:${message.chatId}`).emit('message:edited', updated)

    return reply.send({ message: updated })
  })

  // ── DELETE /messages/:messageId ──────────────────────────
  app.delete('/messages/:messageId', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { messageId }   = request.params as { messageId: string }

    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!message)              return reply.status(404).send({ error: 'Message not found' })
    if (message.senderId !== userId) return reply.status(403).send({ error: 'Cannot delete another user\'s message' })

    await db.update(messages)
      .set({ deletedAt: new Date() })
      .where(eq(messages.id, messageId))

    const io = app.io
    if (io) io.to(`chat:${message.chatId}`).emit('message:deleted', { messageId, chatId: message.chatId })

    return reply.send({ message: 'Message deleted' })
  })

  // ── POST /messages/:messageId/reactions ──────────────────
  app.post('/messages/:messageId/reactions', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { messageId }   = request.params as { messageId: string }

    const parsed = ReactBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!message) return reply.status(404).send({ error: 'Message not found' })

    // Toggle: if reaction exists, delete it; else insert
    const existing = await db.query.messageReactions.findFirst({
      where: and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, parsed.data.emoji),
      ),
    })

    if (existing) {
      await db.delete(messageReactions).where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.userId, userId),
          eq(messageReactions.emoji, parsed.data.emoji),
        )
      )
    } else {
      await db.insert(messageReactions).values({ messageId, userId, emoji: parsed.data.emoji })
    }

    const allReactions = await db.query.messageReactions.findMany({
      where: eq(messageReactions.messageId, messageId),
    })

    const io = app.io
    if (io) io.to(`chat:${message.chatId}`).emit('message:reaction', { messageId, reactions: allReactions })

    return reply.send({ toggled: existing ? 'removed' : 'added', reactions: allReactions })
  })

  // ── GET /messages/:messageId/edits — edit history ────────
  app.get('/messages/:messageId/edits', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { messageId }   = request.params as { messageId: string }

    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!message) return reply.status(404).send({ error: 'Message not found' })

    // Verify user is a member of the chat
    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, message.chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const edits = await db.query.messageEdits.findMany({
      where: eq(messageEdits.messageId, messageId),
      orderBy: [desc(messageEdits.editedAt)],
    })

    return reply.send({ edits })
  })

  // ── POST /upload-url — presigned R2 upload URL ───────────
  app.post('/upload-url', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = UploadUrlBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error', issues: parsed.error.issues })

    const { filename, contentType, folder } = parsed.data
    const result = await getUploadUrl(folder as MediaFolder, filename, contentType)

    return reply.send(result)
  })
}

// Extend Fastify types to include Socket.io
declare module 'fastify' {
  interface FastifyInstance {
    io?: import('socket.io').Server
  }
}
