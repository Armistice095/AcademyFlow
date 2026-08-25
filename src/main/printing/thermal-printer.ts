import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import type { SchoolInfo } from '@shared/types/settings.types'
import type { PrinterConfig } from '@shared/types/printer.types'
import { buildReceiptTicket, buildTestTicket, type ReceiptTicketData } from './templates/receipt'

/**
 * Abstraction du pilotage matériel des imprimantes thermiques ESC/POS
 * (ARCHITECTURE.md §6.1). Repose sur `node-thermal-printer`, dont les
 * interfaces `tcp://` (réseau) et fichier/port local (USB) sont pures
 * JavaScript — aucune dépendance native, contrairement à l'interface
 * `printer:<nom>` (module `printer`) volontairement écartée ici pour ne pas
 * introduire de risque de compilation native supplémentaire au packaging
 * (voir Phase 9.5). L'imprimante USB doit donc être accessible comme un
 * port/fichier local (ex: `\\.\COM3` sous Windows) — c'est le cas de la
 * grande majorité des imprimantes de reçus 80mm bon marché, qui s'installent
 * comme un port série virtuel (USB-CDC/FTDI) plutôt qu'un pilote d'impression
 * système.
 */

/** Construit la chaîne d'interface `node-thermal-printer` à partir de la configuration persistée. */
function buildInterfaceString(config: PrinterConfig): string {
  if (config.connectionType === 'network') {
    if (!config.host?.trim()) {
      throw new Error("L'adresse de l'imprimante réseau n'est pas configurée.")
    }
    return `tcp://${config.host.trim()}:${config.port}`
  }

  if (!config.devicePath?.trim()) {
    throw new Error("Le port de l'imprimante USB n'est pas configuré (ex: \\\\.\\COM3).")
  }
  return config.devicePath.trim()
}

function createPrinterInstance(config: PrinterConfig): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: buildInterfaceString(config),
    // PC858 : jeu de caractères Latin étendu (accents français) le plus
    // largement supporté par les imprimantes ESC/POS génériques.
    characterSet: CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    width: 42,
    options: { timeout: 5000 }
  })
}

/**
 * Vérifie la connexion à l'imprimante configurée et, si elle répond,
 * imprime un court ticket de test — c'est le comportement du bouton
 * « Tester l'impression » des Paramètres (Phase 9.2). Lève une erreur
 * explicite en cas d'échec (message affiché tel quel côté renderer).
 */
export async function testPrinterConnection(config: PrinterConfig, schoolInfo: SchoolInfo): Promise<void> {
  const printer = createPrinterInstance(config)

  const connected = await printer.isPrinterConnected()
  if (!connected) {
    throw new Error(
      config.connectionType === 'network'
        ? `Imprimante injoignable à l'adresse ${config.host}:${config.port}.`
        : `Imprimante introuvable sur le port ${config.devicePath}.`
    )
  }

  buildTestTicket(printer, schoolInfo)
  await printer.execute()
}

/** Imprime le reçu de paiement sur l'imprimante configurée (Phase 9.2, F-018). */
export async function printReceiptTicket(
  config: PrinterConfig,
  data: ReceiptTicketData,
  schoolInfo: SchoolInfo
): Promise<void> {
  const printer = createPrinterInstance(config)
  await buildReceiptTicket(printer, data, schoolInfo)
  await printer.execute()
}
