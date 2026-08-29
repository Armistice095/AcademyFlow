import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Search, Wallet } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { KpiCard } from '@renderer/components/reports/KpiCard'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { api } from '@renderer/lib/ipc'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import type { StudentListItem } from '@shared/types/student.types'
import type { TuitionAccount } from '@shared/types/transaction.types'

/**
 * Fiche financière d'un élève — page unique (plus d'onglet "Liste des
 * arriérés", devenu redondant avec Rapports > Impayés et de toute façon
 * inatteignable puisque la route exige un `:id`). Accessible depuis le
 * tableau "Élèves en arriéré" de la page Impayés.
 */
export function StudentAccountPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentSchoolYear, loadCurrentSchoolYear } = useSettingsStore()
  const [studentQuery, setStudentQuery] = useState('')
  const debouncedQuery = useDebounce(studentQuery, 300)
  const [results, setResults] = useState<StudentListItem[]>([])
  const [student, setStudent] = useState<StudentListItem | null>(null)
  const [account, setAccount] = useState<TuitionAccount | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void loadCurrentSchoolYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!id) return
    api.students.findById(id).then((s) => {
      if (s) setStudent({ ...s, className: null })
    })
  }, [id])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    api.students
      .search({ query: debouncedQuery, pageSize: 6, schoolYearId: currentSchoolYear?.id })
      .then((res) => setResults(res.items))
  }, [debouncedQuery, currentSchoolYear])

  useEffect(() => {
    if (!student) {
      setAccount(null)
      return
    }
    setLoading(true)
    api.cashbox
      .getStudentAccount(student.id)
      .then(setAccount)
      .finally(() => setLoading(false))
  }, [student])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="-ml-2 gap-1.5 text-muted-foreground"
          onClick={() => navigate('/cashbox/reports/impayes')}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux impayés
        </Button>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Rechercher un autre élève par nom ou matricule..."
            className="pl-8"
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStudent(s)
                    setStudentQuery('')
                    setResults([])
                    navigate(`/cashbox/student/${s.id}`)
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span>
                    {s.lastName} {s.firstName}
                  </span>
                  <span className="text-xs text-muted-foreground">{s.matricule}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {student && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">
                {student.lastName} {student.firstName}
              </p>
              <p className="font-mono text-sm text-muted-foreground">{student.matricule}</p>
            </div>
            <Button
              className="gap-1.5"
              onClick={() => navigate(`/cashbox/new?studentId=${student.id}`)}
            >
              <Wallet className="h-4 w-4" />
              Enregistrer un paiement
            </Button>
          </div>

          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
          ) : account && account.installments.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <KpiCard
                  icon={Wallet}
                  tone="blue"
                  label="Total attendu"
                  value={formatCFA(account.totalExpected)}
                  changePct={null}
                />
                <KpiCard
                  icon={CheckCircle2}
                  tone="green"
                  label="Total payé"
                  value={formatCFA(account.totalPaid)}
                  changePct={null}
                  animationDelayMs={60}
                />
                <KpiCard
                  icon={AlertTriangle}
                  tone={account.balance > 0 ? 'red' : 'green'}
                  label="Solde restant"
                  value={formatCFA(account.balance)}
                  changePct={null}
                  animationDelayMs={120}
                />
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tranche</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Attendu</TableHead>
                        <TableHead>Payé</TableHead>
                        <TableHead>Restant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {account.installments.map((line) => (
                        <TableRow key={line.installmentId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {line.label}
                              {line.appliesTo !== 'tous' && (
                                <Badge variant="secondary" className="text-xs">
                                  {line.appliesTo === 'nouveau' ? 'Nouveau' : 'Ancien'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(line.dueDate)}</TableCell>
                          <TableCell>{formatCFA(line.expectedAmount)}</TableCell>
                          <TableCell>{formatCFA(line.paidAmount)}</TableCell>
                          <TableCell>
                            {formatCFA(Math.max(line.expectedAmount - line.paidAmount, 0))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                line.paidAmount >= line.expectedAmount
                                  ? 'success'
                                  : line.status === 'en_arriere'
                                    ? 'destructive'
                                    : 'warning'
                              }
                            >
                              {line.paidAmount >= line.expectedAmount
                                ? 'Payé'
                                : line.status === 'en_arriere'
                                  ? 'En arriéré'
                                  : 'Partiel'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun barème de frais configuré pour la classe de cet élève, pour l’année en cours.
            </p>
          )}
        </>
      )}
    </div>
  )
}
