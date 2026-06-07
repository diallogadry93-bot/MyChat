import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const platformEnum = pgEnum('platform', ['ios', 'android', 'web', 'desktop'])
export const chatTypeEnum = pgEnum('chat_type', ['direct', 'group', 'broadcast'])
export const memberRoleEnum = pgEnum('member_role', ['admin', 'member'])
export const messageTypeEnum = pgEnum('message_type', [
  'text', 'image', 'video', 'file', 'voice', 'system',
])

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  displayName:  varchar('display_name', { length: 100 }).notNull(),
  avatarUrl:    text('avatar_url'),
  isOnline:     boolean('is_online').notNull().default(false),
  lastSeen:     timestamp('last_seen', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: index('users_email_idx').on(t.email),
}))

// ── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  deviceId:         uuid('device_id'),
  expiresAt:        timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('sessions_user_idx').on(t.userId),
}))

// ── Devices ──────────────────────────────────────────────────────────────────

export const devices = pgTable('devices', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform:  platformEnum('platform').notNull(),
  pushToken: text('push_token'),
  lastSeen:  timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('devices_user_idx').on(t.userId),
}))

// ── Pre-keys (Signal Protocol) ────────────────────────────────────────────────

export const preKeys = pgTable('pre_keys', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  deviceId:   uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  keyId:      integer('key_id').notNull(),
  publicKey:  text('public_key').notNull(),
  isSigned:   boolean('is_signed').notNull().default(false),
  signature:  text('signature'),
  consumed:   boolean('consumed').notNull().default(false),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDeviceIdx: index('pre_keys_user_device_idx').on(t.userId, t.deviceId),
}))

// ── Chats ─────────────────────────────────────────────────────────────────────

export const chats = pgTable('chats', {
  id:        uuid('id').primaryKey().defaultRandom(),
  type:      chatTypeEnum('type').notNull(),
  name:      varchar('name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Chat Members ──────────────────────────────────────────────────────────────

export const chatMembers = pgTable('chat_members', {
  chatId:    uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:      memberRoleEnum('role').notNull().default('member'),
  joinedAt:  timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  chatUserIdx: index('chat_members_chat_user_idx').on(t.chatId, t.userId),
}))

// ── Messages ──────────────────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id:              uuid('id').primaryKey().defaultRandom(),
  chatId:          uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  senderId:        uuid('sender_id').notNull().references(() => users.id),
  type:            messageTypeEnum('type').notNull().default('text'),
  bodyEncrypted:   text('body_encrypted').notNull(),
  iv:              text('iv').notNull(),
  selfDestructAt:  timestamp('self_destruct_at', { withTimezone: true }),
  editedAt:        timestamp('edited_at', { withTimezone: true }),
  deletedAt:       timestamp('deleted_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  chatIdx:   index('messages_chat_idx').on(t.chatId),
  senderIdx: index('messages_sender_idx').on(t.senderId),
}))

// ── Message Edits ─────────────────────────────────────────────────────────────

export const messageEdits = pgTable('message_edits', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  messageId:             uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  previousBodyEncrypted: text('previous_body_encrypted').notNull(),
  editedAt:              timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Message Reactions ─────────────────────────────────────────────────────────

export const messageReactions = pgTable('message_reactions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji:     varchar('emoji', { length: 8 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  msgUserEmojiIdx: index('reactions_msg_user_emoji_idx').on(t.messageId, t.userId, t.emoji),
}))

// ── Attachments ───────────────────────────────────────────────────────────────

export const attachments = pgTable('attachments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  messageId:   uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  storageKey:  text('storage_key').notNull(),
  mimeType:    varchar('mime_type', { length: 100 }).notNull(),
  sizeBytes:   integer('size_bytes').notNull(),
  width:       integer('width'),
  height:      integer('height'),
  durationMs:  integer('duration_ms'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ── Call Logs ─────────────────────────────────────────────────────────────────

export const callLogs = pgTable('call_logs', {
  id:              uuid('id').primaryKey().defaultRandom(),
  chatId:          uuid('chat_id').notNull().references(() => chats.id),
  initiatedBy:     uuid('initiated_by').notNull().references(() => users.id),
  callType:        varchar('call_type', { length: 10 }).notNull(),
  startedAt:       timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt:         timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),
})

// ── Relations ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions:    many(sessions),
  devices:     many(devices),
  chatMembers: many(chatMembers),
  messages:    many(messages),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members:  many(chatMembers),
  messages: many(messages),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat:      one(chats,    { fields: [messages.chatId],   references: [chats.id] }),
  sender:    one(users,    { fields: [messages.senderId], references: [users.id] }),
  edits:     many(messageEdits),
  reactions: many(messageReactions),
  attachments: many(attachments),
}))
