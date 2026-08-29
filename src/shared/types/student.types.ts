import type { SearchQuery } from './common.types'

export type Gender = 'M' | 'F'

/**
 * Statut d'historique d'un élève — TOUJOURS calculé, jamais stocké (voir
 * `getEnrollmentHistoryStatus` dans student.service.ts). `nouveau` signifie
 * que l'inscription considérée est la toute première de l'élève dans
 * l'établissement ; sinon `ancien`. Une fois `ancien`, un élève ne redevient
 * jamais `nouveau`, même s'il redouble (voir `EnrollmentStatus` pour ça).
 */
export type StudentHistoryStatus = 'nouveau' | 'ancien'

/** Statut de progression pour une inscription donnée (BR-003). */
export type EnrollmentStatus = 'admis' | 'redoublant'

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
  isActive: boolean
  createdAt: string
  updatedAt: string
  createdBy: string | null
  /** Présent uniquement lorsque la fiche est chargée avec ses responsables. */
  guardians?: Guardian[]
  /**
   * Calculé (jamais stocké) : `nouveau` si l'élève n'a encore jamais été
   * inscrit avant sa toute première inscription en base, `ancien` sinon.
   * Reflète l'historique global de l'élève, pas une année en particulier —
   * pour le statut d'une inscription précise, voir `EnrollmentWithDetails`.
   */
  historyStatus?: StudentHistoryStatus
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

// ---------------------------------------------------------------------------
// Statistiques (cartes KPI de la liste des élèves)
// ---------------------------------------------------------------------------

/** Filtre optionnel classe/année pour le calcul des statistiques. */
export interface StudentStatsQuery {
  classId?: string
  schoolYearId?: string
}

/** Valeur courante + valeur de l'année précédente, pour affichage d'une tendance. */
export interface StudentStatsTrend {
  current: number
  previous: number
  /** `null` si l'année précédente n'existe pas ou comptait 0 élève (comparaison non pertinente). */
  growthPct: number | null
}

export interface StudentGenderStat {
  count: number
  /** Pourcentage de l'effectif total (0 si l'effectif est nul). */
  percentage: number
}

export interface StudentStats {
  total: StudentStatsTrend
  anciens: StudentStatsTrend
  nouveaux: StudentStatsTrend
  male: StudentGenderStat
  female: StudentGenderStat
}

/**
 * Variante de `Student` enrichie avec la classe courante — utilisée par
 * `search()` et `listByClass()` lorsqu'un `schoolYearId` est fourni, pour
 * afficher la colonne "classe" dans les listes sans requête supplémentaire.
 * `historyStatus` est calculé en lot pour toute la liste (voir service).
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
