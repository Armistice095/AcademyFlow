import { and, eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { classes, schoolInfo, schoolYears, tuitionInstallments, tuitionSchedules } from '@main/database/schema'
import { generateId } from '@main/database/id'
import type {
  SaveTuitionScheduleDTO,
  SchoolClass,
  SchoolInfo,
  SchoolYear,
  TuitionSchedule,
  UpdateSchoolInfoDTO
} from '@shared/types/settings.types'

// ---------------------------------------------------------------------------
// Années scolaires (F-026)
// ---------------------------------------------------------------------------

export function getCurrentSchoolYear(): SchoolYear | null {
  const db = getDb()
  return db.select().from(schoolYears).where(eq(schoolYears.isCurrent, true)).get() ?? null
}

export function listSchoolYears(): SchoolYear[] {
  const db = getDb()
  return db.select().from(schoolYears).orderBy(schoolYears.label).all()
}

export function createSchoolYear(label: string): SchoolYear {
  const db = getDb()

  const trimmed = label.trim()
  if (!trimmed) {
    throw new Error("Le libellé de l'année scolaire est requis.")
  }

  const existing = db.select({ id: schoolYears.id }).from(schoolYears).where(eq(schoolYears.label, trimmed)).get()
  if (existing) {
    throw new Error(`L'année scolaire "${trimmed}" existe déjà.`)
  }

  const id = generateId()
  db.insert(schoolYears).values({ id, label: trimmed, isCurrent: false }).run()

  return { id, label: trimmed, isCurrent: false, createdAt: new Date().toISOString() }
}

/**
 * Active une année scolaire (F-026). Ne modifie ni ne masque les données des
 * années précédentes (SPEC F-026) — seul le flag `isCurrent` change.
 */
export function setCurrentSchoolYear(yearId: string): SchoolYear {
  const db = getDb()

  const target = db.select().from(schoolYears).where(eq(schoolYears.id, yearId)).get()
  if (!target) {
    throw new Error('Année scolaire introuvable.')
  }

  db.transaction((tx) => {
    tx.update(schoolYears).set({ isCurrent: false }).where(eq(schoolYears.isCurrent, true)).run()
    tx.update(schoolYears).set({ isCurrent: true }).where(eq(schoolYears.id, yearId)).run()
  })

  return { ...target, isCurrent: true }
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export function getClasses(): SchoolClass[] {
  const db = getDb()
  return db.select().from(classes).orderBy(classes.sortOrder).all()
}

// ---------------------------------------------------------------------------
// Barème de frais de scolarité (F-027, BR-010)
// ---------------------------------------------------------------------------

export function getTuitionSchedule(classId: string, schoolYearId: string): TuitionSchedule | null {
  const db = getDb()

  const schedule = db
    .select()
    .from(tuitionSchedules)
    .where(and(eq(tuitionSchedules.classId, classId), eq(tuitionSchedules.schoolYearId, schoolYearId)))
    .get()

  if (!schedule) return null

  const installments = db
    .select()
    .from(tuitionInstallments)
    .where(eq(tuitionInstallments.scheduleId, schedule.id))
    .orderBy(tuitionInstallments.sortOrder)
    .all()

  return { ...schedule, installments }
}

/**
 * Crée ou remplace intégralement le barème de frais d'une classe pour une
 * année scolaire donnée (upsert). Les tranches existantes sont remplacées
 * par la liste fournie — opération atomique (transaction).
 */
export function saveTuitionSchedule(data: SaveTuitionScheduleDTO): TuitionSchedule {
  const db = getDb()

  if (data.installments.length === 0) {
    throw new Error('Au moins une tranche est requise.')
  }
  for (const installment of data.installments) {
    if (!installment.label.trim()) throw new Error('Chaque tranche doit avoir un libellé.')
    if (installment.amount <= 0) throw new Error('Le montant de chaque tranche doit être positif.')
    if (!installment.dueDate) throw new Error("Chaque tranche doit avoir une date d'échéance.")
  }

  const scheduleId = db.transaction((tx) => {
    let schedule = tx
      .select({ id: tuitionSchedules.id })
      .from(tuitionSchedules)
      .where(
        and(eq(tuitionSchedules.classId, data.classId), eq(tuitionSchedules.schoolYearId, data.schoolYearId))
      )
      .get()

    if (!schedule) {
      const id = generateId()
      tx.insert(tuitionSchedules)
        .values({ id, classId: data.classId, schoolYearId: data.schoolYearId })
        .run()
      schedule = { id }
    } else {
      tx.delete(tuitionInstallments).where(eq(tuitionInstallments.scheduleId, schedule.id)).run()
    }

    tx.insert(tuitionInstallments)
      .values(
        data.installments.map((installment, index) => ({
          id: generateId(),
          scheduleId: schedule!.id,
          label: installment.label.trim(),
          amount: installment.amount,
          dueDate: installment.dueDate,
          sortOrder: installment.sortOrder ?? index
        }))
      )
      .run()

    return schedule.id
  })

  const result = getTuitionSchedule(data.classId, data.schoolYearId)
  if (!result) {
    // Ne devrait jamais arriver : on vient de créer/mettre à jour ce barème.
    throw new Error(`Barème introuvable après sauvegarde (id: ${scheduleId}).`)
  }
  return result
}

// ---------------------------------------------------------------------------
// Informations de l'établissement (singleton — personnalisation des documents)
// ---------------------------------------------------------------------------

/** Identifiant fixe de l'unique ligne de la table SCHOOL_INFO. */
const SCHOOL_INFO_ID = 'singleton'

/**
 * Retourne les informations de l'établissement, en créant la ligne singleton
 * avec des valeurs vides si elle n'existe pas encore — auto-guérison utile
 * y compris pour les bases créées avant l'introduction de cette table.
 */
export function getSchoolInfo(): SchoolInfo {
  const db = getDb()

  let row = db.select().from(schoolInfo).where(eq(schoolInfo.id, SCHOOL_INFO_ID)).get()
  if (!row) {
    db.insert(schoolInfo).values({ id: SCHOOL_INFO_ID, name: '' }).run()
    row = db.select().from(schoolInfo).where(eq(schoolInfo.id, SCHOOL_INFO_ID)).get()
  }
  if (!row) {
    throw new Error('Impossible de créer la ligne singleton SCHOOL_INFO.')
  }

  return {
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logoDataUrl: row.logoDataUrl,
    stampDataUrl: row.stampDataUrl,
    updatedAt: row.updatedAt
  }
}

export function updateSchoolInfo(data: UpdateSchoolInfoDTO): SchoolInfo {
  const db = getDb()

  // S'assure que la ligne singleton existe avant la mise à jour.
  getSchoolInfo()

  db.update(schoolInfo)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schoolInfo.id, SCHOOL_INFO_ID))
    .run()

  return getSchoolInfo()
}
