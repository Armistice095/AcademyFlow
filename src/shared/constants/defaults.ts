/** Valeurs par défaut utilisées lors de la création d'entités. */

export const DEFAULT_NATIONALITY = 'Béninoise'

/** Génère (dans l'ordre) les classes créées au seed initial (voir database/seed.ts). */
export const DEFAULT_CLASS_ORDER = [
  'CI',
  'CP',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Tle'
] as const

/** Durée d'inactivité avant verrouillage automatique de la session (Phase 4). */
export const AUTO_LOCK_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Matricule élève (BR-002) : identifiant purement numérique à 8 chiffres,
 * séquentiel, ex: 10052724. Voir `main/services/matricule.service.ts`.
 */
export const MATRICULE_LENGTH = 8
export const MATRICULE_START = 10_000_001

/**
 * Fenêtre (en jours) utilisée par l'alerte « échéances à venir » du tableau
 * de bord : tranches de scolarité dont la date d'échéance tombe dans cet
 * intervalle.
 */
export const UPCOMING_DUE_WINDOW_DAYS = 7

/**
 * Nombre de mois affichés par le graphique « Évolution des mouvements de
 * caisse » du tableau de bord. Les données restent bornées à l'année
 * scolaire en cours (voir `dashboard.service.ts`) : les mois antérieurs au
 * début de l'année scolaire active apparaissent donc à zéro plutôt que
 * d'afficher les montants d'une année précédente.
 */
export const CASH_EVOLUTION_MONTHS_BACK = 12

/** Libellés français des mois (index 0 = janvier), utilisés par le suivi des salaires (F-023). */
export const MONTH_LABELS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
] as const
