import { desc, eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { auditLog, users } from '@main/database/schema'

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

export interface RecentAuditEntry {
  id: string
  userId: string
  userFullName: string
  action: string
  entityType: string
  entityId: string
  /** JSON désérialisé (voir `LogActionParams.details`), ou `null`. */
  details: unknown
  createdAt: string
}

/**
 * Dernières entrées du journal d'audit, du plus récent au plus ancien, avec
 * le nom complet de l'opérateur déjà résolu (flux « Activités récentes » du
 * tableau de bord — F-019, Phase 9.1).
 */
export function listRecent(limit = 10): RecentAuditEntry[] {
  const db = getDb()

  const rows = db
    .select({
      id: auditLog.id,
      userId: auditLog.userId,
      userFullName: users.fullName,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      details: auditLog.details,
      createdAt: auditLog.createdAt
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .all()

  return rows.map((row) => ({
    ...row,
    details: row.details ? (JSON.parse(row.details) as unknown) : null
  }))
}
