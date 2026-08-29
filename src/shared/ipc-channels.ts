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
    getStats: 'students:getStats',
    listEnrollmentClassNames: 'students:listEnrollmentClassNames',
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
    getReportV2: 'cashbox:getReportV2',
    getTypeReport: 'cashbox:getTypeReport',
    getReportByClass: 'cashbox:getReportByClass',
    getReportByCashier: 'cashbox:getReportByCashier',
    getReceipt: 'cashbox:getReceipt',
    reprintReceipt: 'cashbox:reprintReceipt',
    getBalance: 'cashbox:getBalance',
    getStats: 'cashbox:getStats'
  },

  personnel: {
    create: 'personnel:create',
    update: 'personnel:update',
    delete: 'personnel:delete',
    list: 'personnel:list',
    getById: 'personnel:getById',
    markSalaryPaid: 'personnel:markSalaryPaid',
    getSalaryStatus: 'personnel:getSalaryStatus',
    getSalaryHistory: 'personnel:getSalaryHistory',
    grantAdvance: 'personnel:grantAdvance',
    cancelAdvance: 'personnel:cancelAdvance',
    listAdvances: 'personnel:listAdvances',
    getPendingAdvance: 'personnel:getPendingAdvance'
  },

  settings: {
    getCurrentSchoolYear: 'settings:getCurrentSchoolYear',
    listSchoolYears: 'settings:listSchoolYears',
    createSchoolYear: 'settings:createSchoolYear',
    setCurrentSchoolYear: 'settings:setCurrentSchoolYear',
    getClasses: 'settings:getClasses',
    createClass: 'settings:createClass',
    updateClass: 'settings:updateClass',
    deleteClass: 'settings:deleteClass',
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
    getUserById: 'auth:getUserById',
    /** Gestion des comptes utilisateurs (Phase 9.4, onglet « Utilisateurs » des Paramètres). */
    listUsers: 'auth:listUsers',
    createUser: 'auth:createUser',
    updateUser: 'auth:updateUser',
    setUserActive: 'auth:setUserActive',
    resetPassword: 'auth:resetPassword'
  },

  printer: {
    printReceipt: 'printer:printReceipt',
    testConnection: 'printer:testConnection',
    openPdf: 'printer:openPdf',
    /** Ouvre tout fichier binaire déjà généré côté renderer (ex: export Excel) avec l'application par défaut du système. */
    openFile: 'printer:openFile',
    /** Configuration de l'imprimante thermique (Phase 9.2). */
    getConfig: 'printer:getConfig',
    updateConfig: 'printer:updateConfig',
    getStatus: 'printer:getStatus'
  },

  backup: {
    exportToCloud: 'backup:exportToCloud',
    getLastBackup: 'backup:getLastBackup',
    /** Sauvegarde cloud Google Drive (Phase 9.3). */
    getStatus: 'backup:getStatus',
    listBackups: 'backup:listBackups',
    restoreFromCloud: 'backup:restoreFromCloud',
    connectGoogleAccount: 'backup:connectGoogleAccount',
    disconnectGoogleAccount: 'backup:disconnectGoogleAccount',
    updateSettings: 'backup:updateSettings'
  },

  license: {
    getStatus: 'license:getStatus',
    activate: 'license:activate',
    resync: 'license:resync',
    markOnboardingCompleted: 'license:markOnboardingCompleted'
  },

  dashboard: {
    /** Agrégat complet du tableau de bord financier (F-019, Phase 9.1). */
    getStats: 'dashboard:getStats'
  }
} as const
