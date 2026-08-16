import { useEffect, useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { MoneyInput } from '@renderer/components/forms/MoneyInput'
import { DatePickerField } from '@renderer/components/forms/DatePickerField'
import { FormField } from '@renderer/components/forms/FormField'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useToast } from '@renderer/lib/use-toast'
import { formatCFA } from '@renderer/lib/formatters'
import { api } from '@renderer/lib/ipc'
import type { TuitionInstallmentInput } from '@shared/types/settings.types'

interface DraftInstallment extends TuitionInstallmentInput {
  /** Clé locale stable pour le rendu de liste (les tranches n'ont pas encore d'id tant que non sauvegardées). */
  key: string
}

let nextKey = 0
function makeEmptyInstallment(): DraftInstallment {
  nextKey += 1
  return { key: `new-${nextKey}`, label: '', amount: 0, dueDate: '' }
}

export function TuitionFeesPage(): JSX.Element {
  const { classes, currentSchoolYear, loadClasses } = useSettingsStore()
  const { toast } = useToast()

  const [classId, setClassId] = useState<string>('')
  const [installments, setInstallments] = useState<DraftInstallment[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!classId || !currentSchoolYear) {
      setInstallments([])
      return
    }

    setLoadingSchedule(true)
    setError(null)
    api.settings
      .getTuitionSchedule(classId, currentSchoolYear.id)
      .then((schedule) => {
        if (schedule && schedule.installments.length > 0) {
          setInstallments(
            schedule.installments.map((i) => ({
              key: i.id,
              label: i.label,
              amount: i.amount,
              dueDate: i.dueDate,
              sortOrder: i.sortOrder
            }))
          )
        } else {
          setInstallments([makeEmptyInstallment()])
        }
      })
      .catch(() => setError('Échec du chargement du barème.'))
      .finally(() => setLoadingSchedule(false))
  }, [classId, currentSchoolYear])

  const updateInstallment = (key: string, patch: Partial<DraftInstallment>): void => {
    setInstallments((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }

  const removeInstallment = (key: string): void => {
    setInstallments((prev) => prev.filter((i) => i.key !== key))
  }

  const addInstallment = (): void => {
    setInstallments((prev) => [...prev, makeEmptyInstallment()])
  }

  const total = installments.reduce((sum, i) => sum + (i.amount || 0), 0)

  const handleSave = async (): Promise<void> => {
    if (!classId || !currentSchoolYear) return
    setError(null)

    if (installments.length === 0) {
      setError('Ajoutez au moins une tranche.')
      return
    }
    for (const i of installments) {
      if (!i.label.trim() || i.amount <= 0 || !i.dueDate) {
        setError('Chaque tranche doit avoir un libellé, un montant positif et une date d\'échéance.')
        return
      }
    }

    setSaving(true)
    try {
      await api.settings.saveTuitionSchedule({
        classId,
        schoolYearId: currentSchoolYear.id,
        installments: installments.map(({ label, amount, dueDate }, index) => ({
          label,
          amount,
          dueDate,
          sortOrder: index
        }))
      })
      toast({ title: 'Barème enregistré', description: 'Les tranches ont été sauvegardées.' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  if (!currentSchoolYear) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune année scolaire active. Configurez-en une dans l'onglet « Année scolaire » avant de
        définir un barème.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <FormField label="Classe" htmlFor="class-select" className="w-56">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger id="class-select">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <p className="text-sm text-muted-foreground">
          Barème pour l'année <span className="font-medium text-foreground">{currentSchoolYear.label}</span>
        </p>
      </div>

      {classId && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            {loadingSchedule ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_180px_180px_auto] items-center gap-3 text-xs font-medium text-muted-foreground">
                  <span>Libellé de la tranche</span>
                  <span>Montant</span>
                  <span>Date d'échéance</span>
                  <span />
                </div>
                {installments.map((installment) => (
                  <div
                    key={installment.key}
                    className="grid grid-cols-[1fr_180px_180px_auto] items-center gap-3"
                  >
                    <Input
                      value={installment.label}
                      onChange={(e) => updateInstallment(installment.key, { label: e.target.value })}
                      placeholder="Ex: 1ère tranche"
                    />
                    <MoneyInput
                      value={installment.amount}
                      onChange={(amount) => updateInstallment(installment.key, { amount })}
                    />
                    <DatePickerField
                      value={installment.dueDate}
                      onChange={(dueDate) => updateInstallment(installment.key, { dueDate })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeInstallment(installment.key)}
                      disabled={installments.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={addInstallment}>
                  <Plus className="h-4 w-4" />
                  Ajouter une tranche
                </Button>

                {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    Total pour cette classe :{' '}
                    <span className="text-base font-semibold text-foreground">{formatCFA(total)}</span>
                  </p>
                  <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                    <Save className="h-4 w-4" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
