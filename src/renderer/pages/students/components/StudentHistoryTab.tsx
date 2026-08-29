import { GraduationCap } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'
import type { EnrollmentWithDetails } from '@shared/types/student.types'

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  admis: 'Admis(e)',
  redoublant: 'Redoublant(e)'
}

export interface StudentHistoryTabProps {
  history: EnrollmentWithDetails[]
  currentSchoolYearId?: string
}

/**
 * Parcours scolaire de l'élève, sous forme de frise chronologique — plus
 * parlant qu'un tableau à 3 colonnes pour représenter une progression
 * d'année en année, et met en évidence l'année en cours.
 */
export function StudentHistoryTab({
  history,
  currentSchoolYearId
}: StudentHistoryTabProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Parcours scolaire</CardTitle>
        <p className="text-xs text-muted-foreground">
          {history.length} année{history.length > 1 ? 's' : ''} scolaire
          {history.length > 1 ? 's' : ''} enregistrée
          {history.length > 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Aucun historique disponible.
          </p>
        ) : (
          <ol className="relative flex flex-col gap-6 pl-2">
            {history.map((entry, index) => {
              const isCurrent = entry.schoolYearId === currentSchoolYearId
              const isLast = index === history.length - 1
              return (
                <li key={entry.id} className="relative flex gap-4 pl-8">
                  {!isLast && (
                    <span
                      className="absolute left-[15px] top-8 h-[calc(100%-0.5rem)] w-px bg-border"
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      'absolute left-0 top-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                      isCurrent
                        ? 'border-primary bg-primary-50 text-primary-600'
                        : 'border-border bg-muted text-muted-foreground'
                    )}
                  >
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  <div
                    className={cn(
                      'flex flex-1 flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
                      isCurrent ? 'border-primary-100 bg-primary-50/50' : 'border-border'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{entry.schoolYearLabel}</p>
                        {isCurrent && <Badge variant="default">Année en cours</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Classe de {entry.className}</p>
                    </div>
                    <Badge variant={entry.status === 'redoublant' ? 'warning' : 'success'}>
                      {ENROLLMENT_STATUS_LABELS[entry.status] ?? entry.status}
                    </Badge>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
