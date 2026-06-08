import { Queue, Worker, QueueEvents } from 'bullmq'
import { redis } from '../utils/redis.js'

const connection = { host: redis.options.host ?? 'localhost', port: Number(redis.options.port ?? 6379) }

// ── Queue definitions ─────────────────────────────────────────────────────────

export const selfDestructQueue = new Queue('self-destruct', { connection })
export const mediaProcessQueue = new Queue('media-process', { connection })

export const selfDestructEvents = new QueueEvents('self-destruct', { connection })

// ── Job types ─────────────────────────────────────────────────────────────────

export interface SelfDestructJob {
  messageId:   string
  chatId:      string
  storageKeys: string[]  // R2 objects to delete
}

export interface MediaProcessJob {
  messageId:   string
  storageKey:  string
  mimeType:    string
  attachmentId: string
}

/**
 * Schedule a message for self-destruction
 * @param delay milliseconds from now
 */
export async function scheduleSelfDestruct(
  job: SelfDestructJob,
  delay: number,
): Promise<void> {
  await selfDestructQueue.add('destroy', job, {
    delay,
    jobId:   `destruct:${job.messageId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  })
}

/**
 * Cancel a scheduled self-destruct (e.g. if message is manually deleted first)
 */
export async function cancelSelfDestruct(messageId: string): Promise<void> {
  const job = await selfDestructQueue.getJob(`destruct:${messageId}`)
  await job?.remove()
}
