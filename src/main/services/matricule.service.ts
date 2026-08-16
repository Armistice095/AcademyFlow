import { sql } from 'drizzle-orm'
import { getDb } from '@main/database'
import { students } from '@main/database/schema'
import { MATRICULE_LENGTH, MATRICULE_START } from '@shared/constants/defaults'

/**
 * Génère un matricule élève unique, purement numérique, sur
 * {@link MATRICULE_LENGTH} chiffres (ex: `10052724`), conformément à BR-002.
 *
 * Séquence globale (toutes années confondues) : `max(matricules existants) + 1`,
 * en partant de {@link MATRICULE_START}. Comme les élèves ne sont jamais
 * physiquement supprimés (soft delete — BR-006), un matricule déjà attribué
 * n'est jamais réutilisé, même après "suppression" de l'élève.
 */
export function generateMatricule(): string {
  const db = getDb()

  const [row] = db
    .select({ max: sql<number | null>`max(cast(${students.matricule} as integer))` })
    .from(students)
    .all()

  const nextValue = row?.max != null && row.max >= MATRICULE_START ? row.max + 1 : MATRICULE_START

  const matricule = String(nextValue)
  if (matricule.length !== MATRICULE_LENGTH) {
    // Ne devrait se produire qu'après ~90 millions d'élèves (dépassement de MATRICULE_LENGTH chiffres).
    throw new Error(
      `Impossible de générer un matricule à ${MATRICULE_LENGTH} chiffres : séquence épuisée (${matricule}).`
    )
  }

  return matricule
}
