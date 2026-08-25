import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { users } from '@main/database/schema'
import { generateId } from '@main/database/id'
import { logAction } from './audit.service'
import type { AuthUser } from '@shared/types/common.types'
import type { UserAccount, UpdateUserDTO } from '@shared/types/user.types'

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
  if (!user.isActive) {
    throw new Error('Ce compte a été désactivé. Contactez un administrateur.')
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

/** Résout un utilisateur par son ID (ex: affichage du nom de l'opérateur dans le journal de caisse). */
export function getUserById(userId: string): AuthUser | null {
  const db = getDb()
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  return user ? toAuthUser(user) : null
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

/** Crée un nouvel utilisateur (Phase 9.4, onglet « Utilisateurs » des Paramètres). */
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

// ---------------------------------------------------------------------------
// Gestion des comptes utilisateurs (Phase 9.4)
// ---------------------------------------------------------------------------

function toUserAccount(row: typeof users.$inferSelect): UserAccount {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin
  }
}

/** Liste tous les comptes utilisateurs (actifs et désactivés), triés par nom. */
export function listUsers(): UserAccount[] {
  const db = getDb()
  return db.select().from(users).orderBy(users.fullName).all().map(toUserAccount)
}

export function updateUser(userId: string, data: UpdateUserDTO): UserAccount {
  const db = getDb()

  const existing = db.select().from(users).where(eq(users.id, userId)).get()
  if (!existing) {
    throw new Error('Utilisateur introuvable.')
  }

  if (data.username !== undefined && data.username !== existing.username) {
    const trimmed = data.username.trim()
    if (!trimmed) {
      throw new Error("Le nom d'utilisateur ne peut pas être vide.")
    }
    const conflict = db.select({ id: users.id }).from(users).where(eq(users.username, trimmed)).get()
    if (conflict) {
      throw new Error('Ce nom d\'utilisateur est déjà utilisé.')
    }
  }

  db.update(users)
    .set({
      ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
      ...(data.username !== undefined ? { username: data.username.trim() } : {})
    })
    .where(eq(users.id, userId))
    .run()

  const updated = db.select().from(users).where(eq(users.id, userId)).get()
  if (!updated) throw new Error('Utilisateur introuvable après mise à jour.')

  logAction({ userId, action: 'update', entityType: 'user', entityId: userId })

  return toUserAccount(updated)
}

/**
 * Active ou désactive un compte (suppression logique — cohérent avec
 * BR-006). Refuse de désactiver le dernier compte actif restant, pour
 * éviter de verrouiller définitivement l'accès à l'application.
 */
export function setUserActive(userId: string, isActive: boolean): UserAccount {
  const db = getDb()

  const existing = db.select().from(users).where(eq(users.id, userId)).get()
  if (!existing) {
    throw new Error('Utilisateur introuvable.')
  }

  if (!isActive) {
    const activeCount = db.select({ id: users.id }).from(users).where(eq(users.isActive, true)).all().length
    if (activeCount <= 1 && existing.isActive) {
      throw new Error('Impossible de désactiver le dernier compte actif.')
    }
  }

  db.update(users).set({ isActive }).where(eq(users.id, userId)).run()

  logAction({
    userId,
    action: isActive ? 'activate' : 'deactivate',
    entityType: 'user',
    entityId: userId
  })

  const updated = db.select().from(users).where(eq(users.id, userId)).get()
  if (!updated) throw new Error('Utilisateur introuvable après mise à jour.')
  return toUserAccount(updated)
}

/**
 * Réinitialise le mot de passe d'un utilisateur (action administrateur) et
 * force son changement à la prochaine connexion. Retourne le mot de passe
 * temporaire en clair — à communiquer une seule fois à l'utilisateur
 * concerné, il n'est jamais journalisé ni renvoyé à nouveau.
 */
export function resetPassword(userId: string): { temporaryPassword: string } {
  const db = getDb()

  const existing = db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()
  if (!existing) {
    throw new Error('Utilisateur introuvable.')
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = bcrypt.hashSync(temporaryPassword, 10)

  db.update(users)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(users.id, userId))
    .run()

  logAction({ userId, action: 'reset_password', entityType: 'user', entityId: userId })

  return { temporaryPassword }
}

function generateTemporaryPassword(): string {
  // Alphabet sans caractères ambigus (0/O, 1/l/I) pour une saisie manuelle fiable par l'utilisateur.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 10; i++) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return password
}
