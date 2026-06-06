import { z } from 'zod'

export const CreateChatSchema = z.object({
  type: z.enum(['direct', 'group', 'broadcast']),
  memberIds: z.array(z.string().uuid()).min(1),
  name: z.string().min(1).max(100).optional(),
})

export const SendMessageSchema = z.object({
  chatId: z.string().uuid(),
  type: z.enum(['text', 'image', 'video', 'file', 'voice', 'system']),
  body: z.string().min(1).max(65536),
  selfDestructSeconds: z.number().int().positive().optional(),
})

export type CreateChatInput = z.infer<typeof CreateChatSchema>
export type SendMessageInput = z.infer<typeof SendMessageSchema>
