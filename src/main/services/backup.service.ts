import { existsSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { desc, eq } from 'drizzle-orm'
import { format } from 'date-fns'
import { app } from 'electron'
import { getDb, getSqlite, getDatabasePath, closeConnection } from '@main/database'
import { backupHistory } from '@main/database/schema'
import * as backupConfigService from './backup-config.service'
import { runLoopbackAuthorization } from '@main/integrations/google-drive/oauth'
import {
  getDriveClient,
  ensureBackupFolder,
  uploadBackupFile,
  downloadBackupFile,
  deleteBackupFile,
  encryptRefreshToken
} from '@main/integrations/google-drive/client'
import type { BackupAccountStatus, BackupHistoryEntry, UpdateBackupSettingsDTO } from '@shared/types/backup.types'
import type { BackupResult, BackupInfo } from '@shared/types/common.types'

/** Nombre de sauvegardes conservées sur Google Drive — les plus anciennes sont supprimées automatiquement. */
const MAX_BACKUPS_RETAINED = 7

/** Fréquence de vérification du planificateur de sauvegarde automatique. */
const SCHEDULER_CHECK_INTERVAL_MS = 15 * 60 * 1000

function toHistoryEntry(row: typeof backupHistory.$inferSelect): BackupHistoryEntry {
  return { id: row.id, fileName: row.fileName, sizeBytes: row.sizeBytes, createdAt: row.createdAt }
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

export function listBackups(): BackupHistoryEntry[] {
  const db = getDb()
  return db.select().from(backupHistory).orderBy(desc(backupHistory.createdAt)).all().map(toHistoryEntry)
}

export function getLastBackup(): BackupInfo | null {
  const [latest] = listBackups()
  return latest ? { fileName: latest.fileName, createdAt: latest.createdAt, sizeBytes: latest.sizeBytes } : null
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
 * Purge les sauvegardes excédant `MAX_BACKUPS_RETAINED`, du côté Google
 * Drive et de l'historique local. Les échecs de suppression individuels
 * (fichier déjà supprimé manuellement...) sont journalisés mais
 * n'interrompent pas la rotation.
 */
async function rotateOldBackups(): Promise<void> {
  const db = getDb()
  const rows = db.select().from(backupHistory).orderBy(desc(backupHistory.createdAt)).all()
  const toDelete = rows.slice(MAX_BACKUPS_RETAINED)
  if (toDelete.length === 0) return

  const drive = getDriveClient()
  for (const row of toDelete) {
    try {
      await deleteBackupFile(drive, row.driveFileId)
    } catch (error) {
      console.warn(`[backup] Échec de la suppression distante de ${row.fileName} (ignoré) :`, error)
    }
    db.delete(backupHistory).where(eq(backupHistory.id, row.id)).run()
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
    const { driveFileId } = await uploadBackupFile(drive, folderId, fileName, dbBuffer)

    const db = getDb()
    db.insert(backupHistory)
      .values({ driveFileId, fileName, sizeBytes: dbBuffer.length })
      .run()

    await rotateOldBackups()

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
    const db = getDb()
    const target = db.select().from(backupHistory).where(eq(backupHistory.id, backupId)).get()
    if (!target) {
      throw new Error('Sauvegarde introuvable.')
    }

    const drive = getDriveClient()
    const gzipped = await downloadBackupFile(drive, target.driveFileId)
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

    return { success: true, fileName: target.fileName }
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
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
    runAutoBackupIfDue().catch((error) => console.error('[backup] Échec de la sauvegarde automatique :', error))
  }, SCHEDULER_CHECK_INTERVAL_MS)
}

export function stopAutoBackupScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle)
    schedulerHandle = null
  }
}
