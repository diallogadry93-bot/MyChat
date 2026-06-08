import { eq, and } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'

import { db }       from '../db/client.js'
import { callLogs, chatMembers } from '../db/schema.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'
import { sfuManager } from './sfu.js'

const InitiateCallBody = z.object({
  chatId:   z.string().uuid(),
  callType: z.enum(['voice', 'video']),
})

const SfuTransportBody = z.object({
  callId:        z.string().uuid(),
  dtlsParameters: z.record(z.unknown()),
})

export async function callRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /calls — initiate a call ──────────────────────
  app.post('/calls', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed = InitiateCallBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { chatId, callType } = parsed.data

    // Verify caller is a chat member
    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const callId = uuidv4()

    // Log call start
    await db.insert(callLogs).values({
      id:          callId,
      chatId,
      initiatedBy: userId,
      callType,
      startedAt:   new Date(),
    })

    // Get all chat members to notify
    const members = await db.query.chatMembers.findMany({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.deletedAt, null as unknown as Date)),
      with: { user: { columns: { id: true, displayName: true } } },
    })

    // Notify all members via Socket.io
    const io = app.io
    if (io) {
      io.to(`chat:${chatId}`).emit('call:offer', {
        callId, chatId, callType,
        initiator: { id: userId },
        members:   members.map(m => m.user),
      })
    }

    return reply.status(201).send({ callId, chatId, callType })
  })

  // ── POST /calls/:callId/answer — accept a call ─────────
  app.post('/calls/:callId/answer', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { callId }      = request.params as { callId: string }
    const { sdp }         = request.body as { sdp?: unknown }

    const io = app.io
    if (io) {
      io.to(`call:${callId}`).emit('call:answer', { callId, userId, sdp })
    }

    return reply.send({ callId, status: 'answered' })
  })

  // ── POST /calls/:callId/end — end a call ───────────────
  app.post('/calls/:callId/end', { preHandler: requireAuth }, async (request, reply) => {
    const { callId } = request.params as { callId: string }

    const call = await db.query.callLogs.findFirst({ where: eq(callLogs.id, callId) })
    if (!call) return reply.status(404).send({ error: 'Call not found' })

    const endedAt        = new Date()
    const durationSeconds = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)

    await db.update(callLogs)
      .set({ endedAt, durationSeconds })
      .where(eq(callLogs.id, callId))

    // Close SFU room if group call
    await sfuManager.leaveRoom(callId, 'all')

    const io = app.io
    if (io) {
      io.to(`call:${callId}`).emit('call:end', { callId })
      io.to(`chat:${call.chatId}`).emit('call:end', { callId })
    }

    return reply.send({ callId, durationSeconds })
  })

  // ── GET /calls/:callId/sfu-capabilities — mediasoup router RTP caps ──
  app.get('/calls/:callId/sfu-capabilities', { preHandler: requireAuth }, async (request, reply) => {
    const { callId } = request.params as { callId: string }

    const call = await db.query.callLogs.findFirst({ where: eq(callLogs.id, callId) })
    if (!call) return reply.status(404).send({ error: 'Call not found' })

    const room = await sfuManager.getOrCreateRoom(callId, call.chatId)
    if (!room) {
      return reply.send({ sfuAvailable: false, rtpCapabilities: null })
    }

    return reply.send({
      sfuAvailable:    true,
      rtpCapabilities: room.router.rtpCapabilities,
    })
  })

  // ── POST /calls/:callId/sfu-transport — create WebRTC transport ──
  app.post('/calls/:callId/sfu-transport', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { callId }      = request.params as { callId: string }
    const { direction }   = request.body as { direction?: 'send' | 'recv' }

    const room = sfuManager.getRoom(callId)
    if (!room) return reply.status(404).send({ error: 'SFU room not found' })

    const transport = await sfuManager.createWebRtcTransport(room)

    // Ensure participant exists
    if (!room.participants.has(userId)) {
      await sfuManager.joinRoom(room, userId)
    }

    const participant = room.participants.get(userId)!
    if (direction === 'send') participant.sendTransport = transport
    else                      participant.recvTransport  = transport

    return reply.send({
      id:             transport.id,
      iceParameters:  transport.iceParameters,
      iceCandidates:  transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    })
  })

  // ── GET /calls — call history ──────────────────────────
  app.get('/calls', { preHandler: requireAuth }, async (request, reply) => {
    const { chatId } = request.query as { chatId?: string }

    const logs = chatId
      ? await db.query.callLogs.findMany({
          where: eq(callLogs.chatId, chatId),
          orderBy: (t, { desc }) => [desc(t.startedAt)],
          limit: 50,
        })
      : []

    return reply.send({ calls: logs })
  })
}
