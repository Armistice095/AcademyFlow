import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { CASH_CATEGORY_LABELS } from '@shared/constants/categories'
import type { CashReportV2 } from '@shared/types/transaction.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface CashReportPDFProps {
  report: CashReportV2
  schoolInfo: SchoolInfo
}

/** Rapport financier (F-017 refonte) — synthèse KPI + répartition des entrées par catégorie sur une période. */
export function CashReportPDF({ report, schoolInfo }: CashReportPDFProps): JSX.Element {
  const { kpis } = report

  return (
    <Document title={`Rapport financier ${report.from} - ${report.to}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Rapport financier</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 18, color: '#64748b' }}>
          Période du {formatDate(report.from)} au {formatDate(report.to)}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <SummaryBox label="Total entrées" value={formatCFA(kpis.totalEntries)} color="#16a34a" />
          <SummaryBox label="Total sorties" value={formatCFA(kpis.totalExits)} color="#ef4444" />
          <SummaryBox label="Solde net" value={formatCFA(kpis.netBalance)} color="#0f172a" />
          <SummaryBox
            label="Total à recouvrer"
            value={formatCFA(kpis.totalArrears)}
            color="#8b5cf6"
          />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Résumé de la période</Text>
          <View style={pdfStyles.table}>
            <SummaryRow label="Solde initial" value={formatCFA(report.openingBalance)} />
            <SummaryRow label="Total des entrées" value={formatCFA(kpis.totalEntries)} />
            <SummaryRow label="Total des sorties" value={formatCFA(kpis.totalExits)} />
            <SummaryRow label="Solde net" value={formatCFA(kpis.netBalance)} />
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Répartition des entrées par catégorie</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow}>
              <Text style={[pdfStyles.tableCellHeader, { width: 220 }]}>Catégorie</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 140 }]}>Montant</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 80 }]}>Part</Text>
            </View>
            {report.byCategory.map((row) => (
              <View style={pdfStyles.tableRow} key={row.category}>
                <Text style={[pdfStyles.tableCell, { width: 220 }]}>
                  {CASH_CATEGORY_LABELS[row.category] ?? row.category}
                </Text>
                <Text style={[pdfStyles.tableCell, { width: 140 }]}>{formatCFA(row.amount)}</Text>
                <Text style={[pdfStyles.tableCell, { width: 80 }]}>
                  {row.percentage.toFixed(0)}%
                </Text>
              </View>
            ))}
            {report.byCategory.length === 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.tableCell, { width: 440 }]}>
                  Aucune entrée enregistrée sur cette période.
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

function SummaryBox({
  label,
  value,
  color
}: {
  label: string
  value: string
  color: string
}): JSX.Element {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 10 }}>
      <Text style={{ fontSize: 8, color: '#64748b', marginBottom: 3 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: 700, color }}>{value}</Text>
    </View>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={pdfStyles.tableRow}>
      <Text style={[pdfStyles.tableCell, { width: 220 }]}>{label}</Text>
      <Text style={[pdfStyles.tableCell, { width: 220, fontWeight: 700 }]}>{value}</Text>
    </View>
  )
}
