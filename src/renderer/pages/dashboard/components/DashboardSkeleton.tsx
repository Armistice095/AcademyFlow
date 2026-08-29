import { Card, CardContent, CardHeader } from '@renderer/components/ui/card'
import { Skeleton } from '@renderer/components/ui/skeleton'

/**
 * Écran squelette du tableau de bord — reprend la structure réelle de la
 * page (5 cartes KPI + grille 2 rangées) pour un chargement initial qui ne
 * "saute" pas visuellement une fois les données arrivées.
 */
export function DashboardSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {/* Cartes KPI */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start gap-3.5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Évolution des mouvements de caisse */}
        <Card className="lg:col-span-5 lg:row-start-1">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </CardHeader>
          <CardContent className="pl-0">
            <div className="mb-2 flex items-center gap-5 px-6">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mx-2 h-[230px] rounded-lg" />
          </CardContent>
        </Card>

        {/* Répartition des encaissements */}
        <Card className="lg:col-span-4 lg:row-start-1">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Skeleton className="h-[220px] w-[220px] rounded-full" />
            <div className="w-full space-y-2">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </CardContent>
        </Card>

        {/* Activités récentes */}
        <Card className="flex flex-col lg:col-span-3 lg:row-start-1">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Statistiques des élèves */}
        <Card className="lg:col-span-3 lg:row-start-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>

        {/* Taux de recouvrement */}
        <Card className="lg:col-span-3 lg:row-start-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-28" />
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-6">
            <Skeleton className="h-[125px] w-[220px] rounded-t-full" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>

        {/* Top des dépenses */}
        <Card className="lg:col-span-3 lg:row-start-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 shrink-0 rounded-full" />
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <Skeleton className="h-1 w-2/3" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Alertes et rappels */}
        <Card className="flex flex-col lg:col-span-3 lg:row-start-2">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
