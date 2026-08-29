import { TrendingUp } from 'lucide-react'
import { TypeReportView } from '@renderer/components/reports/TypeReportView'
import { CASH_FLOW_COLORS } from '@renderer/pages/dashboard/components/chart-colors'

/** Onglet "Recettes" — vue générique `TypeReportView` avec `type='entry'` forcé (voir plan §3). */
export function RevenueReportPage(): JSX.Element {
  return (
    <TypeReportView
      type="entry"
      label="Recettes"
      tone="green"
      icon={TrendingUp}
      color={CASH_FLOW_COLORS.entries}
      emptyMessage="Aucune recette enregistrée sur cette période."
    />
  )
}
