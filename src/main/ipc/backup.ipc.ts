import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as backupService from '@main/services/backup.service'
import type { UpdateBackupSettingsDTO } from '@shared/types/backup.types'

/**
 * Handlers IPC du domaine Sauvegarde cloud (Phase 9.3, F-025).
 * Squelette posé en Phase 2 — complété en Phase 9.3.
 */
export function registerBackupIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.backup.getStatus, async () => {
    return backupService.getBackupStatus()
  })

  ipcMain.handle(IPC_CHANNELS.backup.updateSettings, async (_event, data: UpdateBackupSettingsDTO) => {
    return backupService.updateBackupSettings(data)
  })

  ipcMain.handle(IPC_CHANNELS.backup.connectGoogleAccount, async () => {
    return backupService.connectGoogleAccount()
  })

  ipcMain.handle(IPC_CHANNELS.backup.disconnectGoogleAccount, async () => {
    return backupService.disconnectGoogleAccount()
  })

  ipcMain.handle(IPC_CHANNELS.backup.exportToCloud, async () => {
    return backupService.exportToCloud()
  })

  ipcMain.handle(IPC_CHANNELS.backup.getLastBackup, async () => {
    return backupService.getLastBackup()
  })

  ipcMain.handle(IPC_CHANNELS.backup.listBackups, async () => {
    return backupService.listBackups()
  })

  ipcMain.handle(IPC_CHANNELS.backup.restoreFromCloud, async (_event, backupId: string) => {
    return backupService.restoreFromCloud(backupId)
  })
}
