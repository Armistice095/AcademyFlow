import { GraduationCap, Wallet } from 'lucide-react'
import { Card } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { StudentAvatar } from '@renderer/components/students/StudentAvatar'
import { cn } from '@renderer/lib/utils'
import { formatCFA, formatMatricule } from '@renderer/lib/formatters'
import type { Student } from '@shared/types/student.types'
import type { TuitionAccount } from '@shared/types/transaction.types'

export interface StudentProfileCardProps {
  student: Student
  isEnrolledThisYear: boolean
  account: TuitionAccount | null
  onViewFinancial: () => void
}

/** Carte "à jour / en retard" dérivée du solde et des tranches en arriéré. */
function accountStanding(account: TuitionAccount | null): { label: string; dotClassName: string } {
  if (!account || account.balance <= 0) {
    return { label: 'Soldé', dotClassName: 'bg-success' }
  }
  const hasArrears = account.installments.some((line) => line.status === 'en_arriere')
  return hasArrears
    ? { label: 'En retard', dotClassName: 'bg-destructive' }
    : { label: 'À jour', dotClassName: 'bg-success' }
}

/** Résumé rapide affiché à côté de la fiche identité — statut scolaire, solde, accès direct au compte. */
export function StudentProfileCard({
  student,
  isEnrolledThisYear,
  account,
  onViewFinancial
}: StudentProfileCardProps): JSX.Element {
  const standing = accountStanding(account)

  return (
    <Card className="overflow-hidden">
      <div className="h-16 bg-gradient-to-br from-primary-100 via-primary-50 to-accent-500/10" />
      <div className="-mt-10 flex flex-col items-center px-6 pb-6">
        <StudentAvatar
          firstName={student.firstName}
          lastName={student.lastName}
          photoPath={student.photoPath}
          size="xl"
          className="border-4 border-card shadow-sm"
        />

        <p className="mt-3 text-center font-semibold text-foreground">
          {student.lastName} {student.firstName}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {formatMatricule(student.matricule)}
        </p>

        <div className="mt-5 flex w-full flex-col divide-y divide-border border-t border-border">
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <GraduationCap className="h-4 w-4" />
              Statut scolaire
            </span>
            <Badge variant={isEnrolledThisYear ? 'success' : 'secondary'}>
              {isEnrolledThisYear ? 'Inscrit' : 'Non inscrit'}
            </Badge>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Scolarité
            </span>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-foreground">
                {formatCFA(account?.balance ?? 0)}
              </p>
              <p
                className={cn('flex items-center justify-end gap-1 text-xs font-medium', {
                  'text-success': standing.dotClassName === 'bg-success',
                  'text-destructive': standing.dotClassName === 'bg-destructive'
                })}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', standing.dotClassName)} />
                {standing.label}
              </p>
            </div>
          </div>
        </div>

        <Button className="mt-5 w-full gap-1.5" onClick={onViewFinancial}>
          <Wallet className="h-4 w-4" />
          Voir la situation financière
        </Button>
      </div>
    </Card>
  )
}
