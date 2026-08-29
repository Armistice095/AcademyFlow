import { create } from 'zustand'
import { api } from '@renderer/lib/ipc'
import type { LicenseStatus } from '@shared/types/license.types'

export type LicenseCheckStatus = 'idle' | 'loading' | 'checked'

interface LicenseState {
  status: LicenseStatus | null
  checkStatus: LicenseCheckStatus
  /** État de la requête d'activation en cours (page 1 de l'onboarding), distinct du statut licence lui-même. */
  activating: boolean
  activationError: string | null

  /** Récupère le statut courant depuis le process main. À appeler au montage de `OnboardingGuard`. */
  refresh: () => Promise<void>
  activate: (licenseKey: string) => Promise<boolean>
  markOnboardingCompleted: () => Promise<void>
  clearActivationError: () => void
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  checkStatus: 'idle',
  activating: false,
  activationError: null,

  refresh: async () => {
    set({ checkStatus: 'loading' })
    try {
      const status = await api.license.getStatus()
      set({ status, checkStatus: 'checked' })
    } catch {
      set({ checkStatus: 'checked' })
    }
  },

  activate: async (licenseKey) => {
    set({ activating: true, activationError: null })
    try {
      const result = await api.license.activate({ licenseKey })
      if (result.success) {
        set({ status: result.status, activating: false })
        return true
      }
      set({ activating: false, activationError: result.error ?? 'Clé de licence invalide.' })
      return false
    } catch (error) {
      set({
        activating: false,
        activationError:
          error instanceof Error ? error.message : "Erreur inattendue lors de l'activation."
      })
      return false
    }
  },

  markOnboardingCompleted: async () => {
    const status = await api.license.markOnboardingCompleted()
    set({ status })
  },

  clearActivationError: () => set({ activationError: null })
}))
