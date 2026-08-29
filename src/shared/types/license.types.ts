/** Types partagés Main ↔ Renderer — domaine Licence (activation, onboarding). */

/**
 * Statut courant de la licence, toujours recalculé (jamais mis en cache) :
 *
 *  - `not_activated` : aucune licence enregistrée localement (premier lancement).
 *  - `invalid` : payload local corrompu, falsifié, ou recul d'horloge système
 *    détecté (voir cliquet anti-triche). Traité comme `not_activated` pour
 *    l'UI (redemande une clé), mais distingué pour le message affiché.
 *  - `active` : licence valide, date d'expiration non atteinte.
 *  - `readonly` : licence expirée (au-delà de la période de grâce, ou
 *    reverification en ligne infructueuse à l'échéance) — consultation
 *    seule, créations désactivées (voir `useLicenseGuard` côté renderer).
 */
export type LicenseState = 'not_activated' | 'invalid' | 'active' | 'readonly'

export interface LicenseStatus {
  state: LicenseState
  /** `null` si `state` est `not_activated`. */
  expiresAt: string | null
  /** Jours restants avant expiration (peut être négatif si déjà expirée). `null` si `not_activated`/`invalid`. */
  daysRemaining: number | null
  /**
   * Palier d'alerte à afficher dans l'UI, dérivé de `daysRemaining`.
   * `null` = pas d'alerte à afficher (licence active, loin de l'échéance).
   */
  alertLevel: 'none' | 'warning_15' | 'warning_7' | 'warning_1'
  lastVerifiedAt: string | null
  onboardingCompleted: boolean
}

export interface ActivateLicenseDTO {
  licenseKey: string
}

export interface ActivateLicenseResult {
  success: boolean
  status: LicenseStatus
  /** Message utilisateur en cas d'échec (clé invalide, déjà activée sur un autre poste, réseau indisponible...). */
  error?: string
}
