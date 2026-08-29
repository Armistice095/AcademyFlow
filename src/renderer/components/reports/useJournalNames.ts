import { useEffect, useState } from 'react'
import { api } from '@renderer/lib/ipc'
import type { JournalTransaction } from '@shared/types/transaction.types'

/**
 * Résout, au fil de l'eau, les noms d'élève et de caissier référencés par une
 * liste d'opérations — même logique que `CashboxJournalPage`, extraite ici
 * pour être réutilisée par les tableaux détaillés des onglets Recettes/Dépenses.
 */
export function useJournalNames(items: JournalTransaction[]): {
  studentNames: Record<string, string>
  operatorNames: Record<string, string>
} {
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const uniqueUserIds = [...new Set(items.map((t) => t.userId))].filter(
      (id) => !operatorNames[id]
    )
    if (uniqueUserIds.length > 0) {
      Promise.all(uniqueUserIds.map((id) => api.auth.getUserById(id))).then((users) => {
        setOperatorNames((prev) => {
          const next = { ...prev }
          users.forEach((user, index) => {
            if (user) next[uniqueUserIds[index]] = user.fullName
          })
          return next
        })
      })
    }

    const uniqueStudentIds = [
      ...new Set(items.map((t) => t.studentId).filter((id): id is string => id !== null))
    ].filter((id) => !studentNames[id])
    if (uniqueStudentIds.length > 0) {
      Promise.all(uniqueStudentIds.map((id) => api.students.findById(id))).then((studentsFound) => {
        setStudentNames((prev) => {
          const next = { ...prev }
          studentsFound.forEach((s, index) => {
            if (s) next[uniqueStudentIds[index]] = `${s.lastName} ${s.firstName}`
          })
          return next
        })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  return { studentNames, operatorNames }
}
