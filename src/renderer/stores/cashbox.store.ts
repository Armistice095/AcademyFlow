import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { PaginatedResult } from '@shared/types/common.types'
import type { JournalFilters, Transaction } from '@shared/types/transaction.types'

interface CashboxState {
  balance: number
  journal: PaginatedResult<Transaction> | null
  isLoading: boolean
  lastFilters: JournalFilters

  loadBalance: () => Promise<void>
  loadJournal: (filters: JournalFilters) => Promise<void>
  refresh: () => Promise<void>
}

export const useCashboxStore = create<CashboxState>((set, get) => ({
  balance: 0,
  journal: null,
  isLoading: false,
  lastFilters: {},

  loadBalance: async () => {
    const balance = await api.cashbox.getBalance()
    set({ balance })
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
    await Promise.all([get().loadBalance(), get().loadJournal(get().lastFilters)])
  }
}))
