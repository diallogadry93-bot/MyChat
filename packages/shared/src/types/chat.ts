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
