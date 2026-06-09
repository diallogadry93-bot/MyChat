const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }
  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText })) as { message?: string }
    throw new ApiError(res.status, error.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export interface AuthResponse {
  user: { id: string; email: string; displayName: string; avatarUrl: string | null }
  accessToken: string
  refreshToken: string
}

export const api = {
  auth: {
    register:  (body: { email: string; password: string; displayName: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login:     (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
    me:        (token: string) =>
      request<{ user: AuthResponse['user'] }>('/api/auth/me', { token }),
    logout:    (token: string, refreshToken: string) =>
      request<void>('/api/auth/logout', { method: 'POST', token, body: JSON.stringify({ refreshToken }) }),
    refresh:   (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST', body: JSON.stringify({ refreshToken }),
      }),
  },

  chats: {
    list: (token: string) =>
      request<{ chats: unknown[] }>('/api/chats', { token }),
    get:  (token: string, chatId: string) =>
      request<{ chat: unknown }>(`/api/chats/${chatId}`, { token }),
    create: (token: string, body: { type: string; memberIds: string[]; name?: string }) =>
      request<{ chat: unknown; existing: boolean }>('/api/chats', { method: 'POST', token, body: JSON.stringify(body) }),
    leave: (token: string, chatId: string) =>
      request<void>(`/api/chats/${chatId}/members/me`, { method: 'DELETE', token }),
  },

  messages: {
    list: (token: string, chatId: string, before?: string) =>
      request<{ messages: unknown[]; hasMore: boolean; nextCursor: string | null }>(
        `/api/chats/${chatId}/messages${before ? `?before=${before}` : ''}`, { token }
      ),
    send: (token: string, chatId: string, body: { bodyEncrypted: string; iv: string; type?: string; selfDestructSeconds?: number }) =>
      request<{ message: unknown }>(`/api/chats/${chatId}/messages`, { method: 'POST', token, body: JSON.stringify(body) }),
    edit: (token: string, messageId: string, body: { bodyEncrypted: string; iv: string }) =>
      request<{ message: unknown }>(`/api/messages/${messageId}`, { method: 'PATCH', token, body: JSON.stringify(body) }),
    delete: (token: string, messageId: string) =>
      request<void>(`/api/messages/${messageId}`, { method: 'DELETE', token }),
    react: (token: string, messageId: string, emoji: string) =>
      request<{ toggled: string; reactions: unknown[] }>(`/api/messages/${messageId}/reactions`, {
        method: 'POST', token, body: JSON.stringify({ emoji }),
      }),
    edits: (token: string, messageId: string) =>
      request<{ edits: unknown[] }>(`/api/messages/${messageId}/edits`, { token }),
    uploadUrl: (token: string, body: { filename: string; contentType: string; folder: string }) =>
      request<{ uploadUrl: string; storageKey: string }>('/api/upload-url', {
        method: 'POST', token, body: JSON.stringify(body),
      }),
  },
}

// ── AI endpoints ──────────────────────────────────────────
type ToneLabel = 'friendly' | 'formal' | 'tense' | 'urgent' | 'neutral'

interface SmartReply { text: string; tone: string }
interface SummaryResult { bullets: string[]; timeRange: string; count: number }

// Extend api object (module augmentation pattern)
Object.assign(api, {
  ai: {
    summary: (token: string, chatId: string, limit = 50) =>
      request<{ summary: SummaryResult | null; reason?: string }>(
        `/api/ai/summary/${chatId}?limit=${limit}`, { token }
      ),
    smartReplies: (token: string, chatId: string, lang = 'en') =>
      request<{ replies: SmartReply[] }>('/api/ai/smart-replies', {
        method: 'POST', token, body: JSON.stringify({ chatId, lang }),
      }),
    tone: (token: string, text: string) =>
      request<{ tone: ToneLabel }>('/api/ai/tone', {
        method: 'POST', token, body: JSON.stringify({ text }),
      }),
    translate: (token: string, messageId: string, targetLanguage: string) =>
      request<{ translated: string; targetLanguage: string; messageId: string }>('/api/ai/translate', {
        method: 'POST', token, body: JSON.stringify({ messageId, targetLanguage }),
      }),
  },
})
