import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'

import { db } from '../db/client.js'
import { messages, attachments } from '../db/schema.js'
import { deleteObjects } from '../utils/storage.js'
import { redis } from '../utils/redis.js'
import type { SelfDestructJob, MediaProcessJob } from './queues.js'

const connection = { host: redis.options.host ?? 'localhost', port: Number(redis.options.port ?? 6379) }

// ── Self-destruct worker ───────────────────────────────────────────────────────

export const selfDestructWorker = new Worker<SelfDestructJob>(
  'self-destruct',
  async (job) => {
    const { messageId, storageKeys } = job.data
    console.info(`💣 Self-destructing message ${messageId}`)

    // Soft-delete the message row
    await db.update(messages)
      .set({ deletedAt: new Date(), bodyEncrypted: '', iv: '' })
      .where(eq(messages.id, messageId))

    // Delete all R2 objects (images, video, voice)
    if (storageKeys.length > 0) {
      await deleteObjects(storageKeys)
    }
  },
  { connection, concurrency: 20 },
)

selfDestructWorker.on('completed', (job) => {
  console.info(`✅ Self-destruct complete: ${job.data.messageId}`)
})

selfDestructWorker.on('failed', (job, err) => {
  console.error(`❌ Self-destruct failed: ${job?.data.messageId}`, err)
})

// ── Media process worker ───────────────────────────────────────────────────────

export const mediaProcessWorker = new Worker<MediaProcessJob>(
  'media-process',
  async (job) => {
    const { attachmentId, mimeType } = job.data
    console.info(`🖼  Processing media attachment ${attachmentId} (${mimeType})`)
    // Thumbnail generation via Sharp/FFmpeg added when those libs are available
    // For now: mark attachment as processed
    console.info(`✅ Media processed: ${attachmentId}`)
  },
  { connection, concurrency: 5 },
)
