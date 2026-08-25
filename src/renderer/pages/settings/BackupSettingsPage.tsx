import { useEffect, useState } from 'react'
import { Cloud, CloudUpload, RotateCcw, Unlink, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Separator } from '@renderer/components/ui/separator'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import type { BackupAccountStatus, BackupHistoryEntry } from '@shared/types/backup.types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function BackupSettingsPage(): JSX.Element {
  const { toast } = useToast()

  const [status, setStatus] = useState<BackupAccountStatus | null>(null)
  const [history, setHistory] = useState<BackupHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<BackupHistoryEntry | null>(null)

  const refresh = async (): Promise<void> => {
    const [nextStatus, nextHistory] = await Promise.all([api.backup.getStatus(), api.backup.listBackups()])
    setStatus(nextStatus)
    setHistory(nextHistory)
  }

  useEffect(() => {
    refresh()
      .catch(() =>
        toast({
          title: 'Échec du chargement',
          description: 'Impossible de charger le statut de la sauvegarde cloud.',
          variant: 'destructive'
        })
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = async (): Promise<void> => {
    setConnecting(true)
    try {
      await api.backup.connectGoogleAccount()
      await refresh()
      toast({ title: 'Compte Google connecté', description: 'La sauvegarde cloud est prête à être utilisée.' })
    } catch (err) {
      toast({
        title: 'Échec de la connexion',
        description: err instanceof Error ? err.message : 'Erreur inattendue.',
        variant: 'destructive'
      })
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (): Promise<void> => {
    await api.backup.disconnectGoogleAccount()
    await refresh()
    toast({ title: 'Compte déconnecté', description: "La sauvegarde automatique a été désactivée." })
  }

  const handleExportNow = async (): Promise<void> => {
    setExporting(true)
    try {
      const result = await api.backup.exportToCloud()
      await refresh()
      if (result.success) {
        toast({ title: 'Sauvegarde envoyée', description: result.fileName ?? 'La sauvegarde a été envoyée sur Google Drive.' })
      } else {
        toast({ title: 'Échec de la sauvegarde', description: result.message, variant: 'destructive' })
      }
    } finally {
      setExporting(false)
    }
  }

  const handleToggleAuto = async (autoBackupEnabled: boolean): Promise<void> => {
    const updated = await api.backup.updateSettings({ autoBackupEnabled })
    setStatus(updated)
  }

  const handleChangeHour = async (autoBackupHour: number): Promise<void> => {
    const updated = await api.backup.updateSettings({ autoBackupHour })
    setStatus(updated)
  }

  const handleRestore = async (): Promise<void> => {
    if (!restoreTarget) return
    const result = await api.backup.restoreFromCloud(restoreTarget.id)
    if (result.success) {
      toast({
        title: 'Restauration en cours',
        description: "L'application va redémarrer pour finaliser la restauration."
      })
    } else {
      toast({ title: 'Échec de la restauration', description: result.message, variant: 'destructive' })
    }
  }

  if (loading || !status) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Cloud className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-gray-900">Compte Google Drive</p>
                <p className="text-sm text-muted-foreground">
                  {status.connected
                    ? `Connecté en tant que ${status.accountEmail}.`
                    : "Connectez un compte Google pour activer la sauvegarde cloud des données de l'établissement."}
                </p>
              </div>
            </div>
            <Badge variant={status.connected ? 'success' : 'secondary'} className="shrink-0 gap-1">
              {status.connected ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {status.connected ? 'Connecté' : 'Non connecté'}
            </Badge>
          </div>

          <div className="flex justify-end gap-2">
            {status.connected ? (
              <Button type="button" variant="outline" onClick={handleDisconnect} className="gap-1.5">
                <Unlink className="h-4 w-4" />
                Déconnecter
              </Button>
            ) : (
              <Button type="button" disabled={connecting} onClick={handleConnect} className="gap-1.5">
                <Cloud className="h-4 w-4" />
                {connecting ? 'Connexion en cours...' : 'Connexion au compte Google'}
              </Button>
            )}
          </div>

          {status.connected && (
            <>
              <Separator />

              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">Sauvegarde automatique quotidienne</p>
                  <p className="text-xs text-muted-foreground">
                    Une sauvegarde est envoyée chaque jour à l'heure choisie, sans intervention manuelle.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {status.autoBackupEnabled && (
                    <Select
                      value={String(status.autoBackupHour)}
                      onValueChange={(value) => handleChangeHour(Number(value))}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HOURS.map((hour) => (
                          <SelectItem key={hour} value={String(hour)}>
                            {hour.toString().padStart(2, '0')}h00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Switch checked={status.autoBackupEnabled} onCheckedChange={handleToggleAuto} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  {status.lastBackupAt ? (
                    <p className="text-xs text-muted-foreground">
                      Dernière sauvegarde : {new Date(status.lastBackupAt).toLocaleString('fr-FR')}
                      {status.lastBackupStatus === 'error' && status.lastBackupMessage
                        ? ` — ${status.lastBackupMessage}`
                        : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune sauvegarde envoyée pour le moment.</p>
                  )}
                </div>
                <Button type="button" disabled={exporting} onClick={handleExportNow} className="gap-1.5">
                  <CloudUpload className="h-4 w-4" />
                  {exporting ? 'Envoi en cours...' : 'Sauvegarder maintenant'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {status.connected && (
        <Card>
          <CardContent className="p-6">
            <p className="mb-4 text-sm font-medium text-gray-900">
              Historique des sauvegardes ({history.length}/7 conservées)
            </p>
            {history.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Aucune sauvegarde disponible.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{entry.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString('fr-FR')} · {formatBytes(entry.sizeBytes)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setRestoreTarget(entry)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        title="Restaurer cette sauvegarde ?"
        description={
          restoreTarget
            ? `Toutes les données actuelles seront remplacées par la sauvegarde du ${new Date(restoreTarget.createdAt).toLocaleString('fr-FR')}. Une copie de sécurité de l'état actuel sera conservée localement. L'application redémarrera pour finaliser l'opération.`
            : ''
        }
        confirmLabel="Restaurer"
        variant="destructive"
        onConfirm={handleRestore}
      />
    </div>
  )
}
