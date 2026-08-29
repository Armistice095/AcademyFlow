import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { KeyRound, MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { DataTable } from '@renderer/components/data-table/DataTable'
import { FormField } from '@renderer/components/forms/FormField'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import type { UserAccount } from '@shared/types/user.types'
import type { AuthUser } from '@shared/types/common.types'

interface UserFormState {
  username: string
  fullName: string
  password: string
}

const EMPTY_FORM: UserFormState = { username: '', fullName: '', password: '' }

export function UsersSettingsPage(): JSX.Element {
  const { toast } = useToast()

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [users, setUsers] = useState<UserAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [userToToggle, setUserToToggle] = useState<UserAccount | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<{
    user: UserAccount
    password: string
  } | null>(null)

  const loadUsers = async (): Promise<void> => {
    const [list, me] = await Promise.all([api.auth.listUsers(), api.auth.getCurrentUser()])
    setUsers(list)
    setCurrentUser(me)
  }

  useEffect(() => {
    setIsLoading(true)
    loadUsers()
      .catch(() =>
        toast({
          title: 'Échec du chargement',
          description: 'Impossible de charger les comptes utilisateurs.',
          variant: 'destructive'
        })
      )
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = (): void => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  const handleEdit = (user: UserAccount): void => {
    setEditingUser(user)
    setForm({ username: user.username, fullName: user.fullName, password: '' })
    setFormError(null)
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setFormError(null)

    if (!form.fullName.trim() || !form.username.trim()) {
      setFormError("Le nom complet et le nom d'utilisateur sont requis.")
      return
    }
    if (!editingUser && form.password.length < 6) {
      setFormError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setSubmitting(true)
    try {
      if (editingUser) {
        await api.auth.updateUser(editingUser.id, {
          fullName: form.fullName.trim(),
          username: form.username.trim()
        })
        toast({ title: 'Compte modifié', description: `${form.fullName} a été mis à jour.` })
      } else {
        await api.auth.createUser({
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          password: form.password
        })
        toast({
          title: 'Compte créé',
          description: `${form.fullName} peut désormais se connecter.`
        })
      }
      setFormOpen(false)
      await loadUsers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Échec de l'enregistrement.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (): Promise<void> => {
    if (!userToToggle) return
    try {
      await api.auth.setUserActive(userToToggle.id, !userToToggle.isActive)
      toast({
        title: userToToggle.isActive ? 'Compte désactivé' : 'Compte réactivé',
        description: `${userToToggle.fullName} ${userToToggle.isActive ? 'ne peut plus se connecter.' : 'peut de nouveau se connecter.'}`
      })
      await loadUsers()
    } catch (err) {
      toast({
        title: "Échec de l'opération",
        description: err instanceof Error ? err.message : 'Erreur inattendue.',
        variant: 'destructive'
      })
    }
  }

  const handleResetPassword = async (user: UserAccount): Promise<void> => {
    const { temporaryPassword: password } = await api.auth.resetPassword(user.id)
    setTemporaryPassword({ user, password })
  }

  const columns = useMemo<ColumnDef<UserAccount>[]>(
    () => [
      { accessorKey: 'fullName', header: 'Nom complet' },
      { accessorKey: 'username', header: "Nom d'utilisateur" },
      {
        accessorKey: 'isActive',
        header: 'Statut',
        cell: ({ row }) =>
          row.original.isActive ? (
            <Badge variant="success">Actif</Badge>
          ) : (
            <Badge variant="secondary">Désactivé</Badge>
          )
      },
      {
        accessorKey: 'lastLogin',
        header: 'Dernière connexion',
        cell: ({ row }) =>
          row.original.lastLogin ? new Date(row.original.lastLogin).toLocaleString('fr-FR') : '—'
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const user = row.original
          const isSelf = currentUser?.id === user.id
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(user)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifier
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Réinitialiser le mot de passe
                </DropdownMenuItem>
                {user.isActive ? (
                  <DropdownMenuItem
                    disabled={isSelf}
                    onClick={() => setUserToToggle(user)}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    {isSelf ? 'Désactiver (impossible pour soi-même)' : 'Désactiver'}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setUserToToggle(user)}>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Réactiver
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      }
    ],
    [currentUser]
  )

  const activeCount = users.filter((u) => u.isActive).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {activeCount} compte{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}
        </div>
        <Button onClick={handleCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nouvel utilisateur
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        hidePagination
        emptyMessage="Aucun compte utilisateur."
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Modifier le compte' : 'Nouveau compte utilisateur'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Modifiez le nom ou l'identifiant de connexion de ce compte."
                : "Ce compte aura accès à l'ensemble des modules de l'application (voir décision produit : pas de gestion différenciée des rôles)."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Nom complet" htmlFor="user-full-name" required>
              <Input
                id="user-full-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Ex: Awa Koffi"
              />
            </FormField>
            <FormField label="Nom d'utilisateur" htmlFor="user-username" required>
              <Input
                id="user-username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Ex: akoffi"
              />
            </FormField>
            {!editingUser && (
              <FormField
                label="Mot de passe initial"
                htmlFor="user-password"
                required
                hint="6 caractères minimum. L'utilisateur devra le changer à sa première connexion."
              >
                <Input
                  id="user-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </FormField>
            )}

            {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={userToToggle !== null}
        onOpenChange={(open) => !open && setUserToToggle(null)}
        title={userToToggle?.isActive ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?'}
        description={
          userToToggle?.isActive
            ? `${userToToggle?.fullName} ne pourra plus se connecter à l'application. Son historique d'opérations est conservé.`
            : `${userToToggle?.fullName} pourra de nouveau se connecter à l'application.`
        }
        confirmLabel={userToToggle?.isActive ? 'Désactiver' : 'Réactiver'}
        variant={userToToggle?.isActive ? 'destructive' : 'default'}
        onConfirm={handleToggleActive}
      />

      <Dialog
        open={temporaryPassword !== null}
        onOpenChange={(open) => !open && setTemporaryPassword(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mot de passe réinitialisé</DialogTitle>
            <DialogDescription>
              Communiquez ce mot de passe temporaire à {temporaryPassword?.user.fullName}. Il devra
              le changer dès sa prochaine connexion. Il ne sera plus affiché après la fermeture de
              cette fenêtre.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-center font-mono text-lg tracking-wider">
            {temporaryPassword?.password}
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setTemporaryPassword(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
