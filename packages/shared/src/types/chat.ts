export type ChatType = 'direct' | 'group' | 'broadcast'
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'system'
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface Chat {
  id: string
  type: ChatType
  name: string | null
  avatarUrl: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  type: MessageType
  body: string
  status: MessageStatus
  selfDestructAt: Date | null
  editedAt: Date | null
  deletedAt: Date | null
  createdAt: Date
}

export interface ChatMember {
  chatId: string
  userId: string
  role: 'admin' | 'member'
  joinedAt: Date
}

export interface Attachment {
  id: string
  messageId: string
  storageKey: string
  mimeType: string
  sizeBytes: number
  width?: number | null
  height?: number | null
  durationMs?: number | null
  createdAt: Date
}

export interface MessageReaction {
  messageId: string
  userId: string
  emoji: string
  createdAt: Date
}

export interface MessageEdit {
  id: string
  messageId: string
  previousBodyEncrypted: string
  editedAt: Date
}

export const SELF_DESTRUCT_SECONDS = [5, 30, 60, 300, 3600, 86400] as const
export type SelfDestructSeconds = (typeof SELF_DESTRUCT_SECONDS)[number]
