import type { SearchQuery } from './common.types'

export type Gender = 'M' | 'F'

/** Statut administratif de la fiche élève. */
export type StudentStatus = 'nouveau' | 'redoublant' | 'transféré'

/** Statut de progression pour une inscription donnée (BR-003). */
export type EnrollmentStatus = 'admis' | 'redoublant' | 'transféré'

// ---------------------------------------------------------------------------
// Responsable / tuteur
// ---------------------------------------------------------------------------

export interface Guardian {
  id: string
  studentId: string
  lastName: string
  firstName: string
  phone: string
  profession: string | null
  relationship: string
}

export interface CreateGuardianDTO {
  lastName: string
  firstName: string
  phone: string
  profession?: string
  relationship: string
}

export type UpdateGuardianDTO = Partial<CreateGuardianDTO>

// ---------------------------------------------------------------------------
// Élève
// ---------------------------------------------------------------------------

export interface Student {
  id: string
  matricule: string
  photoPath: string | null
  lastName: string
  firstName: string
  gender: Gender
  dateOfBirth: string
  placeOfBirth: string | null
  nationality: string
  address: string | null
  previousSchool: string | null
  status: StudentStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string | null
  /** Présent uniquement lorsque la fiche est chargée avec ses responsables. */
  guardians?: Guardian[]
}

export interface CreateStudentDTO {
  lastName: string
  firstName: string
  gender: Gender
  dateOfBirth: string
  placeOfBirth?: string
  nationality?: string
  address?: string
  /** Renseigné si l'élève vient d'une autre école (transfert). */
  previousSchool?: string
  status?: StudentStatus
  /** Data URL base64 de la photo (voir ImageUpload) — colonne DB `photo_path`, réutilisée pour stocker la donnée directement. */
  photoPath?: string
  /** Classe d'affectation pour l'inscription initiale (année scolaire en cours). */
  classId: string
  /** Au moins un responsable est requis (voir SPEC §8). */
  guardians: CreateGuardianDTO[]
}

export type UpdateStudentDTO = Partial<Omit<CreateStudentDTO, 'guardians' | 'classId'>>

export interface StudentSearchQuery extends SearchQuery {
  classId?: string
  schoolYearId?: string
}

/**
 * Variante de `Student` enrichie avec la classe courante — utilisée par
 * `search()` et `listByClass()` lorsqu'un `schoolYearId` est fourni, pour
 * afficher la colonne "classe" dans les listes sans requête supplémentaire.
 */
export interface StudentListItem extends Student {
  className: string | null
}

// ---------------------------------------------------------------------------
// Inscription (élève x année scolaire x classe)
// ---------------------------------------------------------------------------

export interface Enrollment {
  id: string
  studentId: string
  schoolYearId: string
  classId: string
  status: EnrollmentStatus
  createdAt: string
}

export interface CreateEnrollmentDTO {
  studentId: string
  schoolYearId: string
  classId: string
  status: EnrollmentStatus
}

/** Enrichi avec les libellés pour affichage direct dans l'historique (F-006), sans requêtes supplémentaires. */
export interface EnrollmentWithDetails extends Enrollment {
  className: string
  schoolYearLabel: string
}

// ---------------------------------------------------------------------------
// Passage de classe (F-004, F-005)
// ---------------------------------------------------------------------------

export interface PromotionDecision {
  studentId: string
  decision: 'promote' | 'repeat'
}

export interface PromoteStudentsDTO {
  sourceClassId: string
  sourceSchoolYearId: string
  targetSchoolYearId: string
  decisions: PromotionDecision[]
}

export interface PromotionResult {
  promoted: number
  repeated: number
}
