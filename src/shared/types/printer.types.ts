/** Types partagés Main ↔ Renderer du domaine Impression (Phase 9.2, F-018). */

export type PrinterConnectionType = 'usb' | 'network'

/**
 * Configuration de l'imprimante thermique — une seule imprimante configurée
 * à la fois (application mono-poste). Persistée dans `PRINTER_CONFIG`
 * (ligne singleton, voir `printer-config.service.ts`).
 */
export interface PrinterConfig {
  /** Impression thermique activée. Si `false`, l'application bascule directement sur le fallback PDF. */
  enabled: boolean
  connectionType: PrinterConnectionType
  /** Chemin du port local (USB), ex: `\\.\COM3` (Windows). Requis si `connectionType === 'usb'`. */
  devicePath: string | null
  /** Adresse IP ou nom d'hôte (réseau). Requis si `connectionType === 'network'`. */
  host: string | null
  /** Port TCP (réseau) — 9100 par défaut (port RAW standard ESC/POS). */
  port: number
  /** Horodatage du dernier test de connexion (bouton « Tester l'impression »). */
  lastTestAt: string | null
  lastTestSuccess: boolean | null
  /** Message d'erreur du dernier test, le cas échéant. */
  lastTestMessage: string | null
}

export interface UpdatePrinterConfigDTO {
  enabled?: boolean
  connectionType?: PrinterConnectionType
  devicePath?: string | null
  host?: string | null
  port?: number
}
