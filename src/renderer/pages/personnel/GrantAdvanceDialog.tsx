import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Separator } from '@renderer/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { FormField } from '@renderer/components/forms/FormField'
import { MoneyInput } from '@renderer/components/forms/MoneyInput'
import { salaryAdvanceFormSchema, type SalaryAdvanceFormValues } from '@renderer/lib/validators'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { api } from '@renderer/lib/ipc'
import type { Employee, SalaryAdvance } from '@shared/types/personnel.types'

export interface GrantAdvanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null
  onSubmit: (values: SalaryAdvanceFormValues) => Promise<void>
}

const EMPTY_VALUES: SalaryAdvanceFormValues = { amount: 0, reason: '' }

const STATUS_BADGE: Record<
  SalaryAdvance['status'],
  { label: string; variant: 'secondary' | 'success' | 'destructive' }
> = {
  pending: { label: 'En attente', variant: 'secondary' },
  deducted: { label: 'Remboursée', variant: 'success' },
  cancelled: { label: 'Annulée', variant: 'destructive' }
}

/**
 * Dialog d'octroi d'une avance sur salaire (F-026). Le montant est plafonné
 * côté service au salaire mensuel de l'employé ; le remboursement se fait
 * automatiquement, en une fois, lors du prochain paiement de salaire
 * (BR-010). Affiche aussi l'historique des avances déjà accordées à
 * l'employé, pour éviter d'en recréer une par erreur si une est déjà en
 * attente.
 */
export function GrantAdvanceDialog({
  open,
  onOpenChange,
  employee,
  onSubmit
}: GrantAdvanceDialogProps): JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<SalaryAdvanceFormValues>({
    resolver: zodResolver(salaryAdvanceFormSchema),
    defaultValues: EMPTY_VALUES
  })

  const [history, setHistory] = useState<SalaryAdvance[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  useEffect(() => {
    if (open) reset(EMPTY_VALUES)
  }, [open, reset])

  useEffect(() => {
    if (!open || !employee) {
      setHistory([])
      return
    }
    setIsLoadingHistory(true)
    api.personnel
      .listAdvances(employee.id)
      .then(setHistory)
      .finally(() => setIsLoadingHistory(false))
  }, [open, employee])

  const hasPending = history.some((a) => a.status === 'pending')

  const submit = async (values: SalaryAdvanceFormValues): Promise<void> => {
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accorder une avance sur salaire</DialogTitle>
          <DialogDescription>
            {employee
              ? `Pour ${employee.firstName} ${employee.lastName} — salaire mensuel de référence : ${formatCFA(employee.monthlySalary)}.`
              : ''}{' '}
            Une sortie de caisse sera créée immédiatement. Le montant sera automatiquement déduit,
            en une fois, du prochain salaire versé.
          </DialogDescription>
        </DialogHeader>

        {isLoadingHistory ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de l’historique...
          </div>
        ) : history.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground">Avances précédentes</p>
            <div className="flex max-h-32 flex-col gap-1.5 overflow-y-auto">
              {history.map((advance) => {
                const badge = STATUS_BADGE[advance.status]
                return (
                  <div key={advance.id} className="flex items-center justify-between text-sm">
                    <div className="flex flex-col">
                      <span className="font-mono">{formatCFA(advance.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(advance.createdAt)}
                        {advance.reason ? ` — ${advance.reason}` : ''}
                      </span>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {hasPending && (
          <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            Cet employé a déjà une avance en attente de remboursement. Une nouvelle avance ne pourra
            pas être accordée tant qu’elle n’aura pas été déduite de sa prochaine paie.
          </p>
        )}

        <Separator />

        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <FormField
            label="Montant de l'avance"
            htmlFor="amount"
            required
            error={errors.amount?.message}
          >
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  id="amount"
                  autoFocus
                  disabled={hasPending}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>

          <FormField label="Motif (optionnel)" htmlFor="reason" error={errors.reason?.message}>
            <Input
              id="reason"
              placeholder="Ex : urgence familiale, frais médicaux..."
              disabled={hasPending}
              {...register('reason')}
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting || hasPending}>
              {isSubmitting ? 'Enregistrement...' : "Accorder l'avance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
