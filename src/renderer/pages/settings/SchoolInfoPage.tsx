import { useEffect, useState, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import { FormField } from '@renderer/components/forms/FormField'
import { ImageUpload } from '@renderer/components/forms/ImageUpload'
import { useToast } from '@renderer/lib/use-toast'
import { api } from '@renderer/lib/ipc'
import type { SchoolInfo } from '@shared/types/settings.types'

const EMPTY_INFO: SchoolInfo = {
  name: '',
  address: null,
  phone: null,
  email: null,
  logoDataUrl: null,
  stampDataUrl: null,
  updatedAt: ''
}

export function SchoolInfoPage(): JSX.Element {
  const { toast } = useToast()

  const [info, setInfo] = useState<SchoolInfo>(EMPTY_INFO)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.settings
      .getSchoolInfo()
      .then(setInfo)
      .catch(() => setError('Échec du chargement des informations.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (!info.name.trim()) {
      setError("Le nom de l'établissement est requis.")
      return
    }

    setSaving(true)
    try {
      const updated = await api.settings.updateSchoolInfo({
        name: info.name.trim(),
        address: info.address,
        phone: info.phone,
        email: info.email,
        logoDataUrl: info.logoDataUrl,
        stampDataUrl: info.stampDataUrl
      })
      setInfo(updated)
      toast({
        title: 'Informations enregistrées',
        description: "Les informations de l'établissement ont été mises à jour."
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
  }

  return (
    <Card>
      <CardContent className="p-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Ces informations personnalisent les documents administratifs générés par l’application
          (certificats, attestations, reçus, rapports).
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Nom de l'établissement"
              htmlFor="school-name"
              required
              className="sm:col-span-2"
            >
              <Input
                id="school-name"
                value={info.name}
                onChange={(e) => setInfo({ ...info, name: e.target.value })}
                placeholder="Ex: Complexe Scolaire AcademyFlow"
                required
              />
            </FormField>

            <FormField label="Adresse" htmlFor="school-address" className="sm:col-span-2">
              <Input
                id="school-address"
                value={info.address ?? ''}
                onChange={(e) => setInfo({ ...info, address: e.target.value || null })}
                placeholder="Ex: Cotonou, Littoral, Bénin"
              />
            </FormField>

            <FormField label="Téléphone" htmlFor="school-phone">
              <Input
                id="school-phone"
                value={info.phone ?? ''}
                onChange={(e) => setInfo({ ...info, phone: e.target.value || null })}
                placeholder="Ex: +229 XX XX XX XX"
              />
            </FormField>

            <FormField label="E-mail" htmlFor="school-email">
              <Input
                id="school-email"
                type="email"
                value={info.email ?? ''}
                onChange={(e) => setInfo({ ...info, email: e.target.value || null })}
                placeholder="Ex: contact@ecole.bj"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-8 border-t border-border pt-5">
            <ImageUpload
              label="Logo de l'établissement"
              hint="PNG ou JPG, 2 Mo max."
              value={info.logoDataUrl}
              onChange={(logoDataUrl) => setInfo({ ...info, logoDataUrl })}
            />
            <ImageUpload
              label="Cachet de l'établissement"
              hint="Utilisé sur les documents officiels."
              value={info.stampDataUrl}
              onChange={(stampDataUrl) => setInfo({ ...info, stampDataUrl })}
            />
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="flex justify-end border-t border-border pt-4">
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
