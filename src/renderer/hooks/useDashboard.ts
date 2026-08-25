import { useEffect } from 'react'
import { useDashboardStore } from '@renderer/stores/dashboard.store'
import type { DashboardStats } from '@shared/types/dashboard.types'

/** Rafraîchissement automatique — le tableau de bord reste ouvert longtemps en pratique (écran d'accueil). */
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/** Charge les statistiques du tableau de bord et les rafraîchit périodiquement. */
export function useDashboard(): {
  stats: DashboardStats | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
} {
  const { stats, isLoading, error, loadStats } = useDashboardStore()

  useEffect(() => {
    void loadStats()
    const interval = setInterval(() => void loadStats(), AUTO_REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { stats, isLoading, error, refresh: loadStats }
}
