import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { DashboardStats } from '@shared/types/dashboard.types'

interface DashboardState {
  stats: DashboardStats | null
  isLoading: boolean
  error: string | null

  loadStats: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  isLoading: false,
  error: null,

  loadStats: async () => {
    set({ isLoading: true, error: null })
    try {
      const stats = await api.dashboard.getStats()
      set({ stats })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Erreur inconnue.' })
    } finally {
      set({ isLoading: false })
    }
  }
}))
