import { getDb } from '@main/database'
import { auditLog } from '@main/database/schema'

export interface LogActionParams {
  userId: string
  /** ex: "create", "update", "delete", "print", "cancel"... */
  action: string
  /** ex: "student", "transaction", "employee"... */
  entityType: string
  entityId: string
  /** Détails arbitraires (avant/après, motif...) — sérialisés en JSON. */
  details?: unknown
}

/**
 * Enregistre une action dans le journal d'audit (`AUDIT_LOG`).
 *
 * Convention (ARCHITECTURE.md §12.3) : appelé exclusivement depuis la couche
 * `services/`, jamais directement depuis un handler IPC ou un composant.
 */
export function logAction(params: LogActionParams): void {
  const db = getDb()

  db.insert(auditLog)
    .values({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details !== undefined ? JSON.stringify(params.details) : null
    })
    .run()
}
