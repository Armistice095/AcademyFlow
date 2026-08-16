import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { PaginatedResult } from '@shared/types/common.types'
import type { StudentListItem, StudentSearchQuery } from '@shared/types/student.types'

interface StudentsState {
  results: PaginatedResult<StudentListItem> | null
  isLoading: boolean
  lastQuery: StudentSearchQuery

  search: (query: StudentSearchQuery) => Promise<void>
  refresh: () => Promise<void>
}

export const useStudentsStore = create<StudentsState>((set, get) => ({
  results: null,
  isLoading: false,
  lastQuery: {},

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
  }
}))
