import { and, desc, eq, gte, inArray, lt, like, lte, or, type SQL } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  classes,
  enrollments,
  schoolYears,
  students,
  transactions,
  users
} from '@main/database/schema'
import { generateId } from '@main/database/id'
import { insertReceipt } from './receipt.service'
import { logAction } from './audit.service'
import { getArrearsStudents } from './tuition.service'
import {
  CASH_ENTRY_CATEGORIES,
  CASH_EXIT_CATEGORIES,
  type CashCategory
} from '@shared/constants/categories'
import type {
  CashboxStats,
  CashReportV2,
  CreateTransactionDTO,
  JournalFilters,
  JournalTransaction,
  Receipt,
  ReportByCashierRow,
  ReportByClassRow,
  ReportCategoryBreakdown,
  ReportFilters,
  ReportKpis,
  ReportTimeSeriesPoint,
  Transaction,
  TransactionType,
  TypeReport
} from '@shared/types/transaction.types'
import type { PaginatedResult } from '@shared/types/common.types'

const DEFAULT_PAGE_SIZE = 25

/** Catégories d'entrée qui nécessitent obligatoirement un élève rattaché (BR-001). */
const CATEGORIES_REQUIRING_STUDENT: CashCategory[] = ['frais_inscription', 'scolarite']

function toTransaction(row: typeof transactions.$inferSelect): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction['type'],
    category: row.category as CashCategory,
    description: row.description,
    amount: row.amount,
    studentId: row.studentId,
    installmentId: row.installmentId,
    employeeId: row.employeeId,
    status: row.status as Transaction['status'],
    cancelledByTxn: row.cancelledByTxn,
    cancelReason: row.cancelReason,
    userId: row.userId,
    schoolYearId: row.schoolYearId,
    createdAt: row.createdAt
  }
}

/** Année scolaire active — assignée automatiquement à chaque nouvelle opération de caisse. */
function getCurrentSchoolYearIdOrNull(): string | null {
  const db = getDb()
  const year = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  return year?.id ?? null
}

/**
 * Borne d'une journée locale (00:00 → 23:59:59.999), convertie en UTC.
 * IMPORTANT : `createdAt` est stocké en ISO 8601 UTC — construire la borne à
 * partir d'un objet Date (plutôt que de concaténer une chaîne "YYYY-MM-DD")
 * garantit une conversion correcte du fuseau local vers l'UTC, sinon les
 * opérations du début de journée (avant le décalage UTC) sont exclues à tort.
 */
function todayRange(now: Date): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { from: start.toISOString(), to: end.toISOString() }
}

export interface CreateTransactionInput extends CreateTransactionDTO {
  userId: string
}

// ---------------------------------------------------------------------------
// Entrées de caisse (F-013, BR-004, BR-005, BR-007)
// ---------------------------------------------------------------------------

/** Enregistre une entrée de caisse et génère son reçu, de façon atomique (BR-007). */
export function createEntry(data: CreateTransactionInput): {
  transaction: Transaction
  receipt: Receipt
} {
  if (data.type !== 'entry') {
    throw new Error('createEntry ne traite que les opérations de type "entry".')
  }
  if (!(CASH_ENTRY_CATEGORIES as readonly string[]).includes(data.category)) {
    throw new Error('Catégorie invalide pour une entrée de caisse.')
  }
  if (CATEGORIES_REQUIRING_STUDENT.includes(data.category) && !data.studentId) {
    throw new Error("Un élève doit être sélectionné pour cette catégorie d'entrée.")
  }
  if (data.category === 'scolarite' && !data.installmentId) {
    throw new Error('Une tranche de scolarité doit être sélectionnée pour ce paiement.')
  }
  if (data.amount <= 0) {
    throw new Error('Le montant doit être positif.')
  }

  const db = getDb()
  const transactionId = generateId()
  const schoolYearId = getCurrentSchoolYearIdOrNull()

  const result = db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        type: 'entry',
        category: data.category,
        description: data.description ?? null,
        amount: data.amount,
        studentId: data.studentId ?? null,
        installmentId: data.installmentId ?? null,
        employeeId: data.employeeId ?? null,
        status: 'validated',
        userId: data.userId,
        schoolYearId
      })
      .run()

    const receipt = insertReceipt(tx, transactionId, data.amount)
    return receipt
  })

  logAction({
    userId: data.userId,
    action: 'create',
    entityType: 'transaction',
    entityId: transactionId
  })

  const row = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!row) throw new Error("Échec de la récupération de l'entrée après création.")

  return { transaction: toTransaction(row), receipt: result }
}

// ---------------------------------------------------------------------------
// Sorties de caisse (F-014)
// ---------------------------------------------------------------------------

/** Enregistre une sortie de caisse — pas de reçu (contrairement aux entrées). */
export function createExit(data: CreateTransactionInput): Transaction {
  if (data.type !== 'exit') {
    throw new Error('createExit ne traite que les opérations de type "exit".')
  }
  if (!(CASH_EXIT_CATEGORIES as readonly string[]).includes(data.category)) {
    throw new Error('Catégorie invalide pour une sortie de caisse.')
  }
  if (data.amount <= 0) {
    throw new Error('Le montant doit être positif.')
  }

  const db = getDb()
  const transactionId = generateId()
  const schoolYearId = getCurrentSchoolYearIdOrNull()

  db.insert(transactions)
    .values({
      id: transactionId,
      type: 'exit',
      category: data.category,
      description: data.description ?? null,
      amount: data.amount,
      studentId: data.studentId ?? null,
      installmentId: data.installmentId ?? null,
      employeeId: data.employeeId ?? null,
      status: 'validated',
      userId: data.userId,
      schoolYearId
    })
    .run()

  logAction({
    userId: data.userId,
    action: 'create',
    entityType: 'transaction',
    entityId: transactionId
  })

  const row = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!row) throw new Error('Échec de la récupération de la sortie après création.')
  return toTransaction(row)
}

/** Point d'entrée unique utilisé par le handler IPC — délègue selon `data.type`. */
export function createTransaction(
  data: CreateTransactionInput
): { transaction: Transaction; receipt: Receipt } | Transaction {
  return data.type === 'entry' ? createEntry(data) : createExit(data)
}

// ---------------------------------------------------------------------------
// Annulation (BR-005) — jamais de suppression, uniquement marquage "annulée"
// ---------------------------------------------------------------------------
//
// L'opération annulée reste visible dans le journal (barrée, badge "Annulée",
// motif conservé) mais elle est retirée une seule fois du solde de caisse —
// aucune ligne supplémentaire n'est créée, pour éviter de compter l'annulation
// deux fois (une fois par exclusion de l'originale, une fois par l'inverse).

export function cancelTransaction(
  transactionId: string,
  reason: string,
  userId: string
): Transaction {
  if (!reason.trim()) {
    throw new Error("Un motif d'annulation est requis.")
  }

  const db = getDb()

  const original = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!original) {
    throw new Error('Opération introuvable.')
  }
  if (original.status === 'cancelled') {
    throw new Error('Cette opération a déjà été annulée.')
  }

  db.update(transactions)
    .set({ status: 'cancelled', cancelReason: reason.trim() })
    .where(eq(transactions.id, transactionId))
    .run()

  logAction({
    userId,
    action: 'cancel',
    entityType: 'transaction',
    entityId: transactionId,
    details: { reason: reason.trim() }
  })

  const updated = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!updated) throw new Error("Échec de la récupération de l'opération après annulation.")
  return toTransaction(updated)
}

/** Résout une opération par son ID (utilisé par l'impression thermique — Phase 9.2). */
export function getTransactionById(transactionId: string): Transaction | null {
  const db = getDb()
  const row = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  return row ? toTransaction(row) : null
}

// ---------------------------------------------------------------------------
// Journal (F-015, F-016)
// ---------------------------------------------------------------------------

export function getJournal(filters: JournalFilters): PaginatedResult<JournalTransaction> {
  const db = getDb()
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE

  // Le solde cumulé (F-015) se calcule sur l'ensemble de l'historique de la
  // caisse (toutes années scolaires confondues), indépendamment des filtres
  // appliqués à l'affichage — c'est le solde réel de caisse, qui ne se
  // réinitialise jamais au changement d'année scolaire, pas une somme filtrée.
  const balanceAfterByTxnId = new Map<string, number>()
  const allRows = db
    .select()
    .from(transactions)
    .orderBy(transactions.createdAt, transactions.id)
    .all()

  let running = 0
  for (const row of allRows) {
    if (row.status === 'validated') {
      running += row.type === 'entry' ? row.amount : -row.amount
    }
    balanceAfterByTxnId.set(row.id, running)
  }

  const conditions: SQL<unknown>[] = []
  if (filters.schoolYearId) conditions.push(eq(transactions.schoolYearId, filters.schoolYearId))
  if (filters.type) conditions.push(eq(transactions.type, filters.type))
  if (filters.category) conditions.push(eq(transactions.category, filters.category))
  if (filters.userId) conditions.push(eq(transactions.userId, filters.userId))
  if (filters.studentId) conditions.push(eq(transactions.studentId, filters.studentId))
  if (filters.dateFrom) conditions.push(gte(transactions.createdAt, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.createdAt, filters.dateTo))
  if (filters.classId) {
    // Même logique que `buildReportConditions` (page Rapports) : résolution à la
    // volée des élèves de la classe pour l'année en cours (pas de colonne dédiée).
    const studentIds = getStudentIdsForClass(filters.classId)
    conditions.push(
      studentIds.length > 0 ? inArray(transactions.studentId, studentIds) : eq(transactions.id, '')
    )
  }

  let studentIdsMatchingQuery: string[] | null = null
  if (filters.query && filters.query.trim()) {
    const term = `%${filters.query.trim()}%`
    const matchingStudents = db
      .select({ id: students.id })
      .from(students)
      .where(or(like(students.lastName, term), like(students.firstName, term)))
      .all()
    studentIdsMatchingQuery = matchingStudents.map((s) => s.id)

    const textCondition = or(
      like(transactions.description, term),
      studentIdsMatchingQuery.length > 0
        ? or(...studentIdsMatchingQuery.map((id) => eq(transactions.studentId, id)))
        : undefined
    )
    if (textCondition) conditions.push(textCondition)
  }

  const rows = db
    .select()
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.createdAt))
    .all()

  const total = rows.length
  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  return {
    items: paged.map((row) => ({
      ...toTransaction(row),
      balanceAfter: balanceAfterByTxnId.get(row.id) ?? 0
    })),
    total,
    page,
    pageSize
  }
}

// ---------------------------------------------------------------------------
// Solde et rapports (F-017, F-019)
// ---------------------------------------------------------------------------

export function getBalance(schoolYearId?: string): number {
  const db = getDb()
  const conditions: SQL<unknown>[] = [eq(transactions.status, 'validated')]
  if (schoolYearId) conditions.push(eq(transactions.schoolYearId, schoolYearId))

  const rows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(and(...conditions))
    .all()

  return rows.reduce((sum, row) => sum + (row.type === 'entry' ? row.amount : -row.amount), 0)
}

/**
 * Cartes KPI du journal de caisse (F-015).
 * Le solde de caisse est TOUJOURS global (toute l'historique, toutes années
 * scolaires confondues) — c'est un solde réel de trésorerie qui ne se
 * réinitialise jamais au changement d'année scolaire. Seules les entrées/
 * sorties "du jour" ci-dessous peuvent être bornées à une année scolaire,
 * pour rester cohérentes avec le contexte de reporting affiché à l'écran.
 */
export function getStats(schoolYearId?: string): CashboxStats {
  const db = getDb()
  const { from, to } = todayRange(new Date())

  const balance = getBalance()

  const todayConditions: SQL<unknown>[] = [
    eq(transactions.status, 'validated'),
    gte(transactions.createdAt, from),
    lte(transactions.createdAt, to)
  ]
  if (schoolYearId) todayConditions.push(eq(transactions.schoolYearId, schoolYearId))

  const todayRows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(and(...todayConditions))
    .all()

  let todayEntries = 0
  let todayExits = 0
  for (const row of todayRows) {
    if (row.type === 'entry') todayEntries += row.amount
    else todayExits += row.amount
  }

  return { balance, todayEntries, todayExits }
}

/**
 * Solde de caisse réel cumulé strictement avant `beforeDate` (borne exclue).
 * Toujours global — jamais restreint par classe/catégorie/caissier : c'est un
 * solde de trésorerie réel, pas une somme filtrée (voir plan §1.2.3).
 */
export function getBalanceBefore(beforeDate: string): number {
  const db = getDb()
  const rows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.status, 'validated'), lt(transactions.createdAt, beforeDate)))
    .all()

  return rows.reduce((sum, row) => sum + (row.type === 'entry' ? row.amount : -row.amount), 0)
}

/** `null` si la période de référence est à zéro (comparaison non significative) — même convention que le tableau de bord. */
function computeGrowthPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Élèves inscrits dans `classId` pour l'année scolaire en cours — utilisé pour filtrer les transactions "à la volée" (voir plan §1.2.1). */
function getStudentIdsForClass(classId: string): string[] {
  const db = getDb()
  const currentYear = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  if (!currentYear) return []

  const rows = db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.schoolYearId, currentYear.id)))
    .all()
  return rows.map((r) => r.studentId)
}

/** Bornes `[from, to]` d'une période équivalente (même durée) immédiatement avant `from`. */
function getPreviousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  // `from`/`to` sont des dates 'YYYY-MM-DD' (voir convention de `lib/reportPeriod.ts`) —
  // on raisonne en millisecondes UTC minuit pour rester robuste aux fuseaux.
  const fromDate = new Date(`${from}T00:00:00.000Z`)
  const toDate = new Date(`${to}T00:00:00.000Z`)
  const durationMs = toDate.getTime() - fromDate.getTime()

  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000)
  const prevFrom = new Date(prevTo.getTime() - durationMs)

  return {
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10)
  }
}

/** Conditions SQL communes à `getReportV2` — période + filtres optionnels (classe/catégorie/caissier). */
function buildReportConditions(
  from: string,
  to: string,
  filters: Pick<ReportFilters, 'classId' | 'category' | 'userId'>
): SQL<unknown>[] {
  const conditions: SQL<unknown>[] = [
    eq(transactions.status, 'validated'),
    gte(transactions.createdAt, from),
    lte(transactions.createdAt, `${to}T23:59:59.999Z`)
  ]
  if (filters.category) conditions.push(eq(transactions.category, filters.category))
  if (filters.userId) conditions.push(eq(transactions.userId, filters.userId))
  if (filters.classId) {
    const studentIds = getStudentIdsForClass(filters.classId)
    // Aucun élève dans cette classe pour l'année en cours : condition toujours fausse
    // plutôt que d'omettre le filtre (sinon on renverrait les données non filtrées).
    conditions.push(
      studentIds.length > 0 ? inArray(transactions.studentId, studentIds) : eq(transactions.id, '')
    )
  }
  return conditions
}

/** Totaux simples (entrées/sorties/nombre) sur une période — réutilisé pour la période courante et la période précédente. */
function getPeriodTotals(
  from: string,
  to: string,
  filters: Pick<ReportFilters, 'classId' | 'category' | 'userId'>
): { totalEntries: number; totalExits: number; transactionCount: number } {
  const db = getDb()
  const rows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(and(...buildReportConditions(from, to, filters)))
    .all()

  let totalEntries = 0
  let totalExits = 0
  for (const row of rows) {
    if (row.type === 'entry') totalEntries += row.amount
    else totalExits += row.amount
  }
  return { totalEntries, totalExits, transactionCount: rows.length }
}

/**
 * Rapport complet de la Vue générale (F-017 refonte — remplace l'ancien `getReport`,
 * sans autre appelant à date). Voir `PLAN_REFONTE_RAPPORTS_CAISSE.md` §1.2.
 */
export function getReportV2(filters: ReportFilters): CashReportV2 {
  const db = getDb()
  const { from, to } = filters

  // --- Période courante : totaux + répartition par catégorie (entrées) + série temporelle ---
  const rows = db
    .select()
    .from(transactions)
    .where(and(...buildReportConditions(from, to, filters)))
    .all()

  let totalEntries = 0
  let totalExits = 0
  const entriesByCategory: Partial<Record<CashCategory, number>> = {}
  const byDate = new Map<string, { entries: number; exits: number }>()

  for (const row of rows) {
    const category = row.category as CashCategory
    const date = row.createdAt.slice(0, 10)
    const point = byDate.get(date) ?? { entries: 0, exits: 0 }

    if (row.type === 'entry') {
      totalEntries += row.amount
      entriesByCategory[category] = (entriesByCategory[category] ?? 0) + row.amount
      point.entries += row.amount
    } else {
      totalExits += row.amount
      point.exits += row.amount
    }
    byDate.set(date, point)
  }

  const totalEntriesForBreakdown = Object.values(entriesByCategory).reduce(
    (sum, v) => sum + (v ?? 0),
    0
  )
  const byCategory: ReportCategoryBreakdown[] = Object.entries(entriesByCategory)
    .map(([category, amount]) => ({
      category: category as CashCategory,
      amount: amount ?? 0,
      percentage:
        totalEntriesForBreakdown > 0 ? ((amount ?? 0) / totalEntriesForBreakdown) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)

  const timeSeries: ReportTimeSeriesPoint[] = Array.from(byDate.entries())
    .map(([date, point]) => ({ date, ...point }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // --- Période précédente équivalente (mêmes filtres) : uniquement pour les variations % ---
  const { prevFrom, prevTo } = getPreviousPeriod(from, to)
  const previous = getPeriodTotals(prevFrom, prevTo, filters)
  const netBalance = totalEntries - totalExits
  const previousNetBalance = previous.totalEntries - previous.totalExits

  // --- Arriérés : snapshot courant, indépendant de la période (hypothèse retenue) ---
  const totalArrears = getArrearsStudents().reduce((sum, student) => sum + student.balance, 0)

  const kpis: ReportKpis = {
    totalEntries,
    totalExits,
    netBalance,
    transactionCount: rows.length,
    totalArrears,
    totalEntriesChangePct: computeGrowthPct(totalEntries, previous.totalEntries),
    totalExitsChangePct: computeGrowthPct(totalExits, previous.totalExits),
    netBalanceChangePct: computeGrowthPct(netBalance, previousNetBalance),
    transactionCountChangePct: computeGrowthPct(rows.length, previous.transactionCount),
    // Pas d'historique des arriérés disponible pour l'instant — on n'affiche pas
    // de variation plutôt que de bricoler une fausse donnée (voir plan §1.2.5).
    totalArrearsChangePct: null
  }

  return {
    from,
    to,
    openingBalance: getBalanceBefore(from),
    kpis,
    byCategory,
    timeSeries
  }
}

// ---------------------------------------------------------------------------
// Rapports "Recettes" / "Dépenses" (F-017 refonte, Phase 3 — voir plan §3 et §5)
// ---------------------------------------------------------------------------

/**
 * Rapport recentré sur un seul type d'opération (`entry` pour "Recettes",
 * `exit` pour "Dépenses") — réutilise les mêmes conditions/agrégats que
 * `getReportV2`, filtrées en plus par `type` (voir plan : "réutilisation de
 * getReportV2 avec filtre forcé").
 */
export function getTypeReport(filters: ReportFilters, type: TransactionType): TypeReport {
  const db = getDb()
  const { from, to } = filters

  const rows = db
    .select()
    .from(transactions)
    .where(and(eq(transactions.type, type), ...buildReportConditions(from, to, filters)))
    .all()

  let total = 0
  const byCategoryMap: Partial<Record<CashCategory, number>> = {}
  const byDate = new Map<string, number>()

  for (const row of rows) {
    const category = row.category as CashCategory
    const date = row.createdAt.slice(0, 10)
    total += row.amount
    byCategoryMap[category] = (byCategoryMap[category] ?? 0) + row.amount
    byDate.set(date, (byDate.get(date) ?? 0) + row.amount)
  }

  const byCategory: ReportCategoryBreakdown[] = Object.entries(byCategoryMap)
    .map(([category, amount]) => ({
      category: category as CashCategory,
      amount: amount ?? 0,
      percentage: total > 0 ? ((amount ?? 0) / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)

  const timeSeries = Array.from(byDate.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const { prevFrom, prevTo } = getPreviousPeriod(from, to)
  const previousRows = db
    .select({ amount: transactions.amount })
    .from(transactions)
    .where(and(eq(transactions.type, type), ...buildReportConditions(prevFrom, prevTo, filters)))
    .all()
  const previousTotal = previousRows.reduce((sum, row) => sum + row.amount, 0)

  return {
    type,
    total,
    totalChangePct: computeGrowthPct(total, previousTotal),
    transactionCount: rows.length,
    transactionCountChangePct: computeGrowthPct(rows.length, previousRows.length),
    byCategory,
    timeSeries
  }
}

// ---------------------------------------------------------------------------
// Rapport "Par classe" (F-017 refonte, Phase 3)
// ---------------------------------------------------------------------------

/**
 * Ventilation entrées/sorties/solde par classe, pour l'année scolaire en
 * cours. Les opérations sans élève rattaché (salaires, achats de fournitures,
 * charges diverses...) ou dont l'élève n'est plus inscrit cette année sont
 * regroupées sous "Non affecté", pour que la somme des lignes reste égale
 * aux totaux généraux de la période (aucune opération silencieusement omise).
 */
export function getReportByClass(
  filters: Pick<ReportFilters, 'from' | 'to' | 'category' | 'userId'>
): ReportByClassRow[] {
  const db = getDb()
  const currentYear = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()

  const studentToClass = new Map<string, { classId: string; className: string }>()
  if (currentYear) {
    const enrollmentRows = db
      .select({ studentId: enrollments.studentId, classId: classes.id, className: classes.name })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(eq(enrollments.schoolYearId, currentYear.id))
      .all()
    for (const row of enrollmentRows)
      studentToClass.set(row.studentId, { classId: row.classId, className: row.className })
  }

  const conditions: SQL<unknown>[] = [
    eq(transactions.status, 'validated'),
    gte(transactions.createdAt, filters.from),
    lte(transactions.createdAt, `${filters.to}T23:59:59.999Z`)
  ]
  if (filters.category) conditions.push(eq(transactions.category, filters.category))
  if (filters.userId) conditions.push(eq(transactions.userId, filters.userId))

  const rows = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      studentId: transactions.studentId
    })
    .from(transactions)
    .where(and(...conditions))
    .all()

  const UNASSIGNED_KEY = '__unassigned__'
  const byClass = new Map<string, ReportByClassRow>()

  for (const row of rows) {
    const match = row.studentId ? studentToClass.get(row.studentId) : undefined
    const key = match?.classId ?? UNASSIGNED_KEY
    const entry = byClass.get(key) ?? {
      classId: key,
      className: match?.className ?? 'Non affecté',
      totalEntries: 0,
      totalExits: 0,
      netBalance: 0,
      transactionCount: 0
    }
    if (row.type === 'entry') entry.totalEntries += row.amount
    else entry.totalExits += row.amount
    entry.netBalance = entry.totalEntries - entry.totalExits
    entry.transactionCount += 1
    byClass.set(key, entry)
  }

  return Array.from(byClass.values()).sort((a, b) => b.netBalance - a.netBalance)
}

// ---------------------------------------------------------------------------
// Rapport "Par caissier" (F-017 refonte, Phase 3)
// ---------------------------------------------------------------------------

/** Ventilation entrées/sorties/solde par caissier (utilisateur ayant enregistré l'opération). */
export function getReportByCashier(
  filters: Pick<ReportFilters, 'from' | 'to' | 'classId' | 'category'>
): ReportByCashierRow[] {
  const db = getDb()

  const conditions: SQL<unknown>[] = [
    eq(transactions.status, 'validated'),
    gte(transactions.createdAt, filters.from),
    lte(transactions.createdAt, `${filters.to}T23:59:59.999Z`)
  ]
  if (filters.category) conditions.push(eq(transactions.category, filters.category))
  if (filters.classId) {
    const studentIds = getStudentIdsForClass(filters.classId)
    conditions.push(
      studentIds.length > 0 ? inArray(transactions.studentId, studentIds) : eq(transactions.id, '')
    )
  }

  const rows = db
    .select({ type: transactions.type, amount: transactions.amount, userId: transactions.userId })
    .from(transactions)
    .where(and(...conditions))
    .all()

  const cashierNames = new Map(
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .all()
      .map((u) => [u.id, u.fullName])
  )

  const byCashier = new Map<string, ReportByCashierRow>()
  for (const row of rows) {
    const entry = byCashier.get(row.userId) ?? {
      userId: row.userId,
      cashierName: cashierNames.get(row.userId) ?? 'Utilisateur inconnu',
      totalEntries: 0,
      totalExits: 0,
      netBalance: 0,
      transactionCount: 0
    }
    if (row.type === 'entry') entry.totalEntries += row.amount
    else entry.totalExits += row.amount
    entry.netBalance = entry.totalEntries - entry.totalExits
    entry.transactionCount += 1
    byCashier.set(row.userId, entry)
  }

  return Array.from(byCashier.values()).sort((a, b) => b.transactionCount - a.transactionCount)
}
