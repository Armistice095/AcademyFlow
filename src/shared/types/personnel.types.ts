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

/**
 * État payé/non-payé d'un employé pour un mois donné (F-023).
 * Embarque la fiche employé complète pour éviter un aller-retour IPC
 * supplémentaire côté renderer (grille de suivi mensuel).
 */
export interface SalaryMonthStatus {
  employee: Employee
  month: number
  year: number
  isPaid: boolean
  paymentId?: string
  paidAt?: string
  /** Montant de l'avance `pending` de l'employé, le cas échéant (F-026, BR-010). */
  pendingAdvanceAmount?: number
}

/** Ligne d'historique de paiement pour un employé donné (F-024). */
export interface SalaryHistoryEntry {
  id: string
  month: number
  year: number
  /** Montant réellement versé (celui du salaire au moment du paiement). */
  amount: number
  paidAt: string
  transactionId: string
}

// ---------------------------------------------------------------------------
// Avances sur salaire (F-026, BR-010)
// ---------------------------------------------------------------------------

export type SalaryAdvanceStatus = 'pending' | 'deducted' | 'cancelled'

export interface SalaryAdvance {
  id: string
  employeeId: string
  amount: number
  reason: string | null
  transactionId: string
  status: SalaryAdvanceStatus
  deductedInPaymentId: string | null
  createdAt: string
}

export interface GrantSalaryAdvanceDTO {
  employeeId: string
  amount: number
  reason?: string
}

/**
 * Résultat du paiement de salaire lorsqu'une avance en attente a été
 * automatiquement déduite (BR-010 : remboursement intégral, en une fois,
 * sur la prochaine paie).
 */
export interface SalaryPaymentResult extends SalaryPayment {
  /** Salaire de référence de l'employé, avant déduction éventuelle. */
  grossAmount: number
  /** Montant réellement décaissé (= grossAmount - avance déduite, le cas échéant). */
  netAmount: number
  /** Avance déduite lors de ce paiement, le cas échéant. */
  deductedAdvance: SalaryAdvance | null
}
