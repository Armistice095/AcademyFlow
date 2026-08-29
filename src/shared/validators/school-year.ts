/**
 * Validation du format du libellé d'une année scolaire (F-026).
 *
 * Format attendu : "AAAA-AAAA" (ex: "2027-2028"), où la seconde année est
 * exactement la première + 1. Partagé entre le renderer (retour immédiat à
 * la saisie) et le main process (source de vérité, ne fait jamais confiance
 * au frontend).
 */

const SCHOOL_YEAR_LABEL_PATTERN = /^(\d{4})-(\d{4})$/

/** Bornes larges pour attraper les fautes de frappe manifestes (ex: "0202-0203"). */
const MIN_YEAR = 1900
const MAX_YEAR = 2200

export interface SchoolYearLabelValidation {
  valid: boolean
  error?: string
}

export function validateSchoolYearLabel(rawLabel: string): SchoolYearLabelValidation {
  const label = rawLabel.trim()

  if (!label) {
    return { valid: false, error: "Le libellé de l'année scolaire est requis." }
  }

  const match = SCHOOL_YEAR_LABEL_PATTERN.exec(label)
  if (!match) {
    return { valid: false, error: 'Le libellé doit suivre le format AAAA-AAAA, ex: 2027-2028.' }
  }

  const startYear = Number(match[1])
  const endYear = Number(match[2])

  if (endYear !== startYear + 1) {
    return {
      valid: false,
      error: `La seconde année doit suivre la première (ex: ${startYear}-${startYear + 1}).`
    }
  }

  if (startYear < MIN_YEAR || startYear > MAX_YEAR) {
    return { valid: false, error: `L'année doit être comprise entre ${MIN_YEAR} et ${MAX_YEAR}.` }
  }

  return { valid: true }
}
