import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '@/lib/api'

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
}

interface AuthState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  setToken: (token: string, userId: string) => void
  setUser: (user: User) => void
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoggedIn: false,

      setToken: (token: string, userId: string) => {
        localStorage.setItem('access_token', token)
        set({ token, isLoggedIn: true, user: { id: userId } })
      },

      setUser: (user: User) => set({ user }),

      logout: () => {
        localStorage.removeItem('access_token')
        set({ user: null, token: null, isLoggedIn: false })
      },

      fetchMe: async () => {
        try {
          const res = await authAPI.me()
          set({ user: res.data, isLoggedIn: true })
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (s) => ({ token: s.token, user: s.user, isLoggedIn: s.isLoggedIn }),
    }
  )
)
