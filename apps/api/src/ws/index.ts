import type { Server as SocketServer } from 'socket.io'
import { setUserOnline, setUserOffline, refreshPresence } from '../utils/redis.js'

export interface ServerToClientEvents {
  // Presence
  'user:online':      (data: { userId: string }) => void
  'user:offline':     (data: { userId: string }) => void
  // Messages
  'message:new':      (data: Record<string, unknown>) => void
  'message:edited':   (data: Record<string, unknown>) => void
  'message:deleted':  (data: { messageId: string; chatId: string }) => void
  'message:reaction': (data: Record<string, unknown>) => void
  // Typing
  'typing:start':     (data: { chatId: string; userId: string }) => void
  'typing:stop':      (data: { chatId: string; userId: string }) => void
  // Calls — signalling
  'call:offer':       (data: Record<string, unknown>) => void
  'call:answer':      (data: Record<string, unknown>) => void
  'call:ice':         (data: Record<string, unknown>) => void
  'call:end':         (data: { callId: string }) => void
  'call:participant-joined': (data: { callId: string; userId: string }) => void
  'call:participant-left':   (data: { callId: string; userId: string }) => void
  'call:media-state': (data: { callId: string; userId: string; audio: boolean; video: boolean }) => void
  // SFU — mediasoup signalling
  'sfu:new-producer': (data: { callId: string; producerId: string; userId: string; kind: string }) => void
  'sfu:producer-closed': (data: { callId: string; producerId: string }) => void
  // Errors
  'error':            (data: { message: string }) => void
}

export interface ClientToServerEvents {
  'chat:join':        (chatId: string) => void
  'chat:leave':       (chatId: string) => void
  'typing:start':     (chatId: string) => void
  'typing:stop':      (chatId: string) => void
  // P2P call signalling
  'call:join':        (callId: string) => void
  'call:leave':       (callId: string) => void
  'call:ice':         (data: Record<string, unknown>) => void
  'call:media-state': (data: { callId: string; audio: boolean; video: boolean }) => void
  'ping':             () => void
}

export interface SocketData {
  userId:   string
  email:    string
  deviceId?: string
}

export function registerSocketHandlers(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
): void {

  io.on('connection', async (socket) => {
    const { userId } = socket.data
    console.info(`🔌 Connected  userId=${userId}  socketId=${socket.id}`)

    await setUserOnline(userId, socket.id)
    socket.broadcast.emit('user:online', { userId })

    // ── Chat rooms ───────────────────────────────────────
    socket.on('chat:join',  (chatId) => { void socket.join(`chat:${chatId}`) })
    socket.on('chat:leave', (chatId) => { void socket.leave(`chat:${chatId}`) })

    // ── Typing indicators ────────────────────────────────
    socket.on('typing:start', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId })
    })
    socket.on('typing:stop', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId })
    })

    // ── Call room join/leave ─────────────────────────────
    socket.on('call:join', (callId) => {
      void socket.join(`call:${callId}`)
      socket.to(`call:${callId}`).emit('call:participant-joined', { callId, userId })
      console.info(`📞 ${userId} joined call ${callId}`)
    })

    socket.on('call:leave', (callId) => {
      void socket.leave(`call:${callId}`)
      socket.to(`call:${callId}`).emit('call:participant-left', { callId, userId })
      console.info(`📞 ${userId} left call ${callId}`)
    })

    // ── ICE candidate relay ──────────────────────────────
    socket.on('call:ice', (data) => {
      const callId = (data as { callId?: string }).callId
      if (callId) socket.to(`call:${callId}`).emit('call:ice', { ...data, fromUserId: userId })
    })

    // ── Media state (mute/camera toggle) ────────────────
    socket.on('call:media-state', (data) => {
      socket.to(`call:${data.callId}`).emit('call:media-state', { ...data, userId })
    })

    // ── Presence keepalive ───────────────────────────────
    socket.on('ping', () => { void refreshPresence(userId) })

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.info(`🔌 Disconnected userId=${userId} reason=${reason}`)
      const userSockets = await io.in(`user:${userId}`).fetchSockets()
      if (userSockets.length === 0) {
        await setUserOffline(userId)
        socket.broadcast.emit('user:offline', { userId })
      }
    })

    await socket.join(`user:${userId}`)
  })
}
