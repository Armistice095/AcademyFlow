import { Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { NAV_ITEMS } from './nav-config'
import { cn } from '@renderer/lib/utils'

/** Barre de navigation principale — un lien direct par item, ou un dropdown si sous-menus. */
export function TopNav(): JSX.Element {
  const location = useLocation()

  const isActive = (path: string): boolean =>
    path === '/dashboard' ? location.pathname === path : location.pathname.startsWith(path)

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.path)
        const Icon = item.icon

        if (!item.children) {
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        }

        return (
          <DropdownMenu key={item.path}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none',
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {item.children.map((child) => (
                <DropdownMenuItem key={child.path} asChild>
                  <Link to={child.path}>{child.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </nav>
  )
}
