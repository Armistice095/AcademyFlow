import { createConnection, getDb, closeConnection, getDatabasePath, getSqlite } from './connection'
import { runMigrations } from './migrate'
import type { AppDatabase } from './connection'

export { getDb, closeConnection, getDatabasePath, getSqlite }
export * as schema from './schema'
export type { AppDatabase }

/**
 * Initialise entièrement la couche base de données : ouverture de la
 * connexion SQLite, puis application des migrations en attente.
 *
 * Pas de seed automatique : une base vierge (aucun utilisateur, aucune
 * licence activée) déclenche l'assistant d'onboarding (voir
 * `renderer/pages/onboarding/`), qui est l'unique chemin de configuration
 * initiale (licence, établissement, compte admin, classes, année scolaire).
 * À appeler une seule fois, après `app.whenReady()`, avant la création de
 * la fenêtre principale.
 */
export function initDatabase(): AppDatabase {
  const { db } = createConnection()
  runMigrations(db)
  return db
}
