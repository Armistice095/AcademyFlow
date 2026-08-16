import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'

/**
 * Handler de test — permet de valider le pont IPC Main ↔ Preload ↔ Renderer
 * de bout en bout (voir critère de validation de la Phase 2).
 */
export function registerSystemIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.system.ping, async () => {
    return 'pong'
  })
}
