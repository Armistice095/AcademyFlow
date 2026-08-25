import { formatCFA } from '@renderer/lib/formatters'

export interface TooltipRow {
  label: string
  value: number
  color: string
}

/**
 * Construit le HTML d'une info-bulle ECharts, avec le même habillage visuel
 * que l'ancien `ChartTooltip.tsx` (pensé pour Recharts). Contrairement aux
 * séries dessinées sur `<canvas>`, l'info-bulle ECharts est un vrai élément
 * DOM flottant : les variables CSS (`var(--color-x)`) y fonctionnent
 * normalement.
 */
export function buildTooltipHtml(title: string | undefined, rows: TooltipRow[]): string {
  const titleHtml = title
    ? `<div style="margin-bottom:6px;font-size:12px;font-weight:500;color:var(--color-muted-foreground);">${title}</div>`
    : ''

  const rowsHtml = rows
    .map(
      (row) => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.4;">
          <span style="width:8px;height:8px;flex:none;border-radius:9999px;background:${row.color};"></span>
          <span style="color:var(--color-muted-foreground);">${row.label}</span>
          <span style="margin-left:auto;font-family:ui-monospace,monospace;font-weight:600;color:var(--color-foreground);white-space:nowrap;">${formatCFA(row.value)}</span>
        </div>`
    )
    .join('')

  return `
    <div style="min-width:170px;padding:10px 12px;border-radius:10px;background:var(--color-card);border:1px solid var(--color-border);box-shadow:0 8px 24px -8px rgb(0 0 0 / 0.18);">
      ${titleHtml}
      <div style="display:flex;flex-direction:column;gap:5px;">${rowsHtml}</div>
    </div>`
}
