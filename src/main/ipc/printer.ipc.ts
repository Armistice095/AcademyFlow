import { ipcMain, app, shell } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IPC_CHANNELS } from '@shared/ipc-channels'

/**
 * Handlers IPC du domaine Impression.
 * `openPdf` est implémenté dès la Phase 6 (documents PDF élèves) — écrit le
 * PDF dans un dossier temporaire et l'ouvre avec la visionneuse système par
 * défaut. `printReceipt` (impression thermique) reste un squelette, complété
 * en Phase 9.
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

  // TODO Phase 9 :
  // ipcMain.handle(IPC_CHANNELS.printer.printReceipt, async (_event, receiptId) => { ... })
  // ipcMain.handle(IPC_CHANNELS.printer.testConnection, async () => { ... })
}
