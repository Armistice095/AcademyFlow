/**
 * Catégories d'opérations de caisse (BR-004).
 * Toute entrée/sortie de caisse doit être rattachée à l'une de ces catégories.
 */

export const CASH_ENTRY_CATEGORIES = [
  'frais_inscription',
  'scolarite',
  'frais_divers',
  'don',
  'autre_recette'
] as const

export const CASH_EXIT_CATEGORIES = [
  'depense_quotidienne',
  'salaire',
  'achat_fournitures',
  'charge_diverse'
] as const

export type CashEntryCategory = (typeof CASH_ENTRY_CATEGORIES)[number]
export type CashExitCategory = (typeof CASH_EXIT_CATEGORIES)[number]
export type CashCategory = CashEntryCategory | CashExitCategory

/** Libellés français affichés dans l'UI, pour chaque catégorie. */
export const CASH_CATEGORY_LABELS: Record<CashCategory, string> = {
  frais_inscription: "Frais d'inscription",
  scolarite: 'Scolarité',
  frais_divers: 'Frais divers',
  don: 'Don',
  autre_recette: 'Autre recette',
  depense_quotidienne: 'Dépense quotidienne',
  salaire: 'Salaire',
  achat_fournitures: 'Achat de fournitures',
  charge_diverse: 'Charge diverse'
}
