import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { ComparativeBarChart } from '@renderer/components/reports/ComparativeBarChart'
import { ReportsSkeleton } from '@renderer/components/reports/ReportsSkeleton'
import { useReportsStore } from '@renderer/stores/reports.store'
import { api } from '@renderer/lib/ipc'
import { formatCFA } from '@renderer/lib/formatters'
import type { ReportByClassRow } from '@shared/types/transaction.types'

/** Onglet "Par classe" — nouvel agrégat backend `getReportByClass` (voir plan §3). */
export function ByClassReportPage(): JSX.Element {
  const { filters } = useReportsStore()
  const [rows, setRows] = useState<ReportByClassRow[] | null>(null)

  useEffect(() => {
    if (filters.period === 'custom' && (!filters.from || !filters.to)) return
    api.cashbox
      .getReportByClass({
        from: filters.from,
        to: filters.to,
        category: filters.category,
        userId: filters.userId
      })
      .then(setRows)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.category, filters.userId])

  const columns = useMemo<ColumnDef<ReportByClassRow>[]>(
    () => [
      { accessorKey: 'className', header: 'Classe' },
      {
        accessorKey: 'totalEntries',
        header: 'Entrées',
        cell: ({ row }) => (
          <span className="font-mono text-success">{formatCFA(row.original.totalEntries)}</span>
        )
      },
      {
        accessorKey: 'totalExits',
        header: 'Sorties',
        cell: ({ row }) => (
          <span className="font-mono text-destructive">{formatCFA(row.original.totalExits)}</span>
        )
      },
      {
        accessorKey: 'netBalance',
        header: 'Solde',
        cell: ({ row }) => (
          <span className="font-mono font-semibold">{formatCFA(row.original.netBalance)}</span>
        )
      },
      { accessorKey: 'transactionCount', header: 'Nb transactions' }
    ],
    []
  )

  if (!rows) {
    return <ReportsSkeleton kpiCount={0} chartCount={1} />
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucune opération enregistrée sur cette période.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Comparatif entrées / sorties par classe</CardTitle>
        </CardHeader>
        <CardContent>
          <ComparativeBarChart
            data={rows.map((r) => ({
              label: r.className,
              totalEntries: r.totalEntries,
              totalExits: r.totalExits
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Détail par classe</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={rows} hidePagination emptyMessage="Aucune donnée." />
        </CardContent>
      </Card>
    </div>
  )
}
