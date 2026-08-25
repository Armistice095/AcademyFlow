import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import * as studentService from '@main/services/student.service'
import * as authService from '@main/services/auth.service'
import type {
  CreateEnrollmentDTO,
  CreateGuardianDTO,
  CreateStudentDTO,
  PromoteStudentsDTO,
  StudentSearchQuery,
  StudentStatsQuery,
  UpdateGuardianDTO,
  UpdateStudentDTO
} from '@shared/types/student.types'

/** Retourne l'utilisateur courant, ou lève une erreur si personne n'est connecté. */
function requireCurrentUserId(): string {
  const session = authService.getCurrentSession()
  if (!session) throw new Error('Aucune session active.')
  return session.userId
}

/** Handlers IPC du domaine Élèves (F-001 à F-012). */
export function registerStudentsIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.students.create, async (_event, data: CreateStudentDTO) => {
    return studentService.create({ ...data, createdBy: requireCurrentUserId() })
  })

  ipcMain.handle(IPC_CHANNELS.students.update, async (_event, id: string, data: UpdateStudentDTO) => {
    return studentService.update(id, data, requireCurrentUserId())
  })

  ipcMain.handle(IPC_CHANNELS.students.delete, async (_event, id: string) => {
    studentService.softDelete(id, requireCurrentUserId())
  })

  ipcMain.handle(IPC_CHANNELS.students.findById, async (_event, id: string) => {
    return studentService.findById(id)
  })

  ipcMain.handle(IPC_CHANNELS.students.search, async (_event, query: StudentSearchQuery) => {
    return studentService.search(query)
  })

  ipcMain.handle(IPC_CHANNELS.students.getStats, async (_event, query: StudentStatsQuery) => {
    return studentService.getStats(query)
  })

  ipcMain.handle(IPC_CHANNELS.students.listEnrollmentClassNames, async (_event, schoolYearId: string) => {
    return studentService.listEnrollmentClassNames(schoolYearId)
  })

  ipcMain.handle(
    IPC_CHANNELS.students.listByClass,
    async (_event, classId: string, schoolYearId: string) => {
      return studentService.listByClass(classId, schoolYearId)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.students.addGuardian,
    async (_event, studentId: string, data: CreateGuardianDTO) => {
      return studentService.addGuardian(studentId, data)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.students.updateGuardian,
    async (_event, guardianId: string, data: UpdateGuardianDTO) => {
      return studentService.updateGuardian(guardianId, data)
    }
  )

  ipcMain.handle(IPC_CHANNELS.students.deleteGuardian, async (_event, guardianId: string) => {
    studentService.deleteGuardian(guardianId)
  })

  ipcMain.handle(IPC_CHANNELS.students.createEnrollment, async (_event, data: CreateEnrollmentDTO) => {
    return studentService.createEnrollment(data)
  })

  ipcMain.handle(IPC_CHANNELS.students.getEnrollmentHistory, async (_event, studentId: string) => {
    return studentService.getHistory(studentId)
  })

  ipcMain.handle(
    IPC_CHANNELS.students.checkDuplicate,
    async (_event, firstName: string, lastName: string, schoolYearId: string) => {
      return studentService.checkDuplicate(firstName, lastName, schoolYearId)
    }
  )

  ipcMain.handle(IPC_CHANNELS.students.promoteStudents, async (_event, data: PromoteStudentsDTO) => {
    return studentService.promoteStudents(data)
  })

  ipcMain.handle(IPC_CHANNELS.students.hasFinancialHistory, async (_event, studentId: string) => {
    return studentService.hasFinancialHistory(studentId)
  })
}
