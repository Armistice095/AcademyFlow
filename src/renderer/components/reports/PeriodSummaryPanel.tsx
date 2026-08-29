import type { LucideIcon } from 'lucide-react'
import { Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { formatCFA } from '@renderer/lib/formatters'

export interface PeriodSummaryPanelProps {
  openingBalance: number
  totalEntries: number
  totalExits: number
  netBalance: number
}

/**
 * Panneau "Résumé de la période" — solde initial et totaux en liste avec
 * icônes, puis solde net et solde final (= solde initial + solde net) mis en
 * avant dans un bloc distinct, colorés selon le signe.
 */
export function PeriodSummaryPanel({
  openingBalance,
  totalEntries,
  totalExits,
  netBalance
}: PeriodSummaryPanelProps): JSX.Element {
  const closingBalance = openingBalance + netBalance
  const isNetPositive = netBalance >= 0
  const isClosingPositive = closingBalance >= 0

  return (
    <div className="flex flex-col">
      <div className="flex flex-col divide-y divide-border">
        <Row
          icon={Landmark}
          iconClassName="bg-muted text-muted-foreground"
          label="Solde initial"
          value={formatCFA(openingBalance)}
        />
        <Row
          icon={TrendingUp}
          iconClassName="bg-success/10 text-success"
          label="Total des entrées"
          value={formatCFA(totalEntries)}
          valueClassName="text-success"
        />
        <Row
          icon={TrendingDown}
          iconClassName="bg-destructive/10 text-destructive"
          label="Total des sorties"
          value={formatCFA(totalExits)}
          valueClassName="text-destructive"
        />
      </div>

      <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-muted/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">Solde net</span>
          <span
            className={cn(
              'font-mono text-sm font-semibold',
              isNetPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {isNetPositive ? '+' : ''}
            {formatCFA(netBalance)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-2.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Solde final
          </span>
          <span
            className={cn(
              'font-mono text-lg font-bold tracking-tight',
              isClosingPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {formatCFA(closingBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  iconClassName,
  label,
  value,
  valueClassName
}: {
  icon: LucideIcon
  iconClassName: string
  label: string
  value: string
  valueClassName?: string
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          iconClassName
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="flex-1 truncate text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 font-mono text-sm font-semibold',
          valueClassName ?? 'text-foreground'
        )}
      >
        {value}
      </span>
    </div>
  )
}
