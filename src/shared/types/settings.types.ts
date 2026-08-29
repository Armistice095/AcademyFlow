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

/**
 * Population concernée par une tranche de frais. `tous` s'applique à tout
 * élève ; `nouveau`/`ancien` restreint la tranche selon le statut
 * d'historique de l'élève pour l'année scolaire en cours (voir
 * `getEnrollmentHistoryStatus` côté service élèves).
 */
export type TuitionTarget = 'tous' | 'nouveau' | 'ancien'

export interface TuitionInstallment {
  id: string
  scheduleId: string
  label: string
  amount: number
  dueDate: string
  sortOrder: number
  appliesTo: TuitionTarget
  /**
   * `true` si au moins un paiement validé référence déjà cette tranche.
   * Permet au front d'empêcher/avertir avant une suppression qui casserait
   * le lien avec un paiement existant (voir BR-010bis).
   */
  hasPayments: boolean
}

export interface TuitionInstallmentInput {
  /**
   * Id de la tranche existante à mettre à jour. Absent (undefined) pour une
   * tranche nouvellement ajoutée dans le formulaire — le service lui
   * génère alors un nouvel id. Ne JAMAIS régénérer un id côté service pour
   * une tranche déjà existante : ça casse le lien avec les paiements déjà
   * enregistrés (transactions.installmentId).
   */
  id?: string
  label: string
  amount: number
  dueDate: string
  sortOrder?: number
  appliesTo: TuitionTarget
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
