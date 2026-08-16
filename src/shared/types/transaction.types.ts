import type { CashCategory } from '../constants/categories'
import type { SearchQuery } from './common.types'

export type TransactionType = 'entry' | 'exit'
export type TransactionStatus = 'validated' | 'cancelled'

// ---------------------------------------------------------------------------
// Transaction (opération de caisse)
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string
  type: TransactionType
  category: CashCategory
  description: string | null
  amount: number
  studentId: string | null
  installmentId: string | null
  employeeId: string | null
  status: TransactionStatus
  cancelledByTxn: string | null
  userId: string
  createdAt: string
}

export interface CreateTransactionDTO {
  type: TransactionType
  category: CashCategory
  description?: string
  amount: number
  studentId?: string
  installmentId?: string
  employeeId?: string
}

export interface JournalFilters extends SearchQuery {
  type?: TransactionType
  category?: CashCategory
  userId?: string
  studentId?: string
  dateFrom?: string
  dateTo?: string
}

// ---------------------------------------------------------------------------
// Reçu (F-018)
// ---------------------------------------------------------------------------

export interface Receipt {
  id: string
  receiptNumber: string
  transactionId: string
  amount: number
  createdAt: string
  printCount: number
}

// ---------------------------------------------------------------------------
// Compte de scolarité (dérivé — F-020, F-021)
// ---------------------------------------------------------------------------

export interface TuitionAccountLine {
  installmentId: string
  label: string
  dueDate: string
  expectedAmount: number
  paidAmount: number
  /** BR-010 : en arriéré si échéance dépassée et montant non intégralement payé. */
  status: 'a_jour' | 'en_arriere'
}

export interface TuitionAccount {
  studentId: string
  installments: TuitionAccountLine[]
  totalExpected: number
  totalPaid: number
  balance: number
}

// ---------------------------------------------------------------------------
// Rapport de caisse (F-017)
// ---------------------------------------------------------------------------

export interface CashReport {
  from: string
  to: string
  totalEntries: number
  totalExits: number
  netBalance: number
  byCategory: Record<CashCategory, number>
}
