import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  FileBadge,
  FileText,
  IdCard,
  Pencil,
  Save,
  Trash2,
  UserPlus,
  X
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { FormField } from '@renderer/components/forms/FormField'
import { DatePickerField } from '@renderer/components/forms/DatePickerField'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { useToast } from '@renderer/lib/use-toast'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { formatDate, formatMatricule } from '@renderer/lib/formatters'
import { EnrollmentCertPDF } from '@renderer/pdf/EnrollmentCertPDF'
import { SchoolCertPDF } from '@renderer/pdf/SchoolCertPDF'
import { StudentFilePDF } from '@renderer/pdf/StudentFilePDF'
import type { EnrollmentWithDetails, Student, UpdateStudentDTO } from '@shared/types/student.types'

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  redoublant: 'Redoublant',
  transféré: 'Transféré',
  admis: 'Admis(e)'
}

export function StudentDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { currentSchoolYear } = useSettingsStore()

  const [student, setStudent] = useState<Student | null>(null)
  const [history, setHistory] = useState<EnrollmentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(searchParams.get('edit') === '1')
  const [draft, setDraft] = useState<UpdateStudentDTO>({})
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [hasFinancialHistory, setHasFinancialHistory] = useState(false)
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    if (!id) return
    setLoading(true)
    try {
      const [studentData, historyData] = await Promise.all([
        api.students.findById(id),
        api.students.getEnrollmentHistory(id)
      ])
      setStudent(studentData)
      setHistory(historyData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const currentEnrollment = history.find((h) => h.schoolYearId === currentSchoolYear?.id)

  const startEdit = (): void => {
    if (!student) return
    setDraft({
      lastName: student.lastName,
      firstName: student.firstName,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      placeOfBirth: student.placeOfBirth ?? undefined,
      nationality: student.nationality,
      address: student.address ?? undefined,
      previousSchool: student.previousSchool ?? undefined,
      status: student.status
    })
    setEditMode(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!id) return
    setSaving(true)
    try {
      const updated = await api.students.update(id, draft)
      setStudent(updated)
      setEditMode(false)
      toast({ title: 'Fiche mise à jour', description: 'Les modifications ont été enregistrées.' })
    } catch (error) {
      toast({
        title: 'Échec de la mise à jour',
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const openDeleteDialog = async (): Promise<void> => {
    if (!id) return
    const has = await api.students.hasFinancialHistory(id)
    setHasFinancialHistory(has)
    setDeleteOpen(true)
  }

  const handleDelete = async (): Promise<void> => {
    if (!id) return
    await api.students.delete(id)
    toast({ title: 'Élève supprimé', description: 'La fiche a été retirée du dossier actif.' })
    navigate('/students', { replace: true })
  }

  const generateDocument = async (type: 'enrollment' | 'school-cert' | 'file'): Promise<void> => {
    if (!student) return
    setGeneratingDoc(type)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      const className = currentEnrollment?.className ?? '—'
      const schoolYearLabel = currentSchoolYear?.label ?? '—'

      if (type === 'enrollment') {
        await openPdf(
          <EnrollmentCertPDF student={student} className={className} schoolYearLabel={schoolYearLabel} schoolInfo={schoolInfo} />,
          `attestation-${student.matricule}.pdf`
        )
      } else if (type === 'school-cert') {
        await openPdf(
          <SchoolCertPDF student={student} className={className} schoolYearLabel={schoolYearLabel} schoolInfo={schoolInfo} />,
          `certificat-${student.matricule}.pdf`
        )
      } else {
        await openPdf(
          <StudentFilePDF student={student} history={history} schoolInfo={schoolInfo} />,
          `fiche-${student.matricule}.pdf`
        )
      }
    } catch {
      toast({ title: 'Échec de la génération', description: 'Impossible de générer le document.', variant: 'destructive' })
    } finally {
      setGeneratingDoc(null)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chargement...</p>
  }
  if (!student) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Élève introuvable.</p>
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {student.lastName} {student.firstName}
            </h1>
            <Badge variant="secondary">{STATUS_LABELS[student.status] ?? student.status}</Badge>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{formatMatricule(student.matricule)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateDocument('enrollment')} disabled={generatingDoc !== null}>
            <FileBadge className="h-4 w-4" />
            Attestation
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateDocument('school-cert')} disabled={generatingDoc !== null}>
            <FileText className="h-4 w-4" />
            Certificat
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generateDocument('file')} disabled={generatingDoc !== null}>
            <IdCard className="h-4 w-4" />
            Fiche
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={openDeleteDialog}>
            <Trash2 className="h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="history">Parcours scolaire</TabsTrigger>
          <TabsTrigger value="financial">Situation financière</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Informations administratives</CardTitle>
              {!editMode ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditMode(false)}>
                    <X className="h-4 w-4" />
                    Annuler
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {editMode ? (
                <>
                  <FormField label="Nom" htmlFor="edit-lastName">
                    <Input id="edit-lastName" value={draft.lastName ?? ''} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
                  </FormField>
                  <FormField label="Prénom(s)" htmlFor="edit-firstName">
                    <Input id="edit-firstName" value={draft.firstName ?? ''} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
                  </FormField>
                  <FormField label="Sexe" htmlFor="edit-gender">
                    <Select value={draft.gender} onValueChange={(v) => setDraft({ ...draft, gender: v as Student['gender'] })}>
                      <SelectTrigger id="edit-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Date de naissance" htmlFor="edit-dob">
                    <DatePickerField
                      id="edit-dob"
                      value={draft.dateOfBirth ?? ''}
                      onChange={(v) => setDraft({ ...draft, dateOfBirth: v })}
                    />
                  </FormField>
                  <FormField label="Lieu de naissance" htmlFor="edit-pob">
                    <Input id="edit-pob" value={draft.placeOfBirth ?? ''} onChange={(e) => setDraft({ ...draft, placeOfBirth: e.target.value })} />
                  </FormField>
                  <FormField label="Nationalité" htmlFor="edit-nat">
                    <Input id="edit-nat" value={draft.nationality ?? ''} onChange={(e) => setDraft({ ...draft, nationality: e.target.value })} />
                  </FormField>
                  <FormField label="Adresse" htmlFor="edit-addr" className="sm:col-span-2">
                    <Input id="edit-addr" value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                  </FormField>
                </>
              ) : (
                <>
                  <InfoRow label="Sexe" value={student.gender === 'M' ? 'Masculin' : 'Féminin'} />
                  <InfoRow label="Date de naissance" value={formatDate(student.dateOfBirth)} />
                  <InfoRow label="Lieu de naissance" value={student.placeOfBirth ?? '—'} />
                  <InfoRow label="Nationalité" value={student.nationality} />
                  <InfoRow label="Adresse" value={student.address ?? '—'} />
                  <InfoRow label="Classe actuelle" value={currentEnrollment?.className ?? '—'} />
                  {student.previousSchool && <InfoRow label="École de provenance" value={student.previousSchool} />}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Responsables</CardTitle>
              <AddGuardianButton studentId={student.id} onAdded={load} />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(student.guardians ?? []).map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-md border border-border px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      {g.lastName} {g.firstName} <span className="text-muted-foreground">({g.relationship})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.phone}
                      {g.profession ? ` — ${g.profession}` : ''}
                    </p>
                  </div>
                </div>
              ))}
              {(student.guardians ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun responsable enregistré.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Année scolaire</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{entry.schoolYearLabel}</TableCell>
                      <TableCell>{entry.className}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{STATUS_LABELS[entry.status] ?? entry.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {history.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucun historique disponible.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <p className="text-sm text-muted-foreground">
                Le détail des tranches attendues, montants payés et solde de scolarité se trouve dans le
                module Caisse.
              </p>
              <Button variant="outline" className="gap-1.5" onClick={() => navigate(`/cashbox/student/${student.id}`)}>
                <Banknote className="h-4 w-4" />
                Voir le compte de scolarité
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer cet élève ?"
        description={
          hasFinancialHistory
            ? `${student.firstName} ${student.lastName} possède des opérations de caisse enregistrées. La fiche sera retirée du dossier actif, mais tout l'historique financier est conservé (BR-006).`
            : `${student.firstName} ${student.lastName} sera retiré(e) du dossier actif.`
        }
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function AddGuardianButton({ studentId, onAdded }: { studentId: string; onAdded: () => void }): JSX.Element {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ lastName: '', firstName: '', phone: '', profession: '', relationship: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true)
    try {
      await api.students.addGuardian(studentId, { ...form, profession: form.profession || undefined })
      setOpen(false)
      setForm({ lastName: '', firstName: '', phone: '', profession: '', relationship: '' })
      onAdded()
      toast({ title: 'Responsable ajouté' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Ajouter
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input placeholder="Nom" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-28" />
      <Input placeholder="Prénom" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-28" />
      <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-32" />
      <Input placeholder="Lien" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} className="w-28" />
      <Button size="sm" onClick={handleSubmit} disabled={submitting}>
        OK
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Annuler
      </Button>
    </div>
  )
}
