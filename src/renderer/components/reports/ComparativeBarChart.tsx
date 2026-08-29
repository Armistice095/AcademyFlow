import { useMemo } from 'react'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { buildTooltipHtml } from '@renderer/pages/dashboard/components/echarts-tooltip'
import { CASH_FLOW_COLORS, CHART_HEX } from '@renderer/pages/dashboard/components/chart-colors'
import { formatCFACompact } from '@renderer/lib/formatters'

export interface ComparativeBarChartRow {
  label: string
  totalEntries: number
  totalExits: number
}

export interface ComparativeBarChartProps {
  data: ComparativeBarChartRow[]
}

/** Barres groupées entrées (vert) / sorties (rouge) par ligne — onglets "Par classe" et "Par caissier". */
export function ComparativeBarChart({ data }: ComparativeBarChartProps): JSX.Element {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 12, right: 16, bottom: 48, left: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((row) => row.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_HEX.gray200 } },
        axisLabel: { color: CHART_HEX.gray700, fontSize: 11, rotate: data.length > 6 ? 30 : 0 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: CHART_HEX.gray200, type: 'dashed' } },
        axisLabel: {
          color: CHART_HEX.gray700,
          fontSize: 11,
          formatter: (value: number) => formatCFACompact(value).replace(' F CFA', '')
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'transparent',
        borderWidth: 0,
        padding: 0,
        extraCssText: 'box-shadow:none;',
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const title = String(items[0]?.axisValueLabel ?? items[0]?.name ?? '')
          return buildTooltipHtml(
            title,
            items.map((item) => ({
              label: String(item.seriesName ?? ''),
              value: Number(item.value ?? 0),
              color:
                item.seriesName === 'Entrées' ? CASH_FLOW_COLORS.entries : CASH_FLOW_COLORS.exits
            }))
          )
        }
      },
      series: [
        {
          name: 'Entrées',
          type: 'bar',
          data: data.map((row) => row.totalEntries),
          itemStyle: { color: CASH_FLOW_COLORS.entries, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 24
        },
        {
          name: 'Sorties',
          type: 'bar',
          data: data.map((row) => row.totalExits),
          itemStyle: { color: CASH_FLOW_COLORS.exits, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 24
        }
      ]
    }),
    [data]
  )

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune donnée sur cette période.
      </p>
    )
  }

  return <EChart option={option} height={280} />
}
