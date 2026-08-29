import { useEffect, useState } from 'react'
import type { PaginationState } from '@tanstack/react-table'
import { useStudentsStore } from '@renderer/stores/students.store'

export interface UseStudentsOptions {
  classId?: string
  schoolYearId?: string
}

/** Encapsule la recherche élèves (texte + filtre classe), la pagination serveur, et son état de chargement. */
export function useStudents(options: UseStudentsOptions = {}): {
  query: string
  setQuery: (value: string) => void
  results: ReturnType<typeof useStudentsStore.getState>['results']
  isLoading: boolean
  refresh: () => Promise<void>
  pagination: PaginationState
  setPagination: (pagination: PaginationState) => void
} {
  const { results, isLoading, search, refresh } = useStudentsStore()
  const [query, setQueryState] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })

  useEffect(() => {
    void search({
      query,
      classId: options.classId,
      schoolYearId: options.schoolYearId,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options.classId, options.schoolYearId, pagination])

  // Revenir à la page 1 dès qu'un filtre (hors pagination) change.
  const setQuery = (value: string): void => {
    setQueryState(value)
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [options.classId, options.schoolYearId])

  return { query, setQuery, results, isLoading, refresh, pagination, setPagination }
}

/**
 * Cartes KPI (effectifs) de la liste des élèves — se recalculent
 * automatiquement lorsque `classId` ou `schoolYearId` changent.
 */
export function useStudentStats(options: UseStudentsOptions = {}): {
  stats: ReturnType<typeof useStudentsStore.getState>['stats']
  isLoading: boolean
} {
  const { stats, isStatsLoading, loadStats } = useStudentsStore()

  useEffect(() => {
    void loadStats({ classId: options.classId, schoolYearId: options.schoolYearId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.classId, options.schoolYearId])

  return { stats, isLoading: isStatsLoading }
}
