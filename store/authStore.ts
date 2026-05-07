/**
 * @fileoverview Zustand auth store — global authentication state with
 * full user profile including name, role, and status.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../lib/api';

interface UserProfile {
  id: string;
  email: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  isActive: boolean;
  fullName?: string;
  profile?: { firstName: string; lastName: string; department?: string };
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login(email, password);
          const token = data.data.accessToken;
          localStorage.setItem('accessToken', token);
          set({ accessToken: token, user: data.data.user, isLoading: false });
        } catch (err: unknown) {
          const resData = (err as any)?.response?.data;
          let message = resData?.message || resData?.detail || 'Login failed';

          if (resData?.code === 'VALIDATION_ERROR' && resData.errors) {
            const errorDetails = Object.entries(resData.errors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join(' | ');
            message = `${message} - ${errorDetails}`;
          }

          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.register(data);
          set({ isLoading: false });
          // Auto-login after successful registration
          if (data.email && typeof data.password === 'string') {
            await get().login(data.email as string, data.password);
          }
        } catch (err: unknown) {
          const resData = (err as any)?.response?.data;
          let message = resData?.message || resData?.detail || 'Registration failed';

          // Handle validation errors (422)
          if (resData?.detail && Array.isArray(resData.detail)) {
            message = resData.detail
              .map((d: any) => d.msg || d.message || JSON.stringify(d))
              .join(' | ');
          } else if (resData?.code === 'VALIDATION_ERROR' && resData.errors) {
            const errorDetails = Object.entries(resData.errors)
              .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(', ')}`)
              .join(' | ');
            message = `${message} - ${errorDetails}`;
          }

          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try { await authApi.logout(); } catch { /* ignore */ }
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null });
        window.location.href = '/';
      },

      loadUser: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        set({ isLoading: true });
        try {
          const user = await authApi.me();
          set({ user, accessToken: token, isLoading: false });
        } catch {
          localStorage.removeItem('accessToken');
          set({ user: null, accessToken: null, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'sms-auth',
      partialize: (state) => ({ accessToken: state.accessToken }),
    },
  ),
);

/** Convenience selectors */
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAdmin = () => useAuthStore((s) => s.user?.role === 'ADMIN');
export const useIsInstructor = () =>
  useAuthStore((s) => s.user?.role === 'ADMIN' || s.user?.role === 'INSTRUCTOR');
