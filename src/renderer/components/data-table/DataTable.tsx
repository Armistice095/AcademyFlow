import * as React from 'react'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { DataTablePagination } from './DataTablePagination'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Message affiché lorsque `data` est vide. */
  emptyMessage?: string
  /** Appelé au clic sur une ligne (ex: navigation vers le détail). */
  onRowClick?: (row: TData) => void
  /** Masque la pagination (utile pour de petites listes affichées entièrement). */
  hidePagination?: boolean
  pageSize?: number
  isLoading?: boolean
  /**
   * Active la pagination "serveur" : `data` ne contient que la page courante
   * (déjà découpée côté backend). Requiert `pagination`, `onPaginationChange`
   * et `rowCount` (le nombre total de lignes, toutes pages confondues).
   */
  manualPagination?: boolean
  /** État de pagination contrôlé par le parent (0-indexé), utilisé si `manualPagination` est vrai. */
  pagination?: PaginationState
  onPaginationChange?: (pagination: PaginationState) => void
  /** Nombre total de lignes côté serveur (toutes pages confondues), pour l'affichage "X–Y sur Z". */
  rowCount?: number
}

/**
 * Table de données générique — tri par colonne (clic sur l'en-tête) et
 * pagination intégrés. Les colonnes sont définies via l'API TanStack Table
 * (`ColumnDef`), ce qui permet des rendus de cellule personnalisés (badges,
 * montants formatés, actions...) sans dupliquer la logique de table.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = 'Aucune donnée.',
  onRowClick,
  hidePagination = false,
  pageSize = 10,
  isLoading = false,
  manualPagination = false,
  pagination,
  onPaginationChange,
  rowCount
}: DataTableProps<TData, TValue>): JSX.Element {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize
  })

  const paginationState = manualPagination ? (pagination ?? internalPagination) : internalPagination

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    onSortingChange: setSorting,
    manualPagination,
    pageCount: manualPagination
      ? Math.max(1, Math.ceil((rowCount ?? 0) / paginationState.pageSize))
      : undefined,
    rowCount: manualPagination ? rowCount : undefined,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(paginationState) : updater
      if (manualPagination) {
        onPaginationChange?.(next)
      } else {
        setInternalPagination(next)
      }
    },
    state: { sorting, pagination: paginationState }
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sortDirection = header.column.getIsSorted()

                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          disabled={!canSort}
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'flex items-center gap-1.5',
                            canSort && 'cursor-pointer select-none hover:text-foreground'
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sortDirection === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : sortDirection === 'desc' ? (
                              <ArrowDown className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                            ))}
                        </button>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: paginationState.pageSize }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((_, colIndex) => (
                    <TableCell key={`skeleton-cell-${colIndex}`}>
                      {colIndex === 0 ? (
                        <Skeleton className="h-9 w-9 rounded-full" />
                      ) : (
                        <Skeleton className="h-4 w-full max-w-32" />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {!hidePagination && (manualPagination ? (rowCount ?? 0) > 0 : data.length > 0) && (
        <DataTablePagination table={table} rowCount={manualPagination ? rowCount : undefined} />
      )}
    </div>
  )
}
