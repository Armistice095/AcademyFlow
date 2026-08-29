import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import { computeRange, type ReportPeriod } from '@renderer/lib/reportPeriod'
import type { CashCategory } from '@shared/constants/categories'
import type { CashReportV2 } from '@shared/types/transaction.types'

/**
 * Filtres de la page Rapports, tels que manipulés par `ReportFilterBar`.
 * Distincts de `ReportFilters` (shared/types) : ici `period` pilote le calcul
 * de `from`/`to` côté frontend, et `from`/`to` restent éditables uniquement
 * en mode "Personnalisé".
 */
export interface ReportsUiFilters {
  period: ReportPeriod
  from: string
  to: string
  classId?: string
  category?: CashCategory
  userId?: string
}

function defaultFilters(): ReportsUiFilters {
  const range = computeRange('month', { from: '', to: '' })
  return { period: 'month', from: range.from, to: range.to }
}

interface ReportsState {
  filters: ReportsUiFilters
  /**
   * Rapport de la Vue générale — partagé au niveau du store le temps que les
   * 5 autres onglets restent des placeholders (Phase 3, voir le plan). Une
   * fois ces onglets implémentés avec leurs propres agrégats backend, ce
   * champ pourra être scindé par onglet.
   */
  report: CashReportV2 | null
  isLoading: boolean
  error: string | null

  setFilters: (partial: Partial<ReportsUiFilters>) => void
  resetFilters: () => void
  loadReport: () => Promise<void>
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  filters: defaultFilters(),
  report: null,
  isLoading: false,
  error: null,

  setFilters: (partial) => {
    set((state) => {
      const next = { ...state.filters, ...partial }
      // Changer de période (hors "Personnalisé") recalcule immédiatement from/to,
      // pour que le rapport se recharge avec les bonnes bornes sans étape supplémentaire.
      if (partial.period && partial.period !== 'custom') {
        const range = computeRange(partial.period, { from: next.from, to: next.to })
        next.from = range.from
        next.to = range.to
      }
      return { filters: next }
    })
  },

  resetFilters: () => set({ filters: defaultFilters() }),

  loadReport: async () => {
    const { filters } = get()
    if (filters.period === 'custom' && (!filters.from || !filters.to)) return

    set({ isLoading: true, error: null })
    try {
      const report = await api.cashbox.getReportV2({
        from: filters.from,
        to: filters.to,
        classId: filters.classId,
        category: filters.category,
        userId: filters.userId
      })
      set({ report })
    } catch {
      set({ error: 'Impossible de charger le rapport.' })
    } finally {
      set({ isLoading: false })
    }
  }
}))
