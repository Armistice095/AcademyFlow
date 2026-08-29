import { api } from '@renderer/lib/ipc'

/** Les 6 étapes de l'onboarding, dans l'ordre — utilisées par le Stepper et le routing. */
export const ONBOARDING_STEPS = [
  { path: 'license', label: 'Licence' },
  { path: 'school', label: 'Établissement' },
  { path: 'admin', label: 'Administrateur' },
  { path: 'classes', label: 'Classes' },
  { path: 'school-year', label: 'Année scolaire' },
  { path: 'drive', label: 'Sauvegarde' }
] as const

export type OnboardingStepPath = (typeof ONBOARDING_STEPS)[number]['path']

/**
 * Détermine à quelle étape reprendre l'onboarding, en se basant sur les
 * données réellement présentes en base plutôt que sur un simple indicateur
 * — robuste à une fermeture de l'app en plein milieu de l'assistant (voir
 * discussion produit : chaque étape persiste directement via les services
 * existants, il n'y a pas d'état de brouillon côté renderer à perdre).
 *
 * Retourne `null` si l'onboarding est entièrement terminé.
 */
export async function resolveOnboardingResumeStep(): Promise<OnboardingStepPath | null> {
  const license = await api.license.getStatus()
  if (license.state === 'not_activated' || license.state === 'invalid') {
    return 'license'
  }

  const schoolInfo = await api.settings.getSchoolInfo()
  if (!schoolInfo.name.trim()) {
    return 'school'
  }

  const users = await api.auth.listUsers()
  if (users.length === 0) {
    return 'admin'
  }

  const classes = await api.settings.getClasses()
  if (classes.length === 0) {
    return 'classes'
  }

  const schoolYears = await api.settings.listSchoolYears()
  if (schoolYears.length === 0) {
    return 'school-year'
  }

  if (!license.onboardingCompleted) {
    return 'drive'
  }

  return null
}
