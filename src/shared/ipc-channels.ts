/**
 * Noms des canaux IPC — source unique de vérité, utilisée par :
 *  - les handlers du Main Process (`src/main/ipc/*.ipc.ts`)
 *  - le preload script (`src/preload/index.ts`)
 *
 * Organisé par domaine, en écho aux 7 domaines de l'API exposée au renderer
 * (`window.api.students`, `window.api.cashbox`, etc. — voir `preload/api.d.ts`).
 *
 * Phase 2 : structure complète posée. Les domaines `personnel` restent vides
 * (méthodes non encore spécifiées) et seront complétés en Phase 8.
 */
export const IPC_CHANNELS = {
  /** Canal de test — validation du round-trip IPC en Phase 2. */
  system: {
    ping: 'system:ping'
  },

  students: {
    create: 'students:create',
    update: 'students:update',
    delete: 'students:delete',
    findById: 'students:findById',
    search: 'students:search',
    listByClass: 'students:listByClass',
    addGuardian: 'students:addGuardian',
    updateGuardian: 'students:updateGuardian',
    deleteGuardian: 'students:deleteGuardian',
    createEnrollment: 'students:createEnrollment',
    getEnrollmentHistory: 'students:getEnrollmentHistory',
    checkDuplicate: 'students:checkDuplicate',
    promoteStudents: 'students:promoteStudents',
    hasFinancialHistory: 'students:hasFinancialHistory'
  },

  cashbox: {
    createEntry: 'cashbox:createEntry',
    cancelTransaction: 'cashbox:cancelTransaction',
    getJournal: 'cashbox:getJournal',
    getStudentAccount: 'cashbox:getStudentAccount',
    listArrears: 'cashbox:listArrears',
    getReport: 'cashbox:getReport',
    getReceipt: 'cashbox:getReceipt',
    reprintReceipt: 'cashbox:reprintReceipt',
    getBalance: 'cashbox:getBalance'
  },

  /** Complété en Phase 8 — Module Personnel. */
  personnel: {
    create: 'personnel:create',
    update: 'personnel:update',
    delete: 'personnel:delete',
    list: 'personnel:list',
    markSalaryPaid: 'personnel:markSalaryPaid',
    getSalaryStatus: 'personnel:getSalaryStatus'
  },

  settings: {
    getCurrentSchoolYear: 'settings:getCurrentSchoolYear',
    listSchoolYears: 'settings:listSchoolYears',
    createSchoolYear: 'settings:createSchoolYear',
    setCurrentSchoolYear: 'settings:setCurrentSchoolYear',
    getClasses: 'settings:getClasses',
    getTuitionSchedule: 'settings:getTuitionSchedule',
    saveTuitionSchedule: 'settings:saveTuitionSchedule',
    getSchoolInfo: 'settings:getSchoolInfo',
    updateSchoolInfo: 'settings:updateSchoolInfo'
  },

  auth: {
    login: 'auth:login',
    logout: 'auth:logout',
    getCurrentUser: 'auth:getCurrentUser',
    changePassword: 'auth:changePassword',
    getUserById: 'auth:getUserById'
  },

  printer: {
    printReceipt: 'printer:printReceipt',
    testConnection: 'printer:testConnection',
    openPdf: 'printer:openPdf'
  },

  backup: {
    exportToCloud: 'backup:exportToCloud',
    getLastBackup: 'backup:getLastBackup'
  }
} as const
