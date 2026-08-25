import { and, eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { employees, salaryPayments, schoolYears, transactions } from '@main/database/schema'
import { generateId } from '@main/database/id'
import { logAction } from './audit.service'
import type {
  CreateEmployeeDTO,
  Employee,
  SalaryHistoryEntry,
  SalaryMonthStatus,
  SalaryPayment,
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
 */
export function paySalary(
  employeeId: string,
  month: number,
  year: number,
  userId: string
): SalaryPayment {
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

  const schoolYearId = requireCurrentSchoolYearId()
  const transactionId = generateId()
  const paymentId = generateId()
  const monthLabel = String(month).padStart(2, '0')

  db.transaction((tx) => {
    tx.insert(transactions)
      .values({
        id: transactionId,
        type: 'exit',
        category: 'salaire',
        description: `Salaire ${monthLabel}/${year} — ${employee.firstName} ${employee.lastName} (${employee.role})`,
        amount: employee.monthlySalary,
        employeeId,
        status: 'validated',
        userId
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
  })

  logAction({
    userId,
    action: 'paySalary',
    entityType: 'employee',
    entityId: employeeId,
    details: { month, year, transactionId, amount: employee.monthlySalary }
  })

  const row = db.select().from(salaryPayments).where(eq(salaryPayments.id, paymentId)).get()
  if (!row) throw new Error('Échec de la récupération du paiement après création.')
  return toSalaryPayment(row)
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

  return activeEmployees.map((emp) => {
    const payment = paymentByEmployeeId.get(emp.id)
    return {
      employee: toEmployee(emp),
      month,
      year,
      isPaid: Boolean(payment),
      paymentId: payment?.id,
      paidAt: payment?.paidAt
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
