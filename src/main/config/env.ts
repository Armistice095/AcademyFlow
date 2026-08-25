import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Charge un fichier `.env` (format `CLE=valeur`, une entrée par ligne) dans
 * `process.env`, sans dépendance externe (pas de `dotenv`).
 *
 * Utilisé exclusivement pour la configuration développeur de l'intégration
 * Google Drive (Phase 9.3) : `GOOGLE_DRIVE_CLIENT_ID` / `GOOGLE_DRIVE_CLIENT_SECRET`.
 * Contrairement aux identifiants saisis par l'utilisateur final (mot de
 * passe, etc.), il s'agit d'un identifiant d'application OAuth "Desktop"
 * fourni par l'intégrateur/développeur au moment du déploiement — voir
 * `.env.example` à la racine du projet et ARCHITECTURE.md §7.
 *
 * Recherche, dans l'ordre :
 *  1. `process.resourcesPath/.env` (application packagée — permet de
 *     reconfigurer les identifiants sans reconstruire l'installateur)
 *  2. `<racine du projet>/.env` (développement)
 *
 * N'écrase jamais une variable déjà présente dans `process.env` (permet la
 * configuration via variables d'environnement système en priorité).
 */
export function loadEnvFile(): void {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, '.env')]
    : [join(__dirname, '../../.env')]

  for (const path of candidates) {
    if (!existsSync(path)) continue

    try {
      const content = readFileSync(path, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const separatorIndex = trimmed.indexOf('=')
        if (separatorIndex === -1) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        let value = trimmed.slice(separatorIndex + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }

        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    } catch (error) {
      console.warn(`[config] Échec de la lecture de ${path} :`, error)
    }

    return
  }
}
