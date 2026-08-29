/** Types partagés Main ↔ Renderer du domaine Utilisateurs (Phase 9.4, onglet « Utilisateurs »). */

/** Vue sanitisée d'un compte utilisateur — jamais `passwordHash`. */
export interface UserAccount {
  id: string
  username: string
  fullName: string
  /** Désactivation sans suppression physique (cohérent avec BR-006). */
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  lastLogin: string | null
}

export interface CreateUserDTO {
  username: string
  password: string
  fullName: string
  /** Réservé à l'onboarding — voir `CreateUserInput` dans auth.service.ts. */
  skipMustChangePassword?: boolean
}

export interface UpdateUserDTO {
  fullName?: string
  username?: string
}
