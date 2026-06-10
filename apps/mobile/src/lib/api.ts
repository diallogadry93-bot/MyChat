import * as SecureStore from 'expo-secure-store'

const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('mychat_access_token')
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync('mychat_refresh_token')
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync('mychat_access_token', access),
    SecureStore.setItemAsync('mychat_refresh_token', refresh),
  ])
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync('mychat_access_token'),
    SecureStore.deleteItemAsync('mychat_refresh_token'),
  ])
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
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
  user:         { id: string; email: string; displayName: string; avatarUrl: string | null }
  accessToken:  string
  refreshToken: string
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; displayName: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me:    (token: string) =>
      request<{ user: AuthResponse['user'] }>('/api/auth/me', { token }),
    logout: (token: string, refreshToken: string) =>
      request<void>('/api/auth/logout', { method: 'POST', token, body: JSON.stringify({ refreshToken }) }),
    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST', body: JSON.stringify({ refreshToken }),
      }),
  },
  chats: {
    list:   (token: string) => request<{ chats: unknown[] }>('/api/chats', { token }),
    create: (token: string, body: { type: string; memberIds: string[]; name?: string }) =>
      request<{ chat: unknown }>('/api/chats', { method: 'POST', token, body: JSON.stringify(body) }),
  },
  messages: {
    list: (token: string, chatId: string, before?: string) =>
      request<{ messages: unknown[]; hasMore: boolean }>(
        `/api/chats/${chatId}/messages${before ? `?before=${before}` : ''}`, { token }
      ),
    send: (token: string, chatId: string, body: { bodyEncrypted: string; iv: string; type?: string; selfDestructSeconds?: number }) =>
      request<{ message: unknown }>(`/api/chats/${chatId}/messages`, {
        method: 'POST', token, body: JSON.stringify(body),
      }),
    react: (token: string, messageId: string, emoji: string) =>
      request<{ reactions: unknown[] }>(`/api/messages/${messageId}/reactions`, {
        method: 'POST', token, body: JSON.stringify({ emoji }),
      }),
  },
}
