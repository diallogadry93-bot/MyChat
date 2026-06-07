'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'
import type { AuthResponse } from './api'

interface AuthState {
  user: AuthResponse['user'] | null
  accessToken: string | null
  refreshToken: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null, accessToken: null, refreshToken: null, isLoading: true,
  })

  // Restore session from localStorage on mount
  useEffect(() => {
    const accessToken = localStorage.getItem('mychat_access_token')
    const refreshToken = localStorage.getItem('mychat_refresh_token')
    if (accessToken && refreshToken) {
      api.auth.me(accessToken)
        .then(({ user }) => setState({ user, accessToken, refreshToken, isLoading: false }))
        .catch(() => {
          localStorage.removeItem('mychat_access_token')
          localStorage.removeItem('mychat_refresh_token')
          setState(s => ({ ...s, isLoading: false }))
        })
    } else {
      setState(s => ({ ...s, isLoading: false }))
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password })
    localStorage.setItem('mychat_access_token', res.accessToken)
    localStorage.setItem('mychat_refresh_token', res.refreshToken)
    setState({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken, isLoading: false })
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.auth.register({ email, password, displayName })
    localStorage.setItem('mychat_access_token', res.accessToken)
    localStorage.setItem('mychat_refresh_token', res.refreshToken)
    setState({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken, isLoading: false })
  }, [])

  const logout = useCallback(async () => {
    const { accessToken, refreshToken } = state
    if (accessToken && refreshToken) {
      await api.auth.logout(accessToken, refreshToken).catch(() => {})
    }
    localStorage.removeItem('mychat_access_token')
    localStorage.removeItem('mychat_refresh_token')
    setState({ user: null, accessToken: null, refreshToken: null, isLoading: false })
  }, [state])

  return <AuthContext.Provider value={{ ...state, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
