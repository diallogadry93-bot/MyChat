import { eq, and, gt } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'
import { hashPassword, verifyPassword, generateRefreshToken, hashToken, verifyToken } from '../utils/auth.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  displayName: z.string().min(2).max(50).trim(),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const REFRESH_EXPIRY_DAYS = 30

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ── POST /auth/register ────────────────────────────────
  app.post('/auth/register', async (request, reply) => {
    const result = RegisterBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const { email, password, displayName } = result.data

    // Check duplicate email
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await hashPassword(password)
    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      passwordHash,
      displayName,
    }).returning({ id: users.id, email: users.email, displayName: users.displayName })

    if (!user) return reply.status(500).send({ error: 'Failed to create user' })

    const { accessToken, refreshToken } = await createTokenPair(app, user.id, user.email)

    return reply.status(201).send({
      user: { id: user.id, email: user.email, displayName: user.displayName },
      accessToken,
      refreshToken,
    })
  })

  // ── POST /auth/login ───────────────────────────────────
  app.post('/auth/login', async (request, reply) => {
    const result = LoginBody.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'Validation error', issues: result.error.issues })
    }
    const { email, password } = result.data

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })

    // Constant-time comparison to prevent user enumeration
    const validPassword = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, '$2b$12$placeholder.hash.for.timing.safety')

    if (!user || !validPassword) {
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    const { accessToken, refreshToken } = await createTokenPair(app, user.id, user.email)

    // Update last seen
    await db.update(users)
      .set({ isOnline: true, lastSeen: new Date() })
      .where(eq(users.id, user.id))

    return reply.send({
      user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken,
    })
  })

  // ── POST /auth/refresh ─────────────────────────────────
  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }
    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token required' })
    }

    // Find valid (non-expired) sessions
    const validSessions = await db.query.sessions.findMany({
      where: and(
        gt(sessions.expiresAt, new Date()),
      ),
      with: { user: true },
    })

    // Find matching session by verifying token hash
    let matchedSession = null
    for (const session of validSessions) {
      if (await verifyToken(refreshToken, session.refreshTokenHash)) {
        matchedSession = session
        break
      }
    }

    if (!matchedSession) {
      return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    }

    // Rotate refresh token
    const newRefreshToken = generateRefreshToken()
    const newRefreshTokenHash = await hashToken(newRefreshToken)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS)

    await db.update(sessions)
      .set({ refreshTokenHash: newRefreshTokenHash, expiresAt })
      .where(eq(sessions.id, matchedSession.id))

    const newAccessToken = app.jwt.sign(
      { sub: matchedSession.userId, email: matchedSession.user.email },
      { expiresIn: '15m' },
    )

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // ── POST /auth/logout ──────────────────────────────────
  app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }
    if (refreshToken) {
      // Delete the specific session
      const allSessions = await db.query.sessions.findMany({
        where: eq(sessions.userId, getCurrentUser(request).sub),
      })
      for (const session of allSessions) {
        if (await verifyToken(refreshToken, session.refreshTokenHash)) {
          await db.delete(sessions).where(eq(sessions.id, session.id))
          break
        }
      }
    }

    return reply.send({ message: 'Logged out successfully' })
  })

  // ── GET /auth/me ───────────────────────────────────────
  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const { sub } = getCurrentUser(request)
    const user = await db.query.users.findFirst({
      where: eq(users.id, sub),
      columns: { passwordHash: false },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({ user })
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function createTokenPair(
  app: FastifyInstance,
  userId: string,
  email: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = app.jwt.sign(
    { sub: userId, email },
    { expiresIn: '15m' },
  )

  const refreshToken = generateRefreshToken()
  const refreshTokenHash = await hashToken(refreshToken)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRY_DAYS)

  await db.insert(sessions).values({ userId, refreshTokenHash, expiresAt })

  return { accessToken, refreshToken }
}
