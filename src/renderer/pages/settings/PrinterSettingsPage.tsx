import { useEffect, useState, type FormEvent } from 'react'
import { Printer, Save, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
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
import { FormField } from '@renderer/components/forms/FormField'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import type { PrinterConfig, PrinterConnectionType } from '@shared/types/printer.types'

const EMPTY_CONFIG: PrinterConfig = {
  enabled: false,
  connectionType: 'network',
  devicePath: null,
  host: null,
  port: 9100,
  lastTestAt: null,
  lastTestSuccess: null,
  lastTestMessage: null
}

export function PrinterSettingsPage(): JSX.Element {
  const { toast } = useToast()

  const [config, setConfig] = useState<PrinterConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.printer
      .getConfig()
      .then(setConfig)
      .catch(() => setError("Échec du chargement de la configuration de l'imprimante."))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (config.connectionType === 'network' && !config.host?.trim()) {
      setError("L'adresse de l'imprimante réseau est requise.")
      return
    }
    if (config.connectionType === 'usb' && !config.devicePath?.trim()) {
      setError("Le port de l'imprimante USB est requis (ex: \\\\.\\COM3).")
      return
    }

    setSaving(true)
    try {
      const updated = await api.printer.updateConfig({
        enabled: config.enabled,
        connectionType: config.connectionType,
        devicePath: config.devicePath,
        host: config.host,
        port: config.port
      })
      setConfig(updated)
      toast({ title: 'Configuration enregistrée', description: "Les réglages de l'imprimante ont été mis à jour." })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setError(null)
    try {
      const status = await api.printer.testConnection()
      const refreshed = await api.printer.getConfig()
      setConfig(refreshed)

      if (status.connected) {
        toast({ title: 'Connexion réussie', description: "Un ticket de test a été envoyé à l'imprimante." })
      } else {
        toast({
          title: 'Échec de la connexion',
          description: refreshed.lastTestMessage ?? "L'imprimante n'a pas répondu.",
          variant: 'destructive'
        })
      }
    } catch (err) {
      toast({
        title: 'Échec du test',
        description: err instanceof Error ? err.message : 'Erreur inattendue.',
        variant: 'destructive'
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Printer className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Impression thermique des reçus de paiement (imprimante 80mm ESC/POS). Si elle est
              désactivée ou injoignable, l'application ouvre automatiquement le reçu au format PDF.
            </p>
          </div>
          {config.lastTestSuccess !== null && (
            <Badge variant={config.lastTestSuccess ? 'success' : 'destructive'} className="shrink-0 gap-1">
              {config.lastTestSuccess ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {config.lastTestSuccess ? 'Connectée' : 'Non connectée'}
            </Badge>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Impression thermique activée</p>
              <p className="text-xs text-muted-foreground">
                Décochez pour toujours utiliser le reçu PDF, même si une imprimante est configurée.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type de connexion" htmlFor="printer-connection-type">
              <Select
                value={config.connectionType}
                onValueChange={(value) =>
                  setConfig({ ...config, connectionType: value as PrinterConnectionType })
                }
              >
                <SelectTrigger id="printer-connection-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">Réseau (Ethernet / Wi-Fi)</SelectItem>
                  <SelectItem value="usb">USB (port local)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {config.connectionType === 'network' ? (
              <>
                <FormField label="Adresse IP" htmlFor="printer-host" required>
                  <Input
                    id="printer-host"
                    value={config.host ?? ''}
                    onChange={(e) => setConfig({ ...config, host: e.target.value || null })}
                    placeholder="Ex: 192.168.1.50"
                  />
                </FormField>
                <FormField label="Port TCP" htmlFor="printer-port" hint="9100 par défaut (port RAW standard).">
                  <Input
                    id="printer-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: Number(e.target.value) || 9100 })}
                  />
                </FormField>
              </>
            ) : (
              <FormField
                label="Port de l'imprimante"
                htmlFor="printer-device-path"
                required
                hint="Chemin du port local, ex: \\.\COM3 (voir Gestionnaire de périphériques Windows)."
                className="sm:col-span-2"
              >
                <Input
                  id="printer-device-path"
                  value={config.devicePath ?? ''}
                  onChange={(e) => setConfig({ ...config, devicePath: e.target.value || null })}
                  placeholder="Ex: \\.\COM3"
                />
              </FormField>
            )}
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          {config.lastTestAt && (
            <p className="text-xs text-muted-foreground">
              Dernier test : {new Date(config.lastTestAt).toLocaleString('fr-FR')}
              {!config.lastTestSuccess && config.lastTestMessage ? ` — ${config.lastTestMessage}` : ''}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" disabled={testing} onClick={handleTest} className="gap-1.5">
              <Printer className="h-4 w-4" />
              {testing ? 'Test en cours...' : "Tester l'impression"}
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
