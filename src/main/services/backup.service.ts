import { existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { format } from 'date-fns'
import { app } from 'electron'
import { getSqlite, getDatabasePath, closeConnection } from '@main/database'
import * as backupConfigService from './backup-config.service'
import { runLoopbackAuthorization } from '@main/integrations/google-drive/oauth'
import {
  getDriveClient,
  ensureBackupFolder,
  uploadBackupFile,
  downloadBackupFile,
  deleteBackupFile,
  listBackupFiles,
  encryptRefreshToken,
  type DriveBackupFile
} from '@main/integrations/google-drive/client'
import type {
  BackupAccountStatus,
  BackupHistoryEntry,
  UpdateBackupSettingsDTO
} from '@shared/types/backup.types'
import type { BackupResult, BackupInfo } from '@shared/types/common.types'

/** Nombre de sauvegardes conservées sur Google Drive — les plus anciennes sont supprimées automatiquement. */
const MAX_BACKUPS_RETAINED = 7

/** Fréquence de vérification du planificateur de sauvegarde automatique. */
const SCHEDULER_CHECK_INTERVAL_MS = 15 * 60 * 1000

function toHistoryEntry(file: DriveBackupFile): BackupHistoryEntry {
  return {
    id: file.driveFileId,
    fileName: file.fileName,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ---------------------------------------------------------------------------
// Statut & réglages
// ---------------------------------------------------------------------------

export function getBackupStatus(): BackupAccountStatus {
  return backupConfigService.getBackupStatus()
}

export function updateBackupSettings(data: UpdateBackupSettingsDTO): BackupAccountStatus {
  return backupConfigService.updateBackupSettings(data)
}

/**
 * Source unique de vérité de l'historique des sauvegardes : Google Drive.
 * On ne lit plus jamais de table locale ici — après suppression de la base
 * locale, les sauvegardes déjà envoyées restent donc visibles et
 * restaurables tant qu'elles existent sur Drive.
 */
export async function listBackups(): Promise<BackupHistoryEntry[]> {
  const drive = getDriveClient()
  const folderId = await ensureBackupFolder(drive)
  const files = await listBackupFiles(drive, folderId)
  return files.map(toHistoryEntry)
}

export async function getLastBackup(): Promise<BackupInfo | null> {
  const [latest] = await listBackups()
  return latest
    ? { fileName: latest.fileName, createdAt: latest.createdAt, sizeBytes: latest.sizeBytes }
    : null
}

// ---------------------------------------------------------------------------
// Connexion / déconnexion du compte Google
// ---------------------------------------------------------------------------

export async function connectGoogleAccount(): Promise<BackupAccountStatus> {
  const { refreshToken, accountEmail } = await runLoopbackAuthorization()
  backupConfigService.setConnectedAccount(accountEmail, encryptRefreshToken(refreshToken))
  return backupConfigService.getBackupStatus()
}

export function disconnectGoogleAccount(): BackupAccountStatus {
  backupConfigService.disconnectAccount()
  return backupConfigService.getBackupStatus()
}

// ---------------------------------------------------------------------------
// Export vers le cloud (F-025)
// ---------------------------------------------------------------------------

/**
 * Purge les sauvegardes excédant `MAX_BACKUPS_RETAINED` sur Google Drive.
 * La liste de référence est celle de Drive (pas un historique local
 * potentiellement désynchronisé) — voir plan de correction, étape 3. Les
 * échecs de suppression individuels (fichier déjà supprimé manuellement...)
 * sont journalisés mais n'interrompent pas la rotation des autres fichiers.
 */
async function rotateOldBackups(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string
): Promise<void> {
  const files = await listBackupFiles(drive, folderId)
  const toDelete = files.slice(MAX_BACKUPS_RETAINED)
  if (toDelete.length === 0) return

  for (const file of toDelete) {
    try {
      await deleteBackupFile(drive, file.driveFileId)
    } catch (error) {
      console.warn(
        `[backup] Échec de la suppression distante de ${file.fileName} (ignoré) :`,
        error
      )
    }
  }
}

/**
 * Exporte la base de données vers Google Drive (F-025). Étapes : checkpoint
 * WAL (garantit que le fichier `.db` contient toutes les écritures
 * validées), compression gzip, envoi, puis rotation des sauvegardes au-delà
 * de {@link MAX_BACKUPS_RETAINED}.
 */
export async function exportToCloud(): Promise<BackupResult> {
  try {
    const drive = getDriveClient()
    const folderId = await ensureBackupFolder(drive)

    getSqlite().pragma('wal_checkpoint(TRUNCATE)')
    const dbBuffer = gzipSync(readFileSync(getDatabasePath()))

    const fileName = `academyflow_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.db.gz`
    await uploadBackupFile(drive, folderId, fileName, dbBuffer)

    await rotateOldBackups(drive, folderId)

    const message = `Sauvegarde envoyée (${formatBytes(dbBuffer.length)}).`
    backupConfigService.recordBackupResult('success', message)

    return { success: true, fileName }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Échec de la sauvegarde cloud.'
    backupConfigService.recordBackupResult('error', message)
    return { success: false, message }
  }
}

// ---------------------------------------------------------------------------
// Restauration depuis le cloud (F-025)
// ---------------------------------------------------------------------------

/**
 * Restaure la base de données à partir d'une sauvegarde cloud. Par sécurité,
 * la base actuelle est d'abord copiée localement dans `backups/` avant tout
 * remplacement (une restauration ne doit jamais être un aller sans retour).
 *
 * Une connexion `better-sqlite3` ouverte ne peut pas être "échangée à
 * chaud" : l'application se ferme la connexion, remplace le fichier, puis
 * se relance intégralement pour repartir sur un état propre. Le renderer
 * reçoit `{ success: true }` juste avant le redémarrage pour afficher une
 * confirmation.
 */
export async function restoreFromCloud(backupId: string): Promise<BackupResult> {
  try {
    // `backupId` est directement l'ID du fichier Google Drive (voir
    // `BackupHistoryEntry.id`) — plus de table locale à interroger au
    // préalable, Drive est la seule source de vérité.
    const drive = getDriveClient()
    let gzipped: Buffer
    try {
      gzipped = await downloadBackupFile(drive, backupId)
    } catch (error) {
      const status =
        (error as { code?: number; status?: number })?.code ??
        (error as { status?: number })?.status
      if (status === 404) {
        throw new Error("Cette sauvegarde n'existe plus sur Google Drive.")
      }
      throw error
    }
    const restoredDb = gunzipSync(gzipped)

    const dbPath = getDatabasePath()
    const localBackupsDir = join(dirname(dbPath), 'backups')
    mkdirSync(localBackupsDir, { recursive: true })
    const safetyCopyName = `pre-restore_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.db`
    copyFileSync(dbPath, join(localBackupsDir, safetyCopyName))

    closeConnection()
    writeFileSync(dbPath, restoredDb)
    for (const suffix of ['-wal', '-shm']) {
      const sidecarPath = `${dbPath}${suffix}`
      if (existsSync(sidecarPath)) rmSync(sidecarPath)
    }

    // Laisse le temps à la promesse de résoudre côté renderer avant de couper le processus.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 800)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Échec de la restauration.'
    return { success: false, message }
  }
}

// ---------------------------------------------------------------------------
// Sauvegarde automatique quotidienne (F-025)
// ---------------------------------------------------------------------------

let schedulerHandle: NodeJS.Timeout | null = null

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

async function runAutoBackupIfDue(): Promise<void> {
  const status = backupConfigService.getBackupStatus()
  if (!status.connected || !status.autoBackupEnabled) return

  const now = new Date()
  if (now.getHours() !== status.autoBackupHour) return
  if (status.lastBackupAt && isSameDay(new Date(status.lastBackupAt), now)) return

  console.info('[backup] Déclenchement de la sauvegarde automatique quotidienne.')
  await exportToCloud()
}

/** Démarre le planificateur de sauvegarde automatique (appelé une fois au démarrage de l'application). */
export function initAutoBackupScheduler(): void {
  if (schedulerHandle) return
  schedulerHandle = setInterval(() => {
    runAutoBackupIfDue().catch((error) =>
      console.error('[backup] Échec de la sauvegarde automatique :', error)
    )
  }, SCHEDULER_CHECK_INTERVAL_MS)
}

export function stopAutoBackupScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }
}
