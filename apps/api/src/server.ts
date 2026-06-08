import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyHelmet from '@fastify/helmet'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'
import Fastify from 'fastify'
import { createAdapter } from '@socket.io/redis-adapter'
import { Server as SocketServer } from 'socket.io'

import { authRoutes }     from './routes/auth.js'
import { chatRoutes }     from './routes/chats.js'
import { messageRoutes }  from './routes/messages.js'
import { redis, redisPub, redisSub } from './utils/redis.js'
import { registerSocketHandlers } from './ws/index.js'
import type { SocketData, ServerToClientEvents, ClientToServerEvents } from './ws/index.js'

export async function createServer() {
  const app = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
  })

  // ── Security ──────────────────────────────────────────────
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: process.env['NODE_ENV'] === 'production',
  })
  await app.register(fastifyCors, {
    origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(fastifyCookie)
  await app.register(fastifyRateLimit, {
    max: 200, timeWindow: '1 minute', redis, skipOnError: false,
  })

  // ── JWT ───────────────────────────────────────────────────
  await app.register(fastifyJwt, {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
    sign: { expiresIn: '15m' },
  })

  // ── Routes ────────────────────────────────────────────────
  await app.register(authRoutes,    { prefix: '/api' })
  await app.register(chatRoutes,    { prefix: '/api' })
  await app.register(messageRoutes, { prefix: '/api' })

  // ── Health ────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok', version: '0.3.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }))

  // ── Socket.io ─────────────────────────────────────────────
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    app.server,
    {
      cors: {
        origin: process.env['CORS_ORIGIN']?.split(',') ?? ['http://localhost:3000'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    },
  )

  io.adapter(createAdapter(redisPub, redisSub))

  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined
    if (!token) return next(new Error('Authentication token required'))
    try {
      const payload = app.jwt.verify<{ sub: string; email: string }>(token)
      socket.data.userId = payload.sub
      socket.data.email  = payload.email
      return next()
    } catch {
      return next(new Error('Invalid or expired token'))
    }
  })

  // Expose io on the fastify instance so routes can emit events
  app.decorate('io', io)
  registerSocketHandlers(io)

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async () => {
    console.info('Shutting down gracefully...')
    await io.close()
    await app.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => { void shutdown() })
  process.on('SIGINT',  () => { void shutdown() })

  return app
}
