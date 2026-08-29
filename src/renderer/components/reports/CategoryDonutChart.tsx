import { useMemo } from 'react'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { buildTooltipHtml } from '@renderer/pages/dashboard/components/echarts-tooltip'
import { CATEGORY_COLORS } from '@renderer/pages/dashboard/components/category-colors'
import { CHART_HEX } from '@renderer/pages/dashboard/components/chart-colors'
import { CASH_CATEGORY_LABELS } from '@shared/constants/categories'
import { formatCFA, formatCFACompact } from '@renderer/lib/formatters'
import type { ReportCategoryBreakdown } from '@shared/types/transaction.types'

export interface CategoryDonutChartProps {
  data: ReportCategoryBreakdown[]
  /** Libellé affiché sous le total, au centre du donut (ex: "F CFA"). */
  centerLabel?: string
}

/** Donut "Répartition des entrées par catégorie" — total au centre, légende détaillée à droite (mockup). */
export function CategoryDonutChart({ data, centerLabel }: CategoryDonutChartProps): JSX.Element {
  const total = data.reduce((sum, item) => sum + item.amount, 0)

  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        extraCssText: 'box-shadow:none;',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return buildTooltipHtml(undefined, [
            {
              label: String(item.name ?? ''),
              value: Number(item.value ?? 0),
              color: String(item.color ?? CHART_HEX.primary500)
            }
          ])
        }
      },
      series: [
        {
          type: 'pie',
          radius: ['68%', '84%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          padAngle: 3,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          labelLine: { show: false },
          data: data.map((item) => ({
            name: CASH_CATEGORY_LABELS[item.category] ?? item.category,
            value: item.amount,
            itemStyle: { color: CATEGORY_COLORS[item.category] }
          }))
        }
      ]
    }),
    [data]
  )

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune entrée sur cette période.
      </p>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
        <EChart option={option} height={220} />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="font-mono text-base font-bold leading-tight tracking-tight text-foreground">
            {formatCFACompact(total)}
          </p>
          {centerLabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{centerLabel}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {data.map((item) => (
          <div key={item.category} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
            />
            <span className="truncate text-muted-foreground">
              {CASH_CATEGORY_LABELS[item.category] ?? item.category}
            </span>
            <span className="ml-auto shrink-0 font-medium text-foreground">
              {item.percentage.toFixed(0)}%
            </span>
            <span className="w-24 shrink-0 text-right font-mono text-muted-foreground">
              {formatCFA(item.amount)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-xs font-semibold">
          <span className="text-foreground">Total</span>
          <span className="ml-auto shrink-0 text-foreground">100%</span>
          <span className="w-24 shrink-0 text-right font-mono text-foreground">
            {formatCFA(total)}
          </span>
        </div>
      </div>
    </div>
  )
}
