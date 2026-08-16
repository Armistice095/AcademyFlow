import bcrypt from 'bcryptjs'
import { classes, schoolYears, users } from './schema'
import { generateId } from './id'
import type { AppDatabase } from './connection'

/** Classes du système éducatif béninois : primaire (CI → CM2) + secondaire (6ème → Tle). */
const DEFAULT_CLASSES = [
  'CI',
  'CP',
  'CE1',
  'CE2',
  'CM1',
  'CM2',
  '6ème',
  '5ème',
  '4ème',
  '3ème',
  '2nde',
  '1ère',
  'Tle'
] as const

/** Identifiants du compte administrateur créé au premier lancement. */
export const DEFAULT_ADMIN_USERNAME = 'admin'
export const DEFAULT_ADMIN_PASSWORD = 'admin123'

/**
 * Calcule le libellé de l'année scolaire par défaut (ex: "2025-2026") en se
 * basant sur la date courante : la rentrée est conventionnellement en
 * septembre en Afrique de l'Ouest francophone.
 */
export function getDefaultSchoolYearLabel(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  const startYear = month >= 9 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

/**
 * Insère les données initiales si la base est vierge (aucun utilisateur).
 * Idempotent : ne fait rien si déjà exécuté (utile car appelé à chaque démarrage).
 */
export function seedDatabase(db: AppDatabase): void {
  const existingUsers = db.select({ id: users.id }).from(users).limit(1).all()
  if (existingUsers.length > 0) {
    return
  }

  console.log('[database] Base vierge détectée — insertion des données initiales...')

  db.insert(classes)
    .values(DEFAULT_CLASSES.map((name, index) => ({ id: generateId(), name, sortOrder: index + 1 })))
    .run()

  db.insert(schoolYears)
    .values({ id: generateId(), label: getDefaultSchoolYearLabel(), isCurrent: true })
    .run()

  const passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10)
  db.insert(users)
    .values({
      id: generateId(),
      username: DEFAULT_ADMIN_USERNAME,
      passwordHash,
      fullName: 'Administrateur',
      mustChangePassword: true
    })
    .run()

  console.log(
    `[database] Seed terminé : ${DEFAULT_CLASSES.length} classes, 1 année scolaire, ` +
      `utilisateur "${DEFAULT_ADMIN_USERNAME}" (mot de passe par défaut à changer au premier login).`
  )
}
