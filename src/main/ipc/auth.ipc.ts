import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as authService from '@main/services/auth.service'
import type { CreateUserDTO, UpdateUserDTO } from '@shared/types/user.types'

/** Handlers IPC du domaine Authentification, y compris la gestion des comptes (Phase 9.4). */
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

  ipcMain.handle(IPC_CHANNELS.auth.listUsers, async () => {
    return authService.listUsers()
  })

  ipcMain.handle(IPC_CHANNELS.auth.createUser, async (_event, data: CreateUserDTO) => {
    return authService.createUser(data)
  })

  ipcMain.handle(
    IPC_CHANNELS.auth.updateUser,
    async (_event, userId: string, data: UpdateUserDTO) => {
      return authService.updateUser(userId, data)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.auth.setUserActive,
    async (_event, userId: string, isActive: boolean) => {
      return authService.setUserActive(userId, isActive)
    }
  )

  ipcMain.handle(IPC_CHANNELS.auth.resetPassword, async (_event, userId: string) => {
    return authService.resetPassword(userId)
  })
}
