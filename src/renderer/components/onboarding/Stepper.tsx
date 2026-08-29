import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface StepperStep {
  label: string
}

export interface StepperProps {
  steps: readonly { label: string }[]
  /** Index (0-based) de l'étape courante. */
  currentIndex: number
}

/**
 * Fil d'étapes minimal utilisé par l'assistant d'onboarding : une rangée de
 * pastilles reliées par un fil de progression. Le libellé de chaque étape
 * reste disponible au survol (title) plutôt qu'imprimé en dur à côté —
 * l'en-tête reste léger sur les 6 pages.
 */
export function Stepper({ steps, currentIndex }: StepperProps): JSX.Element {
  return (
    <div className="flex items-center">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={step.label} className="flex items-center">
            <div
              className={cn(
                'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-all duration-300',
                isCurrent &&
                  'scale-110 bg-primary text-primary-foreground shadow-glow-primary ring-4 ring-primary-100',
                isCompleted && 'bg-primary/15 text-primary',
                !isCurrent && !isCompleted && 'bg-gray-100 text-gray-400'
              )}
              aria-current={isCurrent ? 'step' : undefined}
              title={step.label}
            >
              {isCompleted ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
            </div>

            {index < steps.length - 1 && (
              <div
                className={cn(
                  'h-px w-4 shrink-0 transition-colors duration-500 sm:w-8',
                  isCompleted ? 'bg-primary/40' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
