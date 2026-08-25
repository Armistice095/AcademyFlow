import { eq, like, sql } from 'drizzle-orm'
import { getDb } from '@main/database'
import { receipts } from '@main/database/schema'
import { generateId } from '@main/database/id'
import type { Receipt } from '@shared/types/transaction.types'

const RECEIPT_PREFIX = 'REC'
const RECEIPT_SEQUENCE_LENGTH = 6

/**
 * Génère un numéro de reçu unique au format `REC-{ANNÉE}-{SÉQUENCE_6_CHIFFRES}`
 * (ex: `REC-2026-000001`). Séquence par année civile, jamais réutilisée
 * (aucune suppression physique de reçu — cohérent avec BR-005/BR-007).
 */
export function generateReceiptNumber(date: Date = new Date()): string {
  const db = getDb()
  const year = date.getFullYear()
  const prefix = `${RECEIPT_PREFIX}-${year}-`

  const existing = db
    .select({ receiptNumber: receipts.receiptNumber })
    .from(receipts)
    .where(like(receipts.receiptNumber, `${prefix}%`))
    .all()

  let maxSequence = 0
  for (const row of existing) {
    const seq = Number.parseInt(row.receiptNumber.slice(prefix.length), 10)
    if (!Number.isNaN(seq) && seq > maxSequence) maxSequence = seq
  }

  return `${prefix}${String(maxSequence + 1).padStart(RECEIPT_SEQUENCE_LENGTH, '0')}`
}

type Database = ReturnType<typeof getDb>

/**
 * Insère la ligne RECEIPTS pour une transaction donnée. Appelé depuis
 * `cashbox.service.ts` à l'intérieur de la même transaction BDD que la
 * création de l'entrée de caisse, pour respecter BR-007 (paiement non
 * finalisé tant que le reçu n'existe pas).
 */
export function insertReceipt(tx: Database, transactionId: string, amount: number): Receipt {
  const id = generateId()
  const receiptNumber = generateReceiptNumber()
  const createdAt = new Date().toISOString()

  tx.insert(receipts)
    .values({ id, receiptNumber, transactionId, amount, createdAt, printCount: 0 })
    .run()

  return { id, receiptNumber, transactionId, amount, createdAt, printCount: 0 }
}

export function getReceiptByTransaction(transactionId: string): Receipt | null {
  const db = getDb()
  const row = db.select().from(receipts).where(eq(receipts.transactionId, transactionId)).get()
  return row ?? null
}

/** Résout un reçu par son ID (utilisé par l'impression thermique — Phase 9.2). */
export function getReceiptById(receiptId: string): Receipt | null {
  const db = getDb()
  const row = db.select().from(receipts).where(eq(receipts.id, receiptId)).get()
  return row ?? null
}

/** Incrémente le compteur de réimpressions et retourne le reçu à jour. */
export function incrementPrintCount(transactionId: string): Receipt {
  const db = getDb()
  const existing = getReceiptByTransaction(transactionId)
  if (!existing) {
    throw new Error('Reçu introuvable pour cette opération.')
  }

  db.update(receipts)
    .set({ printCount: sql`${receipts.printCount} + 1` })
    .where(eq(receipts.transactionId, transactionId))
    .run()

  const updated = getReceiptByTransaction(transactionId)
  if (!updated) throw new Error('Échec de la mise à jour du compteur de réimpression.')
  return updated
}
