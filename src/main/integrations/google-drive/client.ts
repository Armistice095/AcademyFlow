import { Readable } from 'node:stream'
import { safeStorage } from 'electron'
import { google, type drive_v3 } from 'googleapis'
import { getOAuthCredentials } from './oauth'
import * as backupConfigService from '@main/services/backup-config.service'

/** Nom du dossier Google Drive dédié, créé automatiquement au premier export. */
export const BACKUP_FOLDER_NAME = 'AcademyFlow — Sauvegardes'

/**
 * Chiffre le jeton via `safeStorage` (API Electron adossée au trousseau du
 * système d'exploitation — DPAPI sous Windows). Dégrade proprement si le
 * chiffrement n'est pas disponible (ex: session sans trousseau sur certains
 * environnements Linux) plutôt que de faire échouer la connexion.
 */
export function encryptRefreshToken(token: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(token).toString('base64')}`
  }
  console.warn('[backup] Chiffrement système indisponible — jeton Google Drive stocké sans chiffrement.')
  return `plain:${token}`
}

function decryptRefreshToken(stored: string): string {
  if (stored.startsWith('enc:')) {
    return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
  }
  if (stored.startsWith('plain:')) {
    return stored.slice(6)
  }
  throw new Error('Jeton Google Drive illisible — merci de reconnecter le compte.')
}

/** Construit un client OAuth2 authentifié à partir du jeton de rafraîchissement persisté. */
function getAuthorizedClient(): InstanceType<typeof google.auth.OAuth2> {
  const { clientId, clientSecret } = getOAuthCredentials()
  const config = backupConfigService.getRawBackupConfig()

  if (!config.connected || !config.refreshTokenEncrypted) {
    throw new Error("Aucun compte Google Drive connecté. Rendez-vous dans Paramètres > Sauvegarde.")
  }

  const client = new google.auth.OAuth2(clientId, clientSecret)
  client.setCredentials({ refresh_token: decryptRefreshToken(config.refreshTokenEncrypted) })
  return client
}

export function getDriveClient(): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: getAuthorizedClient() })
}

/**
 * Retourne l'ID du dossier de sauvegardes, en le recréant si celui
 * précédemment connu a disparu (supprimé manuellement, changement de
 * compte...).
 */
export async function ensureBackupFolder(drive: drive_v3.Drive): Promise<string> {
  const config = backupConfigService.getRawBackupConfig()

  if (config.driveFolderId) {
    try {
      const existing = await drive.files.get({ fileId: config.driveFolderId, fields: 'id,trashed' })
      if (existing.data.id && !existing.data.trashed) {
        return existing.data.id
      }
    } catch {
      // Dossier introuvable ou inaccessible — recréation ci-dessous.
    }
  }

  const created = await drive.files.create({
    requestBody: { name: BACKUP_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  })

  const folderId = created.data.id
  if (!folderId) {
    throw new Error('Échec de la création du dossier de sauvegardes sur Google Drive.')
  }

  backupConfigService.setDriveFolderId(folderId)
  return folderId
}

export async function uploadBackupFile(
  drive: drive_v3.Drive,
  folderId: string,
  fileName: string,
  content: Buffer
): Promise<{ driveFileId: string }> {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/gzip', body: Readable.from(content) },
    fields: 'id'
  })

  if (!res.data.id) {
    throw new Error("Échec de l'envoi de la sauvegarde vers Google Drive.")
  }

  return { driveFileId: res.data.id }
}

export async function downloadBackupFile(drive: drive_v3.Drive, driveFileId: string): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  return Buffer.from(res.data as ArrayBuffer)
}

export async function deleteBackupFile(drive: drive_v3.Drive, driveFileId: string): Promise<void> {
  await drive.files.delete({ fileId: driveFileId })
}
