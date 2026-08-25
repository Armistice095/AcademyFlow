import type { CashCategory } from '@shared/constants/categories'

/**
 * Couleur stable par catégorie (indépendante du tri/rang), pour que la
 * couleur d'une catégorie donnée ne change jamais d'un rafraîchissement à
 * l'autre du tableau de bord.
 *
 * Palette dédiée aux graphiques (bleu / vert / ambre / violet / gris),
 * choisie pour rester lisible et bien contrastée dans un anneau à segments
 * arrondis — distincte de la couleur de marque (rose), réservée à l'UI.
 */
export const CATEGORY_COLORS: Record<CashCategory, string> = {
  scolarite: '#3b82f6',
  frais_inscription: '#10b981',
  frais_divers: '#f59e0b',
  don: '#8b5cf6',
  autre_recette: '#94a3b8',
  depense_quotidienne: '#ef4444',
  salaire: '#0f172a',
  achat_fournitures: '#06b6d4',
  charge_diverse: '#94a3b8'
}
