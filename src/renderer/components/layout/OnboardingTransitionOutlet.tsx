import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { ONBOARDING_STEPS } from '@renderer/lib/onboarding'

function stepIndexFromPathname(pathname: string): number {
  const step = pathname.split('/')[2]
  const index = ONBOARDING_STEPS.findIndex((s) => s.path === step)
  return index === -1 ? 0 : index
}

const variants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -28 : 28 })
}

/**
 * Enveloppe placée au-dessus des 6 routes `/onboarding/*` (voir `App.tsx`).
 * Contrairement à `OnboardingGuard`, ce composant ne contient aucune logique
 * de résolution d'étape — il se contente d'observer le changement de route
 * pour transitionner en douceur d'une étape à l'autre : fondu + léger
 * glissement, dont le sens dépend du sens de navigation (avance vers une
 * étape suivante ou retour en arrière), calculé en comparant l'index de
 * l'étape courante à celui de la précédente.
 *
 * Comme ce composant reste monté tout au long du parcours d'onboarding (seul
 * l'`<Outlet />` qu'il rend change), `AnimatePresence` peut réellement faire
 * cohabiter un instant l'étape sortante et l'étape entrante — ce qui ne
 * serait pas possible en plaçant l'animation plus bas, dans chaque page.
 */
export function OnboardingTransitionOutlet(): JSX.Element {
  const location = useLocation()
  const currentIndex = stepIndexFromPathname(location.pathname)
  const previousIndexRef = useRef(currentIndex)
  const direction = currentIndex >= previousIndexRef.current ? 1 : -1

  useEffect(() => {
    previousIndexRef.current = currentIndex
  }, [currentIndex])

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
