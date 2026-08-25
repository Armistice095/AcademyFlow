import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, FileDown, MoreHorizontal, Pencil, Plus, Trash2, Upload, User } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { DataTableToolbar } from '@renderer/components/data-table/DataTableToolbar'
import { StudentStatsCards } from './components/StudentStatsCards'
import { useStudents, useStudentStats } from '@renderer/hooks/useStudents'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useStudentsStore } from '@renderer/stores/students.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { formatDateShort } from '@renderer/lib/formatters'
import { ClassListPDF } from '@renderer/pdf/ClassListPDF'
import type { StudentListItem } from '@shared/types/student.types'

const STATUS_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  redoublant: 'Redoublant'
}

export function StudentsListPage(): JSX.Element {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { classes, currentSchoolYear, loadClasses, loadCurrentSchoolYear } = useSettingsStore()
  const { refresh } = useStudentsStore()

  const [classId, setClassId] = useState<string>('all')
  const [studentToDelete, setStudentToDelete] = useState<StudentListItem | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadClasses()
    void loadCurrentSchoolYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { query, setQuery, results, isLoading } = useStudents({
    classId: classId === 'all' ? undefined : classId,
    schoolYearId: currentSchoolYear?.id
  })

  const { stats } = useStudentStats({
    classId: classId === 'all' ? undefined : classId,
    schoolYearId: currentSchoolYear?.id
  })

  const columns = useMemo<ColumnDef<StudentListItem>[]>(
    () => [
      {
        id: 'photo',
        header: 'Photo',
        cell: ({ row }) =>
          row.original.photoPath ? (
            <img
              src={row.original.photoPath}
              alt=""
              className="h-9 w-9 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-input bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          )
      },
      {
        id: 'name',
        header: 'Élève',
        accessorFn: (row) => `${row.lastName} ${row.firstName}`,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.lastName} {row.original.firstName}
            </p>
            <p className="truncate text-xs text-muted-foreground">ID: {row.original.matricule}</p>
          </div>
        )
      },
      {
        accessorKey: 'gender',
        header: 'Sexe',
        cell: ({ row }) => (row.original.gender === 'M' ? 'M' : 'F')
      },
      {
        accessorKey: 'dateOfBirth',
        header: 'Date de naissance',
        cell: ({ row }) => (row.original.dateOfBirth ? formatDateShort(row.original.dateOfBirth) : '—')
      },
      {
        id: 'placeOfBirth',
        header: 'Lieu de naissance',
        accessorFn: (row) => row.placeOfBirth ?? '—'
      },
      {
        id: 'className',
        header: 'Classe',
        accessorFn: (row) => row.className ?? '—'
      },
      {
        accessorKey: 'status',
        header: 'Statut',
        cell: ({ row }) => (
          <Badge variant="secondary">{STATUS_LABELS[row.original.status] ?? row.original.status}</Badge>
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
              <DropdownMenuItem onClick={() => navigate(`/students/${row.original.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Voir la fiche
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/students/${row.original.id}?edit=1`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setStudentToDelete(row.original)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    ],
    [navigate]
  )

  const handleDelete = async (): Promise<void> => {
    if (!studentToDelete) return
    await api.students.delete(studentToDelete.id)
    toast({
      title: 'Élève supprimé',
      description: `${studentToDelete.firstName} ${studentToDelete.lastName} a été retiré(e) du dossier actif.`
    })
    await refresh()
  }

  const handleImport = (): void => {
    toast({
      title: 'Fonctionnalité en cours de construction',
      description: "L'import d'élèves sera bientôt disponible."
    })
  }

  const handleExportClassList = async (): Promise<void> => {
    if (classId === 'all' || !currentSchoolYear || !results) return
    setExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      const className = classes.find((c) => c.id === classId)?.name ?? ''
      await openPdf(
        <ClassListPDF
          students={results.items}
          className={className}
          schoolYearLabel={currentSchoolYear.label}
          schoolInfo={schoolInfo}
        />,
        `liste-${className}.pdf`
      )
    } catch {
      toast({ title: "Échec de l'export", description: 'Impossible de générer le PDF.', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StudentStatsCards stats={stats} />

      <DataTableToolbar
        onSearch={setQuery}
        searchPlaceholder="Rechercher par nom ou matricule..."
        filters={
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImport} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Importer
            </Button>
            {classId !== 'all' && (
              <Button variant="outline" onClick={handleExportClassList} disabled={exporting} className="gap-1.5">
                <FileDown className="h-4 w-4" />
                {exporting ? 'Export...' : 'Exporter la liste'}
              </Button>
            )}
            <Button onClick={() => navigate('/students/new')} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouvel élève
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={results?.items ?? []}
        isLoading={isLoading}
        onRowClick={(row) => navigate(`/students/${row.id}`)}
        emptyMessage={query ? 'Aucun élève ne correspond à cette recherche.' : 'Aucun élève inscrit.'}
      />

      <ConfirmDialog
        open={studentToDelete !== null}
        onOpenChange={(open) => !open && setStudentToDelete(null)}
        title="Supprimer cet élève ?"
        description={`${studentToDelete?.firstName} ${studentToDelete?.lastName} sera retiré(e) du dossier actif. Son historique financier, s'il existe, est conservé (BR-006). Cette action nécessite votre confirmation.`}
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
