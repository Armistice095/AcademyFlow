import { randomUUID } from 'node:crypto'

/**
 * Génère un identifiant unique pour les entités de la base de données.
 *
 * Note : `crypto.randomUUID()` (Node.js) produit des UUID v4 (aléatoires),
 * pas des UUID v7 (triables chronologiquement) comme mentionné dans
 * ARCHITECTURE.md §4.2 — Node.js ne propose pas encore de génération native
 * de v7. Si le tri chronologique des IDs devient nécessaire (ex. pagination
 * par curseur), remplacer l'implémentation ci-dessous par le package
 * `uuidv7` sans toucher aux appelants.
 */
export function generateId(): string {
  return randomUUID()
}
