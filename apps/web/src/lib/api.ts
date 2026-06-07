const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
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
  user: { id: string; email: string; displayName: string; avatarUrl: string | null }
  accessToken: string
  refreshToken: string
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; displayName: string }) =>
      request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),

    me: (token: string) =>
      request<{ user: AuthResponse['user'] }>('/api/auth/me', { token }),

    logout: (token: string, refreshToken: string) =>
      request<void>('/api/auth/logout', {
        method: 'POST', token, body: JSON.stringify({ refreshToken }),
      }),

    refresh: (refreshToken: string) =>
      request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
        method: 'POST', body: JSON.stringify({ refreshToken }),
      }),
  },
}
