import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { FormField } from '@renderer/components/forms/FormField'
import { useAuthStore } from '@renderer/stores/auth.store'
import logo from '@renderer/assets/logo.png'

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { status, error, login, clearError } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    clearError()
    const success = await login(username, password)
    if (success) navigate('/dashboard', { replace: true })
  }

  const isLoading = status === 'loading'

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-accent-400/10">
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />

      <div className="relative w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border border-white/60 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <img src={logo} alt="AcademyFlow" className="h-16 w-16" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">AcademyFlow</h1>
              <p className="text-sm text-muted-foreground">
                Connectez-vous pour accéder à votre espace de gestion.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <FormField label="Identifiant" htmlFor="username" required>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
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
                  autoComplete="current-password"
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

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="mt-2 gap-2" disabled={isLoading}>
              <LogIn className="h-4 w-4" />
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
