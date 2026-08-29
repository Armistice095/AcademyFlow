import * as React from 'react'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

export interface DatePickerFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> {
  /** Valeur au format ISO `yyyy-MM-dd`. */
  value: string
  onChange: (value: string) => void
}

/**
 * Sélecteur de date — s'appuie sur `<input type="date">` (widget natif Chromium),
 * pour rester léger et cohérent avec le stockage ISO 8601 des dates en base.
 * À combiner avec `FormField` pour le label/erreur.
 */
const DatePickerField = React.forwardRef<HTMLInputElement, DatePickerFieldProps>(
  ({ value, onChange, className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn('font-mono', className)}
        {...props}
      />
    )
  }
)
DatePickerField.displayName = 'DatePickerField'

export { DatePickerField }
