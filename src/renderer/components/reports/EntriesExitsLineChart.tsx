import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { buildTooltipHtml } from '@renderer/pages/dashboard/components/echarts-tooltip'
import { CASH_FLOW_COLORS, CHART_HEX } from '@renderer/pages/dashboard/components/chart-colors'
import { formatCFACompact } from '@renderer/lib/formatters'
import type { ReportTimeSeriesPoint } from '@shared/types/transaction.types'

export interface EntriesExitsLineChartProps {
  data: ReportTimeSeriesPoint[]
}

function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

/** Courbe "Évolution des entrées et sorties" — 2 séries, aire en dégradé, lissée (mockup). */
export function EntriesExitsLineChart({ data }: EntriesExitsLineChartProps): JSX.Element {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 12, right: 16, bottom: 28, left: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((p) => formatDayMonth(p.date)),
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_HEX.gray200 } },
        axisLabel: { color: CHART_HEX.gray700, fontSize: 11 }
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
          type: 'line',
          data: data.map((p) => p.entries),
          smooth: true,
          symbolSize: 6,
          lineStyle: { color: CASH_FLOW_COLORS.entries, width: 2 },
          itemStyle: { color: CASH_FLOW_COLORS.entries },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${CASH_FLOW_COLORS.entries}33` },
              { offset: 1, color: `${CASH_FLOW_COLORS.entries}00` }
            ])
          }
        },
        {
          name: 'Sorties',
          type: 'line',
          data: data.map((p) => p.exits),
          smooth: true,
          symbolSize: 6,
          lineStyle: { color: CASH_FLOW_COLORS.exits, width: 2 },
          itemStyle: { color: CASH_FLOW_COLORS.exits },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${CASH_FLOW_COLORS.exits}33` },
              { offset: 1, color: `${CASH_FLOW_COLORS.exits}00` }
            ])
          }
        }
      ]
    }),
    [data]
  )

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Aucune opération sur cette période.
      </p>
    )
  }

  return (
    <div className="h-full min-h-[260px]">
      <EChart option={option} height="100%" />
    </div>
  )
}
