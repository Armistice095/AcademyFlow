import type { CashCategory } from '../constants/categories'

/**
 * Types du tableau de bord financier (F-019, Phase 9.1).
 *
 * Toute la donnée exposée ici est calculée à la volée par
 * `dashboard.service.ts` à partir des tables existantes (aucune table
 * dédiée) — le tableau de bord est une vue agrégée, jamais une source de
 * vérité.
 */

// ---------------------------------------------------------------------------
// Cartes KPI
// ---------------------------------------------------------------------------

/**
 * Comparaison d'une valeur à une période de référence (mois précédent ou
 * année scolaire précédente selon la carte — voir `compareLabel`).
 * `growthPct` est `null` si la période de référence est à zéro (comparaison
 * non significative) ; il vaut `0` dans le cas d'une stagnation réelle
 * (valeur strictement identique), que le frontend affiche avec une icône et
 * une couleur neutres plutôt qu'une flèche haussière/baissière.
 */
export interface KpiTrend {
  current: number
  previous: number
  growthPct: number | null
  /** Libellé de la période de référence, ex: "vs année dernière" ou "vs mois précédent". */
  compareLabel: string
}

export interface DashboardKpis {
  /** Élèves actuellement inscrits (actifs) pour l'année scolaire en cours ; comparé à l'effectif total de l'année scolaire précédente. */
  studentsEnrolled: KpiTrend
  /** Total des entrées de caisse validées de l'année scolaire en cours, mois courant vs mois précédent. */
  cashEntries: KpiTrend
  /** Total des sorties de caisse validées de l'année scolaire en cours, mois courant vs mois précédent. */
  cashExits: KpiTrend
  /** Effectif du personnel actif ; comparé à l'effectif total de l'année scolaire précédente. */
  personnel: KpiTrend
  /** Solde de caisse courant, toutes années confondues (aucune notion de tendance — valeur instantanée). */
  cashBalance: number
  /** Horodatage du calcul (ISO 8601), affiché comme repère de fraîcheur. */
  asOf: string
}

// ---------------------------------------------------------------------------
// Évolution des flux de caisse — encaissements et dépenses (graphique linéaire)
// ---------------------------------------------------------------------------

export interface MonthlyCashPoint {
  /** Clé "YYYY-MM", pour tri/débogage. */
  month: string
  /** Libellé court affiché sur l'axe (ex: "Août"). */
  label: string
  entries: number
  exits: number
}

// ---------------------------------------------------------------------------
// Répartition des encaissements par catégorie (mois courant)
// ---------------------------------------------------------------------------

export interface CategoryBreakdownItem {
  category: CashCategory
  label: string
  amount: number
  /** Part du total des encaissements du mois, en pourcentage (0-100). */
  percentage: number
}

// ---------------------------------------------------------------------------
// Statistiques des élèves par classe
// ---------------------------------------------------------------------------

export interface ClassStatItem {
  classId: string
  className: string
  studentCount: number
}

// ---------------------------------------------------------------------------
// Taux de recouvrement global
// ---------------------------------------------------------------------------

export interface RecoveryRate {
  /** Taux global de recouvrement des frais de scolarité attendus, en % (0-100). */
  rate: number
  totalExpected: number
  totalPaid: number
}

// ---------------------------------------------------------------------------
// Top des sorties (mois courant, par catégorie)
// ---------------------------------------------------------------------------

export interface TopExpenseItem {
  category: CashCategory
  label: string
  amount: number
}

// ---------------------------------------------------------------------------
// Activités récentes (dérivées du journal d'audit)
// ---------------------------------------------------------------------------

export type ActivityKind =
  | 'cash_entry'
  | 'cash_exit'
  | 'cash_cancelled'
  | 'student_enrolled'
  | 'salary_paid'
  | 'user_login'
  | 'other'

export interface ActivityItem {
  id: string
  kind: ActivityKind
  title: string
  description: string
  /** Montant associé, si pertinent pour ce type d'activité (encaissement, dépense, salaire) — `null` sinon (ex: nouvel élève, connexion). Affiché à part, en couleur, plutôt qu'intégré au texte de description. */
  amount: number | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Alertes et rappels
// ---------------------------------------------------------------------------

export type AlertSeverity = 'info' | 'warning' | 'danger'

export interface DashboardAlert {
  id: string
  severity: AlertSeverity
  title: string
  description: string
  /** Route de destination au clic (ex: `/cashbox/reports`). */
  link?: string
}

// ---------------------------------------------------------------------------
// Agrégat complet retourné par `dashboard:getStats`
// ---------------------------------------------------------------------------

export interface DashboardStats {
  kpis: DashboardKpis
  cashEvolution: MonthlyCashPoint[]
  categoryBreakdown: CategoryBreakdownItem[]
  classStats: ClassStatItem[]
  recoveryRate: RecoveryRate
  topExpenses: TopExpenseItem[]
  recentActivity: ActivityItem[]
  alerts: DashboardAlert[]
}
