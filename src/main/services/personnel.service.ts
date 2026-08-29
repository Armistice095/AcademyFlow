import { and, eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  employees,
  salaryAdvances,
  salaryPayments,
  schoolYears,
  transactions
} from '@main/database/schema'
import { generateId } from '@main/database/id'
import { logAction } from './audit.service'
import type {
  CreateEmployeeDTO,
  Employee,
  GrantSalaryAdvanceDTO,
  SalaryAdvance,
  SalaryHistoryEntry,
  SalaryMonthStatus,
  SalaryPayment,
  SalaryPaymentResult,
  UpdateEmployeeDTO
} from '@shared/types/personnel.types'

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function toEmployee(row: typeof employees.$inferSelect): Employee {
  return {
    id: row.id,
    lastName: row.lastName,
    firstName: row.firstName,
    role: row.role,
    phone: row.phone,
    monthlySalary: row.monthlySalary,
    isActive: row.isActive,
    createdAt: row.createdAt
  }
}

function toSalaryPayment(row: typeof salaryPayments.$inferSelect): SalaryPayment {
  return {
    id: row.id,
    employeeId: row.employeeId,
    schoolYearId: row.schoolYearId,
    month: row.month,
    year: row.year,
    transactionId: row.transactionId,
    paidAt: row.paidAt
  }
}

function toSalaryAdvance(row: typeof salaryAdvances.$inferSelect): SalaryAdvance {
  return {
    id: row.id,
    employeeId: row.employeeId,
    amount: row.amount,
    reason: row.reason,
    transactionId: row.transactionId,
    status: row.status as SalaryAdvance['status'],
    deductedInPaymentId: row.deductedInPaymentId,
    createdAt: row.createdAt
  }
}

/** Même convention que `student.service.ts` : une année scolaire active est requise pour rattacher un paiement. */
function requireCurrentSchoolYearId(): string {
  const db = getDb()
  const year = db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  if (!year) {
    throw new Error(
      "Aucune année scolaire active. Configurez-en une dans Paramètres avant d'enregistrer un paiement de salaire."
    )
  }
  return year.id
}

function validateEmployeeInput(data: Partial<CreateEmployeeDTO>): void {
  if (data.lastName !== undefined && !data.lastName.trim()) {
    throw new Error('Le nom est requis.')
  }
  if (data.firstName !== undefined && !data.firstName.trim()) {
    throw new Error('Le prénom est requis.')
  }
  if (data.role !== undefined && !data.role.trim()) {
    throw new Error('La fonction est requise.')
  }
  if (data.monthlySalary !== undefined && data.monthlySalary <= 0) {
    throw new Error('Le salaire mensuel doit être positif.')
  }
}

// ---------------------------------------------------------------------------
// CRUD Employés (F-022)
// ---------------------------------------------------------------------------

export function create(data: CreateEmployeeDTO & { userId: string }): Employee {
  validateEmployeeInput(data)

  const db = getDb()
  const id = generateId()

  db.insert(employees)
    .values({
      id,
      lastName: data.lastName.trim(),
      firstName: data.firstName.trim(),
      role: data.role.trim(),
      phone: data.phone?.trim() || null,
      monthlySalary: data.monthlySalary
    })
    .run()

  logAction({ userId: data.userId, action: 'create', entityType: 'employee', entityId: id })

  const row = db.select().from(employees).where(eq(employees.id, id)).get()
  if (!row) throw new Error("Échec de la récupération de l'employé après création.")
  return toEmployee(row)
}

export function update(id: string, data: UpdateEmployeeDTO, userId: string): Employee {
  validateEmployeeInput(data)

  const db = getDb()
  const existing = db.select().from(employees).where(eq(employees.id, id)).get()
  if (!existing) throw new Error('Employé introuvable.')

  db.update(employees)
    .set({
      ...(data.lastName !== undefined && { lastName: data.lastName.trim() }),
      ...(data.firstName !== undefined && { firstName: data.firstName.trim() }),
      ...(data.role !== undefined && { role: data.role.trim() }),
      ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
      ...(data.monthlySalary !== undefined && { monthlySalary: data.monthlySalary })
    })
    .where(eq(employees.id, id))
    .run()

  logAction({ userId, action: 'update', entityType: 'employee', entityId: id, details: data })

  const row = db.select().from(employees).where(eq(employees.id, id)).get()
  if (!row) throw new Error("Échec de la récupération de l'employé après modification.")
  return toEmployee(row)
}

/** Désactivation (soft delete) — cohérent avec BR-006 : jamais de suppression physique. */
export function softDelete(id: string, userId: string): void {
  const db = getDb()
  const existing = db.select().from(employees).where(eq(employees.id, id)).get()
  if (!existing) throw new Error('Employé introuvable.')

  db.update(employees).set({ isActive: false }).where(eq(employees.id, id)).run()

  logAction({ userId, action: 'deactivate', entityType: 'employee', entityId: id })
}

export function listAll(includeInactive = false): Employee[] {
  const db = getDb()
  const rows = db
    .select()
    .from(employees)
    .where(includeInactive ? undefined : eq(employees.isActive, true))
    .orderBy(employees.lastName, employees.firstName)
    .all()
  return rows.map(toEmployee)
}

export function getById(id: string): Employee | null {
  const db = getDb()
  const row = db.select().from(employees).where(eq(employees.id, id)).get()
  return row ? toEmployee(row) : null
}

// ---------------------------------------------------------------------------
// Suivi mensuel des salaires (F-023, F-024, BR-008, BR-009)
// ---------------------------------------------------------------------------

/**
 * Marque le salaire d'un employé comme payé pour un mois/année donnés, et
 * crée automatiquement la sortie de caisse correspondante (BR-008), de
 * façon atomique : `salary_payments` + `transactions` dans la même
 * transaction BDD. Un même mois ne peut être payé qu'une seule fois par
 * employé (BR-009), garanti à la fois par un contrôle explicite et par la
 * contrainte d'unicité `salary_payments_employee_month_year_unique`.
 *
 * BR-010 : si l'employé a une avance sur salaire en attente (`pending`),
 * elle est automatiquement et intégralement déduite de ce paiement — la
 * sortie de caisse enregistrée correspond au montant net réellement
 * décaissé, jamais au salaire brut. L'avance passe alors au statut
 * `deducted`, liée au paiement qui l'a soldée.
 */
export function paySalary(
  employeeId: string,
  month: number,
  year: number,
  userId: string
): SalaryPaymentResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Le mois doit être compris entre 1 et 12.')
  }
  if (!Number.isInteger(year) || year < 2000) {
    throw new Error('Année invalide.')
  }

  const db = getDb()

  const employee = db.select().from(employees).where(eq(employees.id, employeeId)).get()
  if (!employee) throw new Error('Employé introuvable.')
  if (!employee.isActive) throw new Error('Impossible de payer un employé désactivé.')

  const alreadyPaid = db
    .select()
    .from(salaryPayments)
    .where(
      and(
        eq(salaryPayments.employeeId, employeeId),
        eq(salaryPayments.month, month),
        eq(salaryPayments.year, year)
      )
    )
    .get()
  if (alreadyPaid) {
    throw new Error(
      `Le salaire de ${employee.firstName} ${employee.lastName} pour cette période a déjà été marqué payé (BR-009).`
    )
  }

  const pendingAdvance = db
    .select()
    .from(salaryAdvances)
    .where(and(eq(salaryAdvances.employeeId, employeeId), eq(salaryAdvances.status, 'pending')))
    .get()

  const grossAmount = employee.monthlySalary
  const advanceAmount = pendingAdvance?.amount ?? 0
  if (advanceAmount > grossAmount) {
    throw new Error(
      `L'avance en attente (${advanceAmount} FCFA) dépasse le salaire mensuel de ${employee.firstName} ${employee.lastName} (${grossAmount} FCFA). Contactez un administrateur pour régulariser la situation avant de payer ce salaire.`
    )
  }
  const netAmount = grossAmount - advanceAmount

  const schoolYearId = requireCurrentSchoolYearId()
  const transactionId = generateId()
  const paymentId = generateId()
  const monthLabel = String(month).padStart(2, '0')
  const advanceNote = pendingAdvance ? ` (net après déduction avance de ${advanceAmount} FCFA)` : ''

  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        type: 'exit',
        category: 'salaire',
        description: `Salaire ${monthLabel}/${year} — ${employee.firstName} ${employee.lastName} (${employee.role})${advanceNote}`,
        amount: netAmount,
        employeeId,
        status: 'validated',
        userId,
        schoolYearId
      })
      .run()

    tx.insert(salaryPayments)
      .values({
        id: paymentId,
        employeeId,
        schoolYearId,
        month,
        year,
        transactionId
      })
      .run()

    if (pendingAdvance) {
      tx.update(salaryAdvances)
        .set({ status: 'deducted', deductedInPaymentId: paymentId })
        .where(eq(salaryAdvances.id, pendingAdvance.id))
        .run()
    }
  })

  logAction({
    userId,
    action: 'paySalary',
    entityType: 'employee',
    entityId: employeeId,
    details: {
      month,
      year,
      transactionId,
      grossAmount,
      netAmount,
      deductedAdvanceId: pendingAdvance?.id ?? null
    }
  })

  const row = db.select().from(salaryPayments).where(eq(salaryPayments.id, paymentId)).get()
  if (!row) throw new Error('Échec de la récupération du paiement après création.')

  return {
    ...toSalaryPayment(row),
    grossAmount,
    netAmount,
    deductedAdvance: pendingAdvance
      ? toSalaryAdvance({
          ...pendingAdvance,
          status: 'deducted',
          deductedInPaymentId: paymentId
        })
      : null
  }
}

/** État payé/non-payé de chaque employé actif, pour un mois/année donnés (F-023, F-024). */
export function getSalaryStatus(month: number, year: number): SalaryMonthStatus[] {
  const db = getDb()

  const activeEmployees = db
    .select()
    .from(employees)
    .where(eq(employees.isActive, true))
    .orderBy(employees.lastName, employees.firstName)
    .all()

  const payments = db
    .select()
    .from(salaryPayments)
    .where(and(eq(salaryPayments.month, month), eq(salaryPayments.year, year)))
    .all()
  const paymentByEmployeeId = new Map(payments.map((p) => [p.employeeId, p]))

  const pendingAdvances = db
    .select()
    .from(salaryAdvances)
    .where(eq(salaryAdvances.status, 'pending'))
    .all()
  const pendingAdvanceByEmployeeId = new Map(pendingAdvances.map((a) => [a.employeeId, a]))

  return activeEmployees.map((emp) => {
    const payment = paymentByEmployeeId.get(emp.id)
    return {
      employee: toEmployee(emp),
      month,
      year,
      isPaid: Boolean(payment),
      paymentId: payment?.id,
      paidAt: payment?.paidAt,
      pendingAdvanceAmount: pendingAdvanceByEmployeeId.get(emp.id)?.amount
    }
  })
}

/** Historique des paiements de salaire d'un employé, du plus récent au plus ancien (F-024). */
export function getSalaryHistory(employeeId: string): SalaryHistoryEntry[] {
  const db = getDb()

  const rows = db
    .select({
      id: salaryPayments.id,
      month: salaryPayments.month,
      year: salaryPayments.year,
      paidAt: salaryPayments.paidAt,
      transactionId: salaryPayments.transactionId,
      amount: transactions.amount
    })
    .from(salaryPayments)
    .innerJoin(transactions, eq(salaryPayments.transactionId, transactions.id))
    .where(eq(salaryPayments.employeeId, employeeId))
    .all()

  return rows.sort((a, b) => b.year - a.year || b.month - a.month)
}

// ---------------------------------------------------------------------------
// Avances sur salaire (F-026, BR-010)
// ---------------------------------------------------------------------------

/**
 * Accorde une avance sur salaire à un employé et crée automatiquement la
 * sortie de caisse correspondante (catégorie `avance_salaire`), de façon
 * atomique — même principe que `paySalary` (BR-008).
 *
 * Un employé ne peut avoir qu'une seule avance `pending` à la fois : tant
 * qu'elle n'a pas été déduite d'une paie, aucune nouvelle avance ne peut lui
 * être accordée. Cela évite d'accumuler une dette qui dépasserait un salaire
 * mensuel, cohérent avec la règle de remboursement en une fois (BR-010).
 */
export function grantAdvance(data: GrantSalaryAdvanceDTO & { userId: string }): SalaryAdvance {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error("Le montant de l'avance doit être un nombre entier positif.")
  }

  const db = getDb()

  const employee = db.select().from(employees).where(eq(employees.id, data.employeeId)).get()
  if (!employee) throw new Error('Employé introuvable.')
  if (!employee.isActive) {
    throw new Error('Impossible d’accorder une avance à un employé désactivé.')
  }

  const existingPending = db
    .select()
    .from(salaryAdvances)
    .where(
      and(eq(salaryAdvances.employeeId, data.employeeId), eq(salaryAdvances.status, 'pending'))
    )
    .get()
  if (existingPending) {
    throw new Error(
      `${employee.firstName} ${employee.lastName} a déjà une avance de ${existingPending.amount} FCFA en attente de remboursement. Elle sera déduite automatiquement de son prochain salaire ; une nouvelle avance ne peut pas être accordée avant.`
    )
  }

  if (data.amount > employee.monthlySalary) {
    throw new Error(
      `L'avance (${data.amount} FCFA) ne peut pas dépasser le salaire mensuel de l'employé (${employee.monthlySalary} FCFA).`
    )
  }

  const transactionId = generateId()
  const advanceId = generateId()
  const reason = data.reason?.trim() || null
  const schoolYearId = requireCurrentSchoolYearId()

  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        type: 'exit',
        category: 'avance_salaire',
        description: `Avance sur salaire — ${employee.firstName} ${employee.lastName} (${employee.role})${reason ? ` — ${reason}` : ''}`,
        amount: data.amount,
        employeeId: data.employeeId,
        status: 'validated',
        userId: data.userId,
        schoolYearId
      })
      .run()

    tx.insert(salaryAdvances)
      .values({
        id: advanceId,
        employeeId: data.employeeId,
        amount: data.amount,
        reason,
        transactionId,
        status: 'pending',
        userId: data.userId
      })
      .run()
  })

  logAction({
    userId: data.userId,
    action: 'grantAdvance',
    entityType: 'employee',
    entityId: data.employeeId,
    details: { amount: data.amount, reason, transactionId }
  })

  const row = db.select().from(salaryAdvances).where(eq(salaryAdvances.id, advanceId)).get()
  if (!row) throw new Error("Échec de la récupération de l'avance après création.")
  return toSalaryAdvance(row)
}

/**
 * Annule une avance saisie par erreur. Seule une avance encore `pending`
 * peut être annulée (une avance déjà déduite d'une paie fait partie de
 * l'historique définitif). Cohérent avec BR-005 : la sortie de caisse n'est
 * jamais supprimée, elle est marquée `cancelled` avec motif.
 */
export function cancelAdvance(id: string, userId: string): void {
  const db = getDb()
  const advance = db.select().from(salaryAdvances).where(eq(salaryAdvances.id, id)).get()
  if (!advance) throw new Error('Avance introuvable.')
  if (advance.status !== 'pending') {
    throw new Error('Seule une avance en attente de remboursement peut être annulée.')
  }

  db.transaction((tx) => {
    tx.update(salaryAdvances).set({ status: 'cancelled' }).where(eq(salaryAdvances.id, id)).run()

    tx.update(transactions)
      .set({
        status: 'cancelled',
        cancelReason: "Annulation de l'avance sur salaire associée"
      })
      .where(eq(transactions.id, advance.transactionId))
      .run()
  })

  logAction({
    userId,
    action: 'cancelAdvance',
    entityType: 'employee',
    entityId: advance.employeeId
  })
}

/** Historique complet des avances d'un employé, de la plus récente à la plus ancienne (F-026). */
export function listAdvances(employeeId: string): SalaryAdvance[] {
  const db = getDb()
  const rows = db
    .select()
    .from(salaryAdvances)
    .where(eq(salaryAdvances.employeeId, employeeId))
    .all()
  return rows.map(toSalaryAdvance).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Avance `pending` d'un employé, s'il en a une (utile pour l'afficher avant paiement du salaire). */
export function getPendingAdvance(employeeId: string): SalaryAdvance | null {
  const db = getDb()
  const row = db
    .select()
    .from(salaryAdvances)
    .where(and(eq(salaryAdvances.employeeId, employeeId), eq(salaryAdvances.status, 'pending')))
    .get()
  return row ? toSalaryAdvance(row) : null
}
