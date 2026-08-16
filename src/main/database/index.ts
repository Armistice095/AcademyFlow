import { createConnection, getDb, closeConnection, getDatabasePath } from './connection'
import { runMigrations } from './migrate'
import { seedDatabase } from './seed'
import type { AppDatabase } from './connection'

export { getDb, closeConnection, getDatabasePath }
export * as schema from './schema'
export type { AppDatabase }

/**
 * Initialise entièrement la couche base de données : ouverture de la
 * connexion SQLite, application des migrations en attente, puis insertion
 * des données initiales si la base est vierge. À appeler une seule fois,
 * après `app.whenReady()`, avant la création de la fenêtre principale.
 */
export function initDatabase(): AppDatabase {
  const { db } = createConnection()
  runMigrations(db)
  seedDatabase(db)
  return db
}
