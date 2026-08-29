import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Lightbulb,
  ArrowLeft,
  ArrowRight,
  Check,
  X
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import { api } from '@renderer/lib/ipc'
import type { SchoolClass } from '@shared/types/settings.types'

/** Étape 4/6 de l'onboarding — création des classes de l'établissement. */
export function ClassesSetupPage(): JSX.Element {
  const navigate = useNavigate()

  const [classList, setClassList] = useState<SchoolClass[]>([])
  const [newClassName, setNewClassName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.settings
      .getClasses()
      .then(setClassList)
      .catch(() => setError('Échec du chargement des classes.'))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    const name = newClassName.trim()
    if (!name) return

    try {
      const created = await api.settings.createClass(name)
      setClassList((prev) => [...prev, created])
      setNewClassName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ajout de la classe.")
    }
  }

  const startEditing = (schoolClass: SchoolClass): void => {
    setEditingId(schoolClass.id)
    setEditingName(schoolClass.name)
  }

  const cancelEditing = (): void => {
    setEditingId(null)
    setEditingName('')
  }

  const saveEditing = async (id: string): Promise<void> => {
    const name = editingName.trim()
    if (!name) return

    setError(null)
    try {
      const updated = await api.settings.updateClass(id, name)
      setClassList((prev) => prev.map((c) => (c.id === id ? updated : c)))
      cancelEditing()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la modification.')
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    setError(null)
    try {
      await api.settings.deleteClass(id)
      setClassList((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la suppression.')
    }
  }

  const handleContinue = (): void => {
    if (classList.length === 0) {
      setError('Ajoutez au moins une classe avant de continuer.')
      return
    }
    navigate('/onboarding/school-year')
  }

  return (
    <OnboardingLayout
      currentStep="classes"
      title="Configurez vos classes"
      description="Ajoutez les classes disponibles dans votre établissement. Vous pourrez en ajouter ou en modifier plus tard."
      illustration={
        <>
          <GraduationCap />
          <span>Vos classes</span>
        </>
      }
    >
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <GraduationCap className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Ajoutez les classes de votre établissement
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm text-muted-foreground">
          Commencez à saisir le nom d’une classe puis cliquez sur « Ajouter ». Vous pouvez en
          ajouter autant que nécessaire.
        </p>
      </div>

      <form onSubmit={handleAdd} className="mt-8 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="newClassName" className="mb-1.5 block text-sm font-medium text-gray-900">
            Nom de la classe
          </label>
          <Input
            id="newClassName"
            autoFocus
            placeholder="Ex : 6ème A"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
          />
        </div>
        <Button type="submit" className="gap-2" disabled={!newClassName.trim()}>
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-gray-900">
          Classes ajoutées ({classList.length})
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        ) : classList.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune classe ajoutée pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {classList.map((schoolClass) => (
              <li
                key={schoolClass.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  {editingId === schoolClass.id ? (
                    <Input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveEditing(schoolClass.id)
                        if (e.key === 'Escape') cancelEditing()
                      }}
                      className="h-8 w-48"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{schoolClass.name}</span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {editingId === schoolClass.id ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success hover:text-success"
                        onClick={() => void saveEditing(schoolClass.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => startEditing(schoolClass)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(schoolClass.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-lg bg-primary-50 px-4 py-3">
        <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-gray-900">Conseil</p>
          <p className="text-xs text-muted-foreground">
            Ajoutez toutes vos classes actuelles pour bien démarrer avec AcademyFlow.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-5 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-6">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => navigate('/onboarding/admin')}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button type="button" className="gap-2" onClick={handleContinue}>
          Continuer
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </OnboardingLayout>
  )
}
