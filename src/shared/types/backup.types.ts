/** Types partagés Main ↔ Renderer du domaine Sauvegarde cloud (Phase 9.3). */

export type BackupStatus = 'success' | 'error'

/** État courant de la connexion Google Drive et de la sauvegarde automatique. */
export interface BackupAccountStatus {
  connected: boolean
  /** Adresse e-mail du compte Google connecté, ou `null` si non connecté. */
  accountEmail: string | null
  autoBackupEnabled: boolean
  /** Heure (0-23) de déclenchement de la sauvegarde automatique quotidienne. */
  autoBackupHour: number
  lastBackupAt: string | null
  lastBackupStatus: BackupStatus | null
  lastBackupMessage: string | null
}

/** Une entrée de l'historique des sauvegardes cloud (les 7 dernières sont conservées). */
export interface BackupHistoryEntry {
  id: string
  fileName: string
  sizeBytes: number
  createdAt: string
}

export interface UpdateBackupSettingsDTO {
  autoBackupEnabled?: boolean
  /** 0-23 */
  autoBackupHour?: number
}
