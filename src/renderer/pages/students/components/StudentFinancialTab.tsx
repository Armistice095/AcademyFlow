import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileDown, MoreHorizontal, Plus, Receipt as ReceiptIcon, TrendingUp } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { EChart, type EChartsOption } from '@renderer/components/charts/EChart'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { printReceiptWithFallback } from '@renderer/lib/print'
import { ReceiptPDF } from '@renderer/pdf/ReceiptPDF'
import { StudentAccountPDF } from '@renderer/pdf/StudentAccountPDF'
import { buildStudentPaymentRows, PAYMENT_ROW_STATUS_LABELS } from '@renderer/lib/tuition'
import { formatCFA, formatDateShort } from '@renderer/lib/formatters'
import { cn } from '@renderer/lib/utils'
import type { Student } from '@shared/types/student.types'
import type {
  StudentPaymentRow,
  Transaction,
  TuitionAccount
} from '@shared/types/transaction.types'

const STATUS_BADGE_VARIANT: Record<StudentPaymentRow['status'], 'success' | 'secondary'> = {
  paye: 'success',
  annule: 'secondary'
}

export interface StudentFinancialTabProps {
  student: Student
  className: string
  schoolYearLabel: string
  account: TuitionAccount | null
  transactions: Transaction[]
  loading: boolean
}

/** Compte de scolarité complet de l'élève : historique des paiements réels + courbe d'évolution + solde. */
export function StudentFinancialTab({
  student,
  className,
  schoolYearLabel,
  account,
  transactions,
  loading
}: StudentFinancialTabProps): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)

  const rows = useMemo(() => buildStudentPaymentRows(transactions), [transactions])

  /** Chaque point = un paiement réellement effectué (pas de cumul), trié chronologiquement. */
  const chartOption = useMemo<EChartsOption>(() => {
    const points = transactions
      .filter((t) => t.status === 'validated')
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((t) => [t.createdAt.slice(0, 10), t.amount] as [string, number])

    return {
      grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
      xAxis: {
        type: 'category',
        data: points.map((p) => p[0]),
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#334155',
          fontSize: 11,
          formatter: (value: string) => formatDateShort(value)
        }
      },
      yAxis: {
        type: 'value',
        show: false
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        textStyle: { color: '#0f172a' },
        formatter: (params) => {
          const p = Array.isArray(params) ? params[0] : params
          const value = Array.isArray(p.value) ? p.value[1] : p.value
          return `${formatDateShort(p.axisValue as string)}<br/><strong>${formatCFA(Number(value))}</strong>`
        }
      },
      series: [
        {
          type: 'line',
          data: points.map((p) => p[1]),
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { color: '#f43f5e', width: 2.5 },
          itemStyle: { color: '#f43f5e', borderColor: '#ffffff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(244, 63, 94, 0.28)' },
                { offset: 1, color: 'rgba(244, 63, 94, 0)' }
              ]
            }
          }
        }
      ]
    }
  }, [transactions])

  const hasPayments = transactions.some((t) => t.status === 'validated')
  const remaining = Math.max(account?.balance ?? 0, 0)
  const hasArrears = (account?.installments ?? []).some((line) => line.status === 'en_arriere')

  const handleDownload = async (): Promise<void> => {
    setDownloading(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      await openPdf(
        <StudentAccountPDF
          student={student}
          className={className}
          schoolYearLabel={schoolYearLabel}
          account={account}
          rows={rows}
          schoolInfo={schoolInfo}
        />,
        `compte-scolarite-${student.matricule}.pdf`
      )
    } catch {
      toast({
        title: 'Échec de la génération',
        description: 'Impossible de générer le PDF.',
        variant: 'destructive'
      })
    } finally {
      setDownloading(false)
    }
  }

  const handleViewReceipt = async (transactionId: string): Promise<void> => {
    try {
      const transaction = transactions.find((t) => t.id === transactionId)
      const receipt = await api.cashbox.getReceipt(transactionId)
      if (!receipt || !transaction) {
        toast({
          title: 'Aucun reçu',
          description: "Cette opération n'a pas de reçu associé.",
          variant: 'destructive'
        })
        return
      }
      await printReceiptWithFallback(receipt.id, async () => {
        const [schoolInfo, operator] = await Promise.all([
          api.settings.getSchoolInfo(),
          api.auth.getUserById(transaction.userId)
        ])
        await openPdf(
          <ReceiptPDF
            receipt={receipt}
            transaction={transaction}
            student={student}
            installmentLabel={null}
            operatorName={operator?.fullName ?? '—'}
            schoolInfo={schoolInfo}
          />,
          `recu-${receipt.receiptNumber}.pdf`
        )
      })
    } catch {
      toast({
        title: 'Échec',
        description: "Impossible d'afficher le reçu.",
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Historique des paiements</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Année scolaire {schoolYearLabel}</p>
          </div>
          <div className="flex gap-2">
            <Button
              className="gap-1.5"
              onClick={() => navigate(`/cashbox/new?studentId=${student.id}`)}
            >
              <Plus className="h-4 w-4" />
              Nouveau Paiement
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={handleDownload}
              disabled={downloading}
            >
              <FileDown className="h-4 w-4" />
              {downloading ? 'Export...' : 'Télécharger'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description / Frais</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${row.transactionId}-${index}`}>
                    <TableCell>{formatDateShort(row.date)}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right font-mono">{formatCFA(row.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                        {PAYMENT_ROW_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.transactionId && row.status === 'paye' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label="Actions sur ce paiement"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewReceipt(row.transactionId!)}>
                              <ReceiptIcon className="mr-2 h-4 w-4" />
                              Voir le reçu
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!loading && rows.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Aucun paiement enregistré pour l’année {schoolYearLabel}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Évolution des paiements
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {hasPayments ? (
            <EChart option={chartOption} height={200} />
          ) : (
            <p className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
              Aucun paiement à représenter.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Payé</p>
              <p className="font-mono text-lg font-semibold text-primary">
                {formatCFA(account?.totalPaid ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reste à payer</p>
              <p className="font-mono text-lg font-semibold text-foreground">
                {formatCFA(remaining)}
              </p>
              {remaining > 0 && (
                <p
                  className={cn(
                    'mt-0.5 flex items-center gap-1.5 text-xs font-medium',
                    hasArrears ? 'text-destructive' : 'text-success'
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      hasArrears ? 'bg-destructive' : 'bg-success'
                    )}
                  />
                  {hasArrears ? 'En retard' : 'À jour'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
