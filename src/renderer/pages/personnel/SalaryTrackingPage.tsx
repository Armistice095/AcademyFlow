import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleDollarSign, FileDown, Wallet, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { usePersonnelStore } from '@renderer/stores/personnel.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { SalaryReportPDF } from '@renderer/pdf/SalaryReportPDF'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { MONTH_LABELS_FR } from '@shared/constants/defaults'
import type { SalaryMonthStatus } from '@shared/types/personnel.types'

const now = new Date()

export function SalaryTrackingPage(): JSX.Element {
  const { toast } = useToast()
  const { salaryStatus, isLoadingSalaryStatus, loadSalaryStatus, refreshSalaryStatus } =
    usePersonnelStore()

  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [employeeToPay, setEmployeeToPay] = useState<SalaryMonthStatus | null>(null)
  const [paying, setPaying] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadSalaryStatus(month, year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year])

  const summary = useMemo(() => {
    const totalDue = salaryStatus.reduce((sum, s) => sum + s.employee.monthlySalary, 0)
    const paid = salaryStatus.filter((s) => s.isPaid)
    const totalPaid = paid.reduce((sum, s) => sum + s.employee.monthlySalary, 0)
    return {
      totalDue,
      totalPaid,
      totalRemaining: totalDue - totalPaid,
      paidCount: paid.length,
      unpaidCount: salaryStatus.length - paid.length
    }
  }, [salaryStatus])

  const handlePay = async (): Promise<void> => {
    if (!employeeToPay) return
    setPaying(true)
    try {
      const result = await api.personnel.markSalaryPaid(employeeToPay.employee.id, month, year)
      toast({
        title: 'Salaire payé',
        description: result.deductedAdvance
          ? `Sortie de caisse de ${formatCFA(result.netAmount)} créée pour ${employeeToPay.employee.firstName} ${employeeToPay.employee.lastName} (salaire de ${formatCFA(result.grossAmount)}, moins avance de ${formatCFA(result.deductedAdvance.amount)}).`
          : `Une sortie de caisse a été créée pour ${employeeToPay.employee.firstName} ${employeeToPay.employee.lastName}.`
      })
      setEmployeeToPay(null)
      await refreshSalaryStatus()
    } catch (error) {
      toast({
        title: 'Échec du paiement',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    } finally {
      setPaying(false)
    }
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      await openPdf(
        <SalaryReportPDF
          statuses={salaryStatus}
          month={month}
          year={year}
          schoolInfo={schoolInfo}
        />,
        `etat-salaires-${year}-${String(month).padStart(2, '0')}.pdf`
      )
    } catch {
      toast({
        title: "Échec de l'export",
        description: 'Impossible de générer le PDF.',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS_FR.map((label, index) => (
                <SelectItem key={label} value={String(index + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
            className="w-28"
          />
        </div>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={handleExport}
          disabled={exporting || salaryStatus.length === 0}
        >
          <FileDown className="h-4 w-4" />
          {exporting ? 'Export...' : "Exporter l'état"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Wallet className="h-6 w-6 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total salaires du mois</p>
              <p className="font-mono text-lg font-semibold">{formatCFA(summary.totalDue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Payés ({summary.paidCount})</p>
              <p className="font-mono text-lg font-semibold">{formatCFA(summary.totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CircleDollarSign className="h-6 w-6 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Restants ({summary.unpaidCount})</p>
              <p className="font-mono text-lg font-semibold">{formatCFA(summary.totalRemaining)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom et prénom(s)</TableHead>
              <TableHead>Fonction</TableHead>
              <TableHead>Salaire mensuel</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date de paiement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingSalaryStatus ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : salaryStatus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Aucun employé actif enregistré.
                </TableCell>
              </TableRow>
            ) : (
              salaryStatus.map((status) => (
                <TableRow key={status.employee.id}>
                  <TableCell>
                    {status.employee.lastName} {status.employee.firstName}
                  </TableCell>
                  <TableCell>{status.employee.role}</TableCell>
                  <TableCell className="font-mono">
                    {formatCFA(status.employee.monthlySalary)}
                    {!!status.pendingAdvanceAmount && !status.isPaid && (
                      <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                        Avance {formatCFA(status.pendingAdvanceAmount)} à déduire — net{' '}
                        {formatCFA(status.employee.monthlySalary - status.pendingAdvanceAmount)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {status.isPaid ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Payé
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Non payé
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{status.paidAt ? formatDate(status.paidAt) : '—'}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      disabled={status.isPaid}
                      onClick={() => setEmployeeToPay(status)}
                    >
                      Payer
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={employeeToPay !== null}
        onOpenChange={(open) => !open && setEmployeeToPay(null)}
        title="Confirmer le paiement du salaire ?"
        description={
          employeeToPay?.pendingAdvanceAmount
            ? `Le salaire de ${employeeToPay.employee.firstName} ${employeeToPay.employee.lastName} (${formatCFA(employeeToPay.employee.monthlySalary)}) pour ${MONTH_LABELS_FR[employeeToPay.month - 1]} ${employeeToPay.year} sera marqué payé. Son avance en attente de ${formatCFA(employeeToPay.pendingAdvanceAmount)} sera automatiquement déduite : la sortie de caisse créée sera de ${formatCFA(employeeToPay.employee.monthlySalary - employeeToPay.pendingAdvanceAmount)} (BR-010). Cette opération ne pourra pas être répétée pour ce mois (BR-009).`
            : `Le salaire de ${employeeToPay?.employee.firstName} ${employeeToPay?.employee.lastName} (${employeeToPay ? formatCFA(employeeToPay.employee.monthlySalary) : ''}) pour ${employeeToPay ? MONTH_LABELS_FR[employeeToPay.month - 1] : ''} ${employeeToPay?.year} sera marqué payé, et une sortie de caisse correspondante sera créée automatiquement (BR-008). Cette opération ne pourra pas être répétée pour ce mois (BR-009).`
        }
        confirmLabel={paying ? 'Paiement...' : 'Confirmer le paiement'}
        onConfirm={handlePay}
      />
    </div>
  )
}
