import type { Server as SocketServer } from 'socket.io'

import { setUserOnline, setUserOffline, refreshPresence } from '../utils/redis.js'

export interface ServerToClientEvents {
  'user:online':    (data: { userId: string }) => void
  'user:offline':   (data: { userId: string }) => void
  'message:new':    (data: Record<string, unknown>) => void
  'message:edited': (data: Record<string, unknown>) => void
  'message:deleted':(data: { messageId: string; chatId: string }) => void
  'message:reaction':(data: Record<string, unknown>) => void
  'typing:start':   (data: { chatId: string; userId: string }) => void
  'typing:stop':    (data: { chatId: string; userId: string }) => void
  'call:offer':     (data: Record<string, unknown>) => void
  'call:answer':    (data: Record<string, unknown>) => void
  'call:ice':       (data: Record<string, unknown>) => void
  'call:end':       (data: { callId: string }) => void
  'error':          (data: { message: string }) => void
}

export interface ClientToServerEvents {
  'chat:join':     (chatId: string) => void
  'chat:leave':    (chatId: string) => void
  'typing:start':  (chatId: string) => void
  'typing:stop':   (chatId: string) => void
  'call:offer':    (data: Record<string, unknown>) => void
  'call:answer':   (data: Record<string, unknown>) => void
  'call:ice':      (data: Record<string, unknown>) => void
  'call:end':      (callId: string) => void
  'ping':          () => void
}

export interface SocketData {
  userId: string
  email:  string
  deviceId?: string
}

export function registerSocketHandlers(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>,
): void {

  io.on('connection', async (socket) => {
    const { userId } = socket.data
    console.info(`🔌 Socket connected: userId=${userId} socketId=${socket.id}`)

    // Mark user online & broadcast to others
    await setUserOnline(userId, socket.id)
    socket.broadcast.emit('user:online', { userId })

    // ── Chat room join/leave ─────────────────────────────
    socket.on('chat:join', (chatId) => {
      void socket.join(`chat:${chatId}`)
    })

    socket.on('chat:leave', (chatId) => {
      void socket.leave(`chat:${chatId}`)
    })

    // ── Typing indicators ────────────────────────────────
    socket.on('typing:start', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId })
    })

    socket.on('typing:stop', (chatId) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId })
    })

    // ── Calls ────────────────────────────────────────────
    socket.on('call:offer', (data) => {
      const targetUserId = (data as { targetUserId?: string }).targetUserId
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('call:offer', data)
      }
    })

    socket.on('call:answer', (data) => {
      const targetUserId = (data as { targetUserId?: string }).targetUserId
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('call:answer', data)
      }
    })

    socket.on('call:ice', (data) => {
      const targetUserId = (data as { targetUserId?: string }).targetUserId
      if (targetUserId) {
        socket.to(`user:${targetUserId}`).emit('call:ice', data)
      }
    })

    socket.on('call:end', (callId) => {
      socket.broadcast.emit('call:end', { callId })
    })

    // ── Presence keepalive ───────────────────────────────
    socket.on('ping', () => {
      void refreshPresence(userId)
    })

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', async (reason) => {
      console.info(`🔌 Socket disconnected: userId=${userId} reason=${reason}`)
      // Check if user has other active sockets before marking offline
      const userSockets = await io.in(`user:${userId}`).fetchSockets()
      if (userSockets.length === 0) {
        await setUserOffline(userId)
        socket.broadcast.emit('user:offline', { userId })
      }
    })

    // Join personal room for direct messages
    await socket.join(`user:${userId}`)
  })
}
