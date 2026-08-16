import type { ReactNode } from 'react'
import { SearchInput } from '@renderer/components/forms/SearchInput'

export interface DataTableToolbarProps {
  onSearch?: (query: string) => void
  searchPlaceholder?: string
  /** Filtres additionnels (Select, etc.), alignés à droite de la recherche. */
  filters?: ReactNode
  /** Action principale (ex: bouton "Nouveau"), alignée tout à droite. */
  action?: ReactNode
}

export function DataTableToolbar({
  onSearch,
  searchPlaceholder,
  filters,
  action
}: DataTableToolbarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {onSearch && (
          <SearchInput onSearch={onSearch} placeholder={searchPlaceholder} className="w-full max-w-xs" />
        )}
        {filters}
      </div>
      {action}
    </div>
  )
}
