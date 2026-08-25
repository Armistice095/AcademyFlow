import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as cashboxService from '@main/services/cashbox.service'
import * as tuitionService from '@main/services/tuition.service'
import * as receiptService from '@main/services/receipt.service'
import * as authService from '@main/services/auth.service'
import type { CreateTransactionDTO, JournalFilters } from '@shared/types/transaction.types'

function requireCurrentUserId(): string {
  const session = authService.getCurrentSession()
  if (!session) throw new Error('Aucune session active.')
  return session.userId
}

/** Handlers IPC du domaine Caisse (F-013 à F-021). */
export function registerCashboxIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.cashbox.createEntry, async (_event, data: CreateTransactionDTO) => {
    const result = cashboxService.createTransaction({ ...data, userId: requireCurrentUserId() })
    return 'transaction' in result ? result.transaction : result
  })

  ipcMain.handle(
    IPC_CHANNELS.cashbox.cancelTransaction,
    async (_event, transactionId: string, reason: string) => {
      return cashboxService.cancelTransaction(transactionId, reason, requireCurrentUserId())
    }
  )

  ipcMain.handle(IPC_CHANNELS.cashbox.getJournal, async (_event, filters: JournalFilters) => {
    return cashboxService.getJournal(filters)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.getStudentAccount, async (_event, studentId: string) => {
    return tuitionService.getStudentAccount(studentId)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.listArrears, async () => {
    return tuitionService.getArrearsStudents()
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.getReport, async (_event, from: string, to: string) => {
    return cashboxService.getReport(from, to)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.getReceipt, async (_event, transactionId: string) => {
    return receiptService.getReceiptByTransaction(transactionId)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.reprintReceipt, async (_event, transactionId: string) => {
    return receiptService.incrementPrintCount(transactionId)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.getBalance, async (_event, schoolYearId?: string) => {
    return cashboxService.getBalance(schoolYearId)
  })

  ipcMain.handle(IPC_CHANNELS.cashbox.getStats, async (_event, schoolYearId?: string) => {
    return cashboxService.getStats(schoolYearId)
  })
}
