import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { Employee, SalaryMonthStatus } from '@shared/types/personnel.types'

interface PersonnelState {
  employees: Employee[]
  isLoading: boolean

  salaryStatus: SalaryMonthStatus[]
  salaryStatusMonth: number | null
  salaryStatusYear: number | null
  isLoadingSalaryStatus: boolean

  loadEmployees: () => Promise<void>
  loadSalaryStatus: (month: number, year: number) => Promise<void>
  refreshSalaryStatus: () => Promise<void>
}

export const usePersonnelStore = create<PersonnelState>((set, get) => ({
  employees: [],
  isLoading: false,

  salaryStatus: [],
  salaryStatusMonth: null,
  salaryStatusYear: null,
  isLoadingSalaryStatus: false,

  loadEmployees: async () => {
    set({ isLoading: true })
    try {
      const employees = await api.personnel.list()
      set({ employees })
    } finally {
      set({ isLoading: false })
    }
  },

  loadSalaryStatus: async (month, year) => {
    set({ isLoadingSalaryStatus: true, salaryStatusMonth: month, salaryStatusYear: year })
    try {
      const salaryStatus = await api.personnel.getSalaryStatus(month, year)
      set({ salaryStatus })
    } finally {
      set({ isLoadingSalaryStatus: false })
    }
  },

  refreshSalaryStatus: async () => {
    const { salaryStatusMonth, salaryStatusYear } = get()
    if (salaryStatusMonth === null || salaryStatusYear === null) return
    await get().loadSalaryStatus(salaryStatusMonth, salaryStatusYear)
  }
}))
