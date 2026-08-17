import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type { CashReport } from '@shared/types/transaction.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface CashReportPDFProps {
  report: CashReport
  schoolInfo: SchoolInfo
}

/** Rapport financier (F-017) — synthèse entrées/sorties par catégorie sur une période. */
export function CashReportPDF({ report, schoolInfo }: CashReportPDFProps): JSX.Element {
  const categoryRows = Object.entries(report.byCategory).sort(([, a], [, b]) => b - a)

  return (
    <Document title={`Rapport financier ${report.from} - ${report.to}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Rapport financier</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 18, color: '#64748b' }}>
          Période du {formatDate(report.from)} au {formatDate(report.to)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <SummaryBox label="Total entrées" value={formatCFA(report.totalEntries)} color="#16a34a" />
          <SummaryBox label="Total sorties" value={formatCFA(report.totalExits)} color="#ef4444" />
          <SummaryBox label="Solde net" value={formatCFA(report.netBalance)} color="#0f172a" />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Répartition par catégorie</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow}>
              <Text style={[pdfStyles.tableCellHeader, { width: 220 }]}>Catégorie</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 140 }]}>Montant</Text>
            </View>
            {categoryRows.map(([category, amount]) => (
              <View style={pdfStyles.tableRow} key={category}>
                <Text style={[pdfStyles.tableCell, { width: 220 }]}>
                  {CASH_CATEGORY_LABELS[category as CashCategory] ?? category}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: 140 }]}>{formatCFA(amount)}</Text>
              </View>
            ))}
            {categoryRows.length === 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.tableCell, { width: 360 }]}>
                  Aucune opération enregistrée sur cette période.
                </Text>
              </View>
            )}
          </View>
        </View>

        <PdfFooter />
      </Page>
    </Document>
  )
}

function SummaryBox({ label, value, color }: { label: string; value: string; color: string }): JSX.Element {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 10 }}>
      <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: 700, color }}>{value}</Text>
    </View>
  )
}
