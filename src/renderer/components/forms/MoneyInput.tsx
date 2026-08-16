import * as React from 'react'
import { cn } from '@renderer/lib/utils'

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

/** Input pour montants en FCFA — formate le nombre avec séparateur de milliers pendant la saisie. */
const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, disabled, ...props }, ref) => {
    const displayValue = value ? new Intl.NumberFormat('fr-FR').format(value) : ''

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
      const digitsOnly = event.target.value.replace(/\D/g, '')
      onChange(digitsOnly ? Number.parseInt(digitsOnly, 10) : 0)
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-16 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono',
            className
          )}
          {...props}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          F CFA
        </span>
      </div>
    )
  }
)
MoneyInput.displayName = 'MoneyInput'

export { MoneyInput }
