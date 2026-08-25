import { api } from './ipc'

/**
 * Imprime un reçu : tente l'impression thermique (`printer:printReceipt`,
 * configurée dans Paramètres > Imprimante) et, si elle échoue ou n'est pas
 * configurée, bascule automatiquement sur le fallback PDF déjà en place
 * (`openPdf` + `ReceiptPDF`). L'appelant fournit ce fallback car lui seul
 * dispose du contexte d'affichage (élève sélectionné, tranche...).
 */
export async function printReceiptWithFallback(
  receiptId: string,
  renderPdfFallback: () => Promise<void>
): Promise<void> {
  const result = await api.printer.printReceipt(receiptId)
  if (!result.success) {
    await renderPdfFallback()
  }
}
