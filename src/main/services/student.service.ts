import { and, eq, like, or, sql } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  classes,
  enrollments,
  guardians,
  schoolYears,
  students,
  transactions
} from '@main/database/schema'
import { generateId } from '@main/database/id'
import { generateMatricule } from './matricule.service'
import { logAction } from './audit.service'
import type {
  CreateEnrollmentDTO,
  CreateGuardianDTO,
  CreateStudentDTO,
  Enrollment,
  EnrollmentWithDetails,
  Guardian,
  PromoteStudentsDTO,
  PromotionResult,
  Student,
  StudentListItem,
  StudentSearchQuery,
  StudentStats,
  StudentStatsQuery,
  StudentStatsTrend,
  UpdateGuardianDTO,
  UpdateStudentDTO
} from '@shared/types/student.types'
import type { PaginatedResult } from '@shared/types/common.types'

const DEFAULT_PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function toGuardian(row: typeof guardians.$inferSelect): Guardian {
  return {
    id: row.id,
    studentId: row.studentId,
    lastName: row.lastName,
    firstName: row.firstName,
    phone: row.phone,
    profession: row.profession,
    relationship: row.relationship
  }
}

function getGuardiansForStudent(studentId: string): Guardian[] {
  const db = getDb()
  return db.select().from(guardians).where(eq(guardians.studentId, studentId)).all().map(toGuardian)
}

function requireCurrentSchoolYearId(): string {
  const db = getDb()
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(eq(schoolYears.isCurrent, true)).get()
  if (!year) {
    throw new Error("Aucune année scolaire active. Configurez-en une dans Paramètres avant d'inscrire un élève.")
  }
  return year.id
}

function toStudent(row: typeof students.$inferSelect): Student {
  return {
    id: row.id,
    matricule: row.matricule,
    photoPath: row.photoPath,
    lastName: row.lastName,
    firstName: row.firstName,
    gender: row.gender as Student['gender'],
    dateOfBirth: row.dateOfBirth,
    placeOfBirth: row.placeOfBirth,
    nationality: row.nationality,
    address: row.address,
    previousSchool: row.previousSchool,
    status: row.status as Student['status'],
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy
  }
}

// ---------------------------------------------------------------------------
// Détection de doublons (Parcours 1, scénario d'erreur)
// ---------------------------------------------------------------------------

/** Recherche un élève existant portant le même nom/prénom, déjà inscrit pour l'année donnée. */
export function checkDuplicate(firstName: string, lastName: string, schoolYearId: string): Student | null {
  const db = getDb()

  const match = db
    .select({ id: students.id })
    .from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.schoolYearId, schoolYearId),
        sql`lower(${students.firstName}) = lower(${firstName})`,
        sql`lower(${students.lastName}) = lower(${lastName})`,
        eq(students.isActive, true)
      )
    )
    .get()

  return match ? findById(match.id) : null
}

// ---------------------------------------------------------------------------
// CRUD élève (F-001, F-002, F-003)
// ---------------------------------------------------------------------------

export interface CreateStudentInput extends CreateStudentDTO {
  createdBy: string
}

/** Inscription d'un nouvel élève (F-001, BR-001, BR-002). */
export function create(data: CreateStudentInput): Student {
  const db = getDb()

  if (!data.guardians || data.guardians.length === 0) {
    throw new Error('Au moins un responsable est requis.')
  }

  const schoolYearId = requireCurrentSchoolYearId()

  const duplicate = checkDuplicate(data.firstName, data.lastName, schoolYearId)
  if (duplicate) {
    throw new Error(
      `Une fiche existe déjà pour ${data.firstName} ${data.lastName} pour cette année scolaire (matricule ${duplicate.matricule}).`
    )
  }

  const targetClass = db.select({ id: classes.id }).from(classes).where(eq(classes.id, data.classId)).get()
  if (!targetClass) {
    throw new Error('Classe introuvable.')
  }

  const studentId = generateId()
  const matricule = generateMatricule()
  const status = data.status ?? 'nouveau'
  const enrollmentStatus = status === 'redoublant' ? 'redoublant' : 'admis'

  db.transaction((tx) => {
    tx.insert(students)
      .values({
        id: studentId,
        matricule,
        photoPath: data.photoPath ?? null,
        lastName: data.lastName,
        firstName: data.firstName,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        placeOfBirth: data.placeOfBirth ?? null,
        nationality: data.nationality ?? 'Béninoise',
        address: data.address ?? null,
        previousSchool: data.previousSchool ?? null,
        status,
        createdBy: data.createdBy
      })
      .run()

    tx.insert(guardians)
      .values(
        data.guardians.map((g) => ({
          id: generateId(),
          studentId,
          lastName: g.lastName,
          firstName: g.firstName,
          phone: g.phone,
          profession: g.profession ?? null,
          relationship: g.relationship
        }))
      )
      .run()

    tx.insert(enrollments)
      .values({
        id: generateId(),
        studentId,
        schoolYearId,
        classId: data.classId,
        status: enrollmentStatus
      })
      .run()
  })

  logAction({ userId: data.createdBy, action: 'create', entityType: 'student', entityId: studentId })

  const created = findById(studentId)
  if (!created) throw new Error("Échec de la récupération de l'élève après création.")
  return created
}

/** Modification des informations d'un élève (F-002 — traçable). Le matricule n'est jamais modifiable. */
export function update(id: string, data: UpdateStudentDTO, userId: string): Student {
  const db = getDb()

  const existing = db.select({ id: students.id }).from(students).where(eq(students.id, id)).get()
  if (!existing) {
    throw new Error('Élève introuvable.')
  }

  db.update(students)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(students.id, id))
    .run()

  logAction({ userId, action: 'update', entityType: 'student', entityId: id, details: data })

  const updated = findById(id)
  if (!updated) throw new Error("Échec de la récupération de l'élève après mise à jour.")
  return updated
}

/** Suppression logique (F-003, BR-006) — l'historique financier n'est jamais supprimé. */
export function softDelete(id: string, userId: string): void {
  const db = getDb()

  const existing = db.select({ id: students.id }).from(students).where(eq(students.id, id)).get()
  if (!existing) {
    throw new Error('Élève introuvable.')
  }

  db.update(students)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(students.id, id))
    .run()

  logAction({ userId, action: 'delete', entityType: 'student', entityId: id })
}

/** Indique si l'élève a des opérations de caisse enregistrées (pour avertissement avant suppression). */
export function hasFinancialHistory(studentId: string): boolean {
  const db = getDb()
  const row = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.studentId, studentId))
    .get()
  return !!row
}

/** Détail complet d'un élève (infos + responsables). */
export function findById(id: string): Student | null {
  const db = getDb()

  const row = db.select().from(students).where(eq(students.id, id)).get()
  if (!row) return null

  return { ...toStudent(row), guardians: getGuardiansForStudent(id) }
}

/**
 * Nom de la classe de l'élève pour l'année scolaire en cours, ou `null` si
 * aucune inscription courante (utilisé par l'impression thermique — Phase 9.2).
 */
export function getCurrentClassName(studentId: string): string | null {
  const db = getDb()

  const currentYear = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  if (!currentYear) return null

  const row = db
    .select({ className: classes.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.schoolYearId, currentYear.id)))
    .get()

  return row?.className ?? null
}

// ---------------------------------------------------------------------------
// Recherche & listes (F-007, F-008)
// ---------------------------------------------------------------------------

/**
 * Correspondance élève -> nom de classe pour une année scolaire donnée.
 * Utilisé pour signaler qu'un élève trouvé via une recherche globale (toutes
 * années confondues, voir l'onglet "Ancien" de la réinscription) est déjà
 * inscrit pour l'année en cours, sans jamais restreindre le périmètre de la
 * recherche elle-même à cette année.
 */
export function listEnrollmentClassNames(schoolYearId: string): Record<string, string> {
  const db = getDb()
  const rows = db
    .select({ studentId: enrollments.studentId, className: classes.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(eq(enrollments.schoolYearId, schoolYearId))
    .all()

  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.studentId] = row.className
  }
  return map
}

/** Recherche par nom/prénom/matricule (partielle), avec filtres classe/année optionnels. */
export function search(query: StudentSearchQuery): PaginatedResult<StudentListItem> {
  const db = getDb()
  const page = query.page && query.page > 0 ? query.page : 1
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE

  const conditions = [eq(students.isActive, true)]

  if (query.query && query.query.trim()) {
    const term = `%${query.query.trim()}%`
    conditions.push(
      or(like(students.lastName, term), like(students.firstName, term), like(students.matricule, term))!
    )
  }

  // Correspondance élève -> nom de classe pour l'année demandée (enrichissement + filtre éventuel).
  let classNameByStudentId: Map<string, string> | null = null
  if (query.schoolYearId) {
    const enrollmentRows = db
      .select({ studentId: enrollments.studentId, classId: enrollments.classId, className: classes.name })
      .from(enrollments)
      .innerJoin(classes, eq(classes.id, enrollments.classId))
      .where(eq(enrollments.schoolYearId, query.schoolYearId))
      .all()

    classNameByStudentId = new Map(enrollmentRows.map((r) => [r.studentId, r.className]))

    if (query.classId) {
      const allowedIds = new Set(
        enrollmentRows.filter((r) => r.classId === query.classId).map((r) => r.studentId)
      )
      if (allowedIds.size === 0) {
        return { items: [], total: 0, page, pageSize }
      }
      classNameByStudentId = new Map([...classNameByStudentId].filter(([id]) => allowedIds.has(id)))
    }
  }

  const rows = db
    .select()
    .from(students)
    .where(and(...conditions))
    .orderBy(students.lastName, students.firstName)
    .all()
    .filter((row) => !classNameByStudentId || classNameByStudentId.has(row.id))

  const total = rows.length
  const paged = rows.slice((page - 1) * pageSize, page * pageSize)

  return {
    items: paged.map((row) => ({
      ...toStudent(row),
      className: classNameByStudentId?.get(row.id) ?? null
    })),
    total,
    page,
    pageSize
  }
}

// ---------------------------------------------------------------------------
// Statistiques (cartes KPI de la liste des élèves)
// ---------------------------------------------------------------------------

function getCurrentSchoolYearIdOrNull(): string | null {
  const db = getDb()
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(eq(schoolYears.isCurrent, true)).get()
  return year?.id ?? null
}

/** Année scolaire précédant celle donnée, si elle existe (tri par libellé, ex: "2025-2026"). */
function getPreviousSchoolYearId(schoolYearId: string): string | null {
  const db = getDb()
  const years = db.select({ id: schoolYears.id }).from(schoolYears).orderBy(schoolYears.label).all()
  const index = years.findIndex((y) => y.id === schoolYearId)
  if (index <= 0) return null
  return years[index - 1].id
}

function computeStatsGrowthPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

interface StudentCounts {
  total: number
  nouveaux: number
  anciens: number
  male: number
  female: number
}

const EMPTY_COUNTS: StudentCounts = { total: 0, nouveaux: 0, anciens: 0, male: 0, female: 0 }

/** Compte les élèves actifs inscrits pour une année scolaire (et une classe optionnelle). */
function countStudents(schoolYearId: string, classId?: string): StudentCounts {
  const db = getDb()
  const conditions = [eq(enrollments.schoolYearId, schoolYearId), eq(students.isActive, true)]
  if (classId) conditions.push(eq(enrollments.classId, classId))

  const rows = db
    .select({ status: students.status, gender: students.gender })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(...conditions))
    .all()

  let nouveaux = 0
  let male = 0
  let female = 0
  for (const row of rows) {
    if (row.status === 'nouveau') nouveaux += 1
    if (row.gender === 'M') male += 1
    else if (row.gender === 'F') female += 1
  }

  return { total: rows.length, nouveaux, anciens: rows.length - nouveaux, male, female }
}

/**
 * Statistiques affichées en cartes KPI en tête de la liste des élèves
 * (effectifs total/anciens/nouveaux/garçons/filles), avec comparaison à
 * l'année scolaire précédente. Recalculées selon le filtre classe éventuel.
 */
export function getStats(query: StudentStatsQuery = {}): StudentStats {
  const schoolYearId = query.schoolYearId ?? getCurrentSchoolYearIdOrNull()
  const current = schoolYearId ? countStudents(schoolYearId, query.classId) : EMPTY_COUNTS
  const previousSchoolYearId = schoolYearId ? getPreviousSchoolYearId(schoolYearId) : null
  const previous = previousSchoolYearId ? countStudents(previousSchoolYearId, query.classId) : EMPTY_COUNTS

  const trend = (curr: number, prev: number): StudentStatsTrend => ({
    current: curr,
    previous: prev,
    growthPct: computeStatsGrowthPct(curr, prev)
  })

  return {
    total: trend(current.total, previous.total),
    anciens: trend(current.anciens, previous.anciens),
    nouveaux: trend(current.nouveaux, previous.nouveaux),
    male: { count: current.male, percentage: current.total > 0 ? (current.male / current.total) * 100 : 0 },
    female: { count: current.female, percentage: current.total > 0 ? (current.female / current.total) * 100 : 0 }
  }
}

/** Liste des élèves actifs d'une classe pour une année scolaire (F-008). */
export function listByClass(classId: string, schoolYearId: string): Student[] {
  const db = getDb()

  const rows = db
    .select({ student: students })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(
      and(eq(enrollments.classId, classId), eq(enrollments.schoolYearId, schoolYearId), eq(students.isActive, true))
    )
    .orderBy(students.lastName, students.firstName)
    .all()

  return rows.map(({ student: row }) => toStudent(row))
}

// ---------------------------------------------------------------------------
// Parcours scolaire (F-006)
// ---------------------------------------------------------------------------

export function getHistory(studentId: string): EnrollmentWithDetails[] {
  const db = getDb()

  const rows = db
    .select({ enrollment: enrollments, className: classes.name, schoolYearLabel: schoolYears.label })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(schoolYears, eq(schoolYears.id, enrollments.schoolYearId))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(schoolYears.label)
    .all()

  return rows.map(({ enrollment, className, schoolYearLabel }) => ({
    ...enrollment,
    status: enrollment.status as Enrollment['status'],
    className,
    schoolYearLabel
  }))
}

/** Inscription manuelle ponctuelle (hors passage de classe collectif). */
export function createEnrollment(data: CreateEnrollmentDTO): Enrollment {
  const db = getDb()

  const existing = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, data.studentId), eq(enrollments.schoolYearId, data.schoolYearId)))
    .get()
  if (existing) {
    throw new Error('BR-003 : cet élève a déjà un statut de progression pour cette année scolaire.')
  }

  const id = generateId()
  db.insert(enrollments)
    .values({
      id,
      studentId: data.studentId,
      schoolYearId: data.schoolYearId,
      classId: data.classId,
      status: data.status
    })
    .run()

  return { id, ...data, createdAt: new Date().toISOString() }
}

// ---------------------------------------------------------------------------
// Passage de classe (F-004, F-005) — opération atomique
// ---------------------------------------------------------------------------

/**
 * Applique un passage de classe collectif : pour chaque décision, crée une
 * nouvelle inscription dans l'année cible (classe supérieure si "promote",
 * même classe si "repeat"). Transaction unique — tout ou rien (Parcours 4).
 */
export function promoteStudents(data: PromoteStudentsDTO): PromotionResult {
  const db = getDb()

  if (data.sourceSchoolYearId === data.targetSchoolYearId) {
    throw new Error("L'année scolaire cible doit être différente de l'année source.")
  }
  if (data.decisions.length === 0) {
    throw new Error('Aucune décision à appliquer.')
  }

  return db.transaction((tx) => {
    const allClasses = tx.select().from(classes).orderBy(classes.sortOrder).all()

    let promoted = 0
    let repeated = 0

    for (const decision of data.decisions) {
      const sourceEnrollment = tx
        .select()
        .from(enrollments)
        .where(
          and(eq(enrollments.studentId, decision.studentId), eq(enrollments.schoolYearId, data.sourceSchoolYearId))
        )
        .get()
      if (!sourceEnrollment) {
        throw new Error(`Élève ${decision.studentId} : aucune inscription trouvée pour l'année source.`)
      }

      const alreadyEnrolled = tx
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(eq(enrollments.studentId, decision.studentId), eq(enrollments.schoolYearId, data.targetSchoolYearId))
        )
        .get()
      if (alreadyEnrolled) {
        throw new Error(
          `BR-003 : l'élève ${decision.studentId} a déjà une inscription pour l'année scolaire cible.`
        )
      }

      let targetClassId: string
      if (decision.decision === 'promote') {
        const currentIndex = allClasses.findIndex((c) => c.id === sourceEnrollment.classId)
        const nextClass = currentIndex >= 0 ? allClasses[currentIndex + 1] : undefined
        if (!nextClass) {
          throw new Error(`Élève ${decision.studentId} : pas de classe supérieure disponible (fin de cursus).`)
        }
        targetClassId = nextClass.id
        promoted += 1
      } else {
        targetClassId = sourceEnrollment.classId
        repeated += 1
      }

      tx.insert(enrollments)
        .values({
          id: generateId(),
          studentId: decision.studentId,
          schoolYearId: data.targetSchoolYearId,
          classId: targetClassId,
          status: decision.decision === 'promote' ? 'admis' : 'redoublant'
        })
        .run()
    }

    return { promoted, repeated }
  })
}

// ---------------------------------------------------------------------------
// Responsables (gestion individuelle, hors création initiale)
// ---------------------------------------------------------------------------

export function addGuardian(studentId: string, data: CreateGuardianDTO): Guardian {
  const db = getDb()
  const id = generateId()
  db.insert(guardians)
    .values({
      id,
      studentId,
      lastName: data.lastName,
      firstName: data.firstName,
      phone: data.phone,
      profession: data.profession ?? null,
      relationship: data.relationship
    })
    .run()
  return {
    id,
    studentId,
    lastName: data.lastName,
    firstName: data.firstName,
    phone: data.phone,
    profession: data.profession ?? null,
    relationship: data.relationship
  }
}

export function updateGuardian(guardianId: string, data: UpdateGuardianDTO): Guardian {
  const db = getDb()
  db.update(guardians).set(data).where(eq(guardians.id, guardianId)).run()
  const row = db.select().from(guardians).where(eq(guardians.id, guardianId)).get()
  if (!row) throw new Error('Responsable introuvable.')
  return toGuardian(row)
}

export function deleteGuardian(guardianId: string): void {
  const db = getDb()
  db.delete(guardians).where(eq(guardians.id, guardianId)).run()
}
