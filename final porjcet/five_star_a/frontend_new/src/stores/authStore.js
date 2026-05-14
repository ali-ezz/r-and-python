import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { API_BASE } from '../services/config'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: true,

      login: async (username, password) => {
        try {
          const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Login failed' }))
            let errMsg = err.detail
            if (Array.isArray(err.detail)) {
              errMsg = err.detail.map(e => `${e.loc[e.loc.length - 1]}: ${e.msg}`).join(', ')
            }
            return { success: false, error: errMsg || 'Login failed' }
          }
          const data = await res.json()
          set({
            token: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
            loading: false,
          })
          // Fetch user profile
          const userRes = await fetch(`${API_BASE}/users/me`, {
            headers: { Authorization: `Bearer ${data.access_token}` },
          })
          if (userRes.ok) {
            const user = await userRes.json()
            set({ user })
          }
          return { success: true }
        } catch (error) {
          set({ loading: false })
          return { success: false, error: 'Cannot connect to server' }
        }
      },

      register: async (userData) => {
        try {
          const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userData.email,
              username: userData.username,
              password: userData.password,
              confirm_password: userData.confirmPassword,
              full_name: userData.full_name,
            }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Registration failed' }))
            let errMsg = err.detail
            if (Array.isArray(err.detail)) {
              errMsg = err.detail.map(e => `${e.loc?.[e.loc.length - 1] || ''}: ${e.msg}`).join(', ')
            } else if (Array.isArray(err.errors)) {
              errMsg = err.errors.map(e => `${e.loc?.[e.loc.length - 1] || ''}: ${e.msg}`).join(', ')
            }
            return { success: false, error: errMsg || 'Registration failed' }
          }
          const data = await res.json()
          set({
            token: data.token?.access_token || data.access_token,
            refreshToken: data.token?.refresh_token || data.refresh_token,
            user: data.user,
            isAuthenticated: true,
            loading: false,
          })
          return { success: true }
        } catch (error) {
          set({ loading: false })
          return { success: false, error: 'Cannot connect to server' }
        }
      },

      logout: () => {
        // Only clear state, let zustand persist handle localStorage
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false })
        localStorage.removeItem('auth-storage')
      },

      updateProfile: (data) => set((state) => ({ user: { ...state.user, ...data } })),

      checkAuth: () => {
        const state = get()
        const token = state.token
        if (!token) {
          // No token = not authenticated, not an error
          set({ loading: false, isAuthenticated: false, user: null })
          return Promise.resolve()
        }
        // Set a timeout to prevent hanging
        const timeout = setTimeout(() => {
          set({ loading: false, isAuthenticated: false, token: null, refreshToken: null, user: null })
        }, 5000)

        return fetch(`${API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then(async (res) => {
            clearTimeout(timeout)
            if (res.status === 401) {
              // Token expired - try refresh
              const refreshToken = state.refreshToken
              if (!refreshToken) {
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false })
                localStorage.removeItem('auth-storage')
                return
              }
              try {
                const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_token: refreshToken }),
                })
                if (!refreshRes.ok) throw new Error('Refresh failed')
                const refreshData = await refreshRes.json()
                set({
                  token: refreshData.access_token,
                  refreshToken: refreshData.refresh_token,
                })
                // Retry the original request
                const retryRes = await fetch(`${API_BASE}/users/me`, {
                  headers: { Authorization: `Bearer ${refreshData.access_token}` },
                })
                if (!retryRes.ok) throw new Error('Retry failed')
                const user = await retryRes.json()
                set({ user, isAuthenticated: true, loading: false })
              } catch (refreshErr) {
                set({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false })
                localStorage.removeItem('auth-storage')
              }
              return
            }
            if (!res.ok) {
              set({ user: null, token: null, refreshToken: null, isAuthenticated: false, loading: false })
              localStorage.removeItem('auth-storage')
              return
            }
            const user = await res.json()
            set({ user, isAuthenticated: true, loading: false })
          })
          .catch(() => {
            clearTimeout(timeout)
            // Network error - keep token but mark loading as done
            set({ loading: false })
          })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
      // Skip persisting `user` object since we always fetch it fresh
    }
  )
)
