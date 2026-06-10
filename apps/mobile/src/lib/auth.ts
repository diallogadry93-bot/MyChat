import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'

import { api, getAccessToken, getRefreshToken, saveTokens, clearTokens } from './api'
import type { AuthResponse } from './api'

interface AuthState {
  user:         AuthResponse['user'] | null
  accessToken:  string | null
  isLoading:    boolean
  isLocked:     boolean
}

interface AuthContextValue extends AuthState {
  login:    (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout:   () => Promise<void>
  unlock:   () => Promise<boolean>
}

// React context — used by screens
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export function useAuthState(): AuthState & {
  login:    AuthContextValue['login']
  register: AuthContextValue['register']
  logout:   AuthContextValue['logout']
  unlock:   AuthContextValue['unlock']
} {
  const [state, setState] = useState<AuthState>({
    user: null, accessToken: null, isLoading: true, isLocked: false,
  })

  useEffect(() => {
    void (async () => {
      const [token, refresh] = await Promise.all([getAccessToken(), getRefreshToken()])
      if (token && refresh) {
        try {
          const { user } = await api.auth.me(token)
          setState({ user, accessToken: token, isLoading: false, isLocked: false })
        } catch {
          // Try refresh
          try {
            const { accessToken: newToken, refreshToken: newRefresh } = await api.auth.refresh(refresh)
            await saveTokens(newToken, newRefresh)
            const { user } = await api.auth.me(newToken)
            setState({ user, accessToken: newToken, isLoading: false, isLocked: false })
          } catch {
            await clearTokens()
            setState({ user: null, accessToken: null, isLoading: false, isLocked: false })
          }
        }
      } else {
        setState(s => ({ ...s, isLoading: false }))
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login({ email, password })
    await saveTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, accessToken: res.accessToken, isLoading: false, isLocked: false })
  }, [])

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.auth.register({ email, password, displayName })
    await saveTokens(res.accessToken, res.refreshToken)
    setState({ user: res.user, accessToken: res.accessToken, isLoading: false, isLocked: false })
  }, [])

  const logout = useCallback(async () => {
    const [token, refresh] = await Promise.all([getAccessToken(), getRefreshToken()])
    if (token && refresh) await api.auth.logout(token, refresh).catch(() => {})
    await clearTokens()
    setState({ user: null, accessToken: null, isLoading: false, isLocked: false })
  }, [])

  const unlock = useCallback(async (): Promise<boolean> => {
    const supported = await LocalAuthentication.hasHardwareAsync()
    const enrolled  = await LocalAuthentication.isEnrolledAsync()
    if (!supported || !enrolled) return true

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock MyChat',
      fallbackLabel: 'Use passcode',
    })
    if (result.success) setState(s => ({ ...s, isLocked: false }))
    return result.success
  }, [])

  return { ...state, login, register, logout, unlock }
}
