/** Types partagés Main ↔ Renderer, transversaux à tous les domaines métier. */

// ---------------------------------------------------------------------------
// Pagination / recherche
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface SearchQuery {
  query?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// Authentification (Phase 4)
// ---------------------------------------------------------------------------

/** Utilisateur tel qu'exposé au renderer — jamais `passwordHash`. */
export interface AuthUser {
  id: string
  username: string
  fullName: string
  mustChangePassword: boolean
}

// ---------------------------------------------------------------------------
// Impression (Phase 9)
// ---------------------------------------------------------------------------

export interface PrintResult {
  success: boolean
  message?: string
}

export interface PrinterStatus {
  connected: boolean
  name?: string
}

// ---------------------------------------------------------------------------
// Sauvegarde cloud (Phase 9)
// ---------------------------------------------------------------------------

export interface BackupResult {
  success: boolean
  fileName?: string
  message?: string
}

export interface BackupInfo {
  fileName: string
  createdAt: string
  sizeBytes: number
}
