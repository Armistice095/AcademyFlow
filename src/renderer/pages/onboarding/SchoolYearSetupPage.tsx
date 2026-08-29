import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { FormField } from '@renderer/components/forms/FormField'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import { api } from '@renderer/lib/ipc'

/** Suggère le libellé de l'année scolaire courante (ex: "2026-2027") à partir de la date du jour. */
function suggestSchoolYearLabel(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear()
  // La rentrée scolaire béninoise démarre en septembre.
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`
}

/**
 * Étape 5/6 de l'onboarding — création de la première année scolaire.
 *
 * Remarque : le schéma `SCHOOL_YEARS` ne stocke qu'un libellé (ex:
 * "2026-2027") et un indicateur "année courante", pas de dates de début/fin
 * — contrairement à la maquette initiale qui suggérait des champs de date.
 * Champ simplifié en conséquence ; à revoir si des dates précises sont
 * réellement nécessaires ailleurs dans l'app (bulletins, calcul de périodes...).
 */
export function SchoolYearSetupPage(): JSX.Element {
  const navigate = useNavigate()

  const [label, setLabel] = useState(suggestSchoolYearLabel())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const created = await api.settings.createSchoolYear(label.trim())
      // Aucune année courante ne peut exister avant la première créée à
      // l'onboarding : on la marque active immédiatement pour que l'app
      // soit pleinement utilisable dès la fin de l'assistant.
      await api.settings.setCurrentSchoolYear(created.id)
      navigate('/onboarding/drive')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création de l'année scolaire.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep="school-year"
      title="Définissez votre année scolaire"
      description="Cette année sera utilisée comme période scolaire active dans AcademyFlow."
      illustration={
        <>
          <CalendarRange />
          <span>Année scolaire</span>
        </>
      }
    >
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <CalendarRange className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Créez votre première année scolaire
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm text-muted-foreground">
          Définissez le libellé de votre année scolaire. Vous pourrez en ajouter d’autres lorsque
          nécessaire.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <FormField
          label="Nom de l'année scolaire"
          htmlFor="label"
          required
          hint="Format AAAA-AAAA, ex : 2026-2027"
        >
          <Input
            id="label"
            autoFocus
            placeholder="2026-2027"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="max-w-xs font-mono"
            required
          />
        </FormField>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-6">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/onboarding/classes')}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <Button type="submit" className="gap-2" disabled={saving || !label.trim()}>
            {saving ? 'Création...' : 'Continuer'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
