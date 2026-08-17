import { and, desc, eq, gte, like, lte, or } from 'drizzle-orm'
import { getDb } from '@main/database'
import { students, transactions } from '@main/database/schema'
import { generateId } from '@main/database/id'
import { insertReceipt } from './receipt.service'
import { logAction } from './audit.service'
import { CASH_ENTRY_CATEGORIES, CASH_EXIT_CATEGORIES, type CashCategory } from '@shared/constants/categories'
import type {
  CashReport,
  CreateTransactionDTO,
  JournalFilters,
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
    userId: row.userId,
    createdAt: row.createdAt
  }
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
        userId: data.userId
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
      userId: data.userId
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
// Annulation (BR-005) — jamais de suppression, uniquement opération inverse
// ---------------------------------------------------------------------------

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

  const reversalId = generateId()
  const reversalType = original.type === 'entry' ? 'exit' : 'entry'

  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: reversalId,
        type: reversalType,
        category: original.category,
        description: `Annulation de l'opération du ${original.createdAt} — motif : ${reason.trim()}`,
        amount: original.amount,
        studentId: original.studentId,
        installmentId: original.installmentId,
        employeeId: original.employeeId,
        status: 'validated',
        userId
      })
      .run()

    tx.update(transactions)
      .set({ status: 'cancelled', cancelledByTxn: reversalId })
      .where(eq(transactions.id, transactionId))
      .run()
  })

  logAction({
    userId,
    action: 'cancel',
    entityType: 'transaction',
    entityId: transactionId,
    details: { reason, reversalId }
  })

  const updated = db.select().from(transactions).where(eq(transactions.id, transactionId)).get()
  if (!updated) throw new Error("Échec de la récupération de l'opération après annulation.")
  return toTransaction(updated)
}

// ---------------------------------------------------------------------------
// Journal (F-015, F-016)
// ---------------------------------------------------------------------------

export function getJournal(filters: JournalFilters): PaginatedResult<Transaction> {
  const db = getDb()
  const page = filters.page && filters.page > 0 ? filters.page : 1
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE

  const conditions = []
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

  return { items: paged.map(toTransaction), total, page, pageSize }
}

// ---------------------------------------------------------------------------
// Solde et rapports (F-017, F-019)
// ---------------------------------------------------------------------------

export function getBalance(): number {
  const db = getDb()
  const rows = db
    .select({ type: transactions.type, amount: transactions.amount })
    .from(transactions)
    .where(eq(transactions.status, 'validated'))
    .all()

  return rows.reduce((sum, row) => sum + (row.type === 'entry' ? row.amount : -row.amount), 0)
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
