import type { LucideIcon } from 'lucide-react'
import { GraduationCap, LayoutDashboard, Settings, Users, Wallet } from 'lucide-react'

export interface NavChild {
  label: string
  path: string
}

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  children?: NavChild[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Tableau de bord',
    path: '/dashboard',
    icon: LayoutDashboard
  },
  {
    label: 'Élèves',
    path: '/students',
    icon: GraduationCap,
    children: [
      { label: 'Liste des élèves', path: '/students' },
      { label: 'Nouvelle inscription', path: '/students/new' },
      { label: 'Passage de classe', path: '/students/promotion' }
    ]
  },
  {
    label: 'Caisse',
    path: '/cashbox',
    icon: Wallet,
    children: [
      { label: 'Journal de caisse', path: '/cashbox' },
      { label: 'Nouvelle opération', path: '/cashbox/new' },
      { label: 'Rapports', path: '/cashbox/reports' }
    ]
  },
  {
    label: 'Personnel',
    path: '/personnel',
    icon: Users,
    children: [
      { label: 'Liste du personnel', path: '/personnel' },
      { label: 'Suivi des salaires', path: '/personnel/salaries' }
    ]
  },
  {
    label: 'Paramètres',
    path: '/settings',
    icon: Settings
  }
]
