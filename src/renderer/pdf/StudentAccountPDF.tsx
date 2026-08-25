import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA, formatDate, formatMatricule } from '@renderer/lib/formatters'
import { PAYMENT_ROW_STATUS_LABELS } from '@renderer/lib/tuition'
import type { Student } from '@shared/types/student.types'
import type { StudentPaymentRow, TuitionAccount } from '@shared/types/transaction.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface StudentAccountPDFProps {
  student: Student
  className: string
  schoolYearLabel: string
  account: TuitionAccount | null
  rows: StudentPaymentRow[]
  schoolInfo: SchoolInfo
}

/** Relevé du compte de scolarité — historique des paiements et solde. */
export function StudentAccountPDF({
  student,
  className,
  schoolYearLabel,
  account,
  rows,
  schoolInfo
}: StudentAccountPDFProps): JSX.Element {
  return (
    <Document title={`Compte de scolarité - ${student.lastName} ${student.firstName}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Compte de scolarité</Text>

        <View style={pdfStyles.section}>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Élève</Text>
            <Text style={pdfStyles.value}>
              {student.lastName} {student.firstName}
            </Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Matricule</Text>
            <Text style={pdfStyles.value}>{formatMatricule(student.matricule)}</Text>
          </View>
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Classe</Text>
            <Text style={pdfStyles.value}>
              {className} — {schoolYearLabel}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <SummaryBox label="Total attendu" value={formatCFA(account?.totalExpected ?? 0)} color="#0f172a" />
          <SummaryBox label="Total payé" value={formatCFA(account?.totalPaid ?? 0)} color="#16a34a" />
          <SummaryBox label="Reste à payer" value={formatCFA(Math.max(account?.balance ?? 0, 0))} color="#e11d48" />
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Historique des paiements</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow}>
              <Text style={[pdfStyles.tableCellHeader, { width: 90 }]}>Date</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 240 }]}>Description / Frais</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 100 }]}>Montant</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 90 }]}>Statut</Text>
            </View>
            {rows.map((row, index) => (
              <View style={pdfStyles.tableRow} key={index}>
                <Text style={[pdfStyles.tableCell, { width: 90 }]}>{formatDate(row.date)}</Text>
                <Text style={[pdfStyles.tableCell, { width: 240 }]}>{row.description}</Text>
                <Text style={[pdfStyles.tableCell, { width: 100 }]}>{formatCFA(row.amount)}</Text>
                <Text style={[pdfStyles.tableCell, { width: 90 }]}>{PAYMENT_ROW_STATUS_LABELS[row.status]}</Text>
              </View>
            ))}
            {rows.length === 0 && (
              <View style={pdfStyles.tableRow}>
                <Text style={[pdfStyles.tableCell, { width: 520 }]}>Aucune opération enregistrée.</Text>
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
