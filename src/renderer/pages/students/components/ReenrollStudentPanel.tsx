import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search, UserCheck, X } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { StudentAvatar } from '@renderer/components/students/StudentAvatar'
import { SearchInput } from '@renderer/components/forms/SearchInput'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { FormField } from '@renderer/components/forms/FormField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { formatMatricule } from '@renderer/lib/formatters'
import type { StudentListItem } from '@shared/types/student.types'

/**
 * Réinscription d'un ancien élève : recherche dans l'ensemble de la base
 * (pas seulement l'année en cours), sélection, puis choix de la classe pour
 * l'année scolaire active. Volontairement minimal — aucune autre saisie.
 */
export function ReenrollStudentPanel(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { classes, currentSchoolYear, loadClasses, loadCurrentSchoolYear } = useSettingsStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentListItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<StudentListItem | null>(null)
  const [classId, setClassId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /** studentId -> nom de la classe pour l'année en cours (élèves déjà réinscrits). */
  const [currentYearClassById, setCurrentYearClassById] = useState<Record<string, string>>({})

  useEffect(() => {
    void loadClasses()
    void loadCurrentSchoolYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentSchoolYear) {
      setCurrentYearClassById({})
      return
    }
    api.students.listEnrollmentClassNames(currentSchoolYear.id).then(setCurrentYearClassById)
  }, [currentSchoolYear])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setIsSearching(true)
    // Recherche sur l'ensemble de la base, toutes années confondues : ne pas
    // passer `schoolYearId` ici, sous peine de restreindre les résultats aux
    // seuls élèves déjà inscrits pour l'année en cours (voir `search()`).
    api.students
      .search({ query })
      .then((res) => setResults(res.items))
      .finally(() => setIsSearching(false))
  }, [query])

  const selectedCurrentClass = selected ? currentYearClassById[selected.id] : undefined
  const alreadyEnrolled = selectedCurrentClass != null

  const handleSelect = (student: StudentListItem): void => {
    setSelected(student)
    setClassId('')
  }

  const handleReset = (): void => {
    setSelected(null)
    setClassId('')
  }

  const handleSubmit = async (): Promise<void> => {
    if (!selected || !classId || !currentSchoolYear) return
    setSubmitting(true)
    try {
      await api.students.createEnrollment({
        studentId: selected.id,
        schoolYearId: currentSchoolYear.id,
        classId,
        status: 'admis'
      })
      toast({
        title: 'Réinscription enregistrée',
        description: `${selected.lastName} ${selected.firstName} est réinscrit(e) pour l'année ${currentSchoolYear.label}.`
      })
      navigate(`/students/${selected.id}`, { replace: true })
    } catch (error) {
      toast({
        title: 'Échec de la réinscription',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (selected) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <StudentAvatar
                firstName={selected.firstName}
                lastName={selected.lastName}
                photoPath={selected.photoPath}
                size="md"
              />
              <div>
                <p className="font-medium text-foreground">
                  {selected.lastName} {selected.firstName}
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatMatricule(selected.matricule)}
                </p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={handleReset}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {alreadyEnrolled && (
            <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
              Cet élève est déjà inscrit en {selectedCurrentClass} pour l’année{' '}
              {currentSchoolYear?.label}.
            </p>
          )}

          <FormField label="Nouvelle classe" htmlFor="reenroll-classId" required>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="reenroll-classId">
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

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Choisir un autre élève
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!classId || submitting || alreadyEnrolled}
              className="gap-1.5"
            >
              <UserCheck className="h-4 w-4" />
              {submitting ? 'Enregistrement...' : 'Enregistrer la réinscription'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <SearchInput
          onSearch={setQuery}
          placeholder="Rechercher un élève par nom ou matricule..."
          className="max-w-md"
        />

        {!query.trim() && (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            Recherchez un élève déjà présent dans la base (toutes années confondues) pour le
            réinscrire.
          </p>
        )}

        {query.trim() && isSearching && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-2.5"
              >
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {query.trim() && !isSearching && results.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Aucun élève ne correspond à cette recherche.
          </p>
        )}

        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((student) => {
              const currentClass = currentYearClassById[student.id]
              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleSelect(student)}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <StudentAvatar
                      firstName={student.firstName}
                      lastName={student.lastName}
                      photoPath={student.photoPath}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {student.lastName} {student.firstName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {formatMatricule(student.matricule)}
                      </p>
                    </div>
                  </div>
                  {currentClass ? (
                    <Badge variant="warning">Déjà réinscrit(e) — {currentClass}</Badge>
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
