import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer } from '../server.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  process.env['JWT_SECRET'] = 'test-secret-for-unit-tests-only'
  process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? 'postgresql://mychat:mychat@localhost:5432/mychat_test'
  process.env['REDIS_URL'] = process.env['REDIS_URL'] ?? 'redis://localhost:6379'
  app = await createServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('Auth routes', () => {
  const testUser = {
    email: `test_${Date.now()}@mychat.test`,
    password: 'TestPass123',
    displayName: 'Test User',
  }
  let accessToken: string
  let refreshToken: string

  it('POST /api/auth/register — creates a new user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ user: { email: string }; accessToken: string; refreshToken: string }>()
    expect(body.user.email).toBe(testUser.email)
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  it('POST /api/auth/register — rejects duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    })
    expect(res.statusCode).toBe(409)
  })

  it('POST /api/auth/login — returns tokens for valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: testUser.password },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string; refreshToken: string }>()
    expect(body.accessToken).toBeTruthy()
    accessToken = body.accessToken
    refreshToken = body.refreshToken
  })

  it('POST /api/auth/login — rejects wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testUser.email, password: 'WrongPass999' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/auth/me — returns current user with valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ user: { email: string } }>()
    expect(body.user.email).toBe(testUser.email)
  })

  it('GET /api/auth/me — rejects missing token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/auth/refresh — rotates token pair', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string; refreshToken: string }>()
    expect(body.accessToken).toBeTruthy()
    expect(body.refreshToken).not.toBe(refreshToken)
  })

  it('GET /health — returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ status: string }>()
    expect(body.status).toBe('ok')
  })
})
