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
  /** Motif saisi lors de l'annulation (BR-005). Présent uniquement si `status === 'cancelled'`. */
  cancelReason: string | null
  userId: string
  /** Année scolaire associée à l'opération, assignée automatiquement à la création. */
  schoolYearId: string | null
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

/** Ligne du journal de caisse enrichie du solde cumulé après cette opération (chronologique). */
export interface JournalTransaction extends Transaction {
  balanceAfter: number
}

export interface JournalFilters extends SearchQuery {
  type?: TransactionType
  category?: CashCategory
  userId?: string
  studentId?: string
  dateFrom?: string
  dateTo?: string
  /** Limite le journal à une année scolaire donnée (par défaut : année en cours, voir F-015). */
  schoolYearId?: string
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

/** Ligne "Historique des paiements" : une opération de caisse réellement enregistrée. */
export interface StudentPaymentRow {
  date: string
  description: string
  amount: number
  status: 'paye' | 'annule'
  transactionId?: string
}

/** Vue enrichie pour la liste globale des arriérés (F-021), sans requête supplémentaire par élève. */
export interface ArrearsStudent extends TuitionAccount {
  matricule: string
  studentName: string
  className: string
  lateInstallmentsCount: number
}

// ---------------------------------------------------------------------------
// Cartes KPI du journal de caisse
// ---------------------------------------------------------------------------

/** Indicateurs rapides affichés en tête du journal — calculés sur l'année scolaire en cours. */
export interface CashboxStats {
  /** Solde de caisse cumulé (toutes opérations validées de l'année en cours). */
  balance: number
  /** Total des entrées validées enregistrées aujourd'hui. */
  todayEntries: number
  /** Total des sorties validées enregistrées aujourd'hui. */
  todayExits: number
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
