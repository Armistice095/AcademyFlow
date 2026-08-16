import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

/**
 * Formate un montant en FCFA avec séparateur de milliers.
 * Ex: `formatCFA(150000)` → `"150 000 F CFA"`
 */
export function formatCFA(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} F CFA`
}

/**
 * Formate une date (ISO 8601 ou objet Date) en format long français.
 * Ex: `formatDate('2026-08-14')` → `"14 août 2026"`
 */
export function formatDate(date: string | Date): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return format(parsed, 'd MMMM yyyy', { locale: fr })
}

/**
 * Formate une date-heure (ISO 8601 ou objet Date) en format long français.
 * Ex: `formatDateTime('2026-08-14T15:30:00Z')` → `"14 août 2026 à 15:30"`
 */
export function formatDateTime(date: string | Date): string {
  const parsed = typeof date === 'string' ? new Date(date) : date
  return format(parsed, "d MMMM yyyy 'à' HH:mm", { locale: fr })
}

/**
 * Formate un matricule (chaîne numérique à 8 chiffres) pour l'affichage,
 * en insérant un espace au milieu pour la lisibilité.
 * Ex: `formatMatricule('10052724')` → `"1005 2724"`
 */
export function formatMatricule(matricule: string): string {
  if (matricule.length !== 8) return matricule
  return `${matricule.slice(0, 4)} ${matricule.slice(4)}`
}
