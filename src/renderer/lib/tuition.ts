import type { StudentPaymentRow, Transaction } from '@shared/types/transaction.types'
import { CASH_CATEGORY_LABELS } from '@shared/constants/categories'

/**
 * Historique des paiements d'un élève : uniquement les opérations de caisse
 * réellement enregistrées (payées ou annulées). Les échéances futures ou non
 * encore honorées ne font pas partie d'un "historique" et n'y figurent donc
 * pas — voir le solde du compte de scolarité pour ce qui reste dû.
 * Trié du plus ancien au plus récent.
 */
export function buildStudentPaymentRows(transactions: Transaction[]): StudentPaymentRow[] {
  return transactions
    .map((t): StudentPaymentRow => ({
      date: t.createdAt,
      description: t.description?.trim() || CASH_CATEGORY_LABELS[t.category],
      amount: t.amount,
      status: t.status === 'cancelled' ? 'annule' : 'paye',
      transactionId: t.id
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const PAYMENT_ROW_STATUS_LABELS: Record<StudentPaymentRow['status'], string> = {
  paye: 'Payé',
  annule: 'Annulé'
}
