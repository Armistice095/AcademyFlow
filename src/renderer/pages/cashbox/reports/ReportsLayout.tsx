import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, FileBarChart, PieChart, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ReportFilterBar } from '@renderer/components/reports/ReportFilterBar'
import { QuickExportPanel } from '@renderer/components/reports/QuickExportPanel'

interface ReportTab {
  label: string
  path: string
  icon: typeof FileBarChart
  /** `end` évite que `/cashbox/reports` (Vue générale) reste actif sur les sous-routes. */
  end?: boolean
}

const TABS: ReportTab[] = [
  { label: 'Vue générale', path: '/cashbox/reports', icon: FileBarChart, end: true },
  { label: 'Recettes', path: '/cashbox/reports/recettes', icon: TrendingUp },
  { label: 'Dépenses', path: '/cashbox/reports/depenses', icon: TrendingDown },
  { label: 'Impayés', path: '/cashbox/reports/impayes', icon: PieChart },
  { label: 'Par classe', path: '/cashbox/reports/par-classe', icon: BarChart3 },
  { label: 'Par caissier', path: '/cashbox/reports/par-caissier', icon: Users }
]

/**
 * Layout partagé des 6 onglets de la page Rapports (module Caisse).
 * Sidebar interne + barre de filtres communs, portés par `reports.store.ts`
 * pour ne pas se réinitialiser en changeant d'onglet (voir plan §0).
 */
export function ReportsLayout(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* --- Sidebar interne ------------------------------------------- */}
      <div className="flex shrink-0 flex-col gap-4 lg:w-56">
        <div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rapports
          </p>
          <nav className="flex flex-col gap-0.5">
            {TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )
                }
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <QuickExportPanel />
      </div>

      {/* --- Zone de contenu --------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ReportFilterBar />
        <Outlet />
      </div>
    </div>
  )
}
