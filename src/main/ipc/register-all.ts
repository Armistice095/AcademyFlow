import { registerSystemIpcHandlers } from './system.ipc'
import { registerStudentsIpcHandlers } from './students.ipc'
import { registerCashboxIpcHandlers } from './cashbox.ipc'
import { registerPersonnelIpcHandlers } from './personnel.ipc'
import { registerSettingsIpcHandlers } from './settings.ipc'
import { registerAuthIpcHandlers } from './auth.ipc'
import { registerPrinterIpcHandlers } from './printer.ipc'
import { registerBackupIpcHandlers } from './backup.ipc'
import { registerDashboardIpcHandlers } from './dashboard.ipc'

/**
 * Point d'entrée unique pour l'enregistrement de tous les handlers IPC.
 * Appelé une seule fois au démarrage (`main/index.ts`), après l'initialisation
 * de la base de données.
 */
export function registerAllIpcHandlers(): void {
  registerSystemIpcHandlers()
  registerStudentsIpcHandlers()
  registerCashboxIpcHandlers()
  registerPersonnelIpcHandlers()
  registerSettingsIpcHandlers()
  registerAuthIpcHandlers()
  registerPrinterIpcHandlers()
  registerBackupIpcHandlers()
  registerDashboardIpcHandlers()
}
