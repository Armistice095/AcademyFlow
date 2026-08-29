import { FileDown, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { KpiCard } from '@renderer/components/reports/KpiCard'
import { CategoryDonutChart } from '@renderer/components/reports/CategoryDonutChart'
import { EntriesExitsLineChart } from '@renderer/components/reports/EntriesExitsLineChart'
import { PeriodSummaryPanel } from '@renderer/components/reports/PeriodSummaryPanel'
import { ReportsSkeleton } from '@renderer/components/reports/ReportsSkeleton'
import { useExportCashReportPdf } from '@renderer/components/reports/useExportCashReportPdf'
import { useReportsStore } from '@renderer/stores/reports.store'
import { CASH_FLOW_COLORS } from '@renderer/pages/dashboard/components/chart-colors'
import { formatCFA, formatDate } from '@renderer/lib/formatters'

/** Vue générale — exactement la maquette fournie (5 KPI, donut catégories, courbe, résumé). */
export function OverviewReportPage(): JSX.Element {
  const { report, isLoading, error } = useReportsStore()
  const { exportPdf, isExporting } = useExportCashReportPdf()

  if (error && !report) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    )
  }

  if (!report) {
    return <ReportsSkeleton kpiCount={4} chartCount={2} />
  }

  const { kpis } = report
  const hasNoData = kpis.totalEntries === 0 && kpis.totalExits === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? 'Actualisation…'
            : `Période du ${formatDate(report.from)} au ${formatDate(report.to)}`}
        </p>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => void exportPdf()}
          disabled={isExporting}
        >
          <FileDown className="h-4 w-4" />
          {isExporting ? 'Export...' : 'Exporter en PDF'}
        </Button>
      </div>

      {hasNoData ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune opération enregistrée sur cette période.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <KpiCard
              icon={TrendingUp}
              tone="green"
              label="Total entrées"
              value={formatCFA(kpis.totalEntries)}
              changePct={kpis.totalEntriesChangePct}
              animationDelayMs={0}
            />
            <KpiCard
              icon={TrendingDown}
              tone="red"
              label="Total sorties"
              value={formatCFA(kpis.totalExits)}
              changePct={kpis.totalExitsChangePct}
              animationDelayMs={60}
            />
            <KpiCard
              icon={Wallet}
              tone="blue"
              label="Solde net"
              value={formatCFA(kpis.netBalance)}
              changePct={kpis.netBalanceChangePct}
              animationDelayMs={120}
            />
            <KpiCard
              icon={Users}
              tone="orange"
              label="Nombre de transactions"
              value={kpis.transactionCount.toLocaleString('fr-FR')}
              changePct={kpis.transactionCountChangePct}
              animationDelayMs={180}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Répartition des entrées par catégorie</CardTitle>
                <p className="text-sm text-muted-foreground">Entrées totales</p>
              </CardHeader>
              <CardContent>
                <CategoryDonutChart data={report.byCategory} centerLabel="Entrées" />
              </CardContent>
            </Card>

            <Card className="flex flex-col lg:col-span-5">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Évolution des entrées et sorties</CardTitle>
                <div className="flex items-center gap-5 pt-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CASH_FLOW_COLORS.entries }}
                    />
                    Entrées
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: CASH_FLOW_COLORS.exits }}
                    />
                    Sorties
                  </p>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                <EntriesExitsLineChart data={report.timeSeries} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Résumé de la période</CardTitle>
              </CardHeader>
              <CardContent>
                <PeriodSummaryPanel
                  openingBalance={report.openingBalance}
                  totalEntries={kpis.totalEntries}
                  totalExits={kpis.totalExits}
                  netBalance={kpis.netBalance}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
