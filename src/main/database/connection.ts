import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from './schema'

export type AppDatabase = BetterSQLite3Database<typeof schema>

let sqliteInstance: Database.Database | undefined
let dbInstance: AppDatabase | undefined

/**
 * Chemin du fichier SQLite : `%APPDATA%/AcademyFlow/data/academyflow.db`
 * (voir ARCHITECTURE.md §10.2). Le dossier est créé s'il n'existe pas.
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dataDir = join(userDataPath, 'data')
  mkdirSync(dataDir, { recursive: true })
  return join(dataDir, 'academyflow.db')
}

/**
 * Ouvre (ou crée) la base SQLite et configure les pragmas recommandés.
 * Doit être appelée une seule fois, après `app.whenReady()`.
 */
export function createConnection(): { sqlite: Database.Database; db: AppDatabase } {
  const dbPath = getDatabasePath()
  const sqlite = new Database(dbPath)

  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')

  const db = drizzle(sqlite, { schema })

  sqliteInstance = sqlite
  dbInstance = db

  return { sqlite, db }
}

/** Accès à l'instance Drizzle active. Lève une erreur si `createConnection()` n'a pas été appelée. */
export function getDb(): AppDatabase {
  if (!dbInstance) {
    throw new Error(
      "La base de données n'est pas initialisée. Appeler createConnection() au démarrage."
    )
  }
  return dbInstance
}

/**
 * Accès à l'instance `better-sqlite3` brute — nécessaire pour les opérations
 * hors périmètre de Drizzle : checkpoint WAL avant sauvegarde cloud
 * (`backup.service.ts`, Phase 9.3) et fermeture propre avant restauration.
 */
export function getSqlite(): Database.Database {
  if (!sqliteInstance) {
    throw new Error(
      "La base de données n'est pas initialisée. Appeler createConnection() au démarrage."
    )
  }
  return sqliteInstance
}

/** Ferme proprement la connexion SQLite (à appeler avant la fermeture de l'app). */
export function closeConnection(): void {
  sqliteInstance?.close()
  sqliteInstance = undefined
  dbInstance = undefined
}
