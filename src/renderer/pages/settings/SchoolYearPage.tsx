import { useEffect, useState, type FormEvent } from 'react'
import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { FormField } from '@renderer/components/forms/FormField'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useToast } from '@renderer/lib/use-toast'
import { formatDate } from '@renderer/lib/formatters'
import { validateSchoolYearLabel } from '@shared/validators/school-year'
import type { SchoolYear } from '@shared/types/settings.types'

export function SchoolYearPage(): JSX.Element {
  const { schoolYears, isLoading, loadSchoolYears, createSchoolYear, setCurrentSchoolYear } =
    useSettingsStore()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [yearToActivate, setYearToActivate] = useState<SchoolYear | null>(null)

  useEffect(() => {
    void loadSchoolYears()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setCreateError(null)

    const validation = validateSchoolYearLabel(label)
    if (!validation.valid) {
      setCreateError(validation.error ?? 'Libellé invalide.')
      return
    }

    setSubmitting(true)
    try {
      await createSchoolYear(label)
      setLabel('')
      setCreateOpen(false)
      toast({ title: 'Année scolaire créée', description: `"${label}" a été ajoutée.` })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Échec de la création.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async (): Promise<void> => {
    if (!yearToActivate) return
    await setCurrentSchoolYear(yearToActivate.id)
    toast({
      title: 'Année scolaire activée',
      description: `"${yearToActivate.label}" est maintenant l'année en cours.`
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          L’année scolaire active détermine le rattachement par défaut des nouvelles inscriptions et
          opérations de caisse. Le changement d’année ne masque pas les données précédentes.
        </p>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) {
              setLabel('')
              setCreateError(null)
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              Nouvelle année scolaire
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nouvelle année scolaire</DialogTitle>
              <DialogDescription>Format attendu : AAAA-AAAA, ex: 2027-2028.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <FormField
                label="Libellé"
                htmlFor="year-label"
                required
                error={createError ?? undefined}
              >
                <Input
                  id="year-label"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value)
                    if (createError) setCreateError(null)
                  }}
                  placeholder="2027-2028"
                  autoFocus
                  required
                />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading && schoolYears.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Chargement...</p>
            )}
            {!isLoading && schoolYears.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Aucune année scolaire pour le moment.
              </p>
            )}
            {schoolYears.map((year) => (
              <div key={year.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">{year.label}</span>
                  {year.isCurrent && (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Année en cours
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Créée le {formatDate(year.createdAt)}
                  </span>
                  {!year.isCurrent && (
                    <Button variant="outline" size="sm" onClick={() => setYearToActivate(year)}>
                      Activer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={yearToActivate !== null}
        onOpenChange={(open) => !open && setYearToActivate(null)}
        title="Activer cette année scolaire ?"
        description={`"${yearToActivate?.label}" deviendra l'année scolaire en cours. Les nouvelles inscriptions et opérations de caisse s'y rattacheront par défaut. Les données des autres années restent intactes et accessibles.`}
        confirmLabel="Activer"
        onConfirm={handleActivate}
      />
    </div>
  )
}
