import { useEffect, useMemo, useState } from 'react'
import { ArrowRightCircle, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { FormField } from '@renderer/components/forms/FormField'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { Badge } from '@renderer/components/ui/badge'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { cn } from '@renderer/lib/utils'
import type { PromotionDecision, Student } from '@shared/types/student.types'

export function ClassPromotionPage(): JSX.Element {
  const { toast } = useToast()
  const { classes, schoolYears, currentSchoolYear, loadClasses, loadSchoolYears } = useSettingsStore()

  const [sourceClassId, setSourceClassId] = useState('')
  const [targetSchoolYearId, setTargetSchoolYearId] = useState('')
  const [roster, setRoster] = useState<Student[]>([])
  const [decisions, setDecisions] = useState<Record<string, 'promote' | 'repeat'>>({})
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    void loadClasses()
    void loadSchoolYears()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const targetYearOptions = schoolYears.filter((y) => y.id !== currentSchoolYear?.id)

  useEffect(() => {
    if (!sourceClassId || !currentSchoolYear) {
      setRoster([])
      return
    }
    setLoadingRoster(true)
    api.students
      .listByClass(sourceClassId, currentSchoolYear.id)
      .then((list) => {
        setRoster(list)
        setDecisions(Object.fromEntries(list.map((s) => [s.id, 'promote' as const])))
      })
      .finally(() => setLoadingRoster(false))
  }, [sourceClassId, currentSchoolYear])

  const summary = useMemo(() => {
    const values = Object.values(decisions)
    return {
      promote: values.filter((v) => v === 'promote').length,
      repeat: values.filter((v) => v === 'repeat').length
    }
  }, [decisions])

  const sourceClassName = classes.find((c) => c.id === sourceClassId)?.name ?? ''
  const targetYearLabel = schoolYears.find((y) => y.id === targetSchoolYearId)?.label ?? ''

  const handleApply = async (): Promise<void> => {
    if (!currentSchoolYear || !targetSchoolYearId) return
    setApplying(true)
    try {
      const decisionsPayload: PromotionDecision[] = roster.map((s) => ({
        studentId: s.id,
        decision: decisions[s.id] ?? 'promote'
      }))
      const result = await api.students.promoteStudents({
        sourceClassId,
        sourceSchoolYearId: currentSchoolYear.id,
        targetSchoolYearId,
        decisions: decisionsPayload
      })
      toast({
        title: 'Passage de classe appliqué',
        description: `${result.promoted} élève(s) promu(s), ${result.repeated} redoublant(s).`
      })
      setSourceClassId('')
      setRoster([])
    } catch (error) {
      toast({
        title: 'Échec du passage de classe',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    } finally {
      setApplying(false)
      setConfirmOpen(false)
    }
  }

  if (!currentSchoolYear) {
    return <p className="text-sm text-muted-foreground">Aucune année scolaire active.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Le passage de classe nécessite qu'une nouvelle année scolaire ait été créée au préalable (voir
        Paramètres → Année scolaire). L'opération est appliquée en une seule fois, intégralement, ou pas du
        tout.
      </p>

      <div className="flex flex-wrap gap-4">
        <FormField label="Classe source" htmlFor="source-class" className="w-56">
          <Select value={sourceClassId} onValueChange={setSourceClassId}>
            <SelectTrigger id="source-class">
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

        <FormField label="Année scolaire cible" htmlFor="target-year" className="w-56">
          <Select value={targetSchoolYearId} onValueChange={setTargetSchoolYearId}>
            <SelectTrigger id="target-year">
              <SelectValue placeholder="Choisir une année" />
            </SelectTrigger>
            <SelectContent>
              {targetYearOptions.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      {targetYearOptions.length === 0 && (
        <p className="text-sm text-warning">
          Aucune autre année scolaire disponible. Créez d'abord une nouvelle année dans Paramètres.
        </p>
      )}

      {sourceClassId && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            {loadingRoster ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
            ) : roster.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun élève actif dans cette classe pour l'année {currentSchoolYear.label}.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <p className="text-sm font-medium">
                    {roster.length} élève{roster.length > 1 ? 's' : ''} — {sourceClassName}
                  </p>
                  <div className="flex gap-2">
                    <Badge variant="success">{summary.promote} promu(s)</Badge>
                    <Badge variant="secondary">{summary.repeat} redoublant(s)</Badge>
                  </div>
                </div>

                {roster.map((student) => (
                  <div key={student.id} className="flex items-center justify-between py-1.5">
                    <div>
                      <p className="text-sm font-medium">
                        {student.lastName} {student.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">{student.matricule}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDecisions({ ...decisions, [student.id]: 'promote' })}
                        className={cn(
                          'flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                          decisions[student.id] === 'promote'
                            ? 'border-success bg-success/10 text-success'
                            : 'border-input text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        <ArrowRightCircle className="h-3.5 w-3.5" />
                        Classe supérieure
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecisions({ ...decisions, [student.id]: 'repeat' })}
                        className={cn(
                          'flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                          decisions[student.id] === 'repeat'
                            ? 'border-warning bg-warning/10 text-warning'
                            : 'border-input text-muted-foreground hover:bg-secondary'
                        )}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Redoublement
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end border-t border-border pt-4">
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={!targetSchoolYearId || applying}
                    className="gap-1.5"
                  >
                    Appliquer le passage de classe
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmer le passage de classe"
        description={`${summary.promote} élève(s) passeront en classe supérieure et ${summary.repeat} redoubleront la classe ${sourceClassName}, pour l'année scolaire ${targetYearLabel}. Cette opération est atomique : elle s'applique intégralement ou pas du tout.`}
        confirmLabel="Confirmer"
        onConfirm={handleApply}
      />
    </div>
  )
}
