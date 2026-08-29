import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { PaginatedResult } from '@shared/types/common.types'
import type {
  CashboxStats,
  JournalFilters,
  JournalTransaction
} from '@shared/types/transaction.types'

interface CashboxState {
  stats: CashboxStats | null
  journal: PaginatedResult<JournalTransaction> | null
  isLoading: boolean
  lastFilters: JournalFilters

  loadStats: (schoolYearId?: string) => Promise<void>
  loadJournal: (filters: JournalFilters) => Promise<void>
  refresh: () => Promise<void>
}

export const useCashboxStore = create<CashboxState>((set, get) => ({
  stats: null,
  journal: null,
  isLoading: false,
  lastFilters: {},

  loadStats: async (schoolYearId) => {
    const stats = await api.cashbox.getStats(schoolYearId)
    set({ stats })
  },

  loadJournal: async (filters) => {
    set({ isLoading: true, lastFilters: filters })
    try {
      const journal = await api.cashbox.getJournal(filters)
      set({ journal })
    } finally {
      set({ isLoading: false })
    }
  },

  refresh: async () => {
    const filters = get().lastFilters
    await Promise.all([get().loadStats(filters.schoolYearId), get().loadJournal(filters)])
  }
}))
