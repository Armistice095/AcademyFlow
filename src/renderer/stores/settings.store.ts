import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { SchoolClass, SchoolYear } from '@shared/types/settings.types'

interface SettingsState {
  currentSchoolYear: SchoolYear | null
  schoolYears: SchoolYear[]
  classes: SchoolClass[]
  isLoading: boolean

  loadCurrentSchoolYear: () => Promise<void>
  loadSchoolYears: () => Promise<void>
  loadClasses: () => Promise<void>
  createSchoolYear: (label: string) => Promise<SchoolYear>
  setCurrentSchoolYear: (yearId: string) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  currentSchoolYear: null,
  schoolYears: [],
  classes: [],
  isLoading: false,

  loadCurrentSchoolYear: async () => {
    const currentSchoolYear = await api.settings.getCurrentSchoolYear()
    set({ currentSchoolYear })
  },

  loadSchoolYears: async () => {
    set({ isLoading: true })
    try {
      const schoolYears = await api.settings.listSchoolYears()
      const currentSchoolYear = schoolYears.find((year) => year.isCurrent) ?? null
      set({ schoolYears, currentSchoolYear })
    } finally {
      set({ isLoading: false })
    }
  },

  loadClasses: async () => {
    const classes = await api.settings.getClasses()
    set({ classes })
  },

  createSchoolYear: async (label) => {
    const year = await api.settings.createSchoolYear(label)
    await get().loadSchoolYears()
    return year
  },

  setCurrentSchoolYear: async (yearId) => {
    await api.settings.setCurrentSchoolYear(yearId)
    await get().loadSchoolYears()
  }
}))
