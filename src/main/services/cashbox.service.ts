import { and, desc, eq, gte, like, lte, or, type SQL } from 'drizzle-orm'
import { getDb } from '@main/database'
import { schoolYears, students, transactions } from '@main/database/schema'
import { generateId } from '@main/database/id'
import { insertReceipt } from './receipt.service'
import { logAction } from './audit.service'
import { CASH_ENTRY_CATEGORIES, CASH_EXIT_CATEGORIES, type CashCategory } from '@shared/constants/categories'
import type {
  CashboxStats,
  CashReport,
  CreateTransactionDTO,
  JournalFilters,
  JournalTransaction,
  Receipt,
  Transaction
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
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(eq(schoolYears.isCurrent, true)).get()
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
export function createEntry(data: CreateTransactionInput): { transaction: Transaction; receipt: Receipt } {
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

  logAction({ userId: data.userId, action: 'create', entityType: 'transaction', entityId: transactionId })

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

  logAction({ userId: data.userId, action: 'create', entityType: 'transaction', entityId: transactionId })

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

export function cancelTransaction(transactionId: string, reason: string, userId: string): Transaction {
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

  // Le solde cumulé (F-015) se calcule sur l'ensemble des opérations de
  // l'année scolaire, indépendamment des filtres appliqués à l'affichage —
  // c'est un solde réel de caisse, pas une somme filtrée.
  const balanceAfterByTxnId = new Map<string, number>()
  if (filters.schoolYearId) {
    const allYearRows = db
      .select()
      .from(transactions)
      .where(eq(transactions.schoolYearId, filters.schoolYearId))
      .orderBy(transactions.createdAt, transactions.id)
      .all()

    let running = 0
    for (const row of allYearRows) {
      if (row.status === 'validated') {
        running += row.type === 'entry' ? row.amount : -row.amount
      }
      balanceAfterByTxnId.set(row.id, running)
    }
  }

  const conditions: SQL<unknown>[] = []
  if (filters.schoolYearId) conditions.push(eq(transactions.schoolYearId, filters.schoolYearId))
  if (filters.type) conditions.push(eq(transactions.type, filters.type))
  if (filters.category) conditions.push(eq(transactions.category, filters.category))
  if (filters.userId) conditions.push(eq(transactions.userId, filters.userId))
  if (filters.studentId) conditions.push(eq(transactions.studentId, filters.studentId))
  if (filters.dateFrom) conditions.push(gte(transactions.createdAt, filters.dateFrom))
  if (filters.dateTo) conditions.push(lte(transactions.createdAt, filters.dateTo))

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
    items: paged.map((row) => ({ ...toTransaction(row), balanceAfter: balanceAfterByTxnId.get(row.id) ?? 0 })),
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

/** Cartes KPI du journal de caisse (F-015) — bornées à l'année scolaire en cours. */
export function getStats(schoolYearId?: string): CashboxStats {
  const db = getDb()
  const { from, to } = todayRange(new Date())

  const balance = getBalance(schoolYearId)

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

export function getReport(from: string, to: string): CashReport {
  const db = getDb()

  const rows = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.status, 'validated'),
        gte(transactions.createdAt, from),
        lte(transactions.createdAt, `${to}T23:59:59.999Z`)
      )
    )
    .all()

  let totalEntries = 0
  let totalExits = 0
  const byCategory: Record<string, number> = {}

  for (const row of rows) {
    if (row.type === 'entry') totalEntries += row.amount
    else totalExits += row.amount
    byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount
  }

  return {
    from,
    to,
    totalEntries,
    totalExits,
    netBalance: totalEntries - totalExits,
    byCategory: byCategory as CashReport['byCategory']
  }
}
