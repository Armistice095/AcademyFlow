import { GraduationCap, Sparkles, User, UserRound, Users } from 'lucide-react'
import { KpiCard, type KpiTone } from '@renderer/pages/dashboard/components/KpiCard'
import type { StudentStats, StudentStatsTrend } from '@shared/types/student.types'

interface TrendDescription {
  label: string
  tone: KpiTone
  direction: 'up' | 'down' | 'flat'
}

/** Tendance en pourcentage d'un effectif, comparé à l'année scolaire précédente. */
function describeTrend(trend: StudentStatsTrend): TrendDescription {
  if (trend.growthPct === null) {
    return { label: '0% vs année dernière', tone: 'neutral', direction: 'flat' }
  }
  const pct = trend.growthPct
  const direction: TrendDescription['direction'] = pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat'
  const tone: KpiTone = direction === 'flat' ? 'neutral' : direction === 'up' ? 'positive' : 'negative'
  return { label: `${Math.abs(pct).toFixed(0)}% vs année dernière`, tone, direction }
}

export interface StudentStatsCardsProps {
  stats: StudentStats | null
}

/**
 * Cartes KPI en tête de la liste des élèves. `stats` est déjà recalculé côté
 * appelant en fonction du filtre classe sélectionné (voir `useStudentStats`).
 */
export function StudentStatsCards({ stats }: StudentStatsCardsProps): JSX.Element {
  const total = stats?.total ?? { current: 0, previous: 0, growthPct: null }
  const anciens = stats?.anciens ?? { current: 0, previous: 0, growthPct: null }
  const nouveaux = stats?.nouveaux ?? { current: 0, previous: 0, growthPct: null }
  const male = stats?.male ?? { count: 0, percentage: 0 }
  const female = stats?.female ?? { count: 0, percentage: 0 }

  const totalTrend = describeTrend(total)
  const anciensTrend = describeTrend(anciens)
  const nouveauxTrend = describeTrend(nouveaux)

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        icon={Users}
        iconClassName="bg-accent-500/10 text-accent-600"
        label="Effectif Total"
        value={total.current.toLocaleString('fr-FR')}
        trendLabel={totalTrend.label}
        trendTone={totalTrend.tone}
        trendDirection={totalTrend.direction}
      />
      <KpiCard
        icon={GraduationCap}
        iconClassName="bg-success/10 text-success"
        label="Total Anciens"
        value={anciens.current.toLocaleString('fr-FR')}
        trendLabel={anciensTrend.label}
        trendTone={anciensTrend.tone}
        trendDirection={anciensTrend.direction}
      />
      <KpiCard
        icon={Sparkles}
        iconClassName="bg-warning/10 text-warning"
        label="Total Nouveaux"
        value={nouveaux.current.toLocaleString('fr-FR')}
        trendLabel={nouveauxTrend.label}
        trendTone={nouveauxTrend.tone}
        trendDirection={nouveauxTrend.direction}
      />
      <KpiCard
        icon={User}
        iconClassName="bg-accent-500/10 text-accent-600"
        label="Effectif Garçons"
        value={male.count.toLocaleString('fr-FR')}
        trendLabel={`${male.percentage.toFixed(0)}%`}
        trendTone="neutral"
        trendDirection="flat"
      />
      <KpiCard
        icon={UserRound}
        iconClassName="bg-primary-50 text-primary-600"
        label="Effectif Filles"
        value={female.count.toLocaleString('fr-FR')}
        trendLabel={`${female.percentage.toFixed(0)}%`}
        trendTone="neutral"
        trendDirection="flat"
      />
    </div>
  )
}
