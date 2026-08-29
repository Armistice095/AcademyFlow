import { ipcMain, app, shell } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as printerConfigService from '@main/services/printer-config.service'
import * as receiptService from '@main/services/receipt.service'
import * as cashboxService from '@main/services/cashbox.service'
import * as studentService from '@main/services/student.service'
import * as settingsService from '@main/services/settings.service'
import * as authService from '@main/services/auth.service'
import { testPrinterConnection, printReceiptTicket } from '@main/printing/thermal-printer'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type { UpdatePrinterConfigDTO } from '@shared/types/printer.types'
import type { PrinterStatus, PrintResult } from '@shared/types/common.types'

/**
 * Handlers IPC du domaine Impression.
 * `openPdf` est implémenté dès la Phase 6 (documents PDF élèves). Le reste du
 * domaine — impression thermique des reçus (F-018) — est complété en Phase 9.2 :
 * `printReceipt` tente l'impression thermique si configurée et activée, et
 * retourne `{ success: false }` sinon (le renderer bascule alors sur le
 * fallback PDF déjà en place — voir `renderer/lib/print.ts`).
 */
export function registerPrinterIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.printer.openPdf, async (_event, base64: string, fileName: string) => {
    const buffer = Buffer.from(base64, 'base64')
    const pdfDir = join(app.getPath('temp'), 'academyflow-pdf')
    mkdirSync(pdfDir, { recursive: true })

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = join(pdfDir, safeFileName)
    writeFileSync(filePath, buffer)

    const error = await shell.openPath(filePath)
    if (error) {
      throw new Error(`Échec de l'ouverture du PDF : ${error}`)
    }
  })

  // Généralisation d'`openPdf` pour les autres formats générés côté renderer
  // (ex: export Excel des rapports — voir plan §2.5, Phase 4). Même mécanique :
  // écriture dans un dossier temporaire puis ouverture avec l'application par
  // défaut du système (Excel, LibreOffice Calc, etc.).
  ipcMain.handle(
    IPC_CHANNELS.printer.openFile,
    async (_event, base64: string, fileName: string) => {
      const buffer = Buffer.from(base64, 'base64')
      const dir = join(app.getPath('temp'), 'academyflow-exports')
      mkdirSync(dir, { recursive: true })

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = join(dir, safeFileName)
      writeFileSync(filePath, buffer)

      const error = await shell.openPath(filePath)
      if (error) {
        throw new Error(`Échec de l'ouverture du fichier : ${error}`)
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.printer.getConfig, async () => {
    return printerConfigService.getPrinterConfig()
  })

  ipcMain.handle(
    IPC_CHANNELS.printer.updateConfig,
    async (_event, data: UpdatePrinterConfigDTO) => {
      return printerConfigService.updatePrinterConfig(data)
    }
  )

  ipcMain.handle(IPC_CHANNELS.printer.getStatus, async (): Promise<PrinterStatus> => {
    const config = printerConfigService.getPrinterConfig()
    return {
      connected: config.enabled && config.lastTestSuccess === true,
      name:
        config.connectionType === 'network'
          ? (config.host ?? undefined)
          : (config.devicePath ?? undefined)
    }
  })

  ipcMain.handle(IPC_CHANNELS.printer.testConnection, async (): Promise<PrinterStatus> => {
    const config = printerConfigService.getPrinterConfig()
    const schoolInfo = settingsService.getSchoolInfo()

    try {
      await testPrinterConnection(config, schoolInfo)
      printerConfigService.recordTestResult(true, null)
      return {
        connected: true,
        name:
          config.connectionType === 'network'
            ? (config.host ?? undefined)
            : (config.devicePath ?? undefined)
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Échec de la connexion à l'imprimante."
      printerConfigService.recordTestResult(false, message)
      return { connected: false }
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.printer.printReceipt,
    async (_event, receiptId: string): Promise<PrintResult> => {
      const config = printerConfigService.getPrinterConfig()
      if (!config.enabled) {
        return {
          success: false,
          message: 'Impression thermique désactivée — utilisation du reçu PDF.'
        }
      }

      try {
        const receipt = receiptService.getReceiptById(receiptId)
        if (!receipt) throw new Error('Reçu introuvable.')

        const transaction = cashboxService.getTransactionById(receipt.transactionId)
        if (!transaction) throw new Error('Opération introuvable pour ce reçu.')

        const student = transaction.studentId
          ? studentService.findById(transaction.studentId)
          : null
        const className = transaction.studentId
          ? studentService.getCurrentClassName(transaction.studentId)
          : null
        const installmentLabel = transaction.installmentId
          ? settingsService.getInstallmentLabel(transaction.installmentId)
          : null
        const operator = authService.getUserById(transaction.userId)
        const schoolInfo = settingsService.getSchoolInfo()

        await printReceiptTicket(
          config,
          {
            receiptNumber: receipt.receiptNumber,
            createdAt: receipt.createdAt,
            studentName: student ? `${student.lastName} ${student.firstName}` : null,
            matricule: student?.matricule ?? null,
            className,
            categoryLabel: CASH_CATEGORY_LABELS[transaction.category as CashCategory],
            installmentLabel,
            description: transaction.description,
            amount: transaction.amount,
            operatorName: operator?.fullName ?? '—',
            printCopyLabel: receipt.printCount > 0 ? `Copie n° ${receipt.printCount + 1}` : null
          },
          schoolInfo
        )

        receiptService.incrementPrintCount(transaction.id)

        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec de l'impression thermique."
        return { success: false, message }
      }
    }
  )
}
