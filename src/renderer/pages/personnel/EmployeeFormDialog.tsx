import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { FormField } from '@renderer/components/forms/FormField'
import { MoneyInput } from '@renderer/components/forms/MoneyInput'
import { employeeFormSchema, type EmployeeFormValues } from '@renderer/lib/validators'
import type { Employee } from '@shared/types/personnel.types'

export interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Employé à modifier — `null` pour une création. */
  employee: Employee | null
  onSubmit: (values: EmployeeFormValues) => Promise<void>
}

const EMPTY_VALUES: EmployeeFormValues = {
  lastName: '',
  firstName: '',
  role: '',
  phone: '',
  monthlySalary: 0
}

/** Dialog partagé entre création et modification d'un employé (F-022). */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSubmit
}: EmployeeFormDialogProps): JSX.Element {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: EMPTY_VALUES
  })

  useEffect(() => {
    if (open) {
      reset(
        employee
          ? {
              lastName: employee.lastName,
              firstName: employee.firstName,
              role: employee.role,
              phone: employee.phone ?? '',
              monthlySalary: employee.monthlySalary
            }
          : EMPTY_VALUES
      )
    }
  }, [open, employee, reset])

  const submit = async (values: EmployeeFormValues): Promise<void> => {
    await onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? "Modifier l'employé" : 'Nouvel employé'}</DialogTitle>
          <DialogDescription>
            Le salaire mensuel renseigné ici sert de référence pour le suivi mensuel des paiements
            (F-023).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nom" htmlFor="lastName" required error={errors.lastName?.message}>
              <Input id="lastName" autoFocus {...register('lastName')} />
            </FormField>
            <FormField
              label="Prénom(s)"
              htmlFor="firstName"
              required
              error={errors.firstName?.message}
            >
              <Input id="firstName" {...register('firstName')} />
            </FormField>
          </div>

          <FormField label="Fonction" htmlFor="role" required error={errors.role?.message}>
            <Input
              id="role"
              placeholder="Ex : Enseignant, Comptable, Surveillant..."
              {...register('role')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Téléphone" htmlFor="phone" error={errors.phone?.message}>
              <Input id="phone" {...register('phone')} />
            </FormField>
            <FormField
              label="Salaire mensuel"
              htmlFor="monthlySalary"
              required
              error={errors.monthlySalary?.message}
            >
              <Controller
                control={control}
                name="monthlySalary"
                render={({ field }) => (
                  <MoneyInput id="monthlySalary" value={field.value} onChange={field.onChange} />
                )}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enregistrement...' : employee ? 'Enregistrer' : "Créer l'employé"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
