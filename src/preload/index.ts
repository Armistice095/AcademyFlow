import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { AcademyFlowAPI } from './api'

/**
 * API exposée au renderer via `window.api`, organisée par domaine.
 * Chaque méthode délègue à `ipcRenderer.invoke` sur le canal correspondant
 * (voir `@shared/ipc-channels`). Les types sont déclarés dans `./api.d.ts`.
 */
const api: AcademyFlowAPI = {
  system: {
    ping: () => ipcRenderer.invoke(IPC_CHANNELS.system.ping)
  },

  students: {
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.students.create, data),
    update: (id, data) => ipcRenderer.invoke(IPC_CHANNELS.students.update, id, data),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.students.delete, id),
    findById: (id) => ipcRenderer.invoke(IPC_CHANNELS.students.findById, id),
    search: (query) => ipcRenderer.invoke(IPC_CHANNELS.students.search, query),
    listByClass: (classId, schoolYearId) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.listByClass, classId, schoolYearId),
    addGuardian: (studentId, data) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.addGuardian, studentId, data),
    updateGuardian: (guardianId, data) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.updateGuardian, guardianId, data),
    deleteGuardian: (guardianId) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.deleteGuardian, guardianId),
    createEnrollment: (data) => ipcRenderer.invoke(IPC_CHANNELS.students.createEnrollment, data),
    getEnrollmentHistory: (studentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.getEnrollmentHistory, studentId),
    checkDuplicate: (firstName, lastName, schoolYearId) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.checkDuplicate, firstName, lastName, schoolYearId),
    promoteStudents: (data) => ipcRenderer.invoke(IPC_CHANNELS.students.promoteStudents, data),
    hasFinancialHistory: (studentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.students.hasFinancialHistory, studentId)
  },

  cashbox: {
    createEntry: (data) => ipcRenderer.invoke(IPC_CHANNELS.cashbox.createEntry, data),
    cancelTransaction: (transactionId, reason) =>
      ipcRenderer.invoke(IPC_CHANNELS.cashbox.cancelTransaction, transactionId, reason),
    getJournal: (filters) => ipcRenderer.invoke(IPC_CHANNELS.cashbox.getJournal, filters),
    getStudentAccount: (studentId) =>
      ipcRenderer.invoke(IPC_CHANNELS.cashbox.getStudentAccount, studentId),
    listArrears: () => ipcRenderer.invoke(IPC_CHANNELS.cashbox.listArrears),
    getReport: (from, to) => ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReport, from, to),
    getReceipt: (transactionId) => ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReceipt, transactionId),
    reprintReceipt: (transactionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.cashbox.reprintReceipt, transactionId),
    getBalance: () => ipcRenderer.invoke(IPC_CHANNELS.cashbox.getBalance)
  },

  personnel: {
    create: (data) => ipcRenderer.invoke(IPC_CHANNELS.personnel.create, data),
    update: (id, data) => ipcRenderer.invoke(IPC_CHANNELS.personnel.update, id, data),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.personnel.delete, id),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.personnel.list),
    markSalaryPaid: (employeeId, month, year) =>
      ipcRenderer.invoke(IPC_CHANNELS.personnel.markSalaryPaid, employeeId, month, year),
    getSalaryStatus: (month, year) =>
      ipcRenderer.invoke(IPC_CHANNELS.personnel.getSalaryStatus, month, year)
  },

  settings: {
    getCurrentSchoolYear: () => ipcRenderer.invoke(IPC_CHANNELS.settings.getCurrentSchoolYear),
    listSchoolYears: () => ipcRenderer.invoke(IPC_CHANNELS.settings.listSchoolYears),
    createSchoolYear: (label) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.createSchoolYear, label),
    setCurrentSchoolYear: (yearId) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.setCurrentSchoolYear, yearId),
    getClasses: () => ipcRenderer.invoke(IPC_CHANNELS.settings.getClasses),
    getTuitionSchedule: (classId, yearId) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.getTuitionSchedule, classId, yearId),
    saveTuitionSchedule: (data) =>
      ipcRenderer.invoke(IPC_CHANNELS.settings.saveTuitionSchedule, data),
    getSchoolInfo: () => ipcRenderer.invoke(IPC_CHANNELS.settings.getSchoolInfo),
    updateSchoolInfo: (data) => ipcRenderer.invoke(IPC_CHANNELS.settings.updateSchoolInfo, data)
  },

  auth: {
    login: (username, password) => ipcRenderer.invoke(IPC_CHANNELS.auth.login, username, password),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.auth.logout),
    getCurrentUser: () => ipcRenderer.invoke(IPC_CHANNELS.auth.getCurrentUser),
    changePassword: (oldPassword, newPassword) =>
      ipcRenderer.invoke(IPC_CHANNELS.auth.changePassword, oldPassword, newPassword),
    getUserById: (userId) => ipcRenderer.invoke(IPC_CHANNELS.auth.getUserById, userId)
  },

  printer: {
    printReceipt: (receiptId) => ipcRenderer.invoke(IPC_CHANNELS.printer.printReceipt, receiptId),
    testConnection: () => ipcRenderer.invoke(IPC_CHANNELS.printer.testConnection),
    openPdf: (base64, fileName) => ipcRenderer.invoke(IPC_CHANNELS.printer.openPdf, base64, fileName)
  },

  backup: {
    exportToCloud: () => ipcRenderer.invoke(IPC_CHANNELS.backup.exportToCloud),
    getLastBackup: () => ipcRenderer.invoke(IPC_CHANNELS.backup.getLastBackup)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (fallback sans context isolation, non utilisé en production)
  window.electron = electronAPI
  // @ts-expect-error (fallback sans context isolation, non utilisé en production)
  window.api = api
}
