import { useMemo } from 'react'
import * as echarts from 'echarts/core'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { buildTooltipHtml } from '@renderer/pages/dashboard/components/echarts-tooltip'
import { CHART_HEX } from '@renderer/pages/dashboard/components/chart-colors'
import { formatCFACompact } from '@renderer/lib/formatters'

export interface SingleSeriesPoint {
  date: string // 'YYYY-MM-DD'
  amount: number
}

export interface SingleSeriesAreaChartProps {
  data: SingleSeriesPoint[]
  seriesName: string
  color: string
}

function formatDayMonth(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${day}/${month}`
}

/** Courbe à une seule série (Recettes ou Dépenses), même habillage que `EntriesExitsLineChart`. */
export function SingleSeriesAreaChart({
  data,
  seriesName,
  color
}: SingleSeriesAreaChartProps): JSX.Element {
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
          return buildTooltipHtml(title, [
            { label: seriesName, value: Number(items[0]?.value ?? 0), color }
          ])
        }
      },
      series: [
        {
          name: seriesName,
          type: 'line',
          data: data.map((p) => p.amount),
          smooth: true,
          symbolSize: 6,
          lineStyle: { color, width: 2 },
          itemStyle: { color },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `${color}33` },
              { offset: 1, color: `${color}00` }
            ])
          }
        }
      ]
    }),
    [data, seriesName, color]
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
