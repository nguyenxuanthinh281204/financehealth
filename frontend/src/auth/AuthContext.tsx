import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler, tokenStore } from '../api/client'
import type { AuthResponse, User } from '../api/types'
import { applyTheme } from '../lib/theme'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  /** Cập nhật user sau khi đổi cài đặt; kèm token khi đổi mật khẩu. */
  updateUser: (user: User, token?: string) => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => !!tokenStore.get())

  const logout = useCallback(() => {
    tokenStore.set(null)
    setUser(null)
    qc.clear()
  }, [qc])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) return
    api.get<User>('/api/me').then(setUser).catch(() => logout()).finally(() => setLoading(false))
  }, [logout])

  useEffect(() => {
    if (user) applyTheme(user.themeMode, user.accentColor)
  }, [user])

  const accept = (r: AuthResponse) => {
    tokenStore.set(r.token)
    setUser(r.user)
  }

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    logout,
    updateUser: (u, token) => {
      if (token) tokenStore.set(token)
      setUser(u)
    },
    login: async (email, password) => accept(await api.post<AuthResponse>('/api/auth/login', { email, password })),
    register: async (email, password, displayName) =>
      accept(await api.post<AuthResponse>('/api/auth/register', { email, password, displayName })),
  }), [user, loading, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth phải nằm trong AuthProvider')
  return v
}
