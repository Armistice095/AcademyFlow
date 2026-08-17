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
import type { ArrearsStudent, TuitionAccount, TuitionAccountLine } from '@shared/types/transaction.types'

function getCurrentSchoolYearId(): string | null {
  const db = getDb()
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(eq(schoolYears.isCurrent, true)).get()
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
    .where(and(eq(tuitionSchedules.classId, classId), eq(tuitionSchedules.schoolYearId, schoolYearId)))
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

  const today = new Date().toISOString().slice(0, 10)

  const lines: TuitionAccountLine[] = installmentRows.map((installment) => {
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

    return {
      installmentId: installment.id,
      label: installment.label,
      dueDate: installment.dueDate,
      expectedAmount: installment.amount,
      paidAmount,
      status: isLate ? 'en_arriere' : 'a_jour'
    }
  })

  const totalExpected = lines.reduce((sum, l) => sum + l.expectedAmount, 0)
  const totalPaid = lines.reduce((sum, l) => sum + l.paidAmount, 0)

  return { studentId, installments: lines, totalExpected, totalPaid, balance: totalExpected - totalPaid }
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
    const lateInstallmentsCount = account.installments.filter((l) => l.status === 'en_arriere').length
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
