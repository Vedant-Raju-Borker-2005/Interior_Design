import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '@/lib/api'

export type UserRole = 'customer' | 'vendor' | 'team' | 'admin'

interface User {
  id?: string
  name?: string
  phone?: string
  email?: string
  city?: string
  style_tags?: string[]
  budget_min?: number
  budget_max?: number
  furnishing_preference?: string
  furnishing_type?: string
  role?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  role: UserRole
  setToken: (token: string, userId: string) => void
  setUser: (user: User) => void
  setRole: (role: UserRole) => void
  logout: () => void
  fetchMe: () => Promise<void>
  getPortalPath: () => string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      role: 'customer',

      setToken: (token: string, userId: string) => {
        localStorage.setItem('access_token', token)
        set({ token, isLoggedIn: true, user: { id: userId } })
      },

      setUser: (user: User) => {
        set({ user, role: user.role || 'customer' })
      },

      setRole: (role: UserRole) => set({ role }),

      logout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('active_user')
        set({ user: null, token: null, isLoggedIn: false, role: 'customer' })
      },

      fetchMe: async () => {
        try {
          const res = await authAPI.me()
          set({ user: res.data, isLoggedIn: true, role: res.data.role || 'customer' })
        } catch {
          get().logout()
        }
      },

      getPortalPath: () => {
        const role = get().role
        if (role === 'vendor') return '/vendor/dashboard'
        if (role === 'team') return '/team'
        if (role === 'admin') return '/admin'
        return '/dashboard'
      },
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({ token: s.token, user: s.user, isLoggedIn: s.isLoggedIn, role: s.role }),
    }
  )
)
