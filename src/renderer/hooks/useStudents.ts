import { useEffect, useState } from 'react'
import { useStudentsStore } from '@renderer/stores/students.store'

export interface UseStudentsOptions {
  classId?: string
  schoolYearId?: string
}

/** Encapsule la recherche élèves (texte + filtre classe) et son état de chargement. */
export function useStudents(options: UseStudentsOptions = {}): {
  query: string
  setQuery: (value: string) => void
  results: ReturnType<typeof useStudentsStore.getState>['results']
  isLoading: boolean
  refresh: () => Promise<void>
} {
  const { results, isLoading, search, refresh } = useStudentsStore()
  const [query, setQuery] = useState('')

  useEffect(() => {
    void search({ query, classId: options.classId, schoolYearId: options.schoolYearId })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, options.classId, options.schoolYearId])

  return { query, setQuery, results, isLoading, refresh }
}
