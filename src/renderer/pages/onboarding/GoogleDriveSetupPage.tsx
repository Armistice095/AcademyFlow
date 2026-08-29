import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CloudUpload, ShieldCheck, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import { useLicenseStore } from '@renderer/stores/license.store'
import { api } from '@renderer/lib/ipc'

/**
 * Étape 6/6 de l'onboarding — connexion Google Drive, optionnelle (voir
 * discussion produit : l'OAuth peut échouer pour des raisons hors du
 * contrôle de l'utilisateur, ça ne doit jamais bloquer la fin de l'assistant).
 */
export function GoogleDriveSetupPage(): JSX.Element {
  const navigate = useNavigate()
  const { markOnboardingCompleted } = useLicenseStore()

  const [connecting, setConnecting] = useState(false)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)

  const finishOnboarding = async (): Promise<void> => {
    setFinishing(true)
    try {
      await markOnboardingCompleted()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la finalisation de la configuration.')
      setFinishing(false)
    }
  }

  const handleConnect = async (): Promise<void> => {
    setError(null)
    setConnecting(true)
    try {
      const status = await api.backup.connectGoogleAccount()
      if (status.connected) {
        setConnectedEmail(status.accountEmail)
      } else {
        setError('La connexion à Google Drive a échoué. Vous pourrez réessayer depuis Paramètres.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de se connecter à Google Drive pour le moment.'
      )
    } finally {
      setConnecting(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep="drive"
      title="Protégez vos données"
      description="Connectez un compte Google Drive pour sauvegarder automatiquement vos données. Cette étape est optionnelle."
      illustration={
        <>
          <CloudUpload />
          <span>Sauvegarde</span>
        </>
      }
    >
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <CloudUpload className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Connectez votre Google Drive
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm text-muted-foreground">
          AcademyFlow pourra sauvegarder automatiquement vos données sur votre propre Google Drive.
          Vous pouvez ignorer cette étape et la configurer plus tard depuis Paramètres.
        </p>
      </div>

      <div className="mt-8">
        {connectedEmail ? (
          <div className="flex items-center gap-3 rounded-lg bg-success/10 px-4 py-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-gray-900">Compte connecté</p>
              <p className="text-xs text-muted-foreground">{connectedEmail}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-lg bg-accent-500/10 px-4 py-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Vos données restent les vôtres
                </p>
                <p className="text-xs text-muted-foreground">
                  AcademyFlow n’accède qu’aux fichiers qu’il crée lui-même sur votre Drive, jamais
                  au reste de votre compte.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="lg"
              className="mt-5 w-full gap-2"
              onClick={() => void handleConnect()}
              disabled={connecting}
            >
              <CloudUpload className="h-4 w-4" />
              {connecting ? 'Connexion en cours...' : 'Connecter Google Drive'}
            </Button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => navigate('/onboarding/school-year')}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex items-center gap-2">
          {!connectedEmail && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void finishOnboarding()}
              disabled={finishing}
            >
              Configurer plus tard
            </Button>
          )}
          <Button
            type="button"
            className="gap-2"
            onClick={() => void finishOnboarding()}
            disabled={finishing}
          >
            {finishing ? 'Finalisation...' : 'Terminer'}
            {!finishing && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </OnboardingLayout>
  )
}
