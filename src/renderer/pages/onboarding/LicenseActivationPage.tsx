import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, ShieldCheck, ArrowRight, LogOut, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import {
  LicenseKeyInput,
  licenseGroupsToKey,
  EMPTY_LICENSE_GROUPS
} from '@renderer/components/onboarding/LicenseKeyInput'
import { useLicenseStore } from '@renderer/stores/license.store'

/**
 * Étape 1/6 de l'onboarding — activation de la licence.
 *
 * Parcours attendu (voir discussion produit) : l'utilisateur a déjà acheté
 * sa clé sur le site officiel AcademyFlow avant d'arriver ici. Une connexion
 * Internet est nécessaire pour cette étape précise — c'est le seul moment
 * de l'usage courant où c'est le cas (voir `license.service.ts`).
 */
export function LicenseActivationPage(): JSX.Element {
  const navigate = useNavigate()
  const { activating, activationError, activate, clearActivationError } = useLicenseStore()
  const [groups, setGroups] = useState<string[]>(EMPTY_LICENSE_GROUPS)

  const isComplete = useMemo(() => groups.every((group) => group.length === 4), [groups])

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    clearActivationError()
    const success = await activate(licenseGroupsToKey(groups))
    if (success) navigate('/onboarding/school', { replace: true })
  }

  return (
    <OnboardingLayout
      currentStep="license"
      title="Configurez votre établissement en quelques minutes"
      description="Cet assistant prépare AcademyFlow selon les besoins réels de votre établissement — licence, établissement, comptes et classes."
      illustration={
        <>
          <Sparkles />
          <span>Bienvenue sur AcademyFlow</span>
        </>
      }
      footerNote="Vos données sont sécurisées et chiffrées."
      headerAction={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => window.close()}
        >
          Quitter
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <KeyRound className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Activez votre licence
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm leading-relaxed text-muted-foreground">
          Entrez la clé reçue après votre achat pour commencer la configuration.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-8 flex animate-in fade-in slide-in-from-bottom-3 flex-col gap-4 delay-100 duration-500"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="licenseKey" className="text-sm font-medium text-gray-700">
            Clé de licence
          </label>
          <LicenseKeyInput
            groups={groups}
            onChange={setGroups}
            autoFocus
            hasError={Boolean(activationError)}
          />
        </div>

        {activationError ? (
          <div className="flex animate-in fade-in items-start gap-2 rounded-xl bg-destructive/5 px-3.5 py-2.5 text-destructive duration-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-medium">{activationError}</p>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 px-0.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
            Vérifiée en ligne — assurez-vous d’être connecté à Internet.
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="group relative mt-2 gap-2 overflow-hidden shadow-glow-primary transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          disabled={activating || !isComplete}
        >
          {activating ? 'Activation en cours…' : 'Activer ma licence'}
          {!activating && (
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          )}
        </Button>
      </form>

      <p className="mt-6 animate-in fade-in text-center text-sm text-muted-foreground delay-200 duration-500">
        Pas encore de licence ?{' '}
        <a
          href="https://academyflow.example.com/acheter"
          onClick={(e) => {
            e.preventDefault()
            window.open('https://academyflow.example.com/acheter', '_blank')
          }}
          className="font-semibold text-primary hover:underline"
        >
          Acheter sur le site officiel →
        </a>
      </p>
    </OnboardingLayout>
  )
}
