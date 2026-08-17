import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA } from '@renderer/lib/formatters'
import type { ArrearsStudent } from '@shared/types/transaction.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface ArrearsListPDFProps {
  students: ArrearsStudent[]
  schoolInfo: SchoolInfo
}

const COL = { matricule: 80, name: 150, className: 70, due: 90, count: 90 }

/** Liste des élèves en arriéré (F-021). */
export function ArrearsListPDF({ students, schoolInfo }: ArrearsListPDFProps): JSX.Element {
  const totalDue = students.reduce((sum, s) => sum + s.balance, 0)

  return (
    <Document title="Liste des arriérés">
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Liste des élèves en arriéré</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 16, color: '#64748b' }}>
          {students.length} élève{students.length > 1 ? 's' : ''} — Total dû : {formatCFA(totalDue)}
        </Text>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeaderRow}>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.matricule }]}>Matricule</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.name }]}>Nom et prénom(s)</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.className }]}>Classe</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.due }]}>Montant dû</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.count }]}>Tranches en retard</Text>
          </View>
          {students.map((student) => (
            <View style={pdfStyles.tableRow} key={student.studentId} wrap={false}>
              <Text style={[pdfStyles.tableCell, { width: COL.matricule }]}>{student.matricule}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.name }]}>{student.studentName}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.className }]}>{student.className}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.due }]}>{formatCFA(student.balance)}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.count }]}>{student.lateInstallmentsCount}</Text>
            </View>
          ))}
          {students.length === 0 && (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: 480 }]}>Aucun élève en arriéré.</Text>
            </View>
          )}
        </View>

        <PdfFooter />
      </Page>
    </Document>
  )
}
