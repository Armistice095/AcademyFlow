import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { api } from './ipc'

/**
 * Génère le PDF à partir d'un document `@react-pdf/renderer`, puis l'envoie
 * au process main pour ouverture dans la visionneuse système (voir
 * `printer.ipc.ts` → `openPdf`).
 */
export async function openPdf(document: ReactElement, fileName: string): Promise<void> {
  const blob = await pdf(document).toBlob()

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(new Error('Échec de la lecture du PDF généré.'))
    reader.readAsDataURL(blob)
  })

  await api.printer.openPdf(base64, fileName)
}
