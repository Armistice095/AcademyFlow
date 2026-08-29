import { eq } from 'drizzle-orm'
import { getDb } from '@main/database'
import { printerConfig } from '@main/database/schema'
import type { PrinterConfig, UpdatePrinterConfigDTO } from '@shared/types/printer.types'

/** Identifiant fixe de l'unique ligne de la table PRINTER_CONFIG (voir settings.service.ts pour la même convention). */
const PRINTER_CONFIG_ID = 'singleton'

function toPrinterConfig(row: typeof printerConfig.$inferSelect): PrinterConfig {
  return {
    enabled: row.enabled,
    connectionType: row.connectionType as PrinterConfig['connectionType'],
    devicePath: row.devicePath,
    host: row.host,
    port: row.port,
    lastTestAt: row.lastTestAt,
    lastTestSuccess: row.lastTestSuccess,
    lastTestMessage: row.lastTestMessage
  }
}

/**
 * Retourne la configuration de l'imprimante thermique, en créant la ligne
 * singleton avec des valeurs par défaut si elle n'existe pas encore.
 */
export function getPrinterConfig(): PrinterConfig {
  const db = getDb()

  let row = db.select().from(printerConfig).where(eq(printerConfig.id, PRINTER_CONFIG_ID)).get()
  if (!row) {
    db.insert(printerConfig).values({ id: PRINTER_CONFIG_ID }).run()
    row = db.select().from(printerConfig).where(eq(printerConfig.id, PRINTER_CONFIG_ID)).get()
  }
  if (!row) {
    throw new Error('Impossible de créer la ligne singleton PRINTER_CONFIG.')
  }

  return toPrinterConfig(row)
}

export function updatePrinterConfig(data: UpdatePrinterConfigDTO): PrinterConfig {
  const db = getDb()

  // S'assure que la ligne singleton existe avant la mise à jour.
  getPrinterConfig()

  if (data.connectionType === 'network' && data.host !== undefined && !data.host?.trim()) {
    throw new Error("L'adresse de l'imprimante réseau est requise.")
  }
  if (data.connectionType === 'usb' && data.devicePath !== undefined && !data.devicePath?.trim()) {
    throw new Error("Le port de l'imprimante USB est requis (ex: \\\\.\\COM3).")
  }
  if (data.port !== undefined && (data.port <= 0 || data.port > 65535)) {
    throw new Error('Le port TCP doit être compris entre 1 et 65535.')
  }

  db.update(printerConfig)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(printerConfig.id, PRINTER_CONFIG_ID))
    .run()

  return getPrinterConfig()
}

/** Enregistre le résultat du dernier test de connexion (bouton « Tester l'impression »). */
export function recordTestResult(success: boolean, message: string | null): PrinterConfig {
  const db = getDb()

  getPrinterConfig()

  db.update(printerConfig)
    .set({
      lastTestAt: new Date().toISOString(),
      lastTestSuccess: success,
      lastTestMessage: message
    })
    .where(eq(printerConfig.id, PRINTER_CONFIG_ID))
    .run()

  return getPrinterConfig()
}
