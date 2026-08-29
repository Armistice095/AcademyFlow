import type { CashCategory } from '../constants/categories'
import type { SearchQuery } from './common.types'
import type { TuitionTarget } from './settings.types'

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
  /** Restreint aux élèves inscrits dans cette classe pour l'année scolaire en cours (page Rapports). */
  classId?: string
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
  appliesTo: TuitionTarget
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
// Rapport de caisse (F-017 → refonte "Rapports v2")
// ---------------------------------------------------------------------------

/** Filtres communs aux 6 onglets de la page Rapports, portés par `reports.store.ts`. */
export interface ReportFilters {
  from: string
  to: string
  /** Restreint aux élèves inscrits dans cette classe pour l'année scolaire en cours. */
  classId?: string
  category?: CashCategory
  /** Caissier (utilisateur ayant enregistré l'opération). */
  userId?: string
}

/**
 * Indicateurs de la carte "5 KPI" de la Vue générale.
 * Les `*ChangePct` comparent à la période précédente de même durée,
 * immédiatement avant `from` (`null` si la période de référence est à zéro —
 * comparaison non significative, voir `computeGrowthPct`).
 */
export interface ReportKpis {
  totalEntries: number
  totalExits: number
  netBalance: number
  transactionCount: number
  /** Snapshot courant des arriérés, INDÉPENDANT de la période filtrée (voir hypothèses du plan). */
  totalArrears: number
  totalEntriesChangePct: number | null
  totalExitsChangePct: number | null
  netBalanceChangePct: number | null
  transactionCountChangePct: number | null
  /** Toujours `null` pour l'instant — pas d'historique des arriérés disponible (voir plan §1.2.5). */
  totalArrearsChangePct: number | null
}

/** Point de la courbe "Évolution des entrées et sorties", une entrée par jour de la période. */
export interface ReportTimeSeriesPoint {
  date: string // 'YYYY-MM-DD'
  entries: number
  exits: number
}

/** Ligne du donut "Répartition des entrées par catégorie" (entrées uniquement). */
export interface ReportCategoryBreakdown {
  category: CashCategory
  amount: number
  percentage: number
}

/** Rapport complet de la Vue générale (F-017 refonte). */
export interface CashReportV2 {
  from: string
  to: string
  /** Solde de caisse réel cumulé jusqu'à la veille du `from` — jamais filtré (voir plan §1.2.3). */
  openingBalance: number
  kpis: ReportKpis
  byCategory: ReportCategoryBreakdown[]
  timeSeries: ReportTimeSeriesPoint[]
}

// ---------------------------------------------------------------------------
// Rapports "Recettes" / "Dépenses" (F-017 refonte, Phase 3)
// ---------------------------------------------------------------------------

/** Point de la courbe d'un rapport à un seul type d'opération (Recettes ou Dépenses). */
export interface TypeReportSeriesPoint {
  date: string // 'YYYY-MM-DD'
  amount: number
}

/** Rapport recentré sur un seul type d'opération — onglets "Recettes" et "Dépenses" (plan §3). */
export interface TypeReport {
  type: TransactionType
  total: number
  totalChangePct: number | null
  transactionCount: number
  transactionCountChangePct: number | null
  byCategory: ReportCategoryBreakdown[]
  timeSeries: TypeReportSeriesPoint[]
}

// ---------------------------------------------------------------------------
// Rapports "Par classe" / "Par caissier" (F-017 refonte, Phase 3)
// ---------------------------------------------------------------------------

export interface ReportByClassRow {
  classId: string
  className: string
  totalEntries: number
  totalExits: number
  netBalance: number
  transactionCount: number
}

export interface ReportByCashierRow {
  userId: string
  cashierName: string
  totalEntries: number
  totalExits: number
  netBalance: number
  transactionCount: number
}
