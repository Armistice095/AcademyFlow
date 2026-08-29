"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      electron.ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        electron.ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return electron.ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      electron.ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      electron.ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return electron.ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      electron.ipcRenderer.once(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      electron.ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return electron.webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        electron.webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        electron.webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return electron.webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
const IPC_CHANNELS = {
  /** Canal de test — validation du round-trip IPC en Phase 2. */
  system: {
    ping: "system:ping"
  },
  students: {
    create: "students:create",
    update: "students:update",
    delete: "students:delete",
    findById: "students:findById",
    search: "students:search",
    getStats: "students:getStats",
    listEnrollmentClassNames: "students:listEnrollmentClassNames",
    listByClass: "students:listByClass",
    addGuardian: "students:addGuardian",
    updateGuardian: "students:updateGuardian",
    deleteGuardian: "students:deleteGuardian",
    createEnrollment: "students:createEnrollment",
    getEnrollmentHistory: "students:getEnrollmentHistory",
    checkDuplicate: "students:checkDuplicate",
    promoteStudents: "students:promoteStudents",
    hasFinancialHistory: "students:hasFinancialHistory"
  },
  cashbox: {
    createEntry: "cashbox:createEntry",
    cancelTransaction: "cashbox:cancelTransaction",
    getJournal: "cashbox:getJournal",
    getStudentAccount: "cashbox:getStudentAccount",
    listArrears: "cashbox:listArrears",
    getReportV2: "cashbox:getReportV2",
    getTypeReport: "cashbox:getTypeReport",
    getReportByClass: "cashbox:getReportByClass",
    getReportByCashier: "cashbox:getReportByCashier",
    getReceipt: "cashbox:getReceipt",
    reprintReceipt: "cashbox:reprintReceipt",
    getBalance: "cashbox:getBalance",
    getStats: "cashbox:getStats"
  },
  personnel: {
    create: "personnel:create",
    update: "personnel:update",
    delete: "personnel:delete",
    list: "personnel:list",
    getById: "personnel:getById",
    markSalaryPaid: "personnel:markSalaryPaid",
    getSalaryStatus: "personnel:getSalaryStatus",
    getSalaryHistory: "personnel:getSalaryHistory",
    grantAdvance: "personnel:grantAdvance",
    cancelAdvance: "personnel:cancelAdvance",
    listAdvances: "personnel:listAdvances",
    getPendingAdvance: "personnel:getPendingAdvance"
  },
  settings: {
    getCurrentSchoolYear: "settings:getCurrentSchoolYear",
    listSchoolYears: "settings:listSchoolYears",
    createSchoolYear: "settings:createSchoolYear",
    setCurrentSchoolYear: "settings:setCurrentSchoolYear",
    getClasses: "settings:getClasses",
    createClass: "settings:createClass",
    updateClass: "settings:updateClass",
    deleteClass: "settings:deleteClass",
    getTuitionSchedule: "settings:getTuitionSchedule",
    saveTuitionSchedule: "settings:saveTuitionSchedule",
    getSchoolInfo: "settings:getSchoolInfo",
    updateSchoolInfo: "settings:updateSchoolInfo"
  },
  auth: {
    login: "auth:login",
    logout: "auth:logout",
    getCurrentUser: "auth:getCurrentUser",
    changePassword: "auth:changePassword",
    getUserById: "auth:getUserById",
    /** Gestion des comptes utilisateurs (Phase 9.4, onglet « Utilisateurs » des Paramètres). */
    listUsers: "auth:listUsers",
    createUser: "auth:createUser",
    updateUser: "auth:updateUser",
    setUserActive: "auth:setUserActive",
    resetPassword: "auth:resetPassword"
  },
  printer: {
    printReceipt: "printer:printReceipt",
    testConnection: "printer:testConnection",
    openPdf: "printer:openPdf",
    /** Ouvre tout fichier binaire déjà généré côté renderer (ex: export Excel) avec l'application par défaut du système. */
    openFile: "printer:openFile",
    /** Configuration de l'imprimante thermique (Phase 9.2). */
    getConfig: "printer:getConfig",
    updateConfig: "printer:updateConfig",
    getStatus: "printer:getStatus"
  },
  backup: {
    exportToCloud: "backup:exportToCloud",
    getLastBackup: "backup:getLastBackup",
    /** Sauvegarde cloud Google Drive (Phase 9.3). */
    getStatus: "backup:getStatus",
    listBackups: "backup:listBackups",
    restoreFromCloud: "backup:restoreFromCloud",
    connectGoogleAccount: "backup:connectGoogleAccount",
    disconnectGoogleAccount: "backup:disconnectGoogleAccount",
    updateSettings: "backup:updateSettings"
  },
  license: {
    getStatus: "license:getStatus",
    activate: "license:activate",
    resync: "license:resync",
    markOnboardingCompleted: "license:markOnboardingCompleted"
  },
  dashboard: {
    /** Agrégat complet du tableau de bord financier (F-019, Phase 9.1). */
    getStats: "dashboard:getStats"
  }
};
const api = {
  system: {
    ping: () => electron.ipcRenderer.invoke(IPC_CHANNELS.system.ping)
  },
  students: {
    create: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.create, data),
    update: (id, data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.update, id, data),
    delete: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.delete, id),
    findById: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.findById, id),
    search: (query) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.search, query),
    getStats: (query) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.getStats, query),
    listEnrollmentClassNames: (schoolYearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.listEnrollmentClassNames, schoolYearId),
    listByClass: (classId, schoolYearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.listByClass, classId, schoolYearId),
    addGuardian: (studentId, data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.addGuardian, studentId, data),
    updateGuardian: (guardianId, data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.updateGuardian, guardianId, data),
    deleteGuardian: (guardianId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.deleteGuardian, guardianId),
    createEnrollment: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.createEnrollment, data),
    getEnrollmentHistory: (studentId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.getEnrollmentHistory, studentId),
    checkDuplicate: (firstName, lastName, schoolYearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.checkDuplicate, firstName, lastName, schoolYearId),
    promoteStudents: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.promoteStudents, data),
    hasFinancialHistory: (studentId) => electron.ipcRenderer.invoke(IPC_CHANNELS.students.hasFinancialHistory, studentId)
  },
  cashbox: {
    createEntry: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.createEntry, data),
    cancelTransaction: (transactionId, reason) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.cancelTransaction, transactionId, reason),
    getJournal: (filters) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getJournal, filters),
    getStudentAccount: (studentId) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getStudentAccount, studentId),
    listArrears: () => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.listArrears),
    getReportV2: (filters) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReportV2, filters),
    getTypeReport: (filters, type) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getTypeReport, filters, type),
    getReportByClass: (filters) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReportByClass, filters),
    getReportByCashier: (filters) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReportByCashier, filters),
    getReceipt: (transactionId) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getReceipt, transactionId),
    reprintReceipt: (transactionId) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.reprintReceipt, transactionId),
    getBalance: (schoolYearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getBalance, schoolYearId),
    getStats: (schoolYearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.cashbox.getStats, schoolYearId)
  },
  personnel: {
    create: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.create, data),
    update: (id, data) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.update, id, data),
    delete: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.delete, id),
    list: () => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.list),
    getById: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.getById, id),
    markSalaryPaid: (employeeId, month, year) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.markSalaryPaid, employeeId, month, year),
    getSalaryStatus: (month, year) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.getSalaryStatus, month, year),
    getSalaryHistory: (employeeId) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.getSalaryHistory, employeeId),
    grantAdvance: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.grantAdvance, data),
    cancelAdvance: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.cancelAdvance, id),
    listAdvances: (employeeId) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.listAdvances, employeeId),
    getPendingAdvance: (employeeId) => electron.ipcRenderer.invoke(IPC_CHANNELS.personnel.getPendingAdvance, employeeId)
  },
  settings: {
    getCurrentSchoolYear: () => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.getCurrentSchoolYear),
    listSchoolYears: () => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.listSchoolYears),
    createSchoolYear: (label) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.createSchoolYear, label),
    setCurrentSchoolYear: (yearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.setCurrentSchoolYear, yearId),
    getClasses: () => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.getClasses),
    createClass: (name) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.createClass, name),
    updateClass: (id, name) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.updateClass, id, name),
    deleteClass: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.deleteClass, id),
    getTuitionSchedule: (classId, yearId) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.getTuitionSchedule, classId, yearId),
    saveTuitionSchedule: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.saveTuitionSchedule, data),
    getSchoolInfo: () => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.getSchoolInfo),
    updateSchoolInfo: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.settings.updateSchoolInfo, data)
  },
  auth: {
    login: (username, password) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.login, username, password),
    logout: () => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.logout),
    getCurrentUser: () => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.getCurrentUser),
    changePassword: (oldPassword, newPassword) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.changePassword, oldPassword, newPassword),
    getUserById: (userId) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.getUserById, userId),
    listUsers: () => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.listUsers),
    createUser: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.createUser, data),
    updateUser: (userId, data) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.updateUser, userId, data),
    setUserActive: (userId, isActive) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.setUserActive, userId, isActive),
    resetPassword: (userId) => electron.ipcRenderer.invoke(IPC_CHANNELS.auth.resetPassword, userId)
  },
  printer: {
    printReceipt: (receiptId) => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.printReceipt, receiptId),
    testConnection: () => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.testConnection),
    openPdf: (base64, fileName) => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.openPdf, base64, fileName),
    openFile: (base64, fileName) => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.openFile, base64, fileName),
    getConfig: () => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.getConfig),
    updateConfig: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.updateConfig, data),
    getStatus: () => electron.ipcRenderer.invoke(IPC_CHANNELS.printer.getStatus)
  },
  backup: {
    exportToCloud: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.exportToCloud),
    getLastBackup: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.getLastBackup),
    getStatus: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.getStatus),
    listBackups: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.listBackups),
    restoreFromCloud: (backupId) => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.restoreFromCloud, backupId),
    connectGoogleAccount: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.connectGoogleAccount),
    disconnectGoogleAccount: () => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.disconnectGoogleAccount),
    updateSettings: (data) => electron.ipcRenderer.invoke(IPC_CHANNELS.backup.updateSettings, data)
  },
  dashboard: {
    getStats: () => electron.ipcRenderer.invoke(IPC_CHANNELS.dashboard.getStats)
  },
  license: {
    getStatus: () => electron.ipcRenderer.invoke(IPC_CHANNELS.license.getStatus),
    activate: (dto) => electron.ipcRenderer.invoke(IPC_CHANNELS.license.activate, dto),
    resync: () => electron.ipcRenderer.invoke(IPC_CHANNELS.license.resync),
    markOnboardingCompleted: () => electron.ipcRenderer.invoke(IPC_CHANNELS.license.markOnboardingCompleted)
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
