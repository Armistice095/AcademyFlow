import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Hash, TrendingUp, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { KpiCard, type KpiCardTone } from './KpiCard'
import { CategoryDonutChart } from './CategoryDonutChart'
import { SingleSeriesAreaChart } from './SingleSeriesAreaChart'
import { ReportsSkeleton } from './ReportsSkeleton'
import { useJournalNames } from './useJournalNames'
import { useReportsStore } from '@renderer/stores/reports.store'
import { api } from '@renderer/lib/ipc'
import { formatCFA, formatDateTime } from '@renderer/lib/formatters'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type {
  JournalTransaction,
  TransactionType,
  TypeReport
} from '@shared/types/transaction.types'

export interface TypeReportViewProps {
  type: TransactionType
  label: string
  tone: KpiCardTone
  icon: typeof TrendingUp
  color: string
  emptyMessage: string
}

/** Vue partagée par "Recettes" (`type='entry'`) et "Dépenses" (`type='exit'`) — voir plan §3. */
export function TypeReportView({
  type,
  label,
  tone,
  icon,
  color,
  emptyMessage
}: TypeReportViewProps): JSX.Element {
  const { filters } = useReportsStore()
  const [report, setReport] = useState<TypeReport | null>(null)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [journalPage, setJournalPage] = useState<{
    items: JournalTransaction[]
    total: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (filters.period === 'custom' && (!filters.from || !filters.to)) return
    setIsLoading(true)
    api.cashbox
      .getTypeReport(
        {
          from: filters.from,
          to: filters.to,
          classId: filters.classId,
          category: filters.category,
          userId: filters.userId
        },
        type
      )
      .then(setReport)
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.classId, filters.category, filters.userId, type])

  // Revenir à la page 1 dès qu'un filtre (hors pagination) change.
  useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [filters.from, filters.to, filters.classId, filters.category, filters.userId])

  useEffect(() => {
    if (filters.period === 'custom' && (!filters.from || !filters.to)) return
    api.cashbox
      .getJournal({
        type,
        category: filters.category,
        userId: filters.userId,
        classId: filters.classId,
        dateFrom: filters.from,
        dateTo: `${filters.to}T23:59:59.999Z`,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize
      })
      .then((result) => setJournalPage({ items: result.items, total: result.total }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.from,
    filters.to,
    filters.classId,
    filters.category,
    filters.userId,
    type,
    pagination
  ])

  const { studentNames, operatorNames } = useJournalNames(journalPage?.items ?? [])

  const columns = useMemo<ColumnDef<JournalTransaction>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ row }) => formatDateTime(row.original.createdAt)
      },
      {
        accessorKey: 'category',
        header: 'Catégorie',
        cell: ({ row }) =>
          CASH_CATEGORY_LABELS[row.original.category as CashCategory] ?? row.original.category
      },
      {
        id: 'detail',
        header: 'Détail',
        cell: ({ row }) => {
          const studentLabel = row.original.studentId
            ? (studentNames[row.original.studentId] ?? '...')
            : null
          return (
            <div className="min-w-0">
              {row.original.description && (
                <p className="truncate text-foreground">{row.original.description}</p>
              )}
              {studentLabel && (
                <p className="truncate text-xs text-muted-foreground">{studentLabel}</p>
              )}
            </div>
          )
        }
      },
      {
        id: 'cashier',
        header: 'Caissier',
        cell: ({ row }) => operatorNames[row.original.userId] ?? '...'
      },
      {
        accessorKey: 'amount',
        header: 'Montant',
        cell: ({ row }) => (
          <span
            className={`font-mono font-medium ${type === 'entry' ? 'text-success' : 'text-destructive'}`}
          >
            {type === 'entry' ? '+' : '-'}
            {formatCFA(row.original.amount)}
          </span>
        )
      }
    ],
    [studentNames, operatorNames, type]
  )

  if (!report) {
    return <ReportsSkeleton kpiCount={3} chartCount={2} />
  }

  const average =
    report.transactionCount > 0 ? Math.round(report.total / report.transactionCount) : 0
  const hasNoData = report.total === 0

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <p className="text-xs text-muted-foreground">Actualisation…</p>}

      {hasNoData ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              icon={icon}
              tone={tone}
              label={`Total ${label.toLowerCase()}`}
              value={formatCFA(report.total)}
              changePct={report.totalChangePct}
            />
            <KpiCard
              icon={Hash}
              tone="orange"
              label="Nombre de transactions"
              value={report.transactionCount.toLocaleString('fr-FR')}
              changePct={report.transactionCountChangePct}
              animationDelayMs={60}
            />
            <KpiCard
              icon={Wallet}
              tone="blue"
              label="Moyenne par transaction"
              value={formatCFA(average)}
              changePct={null}
              animationDelayMs={120}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Répartition par catégorie</CardTitle>
                <p className="text-sm text-muted-foreground">{label} totales</p>
              </CardHeader>
              <CardContent>
                <CategoryDonutChart data={report.byCategory} centerLabel={label} />
              </CardContent>
            </Card>
            <Card className="flex flex-col lg:col-span-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Évolution des {label.toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent className="min-h-0 flex-1">
                <SingleSeriesAreaChart data={report.timeSeries} seriesName={label} color={color} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transactions détaillées</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={journalPage?.items ?? []}
                manualPagination
                pagination={pagination}
                onPaginationChange={setPagination}
                rowCount={journalPage?.total ?? 0}
                emptyMessage="Aucune transaction sur cette période."
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
