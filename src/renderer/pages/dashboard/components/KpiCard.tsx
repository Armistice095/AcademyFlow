import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

export type KpiTone = 'positive' | 'negative' | 'neutral'

export interface KpiCardProps {
  icon: LucideIcon
  iconClassName: string
  label: string
  value: string
  /** Texte affiché sous la valeur (ex: "↑ 8,5% vs année dernière"). Omis si non pertinent. */
  trendLabel?: string
  trendTone?: KpiTone
  trendDirection?: 'up' | 'down' | 'flat'
  /**
   * 'change' (défaut) : flèche haussière/baissière ou tiret neutre — pour une
   * vraie comparaison à une période de référence.
   * 'status' : puce de couleur pleine, sans flèche ni tiret — pour un simple
   * repère d'état/fraîcheur (ex: solde de caisse "Mis à jour à l'instant"),
   * qui n'est pas une tendance et ne doit donc pas ressembler à une baisse.
   */
  trendVariant?: 'change' | 'status'
  /**
   * Classe de couleur pour la puce en mode 'status' (ex: 'bg-accent-500'),
   * quand la couleur doit refléter une catégorie (genre, statut) plutôt
   * qu'une tonalité positive/négative/neutre.
   */
  trendDotClassName?: string
  /** Délai (ms) avant l'animation d'entrée — pour un effet en cascade sur la rangée de cartes KPI. */
  animationDelayMs?: number
}

const TONE_CLASSES: Record<KpiTone, string> = {
  positive: 'text-success',
  negative: 'text-destructive',
  neutral: 'text-muted-foreground'
}

const TONE_DOT_CLASSES: Record<KpiTone, string> = {
  positive: 'bg-success',
  negative: 'bg-destructive',
  neutral: 'bg-muted-foreground'
}

/** Carte KPI du tableau de bord — icône, valeur en gros, tendance optionnelle. */
export function KpiCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  trendLabel,
  trendTone = 'neutral',
  trendDirection = 'flat',
  trendVariant = 'change',
  trendDotClassName,
  animationDelayMs = 0
}: KpiCardProps): JSX.Element {
  const TrendIcon =
    trendDirection === 'up' ? ArrowUpRight : trendDirection === 'down' ? ArrowDownRight : Minus

  return (
    <Card
      className="animate-in fade-in-0 slide-in-from-bottom-2 p-5 shadow-sm duration-500 fill-mode-backwards transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            iconClassName
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate font-mono text-xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          {trendLabel && (
            <p
              className={cn(
                'mt-1 flex items-center gap-1.5 text-xs font-medium',
                trendVariant === 'status' && trendDotClassName
                  ? 'text-muted-foreground'
                  : TONE_CLASSES[trendTone]
              )}
            >
              {trendVariant === 'status' ? (
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    trendDotClassName ?? TONE_DOT_CLASSES[trendTone]
                  )}
                />
              ) : (
                <TrendIcon className="h-3.5 w-3.5 shrink-0" />
              )}
              {trendLabel}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
