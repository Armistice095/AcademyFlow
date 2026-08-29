import ExcelJS from 'exceljs'
import { api } from './ipc'
import { CASH_CATEGORY_LABELS } from '@shared/constants/categories'
import type { CashReportV2 } from '@shared/types/transaction.types'

/**
 * Génère un classeur Excel à 3 feuilles (Résumé / Répartition des entrées /
 * Évolution quotidienne) à partir du rapport de la Vue générale, puis
 * l'envoie au process main pour ouverture avec l'application par défaut du
 * système (voir `printer.ipc.ts` → `openFile`, généralisation d'`openPdf`).
 */
export async function exportReportToExcel(report: CashReportV2): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AcademyFlow'
  workbook.created = new Date()

  const summarySheet = workbook.addWorksheet('Résumé')
  summarySheet.columns = [
    { header: 'Indicateur', key: 'label', width: 32 },
    { header: 'Valeur', key: 'value', width: 20 }
  ]
  summarySheet.addRows([
    { label: 'Période', value: `${report.from} au ${report.to}` },
    { label: 'Solde initial', value: report.openingBalance },
    { label: 'Total des entrées', value: report.kpis.totalEntries },
    { label: 'Total des sorties', value: report.kpis.totalExits },
    { label: 'Solde net', value: report.kpis.netBalance },
    { label: 'Nombre de transactions', value: report.kpis.transactionCount },
    { label: 'Total à recouvrer (snapshot courant)', value: report.kpis.totalArrears }
  ])
  summarySheet.getRow(1).font = { bold: true }

  const categorySheet = workbook.addWorksheet('Répartition des entrées')
  categorySheet.columns = [
    { header: 'Catégorie', key: 'category', width: 28 },
    { header: 'Montant', key: 'amount', width: 16 },
    { header: 'Part', key: 'percentage', width: 12 }
  ]
  for (const row of report.byCategory) {
    categorySheet.addRow({
      category: CASH_CATEGORY_LABELS[row.category] ?? row.category,
      amount: row.amount,
      percentage: `${row.percentage.toFixed(0)}%`
    })
  }
  categorySheet.getRow(1).font = { bold: true }

  const seriesSheet = workbook.addWorksheet('Évolution quotidienne')
  seriesSheet.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Entrées', key: 'entries', width: 16 },
    { header: 'Sorties', key: 'exits', width: 16 }
  ]
  for (const point of report.timeSeries) {
    seriesSheet.addRow(point)
  }
  seriesSheet.getRow(1).font = { bold: true }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(new Error('Échec de la lecture du fichier Excel généré.'))
    reader.readAsDataURL(blob)
  })

  await api.printer.openFile(base64, `rapport-${report.from}-${report.to}.xlsx`)
}
