import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { FileDown, MoreHorizontal, Pencil, Plus, UserX, Users } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { DataTableToolbar } from '@renderer/components/data-table/DataTableToolbar'
import { EmployeeFormDialog } from './EmployeeFormDialog'
import { usePersonnelStore } from '@renderer/stores/personnel.store'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { PersonnelListPDF } from '@renderer/pdf/PersonnelListPDF'
import { formatCFA } from '@renderer/lib/formatters'
import type { EmployeeFormValues } from '@renderer/lib/validators'
import type { Employee } from '@shared/types/personnel.types'

type StatusFilter = 'active' | 'all'

export function PersonnelListPage(): JSX.Element {
  const { toast } = useToast()
  const { employees, isLoading, loadEmployees } = usePersonnelStore()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<Employee | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void loadEmployees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredEmployees = useMemo(() => {
    const term = query.trim().toLowerCase()
    return employees.filter((employee) => {
      if (statusFilter === 'active' && !employee.isActive) return false
      if (!term) return true
      return (
        employee.lastName.toLowerCase().includes(term) ||
        employee.firstName.toLowerCase().includes(term) ||
        employee.role.toLowerCase().includes(term)
      )
    })
  }, [employees, statusFilter, query])

  const activeCount = employees.filter((e) => e.isActive).length

  const handleCreate = (): void => {
    setEditingEmployee(null)
    setFormOpen(true)
  }

  const handleEdit = (employee: Employee): void => {
    setEditingEmployee(employee)
    setFormOpen(true)
  }

  const handleSubmit = async (values: EmployeeFormValues): Promise<void> => {
    try {
      if (editingEmployee) {
        await api.personnel.update(editingEmployee.id, values)
        toast({
          title: 'Employé modifié',
          description: `${values.firstName} ${values.lastName} a été mis à jour.`
        })
      } else {
        await api.personnel.create(values)
        toast({
          title: 'Employé créé',
          description: `${values.firstName} ${values.lastName} a été enregistré(e).`
        })
      }
      setFormOpen(false)
      await loadEmployees()
    } catch (error) {
      toast({
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : 'Une erreur est survenue.',
        variant: 'destructive'
      })
    }
  }

  const handleDeactivate = async (): Promise<void> => {
    if (!employeeToDeactivate) return
    await api.personnel.delete(employeeToDeactivate.id)
    toast({
      title: 'Employé désactivé',
      description: `${employeeToDeactivate.firstName} ${employeeToDeactivate.lastName} n'apparaîtra plus dans le suivi des salaires.`
    })
    await loadEmployees()
  }

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      const activeEmployees = employees.filter((e) => e.isActive)
      await openPdf(
        <PersonnelListPDF employees={activeEmployees} schoolInfo={schoolInfo} />,
        'liste-du-personnel.pdf'
      )
    } catch {
      toast({
        title: "Échec de l'export",
        description: 'Impossible de générer le PDF.',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        id: 'name',
        header: 'Nom et prénom(s)',
        accessorFn: (row) => `${row.lastName} ${row.firstName}`
      },
      { accessorKey: 'role', header: 'Fonction' },
      {
        accessorKey: 'phone',
        header: 'Téléphone',
        cell: ({ row }) => row.original.phone ?? '—'
      },
      {
        accessorKey: 'monthlySalary',
        header: 'Salaire mensuel',
        cell: ({ row }) => (
          <span className="font-mono">{formatCFA(row.original.monthlySalary)}</span>
        )
      },
      {
        accessorKey: 'isActive',
        header: 'Statut',
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Actif</Badge>
          ) : (
            <Badge variant="secondary">Désactivé</Badge>
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
              <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              {row.original.isActive && (
                <DropdownMenuItem
                  onClick={() => setEmployeeToDeactivate(row.original)}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Désactiver
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    ],
    []
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {activeCount} employé{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting}>
            <FileDown className="h-4 w-4" />
            {exporting ? 'Export...' : 'Exporter la liste'}
          </Button>
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nouvel employé
          </Button>
        </div>
      </div>

      <DataTableToolbar
        onSearch={setQuery}
        searchPlaceholder="Rechercher par nom ou fonction..."
        filters={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actifs</SelectItem>
              <SelectItem value="all">Tous</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <DataTable
        columns={columns}
        data={filteredEmployees}
        isLoading={isLoading}
        emptyMessage={
          query ? 'Aucun employé ne correspond à cette recherche.' : 'Aucun employé enregistré.'
        }
      />

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={employeeToDeactivate !== null}
        onOpenChange={(open) => !open && setEmployeeToDeactivate(null)}
        title="Désactiver cet employé ?"
        description={`${employeeToDeactivate?.firstName} ${employeeToDeactivate?.lastName} n'apparaîtra plus dans le suivi des salaires ni dans les listes actives. Son historique de paiement est conservé.`}
        confirmLabel="Désactiver"
        variant="destructive"
        onConfirm={handleDeactivate}
      />
    </div>
  )
}
