import { eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { backupConfig } from '@main/database/schema'
import type { BackupAccountStatus, BackupStatus, UpdateBackupSettingsDTO } from '@shared/types/backup.types'

/** Identifiant fixe de l'unique ligne de la table BACKUP_CONFIG (même convention que `printer-config.service.ts`). */
const BACKUP_CONFIG_ID = 'singleton'

type BackupConfigRow = typeof backupConfig.$inferSelect

function ensureRow(): BackupConfigRow {
  const db = getDb()

  let row = db.select().from(backupConfig).where(eq(backupConfig.id, BACKUP_CONFIG_ID)).get()
  if (!row) {
    db.insert(backupConfig).values({ id: BACKUP_CONFIG_ID }).run()
    row = db.select().from(backupConfig).where(eq(backupConfig.id, BACKUP_CONFIG_ID)).get()
  }
  if (!row) {
    throw new Error('Impossible de créer la ligne singleton BACKUP_CONFIG.')
  }
  return row
}

/** Ligne brute complète, y compris le jeton chiffré — usage interne à `backup.service.ts` uniquement. */
export function getRawBackupConfig(): BackupConfigRow {
  return ensureRow()
}

export function getBackupStatus(): BackupAccountStatus {
  const row = ensureRow()
  return {
    connected: row.connected,
    accountEmail: row.accountEmail,
    autoBackupEnabled: row.autoBackupEnabled,
    autoBackupHour: row.autoBackupHour,
    lastBackupAt: row.lastBackupAt,
    lastBackupStatus: row.lastBackupStatus as BackupStatus | null,
    lastBackupMessage: row.lastBackupMessage
  }
}

export function updateBackupSettings(data: UpdateBackupSettingsDTO): BackupAccountStatus {
  ensureRow()

  if (data.autoBackupHour !== undefined && (data.autoBackupHour < 0 || data.autoBackupHour > 23)) {
    throw new Error("L'heure de sauvegarde automatique doit être comprise entre 0 et 23.")
  }

  const db = getDb()
  db.update(backupConfig)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(backupConfig.id, BACKUP_CONFIG_ID))
    .run()

  return getBackupStatus()
}

/** Enregistre la connexion réussie d'un compte Google (fin du flux OAuth). */
export function setConnectedAccount(accountEmail: string, refreshTokenEncrypted: string): void {
  ensureRow()
  const db = getDb()
  db.update(backupConfig)
    .set({
      connected: true,
      accountEmail,
      refreshTokenEncrypted,
      // Un nouveau compte peut ne pas avoir accès à l'ancien dossier — recréé au prochain export.
      driveFolderId: null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(backupConfig.id, BACKUP_CONFIG_ID))
    .run()
}

export function disconnectAccount(): void {
  ensureRow()
  const db = getDb()
  db.update(backupConfig)
    .set({
      connected: false,
      accountEmail: null,
      refreshTokenEncrypted: null,
      driveFolderId: null,
      autoBackupEnabled: false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(backupConfig.id, BACKUP_CONFIG_ID))
    .run()
}

export function setDriveFolderId(folderId: string): void {
  const db = getDb()
  db.update(backupConfig)
    .set({ driveFolderId: folderId, updatedAt: new Date().toISOString() })
    .where(eq(backupConfig.id, BACKUP_CONFIG_ID))
    .run()
}

export function recordBackupResult(status: BackupStatus, message: string): void {
  ensureRow()
  const db = getDb()
  db.update(backupConfig)
    .set({
      lastBackupAt: new Date().toISOString(),
      lastBackupStatus: status,
      lastBackupMessage: message,
      updatedAt: new Date().toISOString()
    })
    .where(eq(backupConfig.id, BACKUP_CONFIG_ID))
    .run()
}
