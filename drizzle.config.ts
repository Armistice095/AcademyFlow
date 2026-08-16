import { defineConfig } from 'drizzle-kit'

/**
 * Config Drizzle Kit — utilisée par `npm run db:generate` et `npm run db:studio`.
 *
 * `out` correspond au dossier packagé par electron-builder (voir
 * `electron-builder.yml` → extraResources) et résolu au runtime par
 * `src/main/database/migrate.ts`.
 *
 * `dbCredentials.url` pointe vers un fichier SQLite de développement local
 * (à la racine du projet, ignoré par git) — distinct de la base réelle de
 * l'application qui vit dans `%APPDATA%/AcademyFlow/data/academyflow.db`.
 * Cela permet d'utiliser `db:studio` sans lancer l'app Electron.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/main/database/schema.ts',
  out: './resources/migrations',
  dbCredentials: {
    url: './academyflow.dev.db'
  },
  verbose: true,
  strict: true
})
