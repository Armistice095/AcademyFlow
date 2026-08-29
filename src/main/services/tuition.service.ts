import { and, eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  classes,
  enrollments,
  schoolYears,
  students,
  transactions,
  tuitionInstallments,
  tuitionSchedules
} from '@main/database/schema'
import { getEnrollmentHistoryStatus } from './student.service'
import type {
  ArrearsStudent,
  TuitionAccount,
  TuitionAccountLine
} from '@shared/types/transaction.types'

function getCurrentSchoolYearId(): string | null {
  const db = getDb()
  const year = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  return year?.id ?? null
}

function getCurrentEnrollment(studentId: string, schoolYearId: string) {
  const db = getDb()
  return db
    .select({ classId: enrollments.classId, className: classes.name })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.schoolYearId, schoolYearId)))
    .get()
}

function computeAccount(studentId: string, classId: string, schoolYearId: string): TuitionAccount {
  const db = getDb()

  const schedule = db
    .select({ id: tuitionSchedules.id })
    .from(tuitionSchedules)
    .where(
      and(eq(tuitionSchedules.classId, classId), eq(tuitionSchedules.schoolYearId, schoolYearId))
    )
    .get()

  if (!schedule) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 }
  }

  const installmentRows = db
    .select()
    .from(tuitionInstallments)
    .where(eq(tuitionInstallments.scheduleId, schedule.id))
    .orderBy(tuitionInstallments.sortOrder)
    .all()

  // Statut de l'élève pour CETTE année scolaire précise (pas son statut
  // "actuel" global) — détermine quelles tranches ciblées lui sont dues.
  const historyStatus = getEnrollmentHistoryStatus(studentId, schoolYearId)

  const today = new Date().toISOString().slice(0, 10)

  const lines: TuitionAccountLine[] = installmentRows
    .map((installment) => {
      const payments = db
        .select({ amount: transactions.amount })
        .from(transactions)
        .where(
          and(
            eq(transactions.installmentId, installment.id),
            eq(transactions.studentId, studentId),
            eq(transactions.type, 'entry'),
            eq(transactions.status, 'validated')
          )
        )
        .all()

      const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0)
      const isLate = installment.dueDate < today && paidAmount < installment.amount
      const appliesTo = installment.appliesTo as TuitionAccountLine['appliesTo']

      // Une tranche ne concernant pas le statut actuel de l'élève est
      // exclue du compte — SAUF si un paiement y a déjà été enregistré :
      // dans ce cas on la garde toujours visible, pour ne jamais faire
      // disparaître un paiement déjà effectué (sécurité comptable).
      const isRelevant = appliesTo === 'tous' || appliesTo === historyStatus || paidAmount > 0
      if (!isRelevant) return null

      return {
        installmentId: installment.id,
        label: installment.label,
        dueDate: installment.dueDate,
        expectedAmount: installment.amount,
        paidAmount,
        status: isLate ? 'en_arriere' : 'a_jour',
        appliesTo
      } satisfies TuitionAccountLine
    })
    .filter((line): line is TuitionAccountLine => line !== null)

  const totalExpected = lines.reduce((sum, l) => sum + l.expectedAmount, 0)
  const totalPaid = lines.reduce((sum, l) => sum + l.paidAmount, 0)

  return {
    studentId,
    installments: lines,
    totalExpected,
    totalPaid,
    balance: totalExpected - totalPaid
  }
}

/** Compte de scolarité détaillé d'un élève, pour l'année scolaire en cours (F-020). */
export function getStudentAccount(studentId: string): TuitionAccount {
  const schoolYearId = getCurrentSchoolYearId()
  if (!schoolYearId) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 }
  }

  const enrollment = getCurrentEnrollment(studentId, schoolYearId)
  if (!enrollment) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 }
  }

  return computeAccount(studentId, enrollment.classId, schoolYearId)
}

/** Liste des élèves ayant au moins une tranche en arriéré, pour l'année en cours (F-021, BR-010). */
export function getArrearsStudents(): ArrearsStudent[] {
  const db = getDb()
  const schoolYearId = getCurrentSchoolYearId()
  if (!schoolYearId) return []

  const activeEnrollments = db
    .select({
      studentId: enrollments.studentId,
      classId: enrollments.classId,
      className: classes.name,
      matricule: students.matricule,
      lastName: students.lastName,
      firstName: students.firstName
    })
    .from(enrollments)
    .innerJoin(classes, eq(classes.id, enrollments.classId))
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.schoolYearId, schoolYearId), eq(students.isActive, true)))
    .all()

  const result: ArrearsStudent[] = []

  for (const row of activeEnrollments) {
    const account = computeAccount(row.studentId, row.classId, schoolYearId)
    const lateInstallmentsCount = account.installments.filter(
      (l) => l.status === 'en_arriere'
    ).length
    if (lateInstallmentsCount > 0) {
      result.push({
        ...account,
        matricule: row.matricule,
        studentName: `${row.lastName} ${row.firstName}`,
        className: row.className,
        lateInstallmentsCount
      })
    }
  }

  return result
}

/**
 * Statistiques de recouvrement agrégées, toutes classes confondues, pour
 * l'année scolaire en cours (F-019, Phase 9.1). Contrairement à
 * `getArrearsStudents`, cette fonction somme les comptes de scolarité de
 * *tous* les élèves inscrits (pas seulement ceux en arriéré), pour produire
 * un taux global de recouvrement.
 */
export function getGlobalRecoveryStats(): { totalExpected: number; totalPaid: number } {
  const db = getDb()
  const schoolYearId = getCurrentSchoolYearId()
  if (!schoolYearId) return { totalExpected: 0, totalPaid: 0 }

  const activeEnrollments = db
    .select({ studentId: enrollments.studentId, classId: enrollments.classId })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.schoolYearId, schoolYearId), eq(students.isActive, true)))
    .all()

  let totalExpected = 0
  let totalPaid = 0

  for (const row of activeEnrollments) {
    const account = computeAccount(row.studentId, row.classId, schoolYearId)
    totalExpected += account.totalExpected
    totalPaid += account.totalPaid
  }

  return { totalExpected, totalPaid }
}
