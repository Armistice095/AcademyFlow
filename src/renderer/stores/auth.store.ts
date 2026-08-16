import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { AuthUser } from '@shared/types/common.types'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  error: string | null

  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  /** Resynchronise l'état local avec la session réelle du process main (ex: après un HMR en dev). */
  refreshCurrentUser: () => Promise<void>
  /** Met à jour le flag `mustChangePassword` localement, sans aller-retour IPC. */
  markPasswordChanged: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  login: async (username, password) => {
    set({ status: 'loading', error: null })
    try {
      const user = await api.auth.login(username, password)
      set({ user, status: 'authenticated', error: null })
      return true
    } catch (error) {
      set({
        status: 'unauthenticated',
        error: error instanceof Error ? error.message : 'Erreur de connexion.'
      })
      return false
    }
  },

  logout: async () => {
    try {
      await api.auth.logout()
    } finally {
      set({ user: null, status: 'unauthenticated', error: null })
    }
  },

  refreshCurrentUser: async () => {
    try {
      const user = await api.auth.getCurrentUser()
      set({ user, status: user ? 'authenticated' : 'unauthenticated' })
    } catch {
      set({ user: null, status: 'unauthenticated' })
    }
  },

  markPasswordChanged: () =>
    set((state) => ({ user: state.user ? { ...state.user, mustChangePassword: false } : null })),

  clearError: () => set({ error: null })
}))
