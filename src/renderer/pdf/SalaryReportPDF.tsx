import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA, formatDate } from '@renderer/lib/formatters'
import { MONTH_LABELS_FR } from '@shared/constants/defaults'
import type { SalaryMonthStatus } from '@shared/types/personnel.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface SalaryReportPDFProps {
  statuses: SalaryMonthStatus[]
  month: number
  year: number
  schoolInfo: SchoolInfo
}

const COL = { num: 26, name: 150, role: 110, salary: 90, status: 70, paidAt: 90 }

/** État mensuel des paiements de salaire (F-023, F-025). */
export function SalaryReportPDF({
  statuses,
  month,
  year,
  schoolInfo
}: SalaryReportPDFProps): JSX.Element {
  const monthLabel = MONTH_LABELS_FR[month - 1] ?? String(month)
  const totalDue = statuses.reduce((sum, s) => sum + s.employee.monthlySalary, 0)
  const totalPaid = statuses
    .filter((s) => s.isPaid)
    .reduce((sum, s) => sum + s.employee.monthlySalary, 0)
  const totalRemaining = totalDue - totalPaid
  const paidCount = statuses.filter((s) => s.isPaid).length

  return (
    <Document title={`État des salaires - ${monthLabel} ${year}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>État des paiements de salaire</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 18, color: '#64748b' }}>
          {monthLabel} {year} — {paidCount}/{statuses.length} employé
          {statuses.length > 1 ? 's' : ''} payé
          {paidCount > 1 ? 's' : ''}
        </Text>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <SummaryBox label="Total dû" value={formatCFA(totalDue)} color="#0f172a" />
          <SummaryBox label="Total payé" value={formatCFA(totalPaid)} color="#16a34a" />
          <SummaryBox label="Reste à payer" value={formatCFA(totalRemaining)} color="#ef4444" />
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeaderRow}>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.num }]}>N°</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.name }]}>Nom et prénom(s)</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.role }]}>Fonction</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.salary }]}>Salaire</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.status }]}>Statut</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.paidAt }]}>Date paiement</Text>
          </View>
          {statuses.map((status, index) => (
            <View style={pdfStyles.tableRow} key={status.employee.id} wrap={false}>
              <Text style={[pdfStyles.tableCell, { width: COL.num }]}>{index + 1}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.name }]}>
                {status.employee.lastName} {status.employee.firstName}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.role }]}>{status.employee.role}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.salary }]}>
                {formatCFA(status.employee.monthlySalary)}
              </Text>
              <Text
                style={[
                  pdfStyles.tableCell,
                  { width: COL.status, color: status.isPaid ? '#16a34a' : '#ef4444' }
                ]}
              >
                {status.isPaid ? 'Payé' : 'Non payé'}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.paidAt }]}>
                {status.paidAt ? formatDate(status.paidAt) : '—'}
              </Text>
            </View>
          ))}
          {statuses.length === 0 && (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: 536 }]}>
                Aucun employé actif enregistré.
              </Text>
            </View>
          )}
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
      <Text style={{ fontSize: 13, fontWeight: 700, color }}>{value}</Text>
    </View>
  )
}
