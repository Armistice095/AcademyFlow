import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertCircle, FileDown, Search, Wallet } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { ArrearsListPDF } from '@renderer/pdf/ArrearsListPDF'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import type { StudentListItem } from '@shared/types/student.types'
import type { ArrearsStudent, TuitionAccount } from '@shared/types/transaction.types'

export function StudentAccountPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  return (
    <Tabs defaultValue={id ? 'account' : 'arrears'}>
      <TabsList>
        <TabsTrigger value="account">Compte élève</TabsTrigger>
        <TabsTrigger value="arrears">Liste des arriérés</TabsTrigger>
      </TabsList>
      <TabsContent value="account">
        <StudentAccountTab initialStudentId={id} onNavigate={(sid) => navigate(`/cashbox/student/${sid}`)} />
      </TabsContent>
      <TabsContent value="arrears">
        <ArrearsTab />
      </TabsContent>
    </Tabs>
  )
}

// ---------------------------------------------------------------------------
// Onglet Compte élève
// ---------------------------------------------------------------------------

function StudentAccountTab({
  initialStudentId,
  onNavigate
}: {
  initialStudentId?: string
  onNavigate: (studentId: string) => void
}): JSX.Element {
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
    if (!initialStudentId) return
    api.students.findById(initialStudentId).then((s) => {
      if (s) setStudent({ ...s, className: null })
    })
  }, [initialStudentId])

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      return
    }
    api.students
      .search({ query: debouncedQuery, pageSize: 6, schoolYearId: currentSchoolYear?.id })
      .then((res) => setResults(res.items))
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={studentQuery}
          onChange={(e) => setStudentQuery(e.target.value)}
          placeholder="Rechercher un élève par nom ou matricule..."
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
                  onNavigate(s.id)
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

      {student && (
        <>
          <div className="flex items-center justify-between">
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
                        <TableCell>{line.label}</TableCell>
                        <TableCell>{formatDate(line.dueDate)}</TableCell>
                        <TableCell>{formatCFA(line.expectedAmount)}</TableCell>
                        <TableCell>{formatCFA(line.paidAmount)}</TableCell>
                        <TableCell>{formatCFA(Math.max(line.expectedAmount - line.paidAmount, 0))}</TableCell>
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
                <div className="flex justify-end gap-8 border-t border-border px-4 py-3 text-sm">
                  <span>
                    Total attendu : <strong>{formatCFA(account.totalExpected)}</strong>
                  </span>
                  <span>
                    Total payé : <strong>{formatCFA(account.totalPaid)}</strong>
                  </span>
                  <span>
                    Solde : <strong>{formatCFA(account.balance)}</strong>
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucun barème de frais configuré pour la classe de cet élève, pour l'année en cours.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Onglet Liste des arriérés
// ---------------------------------------------------------------------------

function ArrearsTab(): JSX.Element {
  const { toast } = useToast()
  const { classes, loadClasses } = useSettingsStore()
  const [arrears, setArrears] = useState<ArrearsStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [classId, setClassId] = useState('all')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadClasses()
    api.cashbox
      .listArrears()
      .then(setArrears)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = classId === 'all' ? arrears : arrears.filter((a) => a.className === classes.find((c) => c.id === classId)?.name)

  const columns = useMemo<ColumnDef<ArrearsStudent>[]>(
    () => [
      { accessorKey: 'matricule', header: 'Matricule' },
      { accessorKey: 'studentName', header: 'Nom et prénom(s)' },
      { accessorKey: 'className', header: 'Classe' },
      {
        id: 'due',
        header: 'Montant dû',
        cell: ({ row }) => (
          <span className="font-mono font-medium text-destructive">{formatCFA(row.original.balance)}</span>
        )
      },
      {
        accessorKey: 'lateInstallmentsCount',
        header: 'Tranches en retard',
        cell: ({ row }) => <Badge variant="destructive">{row.original.lateInstallmentsCount}</Badge>
      }
    ],
    []
  )

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      await openPdf(<ArrearsListPDF students={filtered} schoolInfo={schoolInfo} />, 'liste-arrieres.pdf')
    } catch {
      toast({ title: "Échec de l'export", description: 'Impossible de générer le PDF.', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 text-destructive" />
          {filtered.length} élève{filtered.length > 1 ? 's' : ''} en arriéré
        </div>
        <div className="flex gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting || filtered.length === 0}>
            <FileDown className="h-4 w-4" />
            {exporting ? 'Export...' : 'Exporter'}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={loading}
        emptyMessage="Aucun élève en arriéré. 🎉"
      />
    </div>
  )
}
