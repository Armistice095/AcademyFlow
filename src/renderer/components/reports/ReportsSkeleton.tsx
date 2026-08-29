import { Skeleton } from '@renderer/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@renderer/components/ui/card'

export interface ReportsSkeletonProps {
  kpiCount?: number
  chartCount?: 1 | 2 | 3
}

/**
 * Squelette de chargement partagé par les 6 onglets Rapports — évite le texte
 * brut "Chargement..." (voir plan §5, Phase 4 : "skeleton plutôt que
 * 'Chargement...' brut").
 */
export function ReportsSkeleton({
  kpiCount = 5,
  chartCount = 2
}: ReportsSkeletonProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: kpiCount }).map((_, i) => (
          <Card key={i} className="min-w-[180px] flex-1 p-5">
            <div className="flex items-start gap-3.5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div
        className={
          chartCount === 1 ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 gap-4 lg:grid-cols-2'
        }
      >
        {Array.from({ length: chartCount }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
