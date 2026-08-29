import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { PaginatedResult } from '@shared/types/common.types'
import type {
  StudentListItem,
  StudentSearchQuery,
  StudentStats,
  StudentStatsQuery
} from '@shared/types/student.types'

interface StudentsState {
  results: PaginatedResult<StudentListItem> | null
  isLoading: boolean
  lastQuery: StudentSearchQuery

  stats: StudentStats | null
  isStatsLoading: boolean

  search: (query: StudentSearchQuery) => Promise<void>
  refresh: () => Promise<void>
  loadStats: (query?: StudentStatsQuery) => Promise<void>
}

export const useStudentsStore = create<StudentsState>((set, get) => ({
  results: null,
  isLoading: false,
  lastQuery: {},

  stats: null,
  isStatsLoading: false,

  search: async (query) => {
    set({ isLoading: true, lastQuery: query })
    try {
      const results = await api.students.search(query)
      set({ results })
    } finally {
      set({ isLoading: false })
    }
  },

  refresh: async () => {
    await get().search(get().lastQuery)
    await get().loadStats({
      classId: get().lastQuery.classId,
      schoolYearId: get().lastQuery.schoolYearId
    })
  },

  loadStats: async (query = {}) => {
    set({ isStatsLoading: true })
    try {
      const stats = await api.students.getStats(query)
      set({ stats })
    } finally {
      set({ isStatsLoading: false })
    }
  }
}))
