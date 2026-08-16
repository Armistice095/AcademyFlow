import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { FormField } from '@renderer/components/forms/FormField'
import { api } from '@renderer/lib/ipc'
import { useAuthStore } from '@renderer/stores/auth.store'

export interface ChangePasswordDialogProps {
  open: boolean
  /** En mode forcé (premier login), pas de bouton d'annulation possible. */
  forced?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
}

export function ChangePasswordDialog({
  open,
  forced = false,
  onOpenChange,
  onSuccess
}: ChangePasswordDialogProps): JSX.Element {
  const markPasswordChanged = useAuthStore((state) => state.markPasswordChanged)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = (): void => {
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('La confirmation ne correspond pas au nouveau mot de passe.')
      return
    }
    if (newPassword.length < 6) {
      setError('Le nouveau mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setSubmitting(true)
    try {
      await api.auth.changePassword(oldPassword, newPassword)
      markPasswordChanged()
      reset()
      onSuccess?.()
      onOpenChange?.(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec du changement de mot de passe.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={forced ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-sm"
        onInteractOutside={forced ? (event) => event.preventDefault() : undefined}
        onEscapeKeyDown={forced ? (event) => event.preventDefault() : undefined}
        showCloseButton={!forced}
      >
        <DialogHeader>
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogDescription>
            {forced
              ? 'Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.'
              : 'Modifiez votre mot de passe de connexion.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Mot de passe actuel" htmlFor="oldPassword" required>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoFocus
              required
            />
          </FormField>
          <FormField label="Nouveau mot de passe" htmlFor="newPassword" required hint="Au moins 6 caractères.">
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Confirmer le nouveau mot de passe" htmlFor="confirmPassword" required>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </FormField>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            {!forced && (
              <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
