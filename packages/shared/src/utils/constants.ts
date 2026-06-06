export const APP_NAME = 'MyChat'
export const APP_VERSION = '0.1.0'

export const JWT_ACCESS_EXPIRY = '15m'
export const JWT_REFRESH_EXPIRY = '30d'

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB
export const MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_MESSAGE_LENGTH = 65536

export const SELF_DESTRUCT_OPTIONS = [5, 30, 60, 300, 3600, 86400] as const // seconds

export const WS_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  // Presence
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  // Messages
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_REACTION: 'message:reaction',
  // Typing
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  // Calls
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',
  CALL_ICE: 'call:ice',
  CALL_END: 'call:end',
} as const
