import { eq, and, isNull, desc } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db }          from '../db/client.js'
import { messages, chatMembers, users } from '../db/schema.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'
import {
  summariseChat,
  getSmartReplies,
  detectTone,
  isSafeMessage,
  translateMessage,
  type ChatMessage,
} from './service.js'

const TranslateBody = z.object({
  messageId:      z.string().uuid(),
  targetLanguage: z.string().min(2).max(50),
})

const ToneBody = z.object({
  text: z.string().min(1).max(2000),
})

const SmartReplyBody = z.object({
  chatId: z.string().uuid(),
  lang:   z.string().min(2).max(10).optional().default('en'),
})

export async function aiRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /ai/summary/:chatId ────────────────────────────
  // "Catch me up" — summarise the last N messages in a chat
  app.get('/ai/summary/:chatId', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { chatId }      = request.params as { chatId: string }
    const { limit }       = request.query as { limit?: string }

    // Verify membership
    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    // Fetch recent messages
    const pageSize = Math.min(parseInt(limit ?? '50', 10), 100)
    const msgs     = await db.query.messages.findMany({
      where:   and(eq(messages.chatId, chatId), isNull(messages.deletedAt)),
      orderBy: [desc(messages.createdAt)],
      limit:   pageSize,
      with:    { sender: { columns: { id: true, displayName: true } } },
    })

    if (msgs.length < 3) {
      return reply.send({ summary: null, reason: 'Not enough messages to summarise' })
    }

    const chatMessages: ChatMessage[] = msgs.reverse().map(m => ({
      senderId:   m.senderId,
      senderName: m.sender.displayName,
      body:       m.bodyEncrypted, // In production: decrypt before passing to AI
      createdAt:  m.createdAt.toISOString(),
    }))

    try {
      const summary = await summariseChat(userId, chatId, chatMessages)
      return reply.send({ summary })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI service error'
      return reply.status(429).send({ error: msg })
    }
  })

  // ── POST /ai/smart-replies ─────────────────────────────
  // Get 3 reply suggestions based on the last 5 messages
  app.post('/ai/smart-replies', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed          = SmartReplyBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { chatId, lang } = parsed.data

    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const msgs = await db.query.messages.findMany({
      where:   and(eq(messages.chatId, chatId), isNull(messages.deletedAt)),
      orderBy: [desc(messages.createdAt)],
      limit:   5,
      with:    { sender: { columns: { id: true, displayName: true } } },
    })

    if (msgs.length === 0) return reply.send({ replies: [] })

    const chatMessages: ChatMessage[] = msgs.reverse().map(m => ({
      senderId:   m.senderId,
      senderName: m.sender.displayName,
      body:       m.bodyEncrypted,
      createdAt:  m.createdAt.toISOString(),
    }))

    const replies = await getSmartReplies(userId, chatMessages, lang)
    return reply.send({ replies })
  })

  // ── POST /ai/tone ──────────────────────────────────────
  // Detect tone of a message text (shown on hover)
  app.post('/ai/tone', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed          = ToneBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const tone = await detectTone(userId, parsed.data.text)
    return reply.send({ tone })
  })

  // ── POST /ai/translate ─────────────────────────────────
  // Translate a message to a target language
  app.post('/ai/translate', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const parsed          = TranslateBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Validation error' })

    const { messageId, targetLanguage } = parsed.data

    const message = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!message) return reply.status(404).send({ error: 'Message not found' })

    // Verify access
    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, message.chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    try {
      const translated = await translateMessage(userId, message.bodyEncrypted, targetLanguage)
      return reply.send({ translated, targetLanguage, messageId })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed'
      return reply.status(429).send({ error: msg })
    }
  })

  // ── POST /ai/safety-check ──────────────────────────────
  // Pre-delivery toxicity/spam check (called server-side before broadcasting)
  app.post('/ai/safety-check', { preHandler: requireAuth }, async (request, reply) => {
    const { text } = request.body as { text?: string }
    if (!text) return reply.status(400).send({ error: 'text required' })

    const result = await isSafeMessage(text)
    return reply.send(result)
  })
}
