/**
 * Wrapper pour les appels IPC côté renderer.
 *
 * `window.api` est déjà entièrement typé (voir `src/preload/api.d.ts`, inclus
 * dans `tsconfig.web.json`), donc ce module se contente de le ré-exporter
 * sous un nom stable et pratique à importer (`import { api } from '@renderer/lib/ipc'`),
 * plutôt que d'utiliser `window.api` directement partout dans les composants.
 */
export const api = window.api

/** Utile pour les tests / rendu hors Electron (ex: Storybook) où `window.api` n'existe pas. */
export function isIpcAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.api !== 'undefined'
}
