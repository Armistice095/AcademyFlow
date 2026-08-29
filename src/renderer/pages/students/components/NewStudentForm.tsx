import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Plus, Trash2, UserPlus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'
import { FormField } from '@renderer/components/forms/FormField'
import { DatePickerField } from '@renderer/components/forms/DatePickerField'
import { ImageUpload } from '@renderer/components/forms/ImageUpload'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { formatMatricule } from '@renderer/lib/formatters'
import { studentFormSchema, type StudentFormValues } from '@renderer/lib/validators'
import type { Student } from '@shared/types/student.types'

const EMPTY_GUARDIAN = { lastName: '', firstName: '', phone: '', profession: '', relationship: '' }

/** Formulaire d'inscription d'un nouvel élève — le statut "nouveau" est implicite (onglet dédié). */
export function NewStudentForm(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { classes, currentSchoolYear, loadClasses, loadCurrentSchoolYear } = useSettingsStore()

  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [duplicate, setDuplicate] = useState<Student | null>(null)

  useEffect(() => {
    void loadClasses()
    void loadCurrentSchoolYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors }
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      nationality: 'Béninoise',
      classId: '',
      guardians: [EMPTY_GUARDIAN]
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'guardians' })

  const lastName = watch('lastName')
  const firstName = watch('firstName')
  const debouncedLastName = useDebounce(lastName, 400)
  const debouncedFirstName = useDebounce(firstName, 400)

  useEffect(() => {
    if (!debouncedLastName?.trim() || !debouncedFirstName?.trim() || !currentSchoolYear) {
      setDuplicate(null)
      return
    }
    api.students
      .checkDuplicate(debouncedFirstName, debouncedLastName, currentSchoolYear.id)
      .then(setDuplicate)
      .catch(() => setDuplicate(null))
  }, [debouncedLastName, debouncedFirstName, currentSchoolYear])

  const onSubmit = async (values: StudentFormValues): Promise<void> => {
    setSubmitError(null)
    setSubmitting(true)
    try {
      const created = await api.students.create({
        ...values,
        placeOfBirth: values.placeOfBirth || undefined,
        address: values.address || undefined,
        previousSchool: values.previousSchool || undefined,
        photoPath: values.photoPath || undefined,
        guardians: values.guardians.map((g) => ({ ...g, profession: g.profession || undefined }))
      })
      toast({
        title: 'Élève inscrit(e) avec succès',
        description: `Matricule attribué : ${formatMatricule(created.matricule)}`
      })
      navigate(`/students/${created.id}`, { replace: true })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Échec de l'inscription.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {duplicate && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-foreground">
              Une fiche existe déjà pour {firstName} {lastName} cette année scolaire.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/students/${duplicate.id}`)}
              className="text-primary underline underline-offset-2"
            >
              Consulter la fiche existante (matricule {formatMatricule(duplicate.matricule)})
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Identité &amp; Scolarité</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="photoPath"
              render={({ field }) => (
                <ImageUpload
                  label="Photo (optionnel)"
                  hint="JPG ou PNG, 2 Mo maximum."
                  shape="avatar"
                  value={field.value ?? null}
                  onChange={(dataUrl) => field.onChange(dataUrl ?? undefined)}
                />
              )}
            />
          </div>

          <FormField label="Nom" htmlFor="lastName" required error={errors.lastName?.message}>
            <Input id="lastName" {...register('lastName')} />
          </FormField>
          <FormField
            label="Prénom(s)"
            htmlFor="firstName"
            required
            error={errors.firstName?.message}
          >
            <Input id="firstName" {...register('firstName')} />
          </FormField>

          <FormField label="Sexe" htmlFor="gender" required error={errors.gender?.message}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField
            label="Date de naissance"
            htmlFor="dateOfBirth"
            required
            error={errors.dateOfBirth?.message}
          >
            <Controller
              control={control}
              name="dateOfBirth"
              render={({ field }) => (
                <DatePickerField
                  id="dateOfBirth"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
          </FormField>

          <FormField label="Lieu de naissance" htmlFor="placeOfBirth">
            <Input id="placeOfBirth" {...register('placeOfBirth')} />
          </FormField>

          <FormField
            label="Nationalité"
            htmlFor="nationality"
            required
            error={errors.nationality?.message}
          >
            <Input id="nationality" {...register('nationality')} />
          </FormField>

          <FormField label="Adresse" htmlFor="address">
            <Input id="address" {...register('address')} />
          </FormField>

          <div className="sm:col-span-2">
            <Separator className="mb-4" />
            <p className="mb-3 text-sm font-medium text-muted-foreground">Scolarité</p>
          </div>

          <FormField label="Classe" htmlFor="classId" required error={errors.classId?.message}>
            <Controller
              control={control}
              name="classId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="classId">
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
              )}
            />
          </FormField>

          <FormField label="École de provenance" htmlFor="previousSchool">
            <Input id="previousSchool" placeholder="Optionnel" {...register('previousSchool')} />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Responsable(s) légal(aux)</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => append(EMPTY_GUARDIAN)}
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un responsable
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {(errors.guardians?.message || errors.guardians?.root?.message) && (
            <p className="text-sm font-medium text-destructive">
              {errors.guardians?.message ?? errors.guardians?.root?.message}
            </p>
          )}
          {fields.map((field, index) => (
            <div key={field.id}>
              {index > 0 && <Separator className="mb-5" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Responsable {index + 1}</p>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Nom"
                  htmlFor={`guardians.${index}.lastName`}
                  required
                  error={errors.guardians?.[index]?.lastName?.message}
                >
                  <Input
                    id={`guardians.${index}.lastName`}
                    {...register(`guardians.${index}.lastName`)}
                  />
                </FormField>
                <FormField
                  label="Prénom"
                  htmlFor={`guardians.${index}.firstName`}
                  required
                  error={errors.guardians?.[index]?.firstName?.message}
                >
                  <Input
                    id={`guardians.${index}.firstName`}
                    {...register(`guardians.${index}.firstName`)}
                  />
                </FormField>
                <FormField
                  label="Téléphone"
                  htmlFor={`guardians.${index}.phone`}
                  required
                  error={errors.guardians?.[index]?.phone?.message}
                >
                  <Input
                    id={`guardians.${index}.phone`}
                    {...register(`guardians.${index}.phone`)}
                  />
                </FormField>
                <FormField label="Profession" htmlFor={`guardians.${index}.profession`}>
                  <Input
                    id={`guardians.${index}.profession`}
                    {...register(`guardians.${index}.profession`)}
                  />
                </FormField>
                <FormField
                  label="Lien de parenté"
                  htmlFor={`guardians.${index}.relationship`}
                  required
                  error={errors.guardians?.[index]?.relationship?.message}
                  className="sm:col-span-2"
                >
                  <Input
                    id={`guardians.${index}.relationship`}
                    placeholder="Ex: Père, Mère, Tuteur légal..."
                    {...register(`guardians.${index}.relationship`)}
                  />
                </FormField>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {submitError && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {submitError}
        </p>
      )}

      <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur supports-backdrop-blur:bg-background/80">
        <Button type="button" variant="outline" onClick={() => navigate('/students')}>
          Annuler
        </Button>
        <Button type="submit" disabled={submitting} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {submitting ? 'Inscription...' : "Inscrire l'élève"}
        </Button>
      </div>
    </form>
  )
}
