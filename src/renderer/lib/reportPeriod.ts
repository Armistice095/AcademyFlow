export type ReportPeriod = 'day' | 'month' | 'year' | 'custom'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export interface DateRange {
  from: string
  to: string
}

/**
 * Calcule les bornes `[from, to]` (format 'YYYY-MM-DD') d'une période nommée.
 * Pour `'custom'`, renvoie tel quel les bornes fournies par l'utilisateur.
 */
export function computeRange(period: ReportPeriod, custom: DateRange): DateRange {
  const now = new Date()
  if (period === 'day') {
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    return { from: day, to: day }
  }
  if (period === 'month') {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const to = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`
    return { from, to }
  }
  if (period === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  return custom
}

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  day: "Aujourd'hui",
  month: 'Ce mois',
  year: 'Cette année',
  custom: 'Personnalisé'
}
