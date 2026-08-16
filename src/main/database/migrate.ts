import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import type { AppDatabase } from './connection'

/**
 * Résout le dossier contenant les fichiers de migration SQL générés par
 * `npm run db:generate` (drizzle-kit). Ce dossier est physiquement à
 * `resources/migrations/` à la racine du projet, et packagé via
 * `extraResources` dans `electron-builder.yml`.
 *
 *  - En dev / build non packagé : `out/main/index.js` → `../../resources/migrations`
 *  - En production (packagée)   : `process.resourcesPath/migrations`
 */
export function getMigrationsFolder(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'migrations')
  }
  return join(__dirname, '../../resources/migrations')
}

/**
 * Applique toutes les migrations en attente. Ne fait rien (avec un warning)
 * si le dossier de migrations n'existe pas encore ou est vide — ce qui est
 * le cas tant que `npm run db:generate` n'a pas été exécuté au moins une fois.
 */
export function runMigrations(db: AppDatabase): void {
  const migrationsFolder = getMigrationsFolder()

  if (!existsSync(migrationsFolder)) {
    console.warn(
      `[database] Dossier de migrations introuvable (${migrationsFolder}). ` +
        'Exécutez "npm run db:generate" puis relancez l\'application.'
    )
    return
  }

  migrate(db, { migrationsFolder })
}
