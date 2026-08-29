import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

/**
 * 5 tonalités fixes, alignées sur la maquette : vert (entrées), rouge
 * (sorties), bleu (solde net), orange (transactions), violet (à recouvrer).
 * Contrairement au KPI card du tableau de bord, la couleur ici est purement
 * décorative (liée à la nature de la carte, pas à un jugement de valeur) —
 * la variation % garde son propre code couleur, littéral au signe brut (voir
 * plan §2.3 : une hausse des sorties reste affichée en vert, pas inversée).
 */
export type KpiCardTone = 'green' | 'red' | 'blue' | 'orange' | 'violet'

const ICON_TONE_CLASSES: Record<KpiCardTone, string> = {
  green: 'bg-success/10 text-success',
  red: 'bg-destructive/10 text-destructive',
  blue: 'bg-primary-50 text-primary-600',
  orange: 'bg-warning/10 text-warning',
  violet: 'bg-[#8b5cf6]/10 text-[#8b5cf6]'
}

export interface KpiCardProps {
  icon: LucideIcon
  tone: KpiCardTone
  label: string
  value: string
  /**
   * Variation en % vs la période précédente équivalente, déjà signée
   * (positive = hausse). `null` si la comparaison n'est pas significative
   * (période de référence à zéro) — affiche alors un texte neutre sans flèche.
   */
  changePct: number | null
  compareLabel?: string
  animationDelayMs?: number
}

/** Carte KPI de la page Rapports — reprend le gabarit visuel du tableau de bord, en 5 tonalités fixes. */
export function KpiCard({
  icon: Icon,
  tone,
  label,
  value,
  changePct,
  compareLabel = 'par rapport au mois dernier',
  animationDelayMs = 0
}: KpiCardProps): JSX.Element {
  const hasComparison = changePct !== null
  // Couleur littérale au signe brut (pas d'inversion sémantique pour les sorties) — voir plan §2.3.
  const isUp = hasComparison && changePct > 0
  const isDown = hasComparison && changePct < 0
  const TrendIcon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus
  const trendClassName = isUp
    ? 'text-success'
    : isDown
      ? 'text-destructive'
      : 'text-muted-foreground'

  return (
    <Card
      className="animate-in fade-in-0 slide-in-from-bottom-2 p-5 shadow-sm duration-500 fill-mode-backwards transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ animationDelay: `${animationDelayMs}ms` }}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            ICON_TONE_CLASSES[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate font-mono text-xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
          <p className={cn('mt-1 flex items-center gap-1 text-xs font-medium', trendClassName)}>
            <TrendIcon className="h-3.5 w-3.5 shrink-0" />
            {hasComparison
              ? `${Math.abs(changePct).toFixed(0)}% ${compareLabel}`
              : 'Pas de comparaison possible'}
          </p>
        </div>
      </div>
    </Card>
  )
}
