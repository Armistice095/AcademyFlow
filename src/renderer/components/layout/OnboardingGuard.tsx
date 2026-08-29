import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ONBOARDING_STEPS, resolveOnboardingResumeStep } from '@renderer/lib/onboarding'
import logo from '@renderer/assets/logo.png'

function FullScreenLoader(): JSX.Element {
  return (
    <div className="flex h-screen w-screen animate-in items-center justify-center bg-gray-50 fade-in duration-200">
      <img src={logo} alt="AcademyFlow" className="h-14 w-14 animate-pulse" />
    </div>
  )
}

/** Résultat de `resolveOnboardingResumeStep()`, associé à la route pour laquelle il a été calculé. */
interface ResolvedState {
  pathname: string
  resumeStep: string | null
}

/**
 * Aiguille entre l'assistant d'onboarding et le reste de l'application.
 * Englobe l'intégralité de l'arbre de routes (voir `App.tsx`) :
 *
 *  - Configuration terminée : les routes `/onboarding/*` redirigent vers
 *    `/login` (empêche de rouvrir l'assistant manuellement) ; le reste de
 *    l'app fonctionne normalement.
 *  - Configuration incomplète : autorise la navigation libre vers toute
 *    étape déjà complétée (permet le bouton « Retour » et l'édition d'une
 *    étape précédente), mais bloque tout accès en avance sur l'étape de
 *    reprise réelle (skip d'URL) et bloque l'accès au reste de l'app.
 *
 * Le point de reprise est recalculé à chaque changement de route à partir
 * des données réelles (voir `resolveOnboardingResumeStep`), jamais mis en
 * cache.
 *
 * Point important : le résultat est stocké AVEC le `pathname` pour lequel
 * il a été calculé (`ResolvedState`). Le rendu affiche le loader tant que
 * `state.pathname !== location.pathname` — jamais de décision de
 * redirection prise avec un résultat calculé pour une route différente de
 * celle actuellement rendue. Sans cette garde, le tout premier rendu qui
 * suit un changement de route (avant même que l'effet n'ait pu s'exécuter)
 * utilisait l'ancien résultat de l'étape précédente pour juger la nouvelle
 * route, la faisant passer à tort pour un saut en avant — d'où le besoin
 * de valider chaque étape deux fois.
 */
export function OnboardingGuard(): JSX.Element {
  const location = useLocation()
  const [state, setState] = useState<ResolvedState | null>(null)

  useEffect(() => {
    let cancelled = false

    resolveOnboardingResumeStep()
      .then((resumeStep) => {
        if (!cancelled) setState({ pathname: location.pathname, resumeStep })
      })
      .catch(() => {
        if (!cancelled) setState({ pathname: location.pathname, resumeStep: null })
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (!state || state.pathname !== location.pathname) {
    return <FullScreenLoader />
  }

  const { resumeStep } = state
  const isOnboardingRoute = location.pathname.startsWith('/onboarding')

  if (resumeStep === null) {
    // Configuration terminée : pas d'accès à l'assistant, redirige vers l'app.
    return isOnboardingRoute ? <Navigate to="/login" replace /> : <Outlet />
  }

  if (!isOnboardingRoute) {
    // Configuration incomplète : pas d'accès au reste de l'app.
    return <Navigate to={`/onboarding/${resumeStep}`} replace />
  }

  const resumeIndex = ONBOARDING_STEPS.findIndex((step) => step.path === resumeStep)
  const requestedStep = location.pathname.split('/')[2]
  const requestedIndex = ONBOARDING_STEPS.findIndex((step) => step.path === requestedStep)

  if (requestedIndex === -1 || requestedIndex > resumeIndex) {
    // Étape inconnue ou en avance sur ce qui est réellement complété.
    return <Navigate to={`/onboarding/${resumeStep}`} replace />
  }

  return <Outlet />
}
