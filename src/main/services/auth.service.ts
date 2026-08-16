import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { users } from '@main/database/schema'
import { generateId } from '@main/database/id'
import { logAction } from './audit.service'
import type { AuthUser } from '@shared/types/common.types'

const MIN_PASSWORD_LENGTH = 6

/**
 * Session courante — en mémoire, propre au process main.
 *
 * AcademyFlow est une application desktop mono-poste, mono-session : pas de
 * jeton, pas de persistance entre redémarrages. Un redémarrage de l'app
 * réinitialise systématiquement la session (nouvel écran de connexion).
 */
let currentSessionUserId: string | null = null

function toAuthUser(row: {
  id: string
  username: string
  fullName: string
  mustChangePassword: boolean
}): AuthUser {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    mustChangePassword: row.mustChangePassword
  }
}

/**
 * Vérifie les identifiants et ouvre une session.
 * Le message d'erreur est volontairement générique (BR sécurité implicite) :
 * on ne révèle pas si c'est l'identifiant ou le mot de passe qui est incorrect.
 */
export function login(username: string, password: string): AuthUser {
  const db = getDb()

  const user = db.select().from(users).where(eq(users.username, username)).get()
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new Error('Identifiant ou mot de passe incorrect.')
  }

  currentSessionUserId = user.id

  db.update(users).set({ lastLogin: new Date().toISOString() }).where(eq(users.id, user.id)).run()

  logAction({ userId: user.id, action: 'login', entityType: 'user', entityId: user.id })

  return toAuthUser(user)
}

/** Ferme la session courante. */
export function logout(): void {
  if (currentSessionUserId) {
    logAction({
      userId: currentSessionUserId,
      action: 'logout',
      entityType: 'user',
      entityId: currentSessionUserId
    })
  }
  currentSessionUserId = null
}

/** Session en mémoire courante (ou `null` si personne n'est connecté). */
export function getCurrentSession(): { userId: string } | null {
  return currentSessionUserId ? { userId: currentSessionUserId } : null
}

/** Utilisateur actuellement connecté (vue sanitisée, sans `passwordHash`), ou `null`. */
export function getCurrentUser(): AuthUser | null {
  if (!currentSessionUserId) return null

  const db = getDb()
  const user = db.select().from(users).where(eq(users.id, currentSessionUserId)).get()
  if (!user) {
    // L'utilisateur de la session n'existe plus (cas improbable) : on invalide la session.
    currentSessionUserId = null
    return null
  }

  return toAuthUser(user)
}

/**
 * Change le mot de passe de l'utilisateur `userId`, après vérification de
 * l'ancien mot de passe. Lève le flag `mustChangePassword` (F-004.5).
 */
export function changePassword(userId: string, oldPassword: string, newPassword: string): void {
  const db = getDb()

  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) {
    throw new Error('Utilisateur introuvable.')
  }
  if (!bcrypt.compareSync(oldPassword, user.passwordHash)) {
    throw new Error('Mot de passe actuel incorrect.')
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10)

  db.update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, userId))
    .run()

  logAction({ userId, action: 'change_password', entityType: 'user', entityId: userId })
}

export interface CreateUserInput {
  username: string
  password: string
  fullName: string
}

/**
 * Crée un nouvel utilisateur. Non exposé via IPC pour l'instant (pas d'écran
 * de gestion des utilisateurs dans le plan actuel) — disponible pour une
 * future fonctionnalité d'administration multi-utilisateurs.
 */
export function createUser(data: CreateUserInput): AuthUser {
  const db = getDb()

  const existing = db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).get()
  if (existing) {
    throw new Error('Ce nom d\'utilisateur est déjà utilisé.')
  }
  if (data.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`)
  }

  const id = generateId()
  const passwordHash = bcrypt.hashSync(data.password, 10)

  db.insert(users)
    .values({
      id,
      username: data.username,
      passwordHash,
      fullName: data.fullName,
      mustChangePassword: true
    })
    .run()

  return { id, username: data.username, fullName: data.fullName, mustChangePassword: true }
}
