import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { cn } from '@renderer/lib/utils'

export interface SearchInputProps {
  placeholder?: string
  defaultValue?: string
  /** Appelé après `delay` ms sans frappe. */
  onSearch: (query: string) => void
  delay?: number
  className?: string
}

/** Champ de recherche avec icône et debounce — évite de déclencher une requête à chaque frappe. */
export function SearchInput({
  placeholder = 'Rechercher...',
  defaultValue = '',
  onSearch,
  delay = 300,
  className
}: SearchInputProps): JSX.Element {
  const [value, setValue] = React.useState(defaultValue)
  const debouncedValue = useDebounce(value, delay)

  React.useEffect(() => {
    onSearch(debouncedValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue])

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  )
}
