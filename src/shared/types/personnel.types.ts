export interface Employee {
  id: string
  lastName: string
  firstName: string
  /** Fonction occupée. */
  role: string
  phone: string | null
  monthlySalary: number
  isActive: boolean
  createdAt: string
}

export interface CreateEmployeeDTO {
  lastName: string
  firstName: string
  role: string
  phone?: string
  monthlySalary: number
}

export type UpdateEmployeeDTO = Partial<CreateEmployeeDTO>

// ---------------------------------------------------------------------------
// Suivi mensuel des salaires (F-023, F-024)
// ---------------------------------------------------------------------------

export interface SalaryPayment {
  id: string
  employeeId: string
  schoolYearId: string
  month: number
  year: number
  transactionId: string
  paidAt: string
}

/** État payé/non-payé d'un employé pour un mois donné. */
export interface SalaryMonthStatus {
  employeeId: string
  month: number
  year: number
  isPaid: boolean
  paymentId?: string
}
