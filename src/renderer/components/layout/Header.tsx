import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, KeyRound, LogOut, Plus, School } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { TopNav } from './TopNav'
import { ChangePasswordDialog } from '@renderer/components/auth/ChangePasswordDialog'
import { useAuthStore } from '@renderer/stores/auth.store'
import { useSettingsStore } from '@renderer/stores/settings.store'
import logo from '@renderer/assets/logo.png'

export function Header(): JSX.Element {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { currentSchoolYear, loadCurrentSchoolYear } = useSettingsStore()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  useEffect(() => {
    // Squelette tant que l'année scolaire n'existe pas encore (premier lancement en cours
    // d'initialisation) : on tolère l'échec sans bloquer l'en-tête.
    loadCurrentSchoolYear().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-8">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logo} alt="AcademyFlow" className="h-8 w-8" />
          <span className="text-lg font-semibold text-gray-900">AcademyFlow</span>
        </Link>
        <TopNav />
      </div>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nouveau
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/students/new">Nouvel élève</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/cashbox/new">Nouvelle opération de caisse</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {currentSchoolYear && (
          <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground md:flex">
            <School className="h-3.5 w-3.5" />
            {currentSchoolYear.label}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Aucune notification</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {(user?.fullName ?? 'U').charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-sm font-medium sm:inline">
                {user?.fullName ?? 'Utilisateur'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.username ?? 'Non connecté'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Changer le mot de passe
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </header>
  )
}
