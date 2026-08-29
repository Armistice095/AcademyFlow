import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Landmark,
  Receipt,
  RefreshCw,
  Users,
  Wallet
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { KpiCard, type KpiTone } from './components/KpiCard'
import { RecoveryGauge } from './components/RecoveryGauge'
import { DashboardSkeleton } from './components/DashboardSkeleton'
import { buildTooltipHtml } from './components/echarts-tooltip'
import { CASH_FLOW_COLORS, CHART_HEX } from './components/chart-colors'
import { getActivityMeta, getActivityAmountSign, getAlertMeta } from './components/activity-meta'
import { CATEGORY_COLORS } from './components/category-colors'
import { getClassDotColor } from './components/class-colors'
import { useDashboard } from '@renderer/hooks/useDashboard'
import { formatCFA, formatCFACompact, formatDateTimeShort } from '@renderer/lib/formatters'
import type { KpiTrend } from '@shared/types/dashboard.types'

interface TrendDescription {
  label: string
  tone: KpiTone
  direction: 'up' | 'down' | 'flat'
}

/**
 * Tendance en pourcentage, pour toute carte KPI comparée à une période de
 * référence (élèves et personnel : année dernière — encaissements/dépenses :
 * mois précédent — voir `trend.compareLabel`, fourni par le backend).
 * `invert` : une hausse est-elle défavorable (ex: les dépenses) ?
 */
function describeTrend(trend: KpiTrend, invert = false): TrendDescription {
  if (trend.growthPct === null) {
    return { label: 'Pas de comparaison possible', tone: 'neutral', direction: 'flat' }
  }
  const pct = trend.growthPct
  // Stagnation réelle (valeur strictement identique à la période de référence,
  // ex: 200 élèves l'an dernier, 200 cette année) : notation neutre — tiret
  // et couleur grise — plutôt qu'une flèche haussière/baissière trompeuse.
  const direction: TrendDescription['direction'] = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
  const isFavorable = invert ? pct <= 0 : pct >= 0
  const tone: KpiTone = direction === 'flat' ? 'neutral' : isFavorable ? 'positive' : 'negative'
  return { label: `${Math.abs(pct).toFixed(1)}% ${trend.compareLabel}`, tone, direction }
}

export function DashboardPage(): JSX.Element {
  const { stats, isLoading, error, refresh } = useDashboard()
  // Nombre de mois affichés dans le graphique d'évolution — 12 par défaut
  // (fenêtre max renvoyée par le backend), ajustable par l'utilisateur.
  const [cashEvolutionMonths, setCashEvolutionMonths] = useState(12)

  const cashEvolutionData = useMemo(() => {
    if (!stats) return []
    return stats.cashEvolution.slice(-cashEvolutionMonths)
  }, [stats, cashEvolutionMonths])

  // --- Options ECharts — recalculées uniquement quand les données changent ---
  const cashEvolutionOption = useMemo<EChartsOption | null>(() => {
    if (!stats) return null
    return {
      grid: { top: 8, right: 12, bottom: 30, left: 8, containLabel: true },
      xAxis: {
        type: 'category',
        // Libellé sur deux lignes ("Août" / "2024"), comme dans la maquette —
        // évite toute ambiguïté quand la période à l'affichage chevauche deux
        // années civiles (ex: année scolaire août 2024 → juillet 2025).
        data: cashEvolutionData.map((p) => `${p.label}\n${p.month.slice(0, 4)}`),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: CHART_HEX.gray200 } },
        axisLabel: { color: CHART_HEX.gray700, fontSize: 11, lineHeight: 15 }
      },
      yAxis: {
        type: 'value',
        name: 'Montant (F CFA)',
        nameLocation: 'middle',
        nameGap: 46,
        nameRotate: 90,
        nameTextStyle: { color: CHART_HEX.gray700, fontSize: 11 },
        splitLine: { lineStyle: { color: CHART_HEX.gray200, type: 'dashed' } },
        axisLabel: {
          color: CHART_HEX.gray700,
          fontSize: 12,
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
          const title = String(items[0]?.axisValueLabel ?? items[0]?.name ?? '').replace('\n', ' ')
          return buildTooltipHtml(
            title,
            items.map((item) => ({
              label: String(item.seriesName ?? ''),
              value: Number(item.value ?? 0),
              color:
                item.seriesName === 'Encaissements'
                  ? CASH_FLOW_COLORS.entries
                  : CASH_FLOW_COLORS.exits
            }))
          )
        }
      },
      series: [
        {
          name: 'Encaissements',
          type: 'bar',
          data: cashEvolutionData.map((p) => p.entries),
          itemStyle: { color: CASH_FLOW_COLORS.entries, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 18
        },
        {
          name: 'Dépenses',
          type: 'bar',
          data: cashEvolutionData.map((p) => p.exits),
          itemStyle: { color: CASH_FLOW_COLORS.exits, borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 18
        }
      ]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashEvolutionData])

  const categoryBreakdownOption = useMemo<EChartsOption | null>(() => {
    if (!stats) return null
    return {
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
          data: stats.categoryBreakdown.map((item) => ({
            name: item.label,
            value: item.amount,
            itemStyle: { color: CATEGORY_COLORS[item.category] }
          }))
        }
      ]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats?.categoryBreakdown])

  if (error && !stats) {
    return (
      <Card className="animate-in fade-in-0 zoom-in-95 duration-300">
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="text-sm text-muted-foreground">Impossible de charger le tableau de bord.</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 transition-transform active:scale-95"
            onClick={() => void refresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!stats || !cashEvolutionOption || !categoryBreakdownOption) {
    return <DashboardSkeleton />
  }

  const studentsTrend = describeTrend(stats.kpis.studentsEnrolled)
  const entriesTrend = describeTrend(stats.kpis.cashEntries)
  const exitsTrend = describeTrend(stats.kpis.cashExits, true)
  const personnelTrend = describeTrend(stats.kpis.personnel)

  const maxTopExpense = Math.max(1, ...stats.topExpenses.map((e) => e.amount))
  const categoryTotal = stats.categoryBreakdown.reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="flex animate-in fade-in-0 items-center gap-1.5 text-xs text-muted-foreground duration-300">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Actualisation…
        </div>
      )}

      {/* --- Cartes KPI ------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={GraduationCap}
          iconClassName="bg-primary-50 text-primary-600"
          label="Élèves inscrits"
          value={stats.kpis.studentsEnrolled.current.toLocaleString('fr-FR')}
          trendLabel={studentsTrend.label}
          trendTone={studentsTrend.tone}
          trendDirection={studentsTrend.direction}
          animationDelayMs={0}
        />
        <KpiCard
          icon={Wallet}
          iconClassName="bg-success/10 text-success"
          label="Encaissements"
          value={formatCFA(stats.kpis.cashEntries.current)}
          trendLabel={entriesTrend.label}
          trendTone={entriesTrend.tone}
          trendDirection={entriesTrend.direction}
          animationDelayMs={60}
        />
        <KpiCard
          icon={Receipt}
          iconClassName="bg-warning/10 text-warning"
          label="Dépenses"
          value={formatCFA(stats.kpis.cashExits.current)}
          trendLabel={exitsTrend.label}
          trendTone={exitsTrend.tone}
          trendDirection={exitsTrend.direction}
          animationDelayMs={120}
        />
        <KpiCard
          icon={Users}
          iconClassName="bg-accent-500/10 text-accent-600"
          label="Personnel"
          value={stats.kpis.personnel.current.toLocaleString('fr-FR')}
          trendLabel={personnelTrend.label}
          trendTone={personnelTrend.tone}
          trendDirection={personnelTrend.direction}
          animationDelayMs={180}
        />
        <KpiCard
          icon={Landmark}
          iconClassName="bg-gray-900 text-white"
          label="Solde de caisse"
          value={formatCFA(stats.kpis.cashBalance)}
          trendLabel="Mise à jour à l'instant"
          trendTone="positive"
          trendVariant="status"
          animationDelayMs={240}
        />
      </div>

      {/*
        Grille principale : 12 colonnes x 2 rangées explicites, partagées par
        toutes les cartes (au lieu de deux colonnes indépendantes). Ainsi
        « Activités récentes » s'étire exactement sur la hauteur de la rangée 1
        (Évolution / Répartition) et « Alertes et rappels » s'étire exactement
        sur la hauteur de la rangée 2 (Statistiques / Recouvrement / Top
        dépenses) — leurs bas s'alignent automatiquement, quel que soit le
        nombre d'éléments affichés dans chaque carte.
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Évolution des mouvements de caisse */}
        <Card
          className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-5 lg:row-start-1"
          style={{ animationDelay: '150ms' }}
        >
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
            <CardTitle className="text-base">Évolution des mouvements de caisse</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  {cashEvolutionMonths} derniers mois
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={String(cashEvolutionMonths)}
                  onValueChange={(value) => setCashEvolutionMonths(Number(value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <DropdownMenuRadioItem key={n} value={String(n)}>
                      {n} {n > 1 ? 'derniers mois' : 'dernier mois'}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col pl-0">
            {/* Légende des séries */}
            <div className="mb-2 flex items-center gap-5 px-6">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CASH_FLOW_COLORS.entries }}
                />
                Encaissements
              </p>
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CASH_FLOW_COLORS.exits }}
                />
                Dépenses
              </p>
            </div>

            <div className="min-h-0 flex-1 px-2">
              <EChart option={cashEvolutionOption} height="100%" />
            </div>
          </CardContent>
        </Card>

        {/* Répartition des encaissements */}
        <Card
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-4 lg:row-start-1"
          style={{ animationDelay: '210ms' }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Répartition des encaissements</CardTitle>
            <p className="text-sm text-muted-foreground">Encaissements totaux</p>
          </CardHeader>
          <CardContent>
            {stats.categoryBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun encaissement ce mois-ci.
              </p>
            ) : (
              <>
                <div className="relative mx-auto" style={{ width: 220, height: 220 }}>
                  <EChart option={categoryBreakdownOption} height={220} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                    <p className="font-mono text-base font-bold leading-tight tracking-tight text-foreground">
                      {formatCFACompact(categoryTotal)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Encaissements</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {stats.categoryBreakdown.map((item) => (
                    <div key={item.category} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[item.category] }}
                      />
                      <span className="truncate text-muted-foreground">{item.label}</span>
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
                      {formatCFA(categoryTotal)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Activités récentes — étirée sur la hauteur de la rangée 1 */}
        <Card
          className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-3 lg:row-start-1"
          style={{ animationDelay: '270ms' }}
        >
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Activités récentes</CardTitle>
            <Link to="/cashbox" className="text-xs font-medium text-primary hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-4">
            {stats.recentActivity.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune activité récente.
              </p>
            ) : (
              stats.recentActivity.map((item) => {
                const meta = getActivityMeta(item.kind)
                const Icon = meta.icon
                const sign = getActivityAmountSign(item.kind)
                return (
                  <div
                    key={item.id}
                    className="-mx-1.5 flex items-start gap-3 rounded-lg p-1.5 transition-colors hover:bg-secondary/50"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatDateTimeShort(item.createdAt)}
                      </p>
                    </div>
                    {item.amount !== null && sign !== null && (
                      <span
                        className={`shrink-0 whitespace-nowrap font-mono text-xs font-semibold ${
                          sign > 0 ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {sign > 0 ? '+' : '−'}
                        {formatCFA(item.amount)}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Statistiques des élèves */}
        <Card
          className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-3 lg:row-start-2"
          style={{ animationDelay: '330ms' }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Statistiques des élèves</CardTitle>
            <p className="text-sm text-muted-foreground">Par classe</p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3">
            {stats.classStats.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucun élève inscrit dans une classe pour le moment.
              </p>
            ) : (
              <>
                <div className="flex flex-1 flex-col gap-2.5">
                  {stats.classStats.map((cls, index) => (
                    <div key={cls.classId} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getClassDotColor(index) }}
                      />
                      <span className="truncate text-foreground">{cls.className}</span>
                      <span className="ml-auto shrink-0 font-mono font-medium text-foreground">
                        {cls.studentCount}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  to="/students"
                  className="group flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Voir toutes les classes
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Taux de recouvrement */}
        <Card
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-3 lg:row-start-2"
          style={{ animationDelay: '390ms' }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Taux de recouvrement</CardTitle>
            <p className="text-sm text-muted-foreground">Sur toute l’année</p>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <RecoveryGauge
              rate={stats.recoveryRate.rate}
              totalPaid={stats.recoveryRate.totalPaid}
              totalExpected={stats.recoveryRate.totalExpected}
            />
          </CardContent>
        </Card>

        {/* Top des dépenses */}
        <Card
          className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-3 lg:row-start-2"
          style={{ animationDelay: '450ms' }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top des dépenses</CardTitle>
            <p className="text-sm text-muted-foreground">Ce mois</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.topExpenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune dépense ce mois-ci.
              </p>
            ) : (
              stats.topExpenses.map((item, index) => {
                const barPct = (item.amount / maxTopExpense) * 100
                return (
                  <div key={item.category} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-foreground text-[11px] font-semibold text-foreground">
                        {index + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">{item.label}</span>
                      <span className="shrink-0 font-mono text-sm font-semibold text-foreground">
                        {formatCFA(item.amount)}
                      </span>
                    </div>
                    <div
                      className="h-1 rounded-full bg-destructive"
                      style={{ width: `${Math.max(4, barPct)}%` }}
                    />
                  </div>
                )
              })
            )}
            <Link
              to="/cashbox/reports"
              className="group mt-1 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Voir tous les détails
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Alertes et rappels — étirée sur la hauteur de la rangée 2 */}
        <Card
          className="flex flex-col animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-backwards transition-shadow hover:shadow-md lg:col-span-3 lg:row-start-2"
          style={{ animationDelay: '510ms' }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alertes et rappels</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center gap-1">
            {stats.alerts.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Aucune alerte — tout est à jour.
              </p>
            ) : (
              stats.alerts.map((alert) => {
                const meta = getAlertMeta(alert.severity)
                const Icon = meta.icon
                const content = (
                  <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                    </div>
                    {alert.link && (
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                )
                return alert.link ? (
                  <Link key={alert.id} to={alert.link}>
                    {content}
                  </Link>
                ) : (
                  <div key={alert.id}>{content}</div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
