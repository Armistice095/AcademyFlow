import { useEffect, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useReportsStore } from '@renderer/stores/reports.store'
import { api } from '@renderer/lib/ipc'
import { REPORT_PERIOD_LABELS, type ReportPeriod } from '@renderer/lib/reportPeriod'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type { UserAccount } from '@shared/types/user.types'

const ALL = '__all__'

/** Ligne de filtres partagée par les 6 onglets de la page Rapports (portée par `reports.store.ts`). */
export function ReportFilterBar(): JSX.Element {
  const { classes, loadClasses } = useSettingsStore()
  const { filters, setFilters, resetFilters, loadReport } = useReportsStore()
  const [cashiers, setCashiers] = useState<UserAccount[]>([])

  useEffect(() => {
    void loadClasses()
    api.auth
      .listUsers()
      .then((users) => setCashiers(users.filter((u) => u.isActive)))
      .catch(() => setCashiers([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.classId, filters.category, filters.userId])

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Période">
          <Select
            value={filters.period}
            onValueChange={(v) => setFilters({ period: v as ReportPeriod })}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REPORT_PERIOD_LABELS) as ReportPeriod[]).map((period) => (
                <SelectItem key={period} value={period}>
                  {REPORT_PERIOD_LABELS[period]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Du">
          <Input
            type="date"
            value={filters.from}
            disabled={filters.period !== 'custom'}
            onChange={(e) => setFilters({ from: e.target.value })}
            className="w-40"
          />
        </FilterField>

        <FilterField label="Au">
          <Input
            type="date"
            value={filters.to}
            disabled={filters.period !== 'custom'}
            onChange={(e) => setFilters({ to: e.target.value })}
            className="w-40"
          />
        </FilterField>

        <FilterField label="Classe">
          <Select
            value={filters.classId ?? ALL}
            onValueChange={(v) => setFilters({ classId: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Type de frais">
          <Select
            value={filters.category ?? ALL}
            onValueChange={(v) =>
              setFilters({ category: v === ALL ? undefined : (v as CashCategory) })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {Object.entries(CASH_CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Caissier">
          <Select
            value={filters.userId ?? ALL}
            onValueChange={(v) => setFilters({ userId: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {cashiers.map((cashier) => (
                <SelectItem key={cashier.id} value={cashier.id}>
                  {cashier.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={resetFilters}>
        <RotateCcw className="h-3.5 w-3.5" />
        Réinitialiser les filtres
      </Button>
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
