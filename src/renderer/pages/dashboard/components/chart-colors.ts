/**
 * Palette de couleurs "en dur" pour les graphiques ECharts du tableau de
 * bord. ECharts dessine sur `<canvas>`, qui ne sait pas résoudre les
 * variables CSS (`var(--color-x)`) contrairement au DOM — contrairement aux
 * info-bulles (voir `echarts-tooltip.ts`), qui restent du HTML classique et
 * peuvent donc utiliser les variables CSS normalement.
 *
 * Ces valeurs sont synchronisées manuellement avec `renderer/styles/globals.css`.
 */
export const CHART_HEX = {
  success: '#22c55e',
  danger: '#ef4444',
  primary500: '#f43f5e',
  primary600: '#e11d48',
  gray200: '#e2e8f0',
  gray700: '#334155',
  gray900: '#0f172a'
} as const

/** Encaissements en vert, dépenses en rouge — convention standard, cohérente avec le croquis fourni. */
export const CASH_FLOW_COLORS = {
  entries: CHART_HEX.success,
  exits: CHART_HEX.danger
} as const
