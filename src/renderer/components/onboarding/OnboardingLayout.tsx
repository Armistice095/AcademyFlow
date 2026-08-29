import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Stepper } from './Stepper'
import { ONBOARDING_STEPS, type OnboardingStepPath } from '@renderer/lib/onboarding'
import logo from '@renderer/assets/logo.png'
import onboardingVisual from '@renderer/assets/onboarding-hero.jpg'

export interface OnboardingLayoutProps {
  currentStep: OnboardingStepPath
  /** Titre affiché en surimpression sur le panneau visuel (desktop uniquement). */
  title: string
  description: string
  /** Petit badge décoratif flottant sur le panneau visuel (icône + libellé court). */
  illustration: ReactNode
  /** Note affichée en bas du panneau visuel (ex: mention sécurité). */
  footerNote?: string
  /** Action secondaire optionnelle affichée en haut à droite de l'en-tête (ex: "Quitter"). */
  headerAction?: ReactNode
  children: ReactNode
}

/** Image de secours pour le panneau visuel — à remplacer par le visuel de marque définitif. */
const VISUAL_BACKGROUND_URL = onboardingVisual

/**
 * Coquille commune aux 6 pages de l'assistant d'onboarding.
 *
 * Direction : Minimalist Clean SaaS UI + Soft UI + glassmorphisme. En-tête
 * fine et vitrée (logo, progression compacte), corps en deux colonnes —
 * formulaire à gauche, panneau visuel de marque à droite — inspiré des
 * écrans d'auth "split screen" modernes plutôt que de la coquille
 * sidebar/carte d'origine.
 */
export function OnboardingLayout({
  currentStep,
  title,
  description,
  illustration,
  footerNote,
  headerAction,
  children
}: OnboardingLayoutProps): JSX.Element {
  const currentIndex = ONBOARDING_STEPS.findIndex((step) => step.path === currentStep)

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-gray-50">
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex shrink-0 items-center gap-2">
          <img src={logo} alt="AcademyFlow" className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight text-gray-900">
            AcademyFlow
          </span>
        </div>

        <Stepper steps={ONBOARDING_STEPS} currentIndex={currentIndex} />

        <div className="flex min-w-[1px] shrink-0 justify-end">{headerAction}</div>
      </header>

      <div className="relative z-10 flex flex-1 gap-3 overflow-hidden px-3 pb-3">
        {/* Colonne formulaire */}
        <main className="flex flex-1 items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[440px] py-6">{children}</div>
        </main>

        {/* Panneau visuel de marque */}
        <aside className="relative hidden w-[42%] max-w-[560px] shrink-0 overflow-hidden rounded-[28px] lg:block">
          <img
            src={VISUAL_BACKGROUND_URL}
            alt=""
            className="absolute inset-0 h-full w-full scale-105 object-cover object-[30%_center]"
            draggable={false}
          />
          {/* Voile de marque + lisibilité du texte */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/85 via-gray-900/35 to-primary-700/40" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-600/25 via-transparent to-accent-500/25" />

          {/* Orbes d'ambiance */}
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 animate-float-blob rounded-full bg-accent-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 animate-float-blob-slow rounded-full bg-primary-500/25 blur-3xl" />

          <div className="relative flex h-full flex-col justify-between p-9 text-white">
            <div className="flex animate-in fade-in slide-in-from-top-3 items-center gap-2 self-start rounded-full glass px-4 py-2 text-xs font-medium text-white duration-700 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0">
              {illustration}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <h1 className="text-[26px] font-bold leading-[1.15] text-balance">{title}</h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">{description}</p>
            </div>

            {footerNote && (
              <p className="flex animate-in fade-in slide-in-from-bottom-2 items-center gap-1.5 text-[11px] text-white/60 delay-150 duration-700">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {footerNote}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
