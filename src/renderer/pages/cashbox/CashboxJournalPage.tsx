import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { MinusCircle, MoreHorizontal, Plus, Printer, Wallet, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { DataTableToolbar } from '@renderer/components/data-table/DataTableToolbar'
import { useCashbox } from '@renderer/hooks/useCashbox'
import { useCashboxStore } from '@renderer/stores/cashbox.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { ReceiptPDF } from '@renderer/pdf/ReceiptPDF'
import { formatCFA, formatDateTime } from '@renderer/lib/formatters'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import { cn } from '@renderer/lib/utils'
import type { JournalFilters, Transaction } from '@shared/types/transaction.types'

export function CashboxJournalPage(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { refresh } = useCashboxStore()

  const [type, setType] = useState<'all' | 'entry' | 'exit'>('all')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({})
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [transactionToCancel, setTransactionToCancel] = useState<Transaction | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const filters = useMemo<JournalFilters>(
    () => ({
      type: type === 'all' ? undefined : type,
      query: query || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo ? `${dateTo}T23:59:59.999Z` : undefined
    }),
    [type, query, dateFrom, dateTo]
  )

  const { balance, journal, isLoading } = useCashbox(filters)

  useEffect(() => {
    const uniqueUserIds = [...new Set((journal?.items ?? []).map((t) => t.userId))].filter(
      (id) => !operatorNames[id]
    )
    if (uniqueUserIds.length > 0) {
      Promise.all(uniqueUserIds.map((id) => api.auth.getUserById(id))).then((users) => {
        setOperatorNames((prev) => {
          const next = { ...prev }
          users.forEach((user, index) => {
            if (user) next[uniqueUserIds[index]] = user.fullName
          })
          return next
        })
      })
    }

    const uniqueStudentIds = [
      ...new Set((journal?.items ?? []).map((t) => t.studentId).filter((id): id is string => id !== null))
    ].filter((id) => !studentNames[id])
    if (uniqueStudentIds.length > 0) {
      Promise.all(uniqueStudentIds.map((id) => api.students.findById(id))).then((studentsFound) => {
        setStudentNames((prev) => {
          const next = { ...prev }
          studentsFound.forEach((s, index) => {
            if (s) next[uniqueStudentIds[index]] = `${s.lastName} ${s.firstName}`
          })
          return next
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal])

  const handleCancel = async (): Promise<void> => {
    if (!transactionToCancel) return
    setCancelling(true)
    try {
      await api.cashbox.cancelTransaction(transactionToCancel.id, cancelReason)
      toast({ title: 'Opération annulée', description: 'Une opération inverse a été créée.' })
      setTransactionToCancel(null)
      setCancelReason('')
      await refresh()
    } catch (error) {
      toast({
        title: "Échec de l'annulation",
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    } finally {
      setCancelling(false)
    }
  }

  const handleReprint = async (transaction: Transaction): Promise<void> => {
    try {
      const receipt = await api.cashbox.getReceipt(transaction.id)
      if (!receipt) {
        toast({ title: 'Aucun reçu', description: "Cette opération n'a pas de reçu associé.", variant: 'destructive' })
        return
      }
      await api.cashbox.reprintReceipt(transaction.id)
      const [schoolInfo, student, operator] = await Promise.all([
        api.settings.getSchoolInfo(),
        transaction.studentId ? api.students.findById(transaction.studentId) : Promise.resolve(null),
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
    } catch {
      toast({ title: 'Échec', description: "Impossible de réimprimer le reçu.", variant: 'destructive' })
    }
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ row }) => (
          <span className={cn(row.original.status === 'cancelled' && 'line-through opacity-50')}>
            {formatDateTime(row.original.createdAt)}
          </span>
        )
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.type === 'entry' ? 'success' : 'destructive'}>
            {row.original.type === 'entry' ? 'Entrée' : 'Sortie'}
          </Badge>
        )
      },
      {
        accessorKey: 'category',
        header: 'Catégorie',
        cell: ({ row }) => CASH_CATEGORY_LABELS[row.original.category as CashCategory] ?? row.original.category
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => row.original.description ?? '—'
      },
      {
        id: 'student',
        header: 'Élève',
        cell: ({ row }) =>
          row.original.studentId ? (studentNames[row.original.studentId] ?? '...') : '—'
      },
      {
        accessorKey: 'amount',
        header: 'Montant',
        cell: ({ row }) => (
          <span
            className={cn(
              'font-mono font-medium',
              row.original.status === 'cancelled' && 'line-through opacity-50'
            )}
          >
            {formatCFA(row.original.amount)}
          </span>
        )
      },
      {
        id: 'operator',
        header: 'Opérateur',
        cell: ({ row }) => operatorNames[row.original.userId] ?? '...'
      },
      {
        id: 'status',
        header: 'Statut',
        cell: ({ row }) =>
          row.original.status === 'cancelled' ? (
            <Badge variant="secondary">Annulée</Badge>
          ) : (
            <Badge variant="success">Validée</Badge>
          )
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {row.original.type === 'entry' && row.original.status === 'validated' && (
                <DropdownMenuItem onClick={() => handleReprint(row.original)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Réimprimer le reçu
                </DropdownMenuItem>
              )}
              {row.original.status === 'validated' && (
                <DropdownMenuItem
                  onClick={() => setTransactionToCancel(row.original)}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Annuler
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    ],
    [operatorNames, studentNames]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="w-fit">
          <CardContent className="flex items-center gap-3 px-5 py-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Solde de caisse</p>
              <p className="font-mono text-lg font-semibold">{formatCFA(balance)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => navigate('/cashbox/new?type=exit')}>
            <MinusCircle className="h-4 w-4" />
            Nouvelle sortie
          </Button>
          <Button className="gap-1.5" onClick={() => navigate('/cashbox/new?type=entry')}>
            <Plus className="h-4 w-4" />
            Nouvelle entrée
          </Button>
        </div>
      </div>

      <DataTableToolbar
        onSearch={setQuery}
        searchPlaceholder="Rechercher par élève ou description..."
        filters={
          <>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="entry">Entrées</SelectItem>
                <SelectItem value="exit">Sorties</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          </>
        }
      />

      <DataTable
        columns={columns}
        data={journal?.items ?? []}
        isLoading={isLoading}
        emptyMessage="Aucune opération enregistrée."
      />

      <Dialog open={transactionToCancel !== null} onOpenChange={(open) => !open && setTransactionToCancel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Annuler cette opération ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Une opération inverse de {transactionToCancel && formatCFA(transactionToCancel.amount)} sera créée.
            L'opération originale reste visible dans le journal, marquée comme annulée (BR-005).
          </p>
          <Input
            placeholder="Motif de l'annulation..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionToCancel(null)}>
              Retour
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason.trim()}>
              {cancelling ? 'Annulation...' : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
