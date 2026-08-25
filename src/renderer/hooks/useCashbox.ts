import { useEffect } from 'react'
import { useCashboxStore } from '@renderer/stores/cashbox.store'
import type { JournalFilters } from '@shared/types/transaction.types'

/** Charge les cartes KPI + le journal filtré, et les recharge à chaque changement de filtres. */
export function useCashbox(filters: JournalFilters): {
  stats: ReturnType<typeof useCashboxStore.getState>['stats']
  journal: ReturnType<typeof useCashboxStore.getState>['journal']
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const { stats, journal, isLoading, loadStats, loadJournal, refresh } = useCashboxStore()

  useEffect(() => {
    void loadStats(filters.schoolYearId)
    void loadJournal(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.category, filters.studentId, filters.dateFrom, filters.dateTo, filters.query, filters.schoolYearId])

  return { stats, journal, isLoading, refresh }
}
