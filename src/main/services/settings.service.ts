import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  classes,
  enrollments,
  schoolInfo,
  schoolYears,
  transactions,
  tuitionInstallments,
  tuitionSchedules
} from '@main/database/schema'
import { generateId } from '@main/database/id'
import { validateSchoolYearLabel } from '@shared/validators/school-year'
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
  const validation = validateSchoolYearLabel(trimmed)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const existing = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.label, trimmed))
    .get()
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

/**
 * Crée une classe. `sortOrder` est attribué automatiquement (à la suite des
 * classes existantes) — l'ordre d'affichage se réordonne ensuite via
 * `reorderClasses` si besoin (non implémenté pour l'instant, pas de besoin
 * exprimé au-delà de l'ordre de création).
 */
export function createClass(name: string): SchoolClass {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Le nom de la classe est requis.')
  }

  const db = getDb()
  const existing = getClasses()
  if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`La classe « ${trimmed} » existe déjà.`)
  }

  const nextSortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0

  const id = generateId()
  db.insert(classes).values({ id, name: trimmed, sortOrder: nextSortOrder }).run()

  return { id, name: trimmed, sortOrder: nextSortOrder }
}

export function updateClass(id: string, name: string): SchoolClass {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Le nom de la classe est requis.')
  }

  const db = getDb()
  const existing = getClasses()
  if (existing.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`La classe « ${trimmed} » existe déjà.`)
  }

  db.update(classes).set({ name: trimmed }).where(eq(classes.id, id)).run()

  const updated = existing.find((c) => c.id === id)
  if (!updated) throw new Error('Classe introuvable.')
  return { ...updated, name: trimmed }
}

/**
 * Supprime une classe. Refuse si des élèves y sont (ou y ont été) inscrits,
 * pour ne jamais perdre l'historique d'une inscription/transaction liée à
 * cette classe (voir `enrollments`/`tuitionSchedules`).
 */
export function deleteClass(id: string): void {
  const db = getDb()
  const hasEnrollments = db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.classId, id))
    .get()

  if (hasEnrollments) {
    throw new Error(
      'Impossible de supprimer cette classe : des élèves y sont ou y ont été inscrits.'
    )
  }

  db.delete(tuitionSchedules).where(eq(tuitionSchedules.classId, id)).run()
  db.delete(classes).where(eq(classes.id, id)).run()
}

// ---------------------------------------------------------------------------
// Barème de frais de scolarité (F-027, BR-010)
// ---------------------------------------------------------------------------

export function getTuitionSchedule(classId: string, schoolYearId: string): TuitionSchedule | null {
  const db = getDb()

  const schedule = db
    .select()
    .from(tuitionSchedules)
    .where(
      and(eq(tuitionSchedules.classId, classId), eq(tuitionSchedules.schoolYearId, schoolYearId))
    )
    .get()

  if (!schedule) return null

  const installments = db
    .select()
    .from(tuitionInstallments)
    .where(eq(tuitionInstallments.scheduleId, schedule.id))
    .orderBy(tuitionInstallments.sortOrder)
    .all()

  const paidInstallmentIds = installmentIdsWithValidatedPayments(installments.map((i) => i.id))

  return {
    ...schedule,
    installments: installments.map((i) => ({ ...i, hasPayments: paidInstallmentIds.has(i.id) }))
  }
}

/**
 * Renvoie l'ensemble des ids de tranches ayant au moins un paiement
 * d'entrée validé (peu importe l'élève). Utilisé pour (1) exposer
 * `hasPayments` au front et (2) empêcher la suppression d'une tranche déjà
 * payée lors de la sauvegarde du barème.
 */
function installmentIdsWithValidatedPayments(installmentIds: string[]): Set<string> {
  if (installmentIds.length === 0) return new Set()

  const db = getDb()
  const rows = db
    .select({ installmentId: transactions.installmentId })
    .from(transactions)
    .where(
      and(
        inArray(transactions.installmentId, installmentIds),
        eq(transactions.type, 'entry'),
        eq(transactions.status, 'validated')
      )
    )
    .all()

  return new Set(rows.map((r) => r.installmentId).filter((id): id is string => id !== null))
}

/**
 * Crée ou met à jour le barème de frais d'une classe pour une année
 * scolaire donnée (upsert), tranche par tranche — opération atomique
 * (transaction).
 *
 * IMPORTANT (correctif bug régénération d'id — voir diagnostic) : on ne
 * supprime/réinsère plus jamais l'intégralité des tranches. Chaque tranche
 * reçue avec un `id` existant est mise à jour EN PLACE (même id conservé) ;
 * chaque tranche sans `id` est une nouvelle tranche insérée ; seules les
 * tranches présentes en base mais absentes de la liste reçue sont
 * supprimées. Ça préserve `transactions.installmentId` pour toutes les
 * tranches non retirées, donc l'historique des paiements déjà enregistrés
 * reste rattaché à la bonne tranche.
 */
export function saveTuitionSchedule(data: SaveTuitionScheduleDTO): TuitionSchedule {
  const db = getDb()

  if (data.installments.length === 0) {
    throw new Error('Au moins une tranche est requise.')
  }
  const VALID_TARGETS = new Set(['tous', 'nouveau', 'ancien'])
  for (const installment of data.installments) {
    if (!installment.label.trim()) throw new Error('Chaque tranche doit avoir un libellé.')
    if (installment.amount <= 0) throw new Error('Le montant de chaque tranche doit être positif.')
    if (!installment.dueDate) throw new Error("Chaque tranche doit avoir une date d'échéance.")
    if (!VALID_TARGETS.has(installment.appliesTo)) {
      throw new Error(`« Concerné » invalide pour la tranche "${installment.label}".`)
    }
  }

  db.transaction((tx) => {
    let schedule = tx
      .select({ id: tuitionSchedules.id })
      .from(tuitionSchedules)
      .where(
        and(
          eq(tuitionSchedules.classId, data.classId),
          eq(tuitionSchedules.schoolYearId, data.schoolYearId)
        )
      )
      .get()

    if (!schedule) {
      const id = generateId()
      tx.insert(tuitionSchedules)
        .values({ id, classId: data.classId, schoolYearId: data.schoolYearId })
        .run()
      schedule = { id }
    }

    const existingInstallments = tx
      .select({ id: tuitionInstallments.id })
      .from(tuitionInstallments)
      .where(eq(tuitionInstallments.scheduleId, schedule.id))
      .all()
    const existingIds = new Set(existingInstallments.map((i) => i.id))

    // Tranches reçues avec un id qui appartient bien à CE barème → update en place.
    const incomingIds = new Set(
      data.installments.filter((i) => i.id && existingIds.has(i.id)).map((i) => i.id as string)
    )

    // Tranches en base mais absentes de la liste reçue → à supprimer.
    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id))
    if (idsToDelete.length > 0) {
      const paidIds = installmentIdsWithValidatedPayments(idsToDelete)
      if (paidIds.size > 0) {
        const paidLabels = tx
          .select({ label: tuitionInstallments.label })
          .from(tuitionInstallments)
          .where(inArray(tuitionInstallments.id, [...paidIds]))
          .all()
          .map((r) => r.label)
        throw new Error(
          `Impossible de supprimer la/les tranche(s) "${paidLabels.join(', ')}" : des paiements y sont déjà enregistrés.`
        )
      }
      tx.delete(tuitionInstallments).where(inArray(tuitionInstallments.id, idsToDelete)).run()
    }

    data.installments.forEach((installment, index) => {
      const sortOrder = installment.sortOrder ?? index

      if (installment.id && existingIds.has(installment.id)) {
        tx.update(tuitionInstallments)
          .set({
            label: installment.label.trim(),
            amount: installment.amount,
            dueDate: installment.dueDate,
            sortOrder,
            appliesTo: installment.appliesTo
          })
          .where(eq(tuitionInstallments.id, installment.id))
          .run()
      } else {
        tx.insert(tuitionInstallments)
          .values({
            id: generateId(),
            scheduleId: schedule!.id,
            label: installment.label.trim(),
            amount: installment.amount,
            dueDate: installment.dueDate,
            sortOrder,
            appliesTo: installment.appliesTo
          })
          .run()
      }
    })

    return schedule.id
  })

  const result = getTuitionSchedule(data.classId, data.schoolYearId)
  if (!result) {
    // Ne devrait jamais arriver : on vient de créer/mettre à jour ce barème.
    throw new Error('Barème introuvable après sauvegarde.')
  }
  return result
}

/**
 * Résout le libellé d'une tranche de scolarité par son ID (utilisé par
 * l'impression thermique — Phase 9.2 — pour afficher le détail de la tranche
 * sur le reçu, sans devoir recharger tout le barème).
 */
export function getInstallmentLabel(installmentId: string): string | null {
  const db = getDb()
  const row = db
    .select({ label: tuitionInstallments.label })
    .from(tuitionInstallments)
    .where(eq(tuitionInstallments.id, installmentId))
    .get()
  return row?.label ?? null
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
