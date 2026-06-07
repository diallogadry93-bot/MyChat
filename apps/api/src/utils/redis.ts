import { Redis } from 'ioredis'

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  enableReadyCheck: true,
  lazyConnect: false,
})

// Separate pub/sub clients (cannot share with commands client)
export const redisPub = new Redis(redisUrl)
export const redisSub = new Redis(redisUrl)

redis.on('error', (err) => console.error('Redis error:', err))
redis.on('connect', () => console.info('✅ Redis connected'))

// Presence helpers
export const PRESENCE_TTL = 30 // seconds

export async function setUserOnline(userId: string, socketId: string): Promise<void> {
  await redis.setex(`presence:${userId}`, PRESENCE_TTL, socketId)
}

export async function setUserOffline(userId: string): Promise<void> {
  await redis.del(`presence:${userId}`)
}

export async function isUserOnline(userId: string): Promise<boolean> {
  const result = await redis.exists(`presence:${userId}`)
  return result === 1
}

export async function refreshPresence(userId: string): Promise<void> {
  await redis.expire(`presence:${userId}`, PRESENCE_TTL)
}
