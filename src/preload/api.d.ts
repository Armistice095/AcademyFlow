import type {
  AuthUser,
  BackupInfo,
  BackupResult,
  PaginatedResult,
  PrinterStatus,
  PrintResult
} from '@shared/types/common.types'
import type {
  CreateEnrollmentDTO,
  CreateGuardianDTO,
  Enrollment,
  EnrollmentWithDetails,
  Guardian,
  PromoteStudentsDTO,
  PromotionResult,
  Student,
  StudentListItem,
  StudentSearchQuery,
  UpdateGuardianDTO,
  UpdateStudentDTO,
  CreateStudentDTO
} from '@shared/types/student.types'
import type {
  ArrearsStudent,
  CashReport,
  CreateTransactionDTO,
  JournalFilters,
  Receipt,
  Transaction,
  TuitionAccount
} from '@shared/types/transaction.types'
import type {
  CreateEmployeeDTO,
  Employee,
  SalaryMonthStatus,
  SalaryPayment,
  UpdateEmployeeDTO
} from '@shared/types/personnel.types'
import type {
  SaveTuitionScheduleDTO,
  SchoolClass,
  SchoolInfo,
  SchoolYear,
  TuitionSchedule,
  UpdateSchoolInfoDTO
} from '@shared/types/settings.types'

/**
 * Déclaration de l'API exposée au renderer via `window.api`, organisée par
 * domaine. Chaque méthode correspond à un canal IPC (voir `@shared/ipc-channels`).
 *
 * Phase 2 : surface complète déclarée et câblée (`preload/index.ts`), mais la
 * plupart des handlers Main correspondants sont encore des squelettes vides
 * (`src/main/ipc/*.ipc.ts`) — ils seront implémentés progressivement, phase
 * par phase (voir commentaires "Complété en Phase X" dans ipc-channels.ts).
 */
export interface AcademyFlowAPI {
  system: {
    /** Handler de test pour valider le round-trip IPC (Phase 2). */
    ping: () => Promise<string>
  }

  students: {
    create: (data: CreateStudentDTO) => Promise<Student>
    update: (id: string, data: UpdateStudentDTO) => Promise<Student>
    delete: (id: string) => Promise<void>
    findById: (id: string) => Promise<Student | null>
    search: (query: StudentSearchQuery) => Promise<PaginatedResult<StudentListItem>>
    listByClass: (classId: string, schoolYearId: string) => Promise<Student[]>
    addGuardian: (studentId: string, data: CreateGuardianDTO) => Promise<Guardian>
    updateGuardian: (guardianId: string, data: UpdateGuardianDTO) => Promise<Guardian>
    deleteGuardian: (guardianId: string) => Promise<void>
    createEnrollment: (data: CreateEnrollmentDTO) => Promise<Enrollment>
    getEnrollmentHistory: (studentId: string) => Promise<EnrollmentWithDetails[]>
    checkDuplicate: (firstName: string, lastName: string, schoolYearId: string) => Promise<Student | null>
    promoteStudents: (data: PromoteStudentsDTO) => Promise<PromotionResult>
    hasFinancialHistory: (studentId: string) => Promise<boolean>
  }

  cashbox: {
    createEntry: (data: CreateTransactionDTO) => Promise<Transaction>
    cancelTransaction: (transactionId: string, reason: string) => Promise<Transaction>
    getJournal: (filters: JournalFilters) => Promise<PaginatedResult<Transaction>>
    getStudentAccount: (studentId: string) => Promise<TuitionAccount>
    listArrears: () => Promise<ArrearsStudent[]>
    getReport: (from: string, to: string) => Promise<CashReport>
    getReceipt: (transactionId: string) => Promise<Receipt | null>
    reprintReceipt: (transactionId: string) => Promise<Receipt>
    getBalance: () => Promise<number>
  }

  personnel: {
    create: (data: CreateEmployeeDTO) => Promise<Employee>
    update: (id: string, data: UpdateEmployeeDTO) => Promise<Employee>
    delete: (id: string) => Promise<void>
    list: () => Promise<Employee[]>
    markSalaryPaid: (employeeId: string, month: number, year: number) => Promise<SalaryPayment>
    getSalaryStatus: (month: number, year: number) => Promise<SalaryMonthStatus[]>
  }

  settings: {
    getCurrentSchoolYear: () => Promise<SchoolYear | null>
    listSchoolYears: () => Promise<SchoolYear[]>
    createSchoolYear: (label: string) => Promise<SchoolYear>
    setCurrentSchoolYear: (yearId: string) => Promise<SchoolYear>
    getClasses: () => Promise<SchoolClass[]>
    getTuitionSchedule: (classId: string, yearId: string) => Promise<TuitionSchedule | null>
    saveTuitionSchedule: (data: SaveTuitionScheduleDTO) => Promise<TuitionSchedule>
    getSchoolInfo: () => Promise<SchoolInfo>
    updateSchoolInfo: (data: UpdateSchoolInfoDTO) => Promise<SchoolInfo>
  }

  auth: {
    login: (username: string, password: string) => Promise<AuthUser>
    logout: () => Promise<void>
    getCurrentUser: () => Promise<AuthUser | null>
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>
    getUserById: (userId: string) => Promise<AuthUser | null>
  }

  printer: {
    printReceipt: (receiptId: string) => Promise<PrintResult>
    testConnection: () => Promise<PrinterStatus>
    openPdf: (base64: string, fileName: string) => Promise<void>
  }

  backup: {
    exportToCloud: () => Promise<BackupResult>
    getLastBackup: () => Promise<BackupInfo | null>
  }
}
