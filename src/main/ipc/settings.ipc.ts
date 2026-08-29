import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as settingsService from '@main/services/settings.service'
import type { SaveTuitionScheduleDTO, UpdateSchoolInfoDTO } from '@shared/types/settings.types'

/** Handlers IPC du domaine Paramètres (F-026, F-027). */
export function registerSettingsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.settings.getCurrentSchoolYear, async () => {
    return settingsService.getCurrentSchoolYear()
  })

  ipcMain.handle(IPC_CHANNELS.settings.listSchoolYears, async () => {
    return settingsService.listSchoolYears()
  })

  ipcMain.handle(IPC_CHANNELS.settings.createSchoolYear, async (_event, label: string) => {
    return settingsService.createSchoolYear(label)
  })

  ipcMain.handle(IPC_CHANNELS.settings.setCurrentSchoolYear, async (_event, yearId: string) => {
    return settingsService.setCurrentSchoolYear(yearId)
  })

  ipcMain.handle(IPC_CHANNELS.settings.getClasses, async () => {
    return settingsService.getClasses()
  })

  ipcMain.handle(IPC_CHANNELS.settings.createClass, async (_event, name: string) => {
    return settingsService.createClass(name)
  })

  ipcMain.handle(IPC_CHANNELS.settings.updateClass, async (_event, id: string, name: string) => {
    return settingsService.updateClass(id, name)
  })

  ipcMain.handle(IPC_CHANNELS.settings.deleteClass, async (_event, id: string) => {
    return settingsService.deleteClass(id)
  })

  ipcMain.handle(
    IPC_CHANNELS.settings.getTuitionSchedule,
    async (_event, classId: string, yearId: string) => {
      return settingsService.getTuitionSchedule(classId, yearId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.settings.saveTuitionSchedule,
    async (_event, data: SaveTuitionScheduleDTO) => {
      return settingsService.saveTuitionSchedule(data)
    }
  )

  ipcMain.handle(IPC_CHANNELS.settings.getSchoolInfo, async () => {
    return settingsService.getSchoolInfo()
  })

  ipcMain.handle(
    IPC_CHANNELS.settings.updateSchoolInfo,
    async (_event, data: UpdateSchoolInfoDTO) => {
      return settingsService.updateSchoolInfo(data)
    }
  )
}
