/**
 * Palette cyclique utilisée pour la puce de couleur de chaque classe dans
 * la carte « Statistiques des élèves ». Purement décorative (indépendante
 * des données) — la couleur d'une classe dépend de sa position dans la
 * liste, pas de son identité, donc pas de mapping stable nécessaire ici
 * (contrairement à `category-colors.ts`, où la stabilité importe pour ne
 * pas faire "sauter" les couleurs d'un rafraîchissement à l'autre).
 */
export const CLASS_DOT_COLORS = [
  '#22c55e',
  '#8b5cf6',
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
  '#ec4899',
  '#10b981',
  '#06b6d4'
] as const

export function getClassDotColor(index: number): string {
  return CLASS_DOT_COLORS[index % CLASS_DOT_COLORS.length]
}
