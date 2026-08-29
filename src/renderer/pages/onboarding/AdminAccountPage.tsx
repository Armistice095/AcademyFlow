import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserCog, Eye, EyeOff, Check, X, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { FormField } from '@renderer/components/forms/FormField'
import { OnboardingLayout } from '@renderer/components/onboarding/OnboardingLayout'
import { cn } from '@renderer/lib/utils'
import { api } from '@renderer/lib/ipc'

interface PasswordRequirement {
  label: string
  test: (password: string) => boolean
}

/**
 * Exigences volontairement plus strictes que le minimum global de l'app
 * (6 caractères, voir auth.service.ts) : c'est le compte super-administrateur
 * qui protège l'ensemble de l'établissement, ça justifie un mot de passe
 * plus robuste dès sa création.
 */
const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'Au moins 8 caractères', test: (p) => p.length >= 8 },
  { label: 'Une lettre majuscule', test: (p) => /[A-Z]/.test(p) },
  { label: 'Une lettre minuscule', test: (p) => /[a-z]/.test(p) },
  { label: 'Au moins un chiffre', test: (p) => /\d/.test(p) },
  { label: 'Un caractère spécial (ex: !@#)', test: (p) => /[^A-Za-z0-9]/.test(p) }
]

/** Étape 3/6 de l'onboarding — création du compte super-administrateur. */
export function AdminAccountPage(): JSX.Element {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requirementResults = useMemo(
    () => PASSWORD_REQUIREMENTS.map((req) => ({ ...req, met: req.test(password) })),
    [password]
  )
  const allRequirementsMet = requirementResults.every((r) => r.met)
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword
  const canSubmit = username.trim().length > 0 && allRequirementsMet && passwordsMatch

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)

    if (!allRequirementsMet) {
      setError('Le mot de passe ne respecte pas toutes les exigences ci-dessous.')
      return
    }
    if (!passwordsMatch) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setSaving(true)
    try {
      // `fullName` n'est pas demandé à cette étape (voir maquette) : le nom
      // d'utilisateur sert de nom complet par défaut, modifiable ensuite
      // depuis Paramètres > Utilisateurs.
      await api.auth.createUser({
        username: username.trim(),
        password,
        fullName: username.trim(),
        skipMustChangePassword: true
      })
      navigate('/onboarding/classes')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la création du compte.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep="admin"
      title="Créez votre compte administrateur"
      description="Ce compte vous permettra d'accéder à AcademyFlow et de gérer toutes les fonctionnalités de votre établissement."
      illustration={
        <>
          <UserCog />
          <span>Compte administrateur</span>
        </>
      }
      footerNote="Vos informations sont sécurisées et chiffrées."
    >
      <div>
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900">
          <UserCog className="h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          Informations du compte administrateur
        </h2>
        <p className="mt-1.5 pl-[30px] text-sm text-muted-foreground">
          Vous serez le super administrateur de votre établissement. Assurez-vous de choisir un mot
          de passe sécurisé.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <FormField label="Nom d'utilisateur" htmlFor="username" required>
          <Input
            id="username"
            autoFocus
            autoComplete="username"
            placeholder="Ex : admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Mot de passe" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Entrez votre mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>

        <FormField label="Confirmer le mot de passe" htmlFor="confirmPassword" required>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirmez votre mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pr-9"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && !passwordsMatch && (
            <p className="text-xs font-medium text-destructive">
              Les mots de passe ne correspondent pas.
            </p>
          )}
        </FormField>

        <div
          className={cn(
            'rounded-lg px-4 py-3 transition-colors',
            allRequirementsMet ? 'bg-success/10' : 'bg-gray-50'
          )}
        >
          <p
            className={cn(
              'mb-2 text-sm font-semibold',
              allRequirementsMet ? 'text-success' : 'text-gray-700'
            )}
          >
            Exigences du mot de passe
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {requirementResults.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                {req.met ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                )}
                <span className={req.met ? 'text-gray-700' : 'text-muted-foreground'}>
                  {req.label}
                </span>
              </div>
            ))}
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
            onClick={() => navigate('/onboarding/school')}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <Button type="submit" className="gap-2" disabled={saving || !canSubmit}>
            {saving ? 'Création...' : 'Continuer'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </OnboardingLayout>
  )
}
