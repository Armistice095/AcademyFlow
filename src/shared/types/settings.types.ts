export interface SchoolYear {
  id: string
  /** ex: "2025-2026" */
  label: string
  isCurrent: boolean
  createdAt: string
}

export interface SchoolClass {
  id: string
  /** ex: "CI", "CP", "6ème"... */
  name: string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// Barème de frais de scolarité (F-027)
// ---------------------------------------------------------------------------

export interface TuitionInstallment {
  id: string
  scheduleId: string
  label: string
  amount: number
  dueDate: string
  sortOrder: number
}

export interface TuitionInstallmentInput {
  label: string
  amount: number
  dueDate: string
  sortOrder?: number
}

export interface TuitionSchedule {
  id: string
  classId: string
  schoolYearId: string
  installments: TuitionInstallment[]
}

export interface SaveTuitionScheduleDTO {
  classId: string
  schoolYearId: string
  installments: TuitionInstallmentInput[]
}

// ---------------------------------------------------------------------------
// Informations de l'établissement (personnalisation des documents)
// ---------------------------------------------------------------------------

export interface SchoolInfo {
  name: string
  address: string | null
  phone: string | null
  email: string | null
  /** Data URL base64 (ex: "data:image/png;base64,..."), ou `null` si non défini. */
  logoDataUrl: string | null
  /** Data URL base64 du cachet de l'établissement, ou `null` si non défini. */
  stampDataUrl: string | null
  updatedAt: string
}

export type UpdateSchoolInfoDTO = Partial<Omit<SchoolInfo, 'updatedAt'>>
