import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as licenseService from '@main/services/license.service'
import type { ActivateLicenseDTO } from '@shared/types/license.types'

/** Handlers IPC du domaine Licence (activation, statut, onboarding). */
export function registerLicenseIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.license.getStatus, async () => {
    return licenseService.evaluateLicense()
  })

  ipcMain.handle(IPC_CHANNELS.license.activate, async (_event, dto: ActivateLicenseDTO) => {
    return licenseService.activateLicense(dto)
  })

  ipcMain.handle(IPC_CHANNELS.license.resync, async () => {
    await licenseService.resyncLicense()
    return licenseService.evaluateLicense()
  })

  ipcMain.handle(IPC_CHANNELS.license.markOnboardingCompleted, async () => {
    licenseService.markOnboardingCompleted()
    return licenseService.evaluateLicense()
  })
}
