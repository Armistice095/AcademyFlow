import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { KpiCard } from '@renderer/components/reports/KpiCard'
import { ReportsSkeleton } from '@renderer/components/reports/ReportsSkeleton'
import { useReportsStore } from '@renderer/stores/reports.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { api } from '@renderer/lib/ipc'
import { formatCFA } from '@renderer/lib/formatters'
import type { ArrearsStudent } from '@shared/types/transaction.types'

/**
 * Onglet "Impayés" — réutilise `listArrears()` existant (voir plan §3).
 * Snapshot courant des arriérés : la période du filtre ne s'applique pas ici
 * (mêmes hypothèses que la carte "Total à recouvrer" de la Vue générale),
 * seul le filtre "Classe" reste pertinent et est appliqué côté client.
 */
export function ArrearsReportPage(): JSX.Element {
  const navigate = useNavigate()
  const { filters } = useReportsStore()
  const { classes, loadClasses } = useSettingsStore()
  const [students, setStudents] = useState<ArrearsStudent[] | null>(null)

  useEffect(() => {
    void loadClasses()
    api.cashbox.listArrears().then(setStudents)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedClassName = filters.classId
    ? classes.find((c) => c.id === filters.classId)?.name
    : undefined
  const visibleStudents = useMemo(
    () =>
      selectedClassName
        ? (students ?? []).filter((s) => s.className === selectedClassName)
        : (students ?? []),
    [students, selectedClassName]
  )

  const totalArrears = visibleStudents.reduce((sum, s) => sum + s.balance, 0)

  const columns = useMemo<ColumnDef<ArrearsStudent>[]>(
    () => [
      { accessorKey: 'matricule', header: 'Matricule' },
      { accessorKey: 'studentName', header: 'Élève' },
      { accessorKey: 'className', header: 'Classe' },
      {
        accessorKey: 'lateInstallmentsCount',
        header: 'Échéances en retard',
        cell: ({ row }) => <Badge variant="destructive">{row.original.lateInstallmentsCount}</Badge>
      },
      {
        accessorKey: 'balance',
        header: 'Montant dû',
        cell: ({ row }) => (
          <span className="font-mono font-semibold text-destructive">
            {formatCFA(row.original.balance)}
          </span>
        )
      }
    ],
    []
  )

  if (!students) {
    return <ReportsSkeleton kpiCount={2} chartCount={1} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          icon={AlertTriangle}
          tone="violet"
          label="Total à recouvrer"
          value={formatCFA(totalArrears)}
          changePct={null}
        />
        <KpiCard
          icon={Users}
          tone="orange"
          label="Élèves en arriéré"
          value={visibleStudents.length.toLocaleString('fr-FR')}
          changePct={null}
          animationDelayMs={60}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Élèves en arriéré</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={visibleStudents}
            onRowClick={(student) => navigate(`/cashbox/student/${student.studentId}`)}
            emptyMessage="Aucun élève en arriéré."
          />
        </CardContent>
      </Card>
    </div>
  )
}
