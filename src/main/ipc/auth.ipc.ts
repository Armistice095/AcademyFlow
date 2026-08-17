import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as authService from '@main/services/auth.service'

/** Handlers IPC du domaine Authentification. */
export function registerAuthIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.auth.login, async (_event, username: string, password: string) => {
    return authService.login(username, password)
  })

  ipcMain.handle(IPC_CHANNELS.auth.logout, async () => {
    authService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.auth.getCurrentUser, async () => {
    return authService.getCurrentUser()
  })

  ipcMain.handle(
    IPC_CHANNELS.auth.changePassword,
    async (_event, oldPassword: string, newPassword: string) => {
      const session = authService.getCurrentSession()
      if (!session) {
        throw new Error('Aucune session active.')
      }
      authService.changePassword(session.userId, oldPassword, newPassword)
    }
  )

  ipcMain.handle(IPC_CHANNELS.auth.getUserById, async (_event, userId: string) => {
    return authService.getUserById(userId)
  })
}
