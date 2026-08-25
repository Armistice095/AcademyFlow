import type { ThermalPrinter } from 'node-thermal-printer'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { SchoolInfo } from '@shared/types/settings.types'

/**
 * Templates d'impression ESC/POS — composent le contenu envoyé à
 * `ThermalPrinter` (voir `../thermal-printer.ts`). Séparés de la couche
 * transport pour rester testables indépendamment du matériel (ARCHITECTURE.md §12.1).
 */

/** Données nécessaires à l'impression du reçu, déjà résolues par `printer.ipc.ts`. */
export interface ReceiptTicketData {
  receiptNumber: string
  createdAt: string
  studentName: string | null
  matricule: string | null
  className: string | null
  categoryLabel: string
  installmentLabel: string | null
  description: string | null
  /** Montant, en FCFA. */
  amount: number
  operatorName: string
  /** ex: "Copie n° 2" (réimpression) — `null` pour une première impression. */
  printCopyLabel: string | null
}

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('fr-FR')} F CFA`
}

function formatDateTime(iso: string): string {
  return format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: fr })
}

/**
 * Décode un logo stocké en data URL base64 vers un buffer PNG brut,
 * exploitable par `printer.printImageBuffer()`. Les imprimantes ESC/POS ne
 * supportent que le raster monochrome : seul un logo au format PNG est
 * imprimé (JPEG non supporté par `pngjs`, utilisé en interne par
 * `node-thermal-printer`) — dégradation silencieuse sinon, le reçu PDF
 * (fallback) affiche toujours le logo quel que soit son format.
 */
function decodePngLogo(logoDataUrl: string | null): Buffer | null {
  if (!logoDataUrl) return null
  const match = /^data:image\/png;base64,(.+)$/i.exec(logoDataUrl)
  if (!match) return null

  try {
    return Buffer.from(match[1], 'base64')
  } catch {
    return null
  }
}

/**
 * Compose le ticket de reçu de paiement sur l'imprimante fournie (largeur
 * 80mm). N'exécute pas l'impression — voir `thermal-printer.ts#printReceiptTicket`.
 */
export async function buildReceiptTicket(
  printer: ThermalPrinter,
  data: ReceiptTicketData,
  schoolInfo: SchoolInfo
): Promise<void> {
  printer.clear()

  const logoBuffer = decodePngLogo(schoolInfo.logoDataUrl)
  if (logoBuffer) {
    try {
      printer.alignCenter()
      await printer.printImageBuffer(logoBuffer)
    } catch (error) {
      // Logo non compatible (image trop grande, format inattendu...) — on
      // continue sans logo plutôt que de faire échouer l'impression du reçu.
      console.warn('[printing] Logo non imprimé (ignoré) :', error)
    }
  }

  printer.alignCenter()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println(schoolInfo.name || 'Établissement scolaire')
  printer.setTextNormal()
  printer.bold(false)
  if (schoolInfo.address) printer.println(schoolInfo.address)
  if (schoolInfo.phone) printer.println(`Tél : ${schoolInfo.phone}`)

  printer.drawLine()
  printer.alignCenter()
  printer.bold(true)
  printer.println('REÇU DE PAIEMENT')
  printer.bold(false)
  printer.println(`N° ${data.receiptNumber}`)
  printer.println(formatDateTime(data.createdAt))
  printer.drawLine()

  printer.alignLeft()
  if (data.studentName) {
    printer.leftRight('Élève', data.studentName)
    if (data.matricule) printer.leftRight('Matricule', data.matricule)
    if (data.className) printer.leftRight('Classe', data.className)
  }
  printer.leftRight('Type de frais', data.categoryLabel)
  if (data.installmentLabel) printer.leftRight('Tranche', data.installmentLabel)
  if (data.description) printer.println(`Motif : ${data.description}`)

  printer.drawLine()
  printer.alignCenter()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println(formatAmount(data.amount))
  printer.setTextNormal()
  printer.bold(false)
  printer.drawLine()

  printer.alignLeft()
  printer.println(`Opérateur : ${data.operatorName}`)
  if (data.printCopyLabel) {
    printer.alignCenter()
    printer.println(data.printCopyLabel)
  }

  printer.newLine()
  printer.alignCenter()
  printer.println('Merci pour votre confiance')
  printer.newLine()
  printer.cut()
}

/** Ticket court imprimé par le bouton « Tester l'impression » des Paramètres. */
export function buildTestTicket(printer: ThermalPrinter, schoolInfo: SchoolInfo): void {
  printer.clear()
  printer.alignCenter()
  printer.bold(true)
  printer.println(schoolInfo.name || 'AcademyFlow')
  printer.bold(false)
  printer.drawLine()
  printer.println('Test de connexion imprimante')
  printer.println(formatDateTime(new Date().toISOString()))
  printer.drawLine()
  printer.println("Si ce ticket s'imprime correctement,")
  printer.println('la configuration est opérationnelle.')
  printer.newLine()
  printer.cut()
}
