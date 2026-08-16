import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbRule {
  test: (path: string) => boolean
  crumbs: Array<{ label: string; path?: string }>
}

const RULES: BreadcrumbRule[] = [
  { test: (p) => p === '/dashboard', crumbs: [{ label: 'Tableau de bord' }] },
  { test: (p) => p === '/students', crumbs: [{ label: 'Élèves' }, { label: 'Liste des élèves' }] },
  {
    test: (p) => p === '/students/new',
    crumbs: [{ label: 'Élèves', path: '/students' }, { label: 'Nouvelle inscription' }]
  },
  {
    test: (p) => p === '/students/promotion',
    crumbs: [{ label: 'Élèves', path: '/students' }, { label: 'Passage de classe' }]
  },
  {
    test: (p) => /^\/students\/[^/]+$/.test(p),
    crumbs: [{ label: 'Élèves', path: '/students' }, { label: "Détail de l'élève" }]
  },
  { test: (p) => p === '/cashbox', crumbs: [{ label: 'Caisse' }, { label: 'Journal de caisse' }] },
  {
    test: (p) => p === '/cashbox/new',
    crumbs: [{ label: 'Caisse', path: '/cashbox' }, { label: 'Nouvelle opération' }]
  },
  {
    test: (p) => p === '/cashbox/reports',
    crumbs: [{ label: 'Caisse', path: '/cashbox' }, { label: 'Rapports' }]
  },
  {
    test: (p) => /^\/cashbox\/student\/[^/]+$/.test(p),
    crumbs: [{ label: 'Caisse', path: '/cashbox' }, { label: 'Compte élève' }]
  },
  {
    test: (p) => p === '/personnel',
    crumbs: [{ label: 'Personnel' }, { label: 'Liste du personnel' }]
  },
  {
    test: (p) => p === '/personnel/salaries',
    crumbs: [{ label: 'Personnel', path: '/personnel' }, { label: 'Suivi des salaires' }]
  },
  { test: (p) => p === '/settings', crumbs: [{ label: 'Paramètres' }] }
]

/** Fil d'Ariane dérivé du chemin courant, selon une table de correspondance simple. */
export function Breadcrumbs(): JSX.Element {
  const location = useLocation()
  const rule = RULES.find((r) => r.test(location.pathname))
  const crumbs = rule?.crumbs ?? [{ label: 'Tableau de bord' }]

  return (
    <div className="flex items-center gap-1.5 border-b border-border bg-gray-50 px-6 py-2 text-sm text-muted-foreground">
      <Link to="/dashboard" className="flex items-center hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, index) => (
        <span key={index} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
          {crumb.path ? (
            <Link to={crumb.path} className="hover:text-foreground">
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}
