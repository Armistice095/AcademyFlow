import { and, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '@main/database'
import {
  classes,
  employees,
  enrollments,
  schoolYears,
  students,
  transactions,
  tuitionInstallments,
  tuitionSchedules
} from '@main/database/schema'
import * as cashboxService from './cashbox.service'
import * as tuitionService from './tuition.service'
import * as personnelService from './personnel.service'
import * as studentService from './student.service'
import * as auditService from './audit.service'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import {
  CASH_EVOLUTION_MONTHS_BACK,
  MONTH_LABELS_FR,
  UPCOMING_DUE_WINDOW_DAYS
} from '@shared/constants/defaults'
import type {
  ActivityItem,
  ActivityKind,
  CategoryBreakdownItem,
  ClassStatItem,
  DashboardAlert,
  DashboardKpis,
  DashboardStats,
  KpiTrend,
  MonthlyCashPoint,
  TopExpenseItem
} from '@shared/types/dashboard.types'

// ---------------------------------------------------------------------------
// Helpers de dates — tout est calculé en heure locale, à la journée près
// (cohérent avec `cashbox.service.getReport`, qui borne `to` par
// "T23:59:59.999Z" pour inclure la journée entière).
// ---------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthRange(year: number, monthIndex0: number): { from: string; toExclusiveEnd: string } {
  const from = `${year}-${pad(monthIndex0 + 1)}-01`
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate()
  const toExclusiveEnd = `${year}-${pad(monthIndex0 + 1)}-${pad(lastDay)}T23:59:59.999Z`
  return { from, toExclusiveEnd }
}

/** Décale une paire (année, mois index 0) de `delta` mois (peut être négatif). */
function shiftMonth(
  year: number,
  monthIndex0: number,
  delta: number
): { year: number; monthIndex0: number } {
  const total = year * 12 + monthIndex0 + delta
  return { year: Math.floor(total / 12), monthIndex0: ((total % 12) + 12) % 12 }
}

function computeGrowthPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/** Fabrique un `KpiTrend`, avec le libellé de comparaison attendu par le frontend (voir F-019 refonte). */
function trend(current: number, previous: number, compareLabel: string): KpiTrend {
  return { current, previous, growthPct: computeGrowthPct(current, previous), compareLabel }
}

// ---------------------------------------------------------------------------
// Année scolaire en cours — pivot de tout le filtrage du tableau de bord
// ---------------------------------------------------------------------------

interface CurrentSchoolYear {
  id: string
  label: string
  createdAt: string
}

function getCurrentSchoolYear(): CurrentSchoolYear | null {
  const db = getDb()
  const year = db
    .select({ id: schoolYears.id, label: schoolYears.label, createdAt: schoolYears.createdAt })
    .from(schoolYears)
    .where(eq(schoolYears.isCurrent, true))
    .get()
  return year ?? null
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

function computeKpis(now: Date, schoolYear: CurrentSchoolYear | null): DashboardKpis {
  const db = getDb()

  const currentMonth = monthRange(now.getFullYear(), now.getMonth())
  const prev = shiftMonth(now.getFullYear(), now.getMonth(), -1)
  const previousMonth = monthRange(prev.year, prev.monthIndex0)

  // --- Élèves inscrits : comparaison à l'effectif total de l'année scolaire
  // précédente (et non à un effectif partiel arrêté à une date arbitraire).
  // On réutilise `student.service.getStats`, qui implémente déjà exactement
  // cette logique pour les cartes KPI de la liste des élèves — garantit que
  // le tableau de bord et la liste des élèves affichent toujours le même
  // chiffre pour la même période.
  const studentStats = studentService.getStats()
  const studentsEnrolled = trend(
    studentStats.total.current,
    studentStats.total.previous,
    'vs année dernière'
  )

  // --- Entrées / sorties de caisse : mois courant vs mois précédent,
  // bornées à l'année scolaire en cours (cohérent avec le journal de caisse).
  const schoolYearId = schoolYear?.id ?? null
  const txnConditions = [
    eq(transactions.status, 'validated'),
    gte(transactions.createdAt, previousMonth.from)
  ]
  if (schoolYearId) txnConditions.push(eq(transactions.schoolYearId, schoolYearId))

  const validatedTxns = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      createdAt: transactions.createdAt
    })
    .from(transactions)
    .where(and(...txnConditions))
    .all()

  const sumFor = (type: 'entry' | 'exit', from: string, to: string): number =>
    validatedTxns
      .filter((t) => t.type === type && t.createdAt >= from && t.createdAt <= to)
      .reduce((sum, t) => sum + t.amount, 0)

  const entriesCurrent = sumFor('entry', currentMonth.from, currentMonth.toExclusiveEnd)
  const entriesPrevious = sumFor('entry', previousMonth.from, previousMonth.toExclusiveEnd)
  const exitsCurrent = sumFor('exit', currentMonth.from, currentMonth.toExclusiveEnd)
  const exitsPrevious = sumFor('exit', previousMonth.from, previousMonth.toExclusiveEnd)

  // --- Personnel : comparaison à l'effectif total de l'année scolaire
  // précédente. Les employés ne sont pas rattachés à une année scolaire en
  // base (contrairement aux inscriptions), donc on approxime « l'effectif de
  // l'année précédente » par l'effectif actif à la date de bascule vers
  // l'année en cours (date de création de l'année scolaire active) — c'est
  // la meilleure donnée disponible pour ce repère temporel.
  const activeEmployees = db
    .select({ createdAt: employees.createdAt })
    .from(employees)
    .where(eq(employees.isActive, true))
    .all()
  const personnelCurrent = activeEmployees.length
  const personnelBoundary = schoolYear?.createdAt ?? null
  const personnelPrevious = personnelBoundary
    ? activeEmployees.filter((e) => e.createdAt <= personnelBoundary).length
    : 0

  return {
    studentsEnrolled,
    cashEntries: trend(entriesCurrent, entriesPrevious, 'vs mois précédent'),
    cashExits: trend(exitsCurrent, exitsPrevious, 'vs mois précédent'),
    personnel: trend(personnelCurrent, personnelPrevious, 'vs année dernière'),
    // Solde de caisse réel : cumulé toutes années confondues (une caisse
    // physique ne se remet pas à zéro au changement d'année scolaire).
    cashBalance: cashboxService.getBalance(),
    asOf: now.toISOString()
  }
}

// ---------------------------------------------------------------------------
// Évolution des mouvements de caisse — graphique en barres (encaissements vs
// dépenses), agrégé par mois, borné à l'année scolaire en cours.
// ---------------------------------------------------------------------------

function computeCashEvolution(
  now: Date,
  schoolYearId: string | null,
  monthsBack = CASH_EVOLUTION_MONTHS_BACK
): MonthlyCashPoint[] {
  const db = getDb()
  const start = shiftMonth(now.getFullYear(), now.getMonth(), -(monthsBack - 1))
  const rangeStart = monthRange(start.year, start.monthIndex0).from

  const conditions = [eq(transactions.status, 'validated'), gte(transactions.createdAt, rangeStart)]
  if (schoolYearId) conditions.push(eq(transactions.schoolYearId, schoolYearId))

  const rows = db
    .select({
      type: transactions.type,
      amount: transactions.amount,
      createdAt: transactions.createdAt
    })
    .from(transactions)
    .where(and(...conditions))
    .all()

  const points: MonthlyCashPoint[] = []
  for (let i = 0; i < monthsBack; i++) {
    const { year, monthIndex0 } = shiftMonth(
      now.getFullYear(),
      now.getMonth(),
      -(monthsBack - 1) + i
    )
    const { from, toExclusiveEnd } = monthRange(year, monthIndex0)
    const inMonth = rows.filter((r) => r.createdAt >= from && r.createdAt <= toExclusiveEnd)
    points.push({
      month: `${year}-${pad(monthIndex0 + 1)}`,
      label:
        MONTH_LABELS_FR[monthIndex0].slice(0, 1).toUpperCase() +
        MONTH_LABELS_FR[monthIndex0].slice(1, 4),
      entries: inMonth.filter((r) => r.type === 'entry').reduce((sum, r) => sum + r.amount, 0),
      exits: inMonth.filter((r) => r.type === 'exit').reduce((sum, r) => sum + r.amount, 0)
    })
  }
  return points
}

// ---------------------------------------------------------------------------
// Répartition des encaissements par catégorie (mois courant, année en cours)
// ---------------------------------------------------------------------------

function computeCategoryBreakdown(now: Date, schoolYearId: string | null): CategoryBreakdownItem[] {
  const db = getDb()
  const { from, toExclusiveEnd } = monthRange(now.getFullYear(), now.getMonth())

  const conditions = [
    eq(transactions.status, 'validated'),
    eq(transactions.type, 'entry'),
    gte(transactions.createdAt, from),
    lte(transactions.createdAt, toExclusiveEnd)
  ]
  if (schoolYearId) conditions.push(eq(transactions.schoolYearId, schoolYearId))

  const rows = db
    .select({ category: transactions.category, amount: transactions.amount })
    .from(transactions)
    .where(and(...conditions))
    .all()

  const byCategory = new Map<string, number>()
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount)
  }

  const total = Array.from(byCategory.values()).reduce((sum, v) => sum + v, 0)

  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category: category as CashCategory,
      label: CASH_CATEGORY_LABELS[category as CashCategory] ?? category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount)
}

// ---------------------------------------------------------------------------
// Statistiques des élèves par classe (année scolaire en cours)
// ---------------------------------------------------------------------------

function computeClassStats(schoolYearId: string | null): ClassStatItem[] {
  const db = getDb()
  if (!schoolYearId) return []

  const allClasses = db.select().from(classes).orderBy(classes.sortOrder).all()

  const rows = db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(and(eq(enrollments.schoolYearId, schoolYearId), eq(students.isActive, true)))
    .all()

  const countByClass = new Map<string, number>()
  for (const row of rows) {
    countByClass.set(row.classId, (countByClass.get(row.classId) ?? 0) + 1)
  }

  // On n'expose que les classes ayant au moins un élève inscrit cette année
  // — une classe à effectif nul n'a pas sa place dans un tableau de bord
  // censé refléter la situation réelle des effectifs.
  return allClasses
    .map((cls) => ({
      classId: cls.id,
      className: cls.name,
      studentCount: countByClass.get(cls.id) ?? 0
    }))
    .filter((cls) => cls.studentCount > 0)
}

// ---------------------------------------------------------------------------
// Top des sorties (mois courant, par catégorie, année en cours)
// ---------------------------------------------------------------------------

function computeTopExpenses(now: Date, schoolYearId: string | null, limit = 5): TopExpenseItem[] {
  const db = getDb()
  const { from, toExclusiveEnd } = monthRange(now.getFullYear(), now.getMonth())

  const conditions = [
    eq(transactions.status, 'validated'),
    eq(transactions.type, 'exit'),
    gte(transactions.createdAt, from),
    lte(transactions.createdAt, toExclusiveEnd)
  ]
  if (schoolYearId) conditions.push(eq(transactions.schoolYearId, schoolYearId))

  const rows = db
    .select({ category: transactions.category, amount: transactions.amount })
    .from(transactions)
    .where(and(...conditions))
    .all()

  const byCategory = new Map<string, number>()
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount)
  }

  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({
      category: category as CashCategory,
      label: CASH_CATEGORY_LABELS[category as CashCategory] ?? category,
      amount
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Activités récentes — dérivées du journal d'audit (AUDIT_LOG)
// ---------------------------------------------------------------------------

interface SalaryPaymentActivityDetails {
  amount?: number
}

function describeActivity(
  entry: auditService.RecentAuditEntry
): { kind: ActivityKind; title: string; description: string; amount: number | null } | null {
  const db = getDb()

  if (entry.entityType === 'transaction' && entry.action === 'create') {
    const txn = db
      .select({
        type: transactions.type,
        amount: transactions.amount,
        category: transactions.category
      })
      .from(transactions)
      .where(eq(transactions.id, entry.entityId))
      .get()
    if (!txn) return null
    const isEntry = txn.type === 'entry'
    return {
      kind: isEntry ? 'cash_entry' : 'cash_exit',
      title: isEntry ? 'Paiement enregistré' : 'Dépense enregistrée',
      description: `${CASH_CATEGORY_LABELS[txn.category as CashCategory] ?? txn.category} — par ${entry.userFullName}`,
      amount: txn.amount
    }
  }

  if (entry.entityType === 'transaction' && entry.action === 'cancel') {
    // Le montant n'est pas dupliqué dans `details` — on le relit sur la
    // transaction elle-même (l'annulation ne modifie jamais `amount`, BR-005).
    const txn = db
      .select({ amount: transactions.amount })
      .from(transactions)
      .where(eq(transactions.id, entry.entityId))
      .get()
    return {
      kind: 'cash_cancelled',
      title: 'Opération annulée',
      description: `Annulation par ${entry.userFullName}`,
      amount: txn?.amount ?? null
    }
  }

  if (entry.entityType === 'student' && entry.action === 'create') {
    const student = db
      .select({
        firstName: students.firstName,
        lastName: students.lastName,
        matricule: students.matricule
      })
      .from(students)
      .where(eq(students.id, entry.entityId))
      .get()
    if (!student) return null
    return {
      kind: 'student_enrolled',
      title: 'Nouvel élève inscrit',
      description: `${student.lastName} ${student.firstName} — matricule ${student.matricule}`,
      amount: null
    }
  }

  if (entry.entityType === 'employee' && entry.action === 'paySalary') {
    const employee = db
      .select({ firstName: employees.firstName, lastName: employees.lastName })
      .from(employees)
      .where(eq(employees.id, entry.entityId))
      .get()
    if (!employee) return null
    const details = entry.details as SalaryPaymentActivityDetails | null
    return {
      kind: 'salary_paid',
      title: 'Salaire versé',
      description: `${employee.lastName} ${employee.firstName} — par ${entry.userFullName}`,
      amount: details?.amount ?? null
    }
  }

  if (entry.entityType === 'user' && entry.action === 'login') {
    return {
      kind: 'user_login',
      title: 'Utilisateur connecté',
      description: entry.userFullName,
      amount: null
    }
  }

  // Événements moins prioritaires pour le tableau de bord (changement de mot de
  // passe, désactivation d'employé, etc.) : affichés de façon générique plutôt
  // qu'ignorés, pour que le flux reste un historique fidèle.
  return {
    kind: 'other',
    title: `${entry.action} — ${entry.entityType}`,
    description: entry.userFullName,
    amount: null
  }
}

function computeRecentActivity(limit = 5): ActivityItem[] {
  const entries = auditService.listRecent(limit)
  const items: ActivityItem[] = []

  for (const entry of entries) {
    const described = describeActivity(entry)
    if (!described) continue
    items.push({ id: entry.id, createdAt: entry.createdAt, ...described })
  }

  return items
}

// ---------------------------------------------------------------------------
// Alertes et rappels
// ---------------------------------------------------------------------------

function computeAlerts(now: Date, schoolYearId: string | null): DashboardAlert[] {
  const db = getDb()
  const alerts: DashboardAlert[] = []

  // --- Paiements en attente (élèves en arriéré) -----------------------------
  const arrears = tuitionService.getArrearsStudents()
  if (arrears.length > 0) {
    alerts.push({
      id: 'arrears',
      severity: 'warning',
      title: 'Paiements en attente',
      description: `${arrears.length} élève${arrears.length > 1 ? 's' : ''} avec des arriérés de paiement`,
      link: '/cashbox/reports'
    })
  }

  // --- Échéances à venir (tranches dues dans les prochains jours) ----------
  if (schoolYearId) {
    const todayKey = toDateKey(now)
    const windowEnd = new Date(now)
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_DUE_WINDOW_DAYS)
    const windowEndKey = toDateKey(windowEnd)

    const upcoming = db
      .select({ dueDate: tuitionInstallments.dueDate })
      .from(tuitionInstallments)
      .innerJoin(tuitionSchedules, eq(tuitionSchedules.id, tuitionInstallments.scheduleId))
      .where(
        and(
          eq(tuitionSchedules.schoolYearId, schoolYearId),
          gte(tuitionInstallments.dueDate, todayKey),
          lte(tuitionInstallments.dueDate, windowEndKey)
        )
      )
      .all()

    if (upcoming.length > 0) {
      alerts.push({
        id: 'upcoming-due',
        severity: 'info',
        title: 'Échéances à venir',
        description: `${upcoming.length} échéance${upcoming.length > 1 ? 's' : ''} dans les ${UPCOMING_DUE_WINDOW_DAYS} prochains jours`,
        link: '/settings'
      })
    }
  }

  // --- Salaires du mois non encore payés ------------------------------------
  const salaryStatus = personnelService.getSalaryStatus(now.getMonth() + 1, now.getFullYear())
  const unpaidCount = salaryStatus.filter((s) => !s.isPaid).length
  if (unpaidCount > 0) {
    alerts.push({
      id: 'unpaid-salaries',
      severity: 'warning',
      title: 'Salaires du mois en attente',
      description: `${unpaidCount} salaire${unpaidCount > 1 ? 's' : ''} non encore versé${unpaidCount > 1 ? 's' : ''} ce mois-ci`,
      link: '/personnel/salaries'
    })
  }

  return alerts
}

// ---------------------------------------------------------------------------
// Point d'entrée — appelé par le handler IPC `dashboard:getStats`
//
// Toutes les données exposées ici sont bornées à l'année scolaire en cours
// (`schoolYears.isCurrent`), au même titre que la liste des élèves et le
// journal de caisse : aucune agrégation ne mélange plusieurs années
// scolaires. Seul le solde de caisse (`kpis.cashBalance`) reste cumulé sur
// toutes les années, car il représente l'état réel de la caisse physique.
// ---------------------------------------------------------------------------

export function getStats(): DashboardStats {
  const now = new Date()
  const schoolYear = getCurrentSchoolYear()
  const schoolYearId = schoolYear?.id ?? null

  const recoveryStats = tuitionService.getGlobalRecoveryStats()
  const rate =
    recoveryStats.totalExpected > 0
      ? (recoveryStats.totalPaid / recoveryStats.totalExpected) * 100
      : 0

  return {
    kpis: computeKpis(now, schoolYear),
    cashEvolution: computeCashEvolution(now, schoolYearId),
    categoryBreakdown: computeCategoryBreakdown(now, schoolYearId),
    classStats: computeClassStats(schoolYearId),
    recoveryRate: {
      rate,
      totalExpected: recoveryStats.totalExpected,
      totalPaid: recoveryStats.totalPaid
    },
    topExpenses: computeTopExpenses(now, schoolYearId),
    recentActivity: computeRecentActivity(),
    alerts: computeAlerts(now, schoolYearId)
  }
}
