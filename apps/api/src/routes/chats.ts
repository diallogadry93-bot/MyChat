import { eq, and, inArray, desc } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '../db/client.js'
import { chats, chatMembers, messages, users } from '../db/schema.js'
import { requireAuth, getCurrentUser } from '../middleware/auth.js'

const CreateChatBody = z.object({
  type:      z.enum(['direct', 'group', 'broadcast']),
  memberIds: z.array(z.string().uuid()).min(1).max(256),
  name:      z.string().min(1).max(100).optional(),
})

export async function chatRoutes(app: FastifyInstance): Promise<void> {

  // ── GET /chats — list all chats for current user ───────
  app.get('/chats', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)

    const memberships = await db.query.chatMembers.findMany({
      where: and(eq(chatMembers.userId, userId), eq(chatMembers.deletedAt, null as unknown as Date)),
      with: {
        chat: {
          with: {
            members: { with: { user: { columns: { id: true, displayName: true, avatarUrl: true, isOnline: true } } } },
          },
        },
      },
    })

    const chatIds = memberships.map(m => m.chatId)
    if (chatIds.length === 0) return reply.send({ chats: [] })

    // Get last message per chat
    const lastMessages = await db.query.messages.findMany({
      where: and(
        inArray(messages.chatId, chatIds),
        eq(messages.deletedAt, null as unknown as Date),
      ),
      orderBy: [desc(messages.createdAt)],
      limit: chatIds.length,
    })

    const lastMsgByChatId = new Map(lastMessages.map(m => [m.chatId, m]))

    const result = memberships.map(m => ({
      ...m.chat,
      myRole:      m.role,
      lastMessage: lastMsgByChatId.get(m.chatId) ?? null,
    }))

    return reply.send({ chats: result })
  })

  // ── POST /chats — create a new chat ────────────────────
  app.post('/chats', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const result = CreateChatBody.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'Validation error', issues: result.error.issues })

    const { type, memberIds, name } = result.data
    const allMemberIds = [...new Set([userId, ...memberIds])]

    // For direct chats: check if one already exists between these two users
    if (type === 'direct' && allMemberIds.length === 2) {
      const existing = await findDirectChat(userId, memberIds[0]!)
      if (existing) return reply.send({ chat: existing, existing: true })
    }

    const [chat] = await db.insert(chats).values({
      type,
      name: name ?? null,
      createdBy: userId,
    }).returning()

    if (!chat) return reply.status(500).send({ error: 'Failed to create chat' })

    // Add all members
    await db.insert(chatMembers).values(
      allMemberIds.map(memberId => ({
        chatId: chat.id,
        userId: memberId,
        role: memberId === userId ? 'admin' as const : 'member' as const,
      }))
    )

    return reply.status(201).send({ chat, existing: false })
  })

  // ── GET /chats/:chatId — get chat details ───────────────
  app.get('/chats/:chatId', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { chatId } = request.params as { chatId: string }

    const membership = await db.query.chatMembers.findFirst({
      where: and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)),
    })
    if (!membership) return reply.status(403).send({ error: 'Not a member of this chat' })

    const chat = await db.query.chats.findFirst({
      where: eq(chats.id, chatId),
      with: {
        members: {
          where: eq(chatMembers.deletedAt, null as unknown as Date),
          with: { user: { columns: { id: true, displayName: true, avatarUrl: true, isOnline: true, lastSeen: true } } },
        },
      },
    })

    return reply.send({ chat })
  })

  // ── DELETE /chats/:chatId/members/me — leave chat ───────
  app.delete('/chats/:chatId/members/me', { preHandler: requireAuth }, async (request, reply) => {
    const { sub: userId } = getCurrentUser(request)
    const { chatId } = request.params as { chatId: string }

    await db.update(chatMembers)
      .set({ deletedAt: new Date() })
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))

    return reply.send({ message: 'Left chat successfully' })
  })
}

async function findDirectChat(userId1: string, userId2: string) {
  const memberships1 = await db.query.chatMembers.findMany({ where: eq(chatMembers.userId, userId1) })
  const memberships2 = await db.query.chatMembers.findMany({ where: eq(chatMembers.userId, userId2) })

  const chatIds1 = new Set(memberships1.map(m => m.chatId))
  const shared   = memberships2.filter(m => chatIds1.has(m.chatId)).map(m => m.chatId)

  for (const chatId of shared) {
    const chat = await db.query.chats.findFirst({ where: and(eq(chats.id, chatId), eq(chats.type, 'direct')) })
    if (chat) return chat
  }
  return null
}
