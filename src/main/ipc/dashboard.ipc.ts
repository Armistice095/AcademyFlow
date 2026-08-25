import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as dashboardService from '@main/services/dashboard.service'

/** Handlers IPC du domaine Tableau de bord (F-019, Phase 9.1). */
export function registerDashboardIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.dashboard.getStats, async () => {
    return dashboardService.getStats()
  })
}
