/**
 * Types, DTOs et constantes partagés entre les process main et renderer.
 *
 * Pas de barrel export ici volontairement : importer directement depuis les
 * fichiers spécifiques (ex: `@shared/types/student.types`, `@shared/ipc-channels`)
 * pour un typage précis et des imports explicites.
 *
 *  - ./types/       → types TypeScript par entité (student, transaction, personnel, settings, common)
 *  - ./constants/    → catégories de caisse (BR-004), valeurs par défaut
 *  - ./ipc-channels.ts → noms des canaux IPC (source unique)
 */
export {}
