import { TrendingDown } from 'lucide-react'
import { TypeReportView } from '@renderer/components/reports/TypeReportView'
import { CASH_FLOW_COLORS } from '@renderer/pages/dashboard/components/chart-colors'

/** Onglet "Dépenses" — vue générique `TypeReportView` avec `type='exit'` forcé (voir plan §3). */
export function ExpensesReportPage(): JSX.Element {
  return (
    <TypeReportView
      type="exit"
      label="Dépenses"
      tone="red"
      icon={TrendingDown}
      color={CASH_FLOW_COLORS.exits}
      emptyMessage="Aucune dépense enregistrée sur cette période."
    />
  )
}
