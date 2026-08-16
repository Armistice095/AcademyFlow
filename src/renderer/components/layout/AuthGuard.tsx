import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@renderer/stores/auth.store'
import { ChangePasswordDialog } from '@renderer/components/auth/ChangePasswordDialog'
import logo from '@renderer/assets/logo.png'
import { AUTO_LOCK_TIMEOUT_MS } from '@shared/constants/defaults'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'click'] as const

function FullScreenLoader(): JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <img src={logo} alt="AcademyFlow" className="h-14 w-14 animate-pulse" />
    </div>
  )
}

/**
 * Protège l'arbre de routes qu'elle englobe : redirige vers `/login` si non
 * connecté, verrouille automatiquement la session après {@link AUTO_LOCK_TIMEOUT_MS}
 * d'inactivité, et bloque l'accès tant que le mot de passe par défaut n'a pas
 * été changé (F-004.5).
 */
export function AuthGuard(): JSX.Element {
  const { user, status, refreshCurrentUser, logout } = useAuthStore()
  const navigate = useNavigate()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (status === 'idle') void refreshCurrentUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    if (status !== 'authenticated') return

    const resetTimer = (): void => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        void logout().then(() => navigate('/login', { replace: true }))
      }, AUTO_LOCK_TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [status, logout, navigate])

  if (status === 'idle' || status === 'loading') {
    return <FullScreenLoader />
  }

  if (status !== 'authenticated' || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.mustChangePassword) {
    return <ChangePasswordDialog open forced />
  }

  return <Outlet />
}
