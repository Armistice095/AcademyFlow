import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as personnelService from '@main/services/personnel.service'
import * as authService from '@main/services/auth.service'
import type {
  CreateEmployeeDTO,
  GrantSalaryAdvanceDTO,
  UpdateEmployeeDTO
} from '@shared/types/personnel.types'

/** Retourne l'utilisateur courant, ou lève une erreur si personne n'est connecté. */
function requireCurrentUserId(): string {
  const session = authService.getCurrentSession()
  if (!session) throw new Error('Aucune session active.')
  return session.userId
}

/** Handlers IPC du domaine Personnel (F-022 à F-025). */
export function registerPersonnelIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.personnel.create, async (_event, data: CreateEmployeeDTO) => {
    return personnelService.create({ ...data, userId: requireCurrentUserId() })
  })

  ipcMain.handle(
    IPC_CHANNELS.personnel.update,
    async (_event, id: string, data: UpdateEmployeeDTO) => {
      return personnelService.update(id, data, requireCurrentUserId())
    }
  )

  ipcMain.handle(IPC_CHANNELS.personnel.delete, async (_event, id: string) => {
    personnelService.softDelete(id, requireCurrentUserId())
  })

  ipcMain.handle(IPC_CHANNELS.personnel.list, async () => {
    return personnelService.listAll()
  })

  ipcMain.handle(IPC_CHANNELS.personnel.getById, async (_event, id: string) => {
    return personnelService.getById(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.personnel.markSalaryPaid,
    async (_event, employeeId: string, month: number, year: number) => {
      return personnelService.paySalary(employeeId, month, year, requireCurrentUserId())
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.personnel.getSalaryStatus,
    async (_event, month: number, year: number) => {
      return personnelService.getSalaryStatus(month, year)
    }
  )

  ipcMain.handle(IPC_CHANNELS.personnel.getSalaryHistory, async (_event, employeeId: string) => {
    return personnelService.getSalaryHistory(employeeId)
  })

  ipcMain.handle(
    IPC_CHANNELS.personnel.grantAdvance,
    async (_event, data: GrantSalaryAdvanceDTO) => {
      return personnelService.grantAdvance({ ...data, userId: requireCurrentUserId() })
    }
  )

  ipcMain.handle(IPC_CHANNELS.personnel.cancelAdvance, async (_event, id: string) => {
    personnelService.cancelAdvance(id, requireCurrentUserId())
  })

  ipcMain.handle(IPC_CHANNELS.personnel.listAdvances, async (_event, employeeId: string) => {
    return personnelService.listAdvances(employeeId)
  })

  ipcMain.handle(IPC_CHANNELS.personnel.getPendingAdvance, async (_event, employeeId: string) => {
    return personnelService.getPendingAdvance(employeeId)
  })
}
