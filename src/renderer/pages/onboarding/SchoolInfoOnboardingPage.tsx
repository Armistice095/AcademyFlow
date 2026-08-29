import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Landmark, Info, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { FormField } from '@renderer/components/forms/FormField'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import { api } from '@renderer/lib/ipc'

/** Étape 2/6 de l'onboarding — informations sur l'établissement. */
export function SchoolInfoOnboardingPage(): JSX.Element {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.settings.updateSchoolInfo({
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null
      })
      navigate('/onboarding/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep="school"
      title="Configurez votre établissement"
      description="Ces informations seront utilisées dans AcademyFlow et sur vos documents officiels."
      illustration={
        <>
          <Landmark />
          <span>Établissement</span>
        </>
      }
      footerNote="Vos informations sont sécurisées et ne seront jamais partagées."
    >
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <Landmark className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Informations sur votre établissement
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm text-muted-foreground">
          Renseignez les informations principales de votre établissement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <FormField label="Nom de l'établissement" htmlFor="name" required>
          <Input
            id="name"
            autoFocus
            placeholder="Ex : Collège les Oliviers"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Adresse" htmlFor="address" required>
            <Input
              id="address"
              placeholder="Ex : 123, Avenue de l'Éducation, Cotonou"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Téléphone" htmlFor="phone" required>
            <Input
              id="phone"
              type="tel"
              placeholder="Ex : +229 97 12 34 56"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </FormField>
        </div>

        <FormField label="Adresse e-mail" htmlFor="email" required>
          <Input
            id="email"
            type="email"
            placeholder="Ex : contact@moncollege.edu.bj"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </FormField>

        <div className="flex items-start gap-3 rounded-lg bg-accent-500/10 px-4 py-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Pourquoi ces informations ?</p>
            <p className="text-xs text-muted-foreground">
              Elles apparaîtront sur vos documents (bulletins, reçus, rapports, etc.) et permettront
              à vos contacts de vous joindre facilement.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-6">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/onboarding/license')}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <Button type="submit" className="gap-2" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Continuer'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
