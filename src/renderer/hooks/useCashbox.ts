import { useEffect } from 'react'
import { useCashboxStore } from '@renderer/stores/cashbox.store'
import type { JournalFilters } from '@shared/types/transaction.types'

/** Charge le solde + le journal filtré, et les recharge à chaque changement de filtres. */
export function useCashbox(filters: JournalFilters): {
  balance: number
  journal: ReturnType<typeof useCashboxStore.getState>['journal']
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const { balance, journal, isLoading, loadBalance, loadJournal, refresh } = useCashboxStore()

  useEffect(() => {
    void loadBalance()
    void loadJournal(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.category, filters.studentId, filters.dateFrom, filters.dateTo, filters.query])

  return { balance, journal, isLoading, refresh }
}
