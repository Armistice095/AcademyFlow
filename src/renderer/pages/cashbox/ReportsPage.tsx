import { useEffect, useMemo, useState } from 'react'
import { FileDown, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { Input } from '@renderer/components/ui/input'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { CashReportPDF } from '@renderer/pdf/CashReportPDF'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type { CashReport } from '@shared/types/transaction.types'

type Period = 'day' | 'month' | 'year' | 'custom'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function computeRange(period: Period, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date()
  if (period === 'day') {
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    return { from: day, to: day }
  }
  if (period === 'month') {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`
    return { from, to }
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  return custom
}

export function ReportsPage(): JSX.Element {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [report, setReport] = useState<CashReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const range = useMemo(
    () => computeRange(period, { from: customFrom, to: customTo }),
    [period, customFrom, customTo]
  )

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return
    setLoading(true)
    api.cashbox
      .getReport(range.from, range.to)
      .then(setReport)
      .finally(() => setLoading(false))
  }, [range, period, customFrom, customTo])

  const categoryEntries = report ? Object.entries(report.byCategory).sort(([, a], [, b]) => b - a) : []
  const maxAmount = categoryEntries.length > 0 ? Math.max(...categoryEntries.map(([, v]) => v)) : 0
  const hasNoData = report && report.totalEntries === 0 && report.totalExits === 0

  const handleExport = async (): Promise<void> => {
    if (!report) return
    setExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      await openPdf(<CashReportPDF report={report} schoolInfo={schoolInfo} />, `rapport-${report.from}-${report.to}.pdf`)
    } catch {
      toast({ title: "Échec de l'export", description: 'Impossible de générer le PDF.', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Aujourd'hui</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
            </>
          )}
        </div>
        <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={!report || exporting}>
          <FileDown className="h-4 w-4" />
          {exporting ? 'Export...' : 'Exporter en PDF'}
        </Button>
      </div>

      {loading && <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>}

      {!loading && report && (
        <>
          <p className="text-sm text-muted-foreground">
            Période du {formatDate(report.from)} au {formatDate(report.to)}
          </p>

          {hasNoData ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Aucune opération enregistrée sur cette période.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="flex items-center gap-3 p-5">
                    <TrendingUp className="h-6 w-6 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total entrées</p>
                      <p className="font-mono text-lg font-semibold">{formatCFA(report.totalEntries)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-5">
                    <TrendingDown className="h-6 w-6 text-destructive" />
                    <div>
                      <p className="text-xs text-muted-foreground">Total sorties</p>
                      <p className="font-mono text-lg font-semibold">{formatCFA(report.totalExits)}</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="flex items-center gap-3 p-5">
                    <Wallet className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Solde net</p>
                      <p className="font-mono text-lg font-semibold">{formatCFA(report.netBalance)}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="flex flex-col gap-3 p-6">
                  <p className="text-sm font-medium">Répartition par catégorie</p>
                  {categoryEntries.map(([category, amount]) => (
                    <div key={category} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs text-muted-foreground">
                        {CASH_CATEGORY_LABELS[category as CashCategory] ?? category}
                      </span>
                      <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded bg-primary"
                          style={{ width: `${maxAmount > 0 ? (amount / maxAmount) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right font-mono text-xs">{formatCFA(amount)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
