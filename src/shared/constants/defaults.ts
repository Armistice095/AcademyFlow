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
