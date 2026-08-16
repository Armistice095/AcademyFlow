import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatDate } from '@renderer/lib/formatters'
import type { Student } from '@shared/types/student.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface ClassListPDFProps {
  students: Student[]
  className: string
  schoolYearLabel: string
  schoolInfo: SchoolInfo
}

const COL = { num: 28, matricule: 75, name: 150, gender: 45, dob: 85 }

/** Liste de classe imprimable (F-011, export de F-008). */
export function ClassListPDF({ students, className, schoolYearLabel, schoolInfo }: ClassListPDFProps): JSX.Element {
  return (
    <Document title={`Liste de classe - ${className}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Liste des élèves — {className}</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 16, color: '#64748b' }}>
          Année scolaire {schoolYearLabel} — {students.length} élève{students.length > 1 ? 's' : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeaderRow}>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.num }]}>N°</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.matricule }]}>Matricule</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.name }]}>Nom et prénom(s)</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.gender }]}>Sexe</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.dob }]}>Date de naissance</Text>
          </View>
          {students.map((student, index) => (
            <View style={pdfStyles.tableRow} key={student.id} wrap={false}>
              <Text style={[pdfStyles.tableCell, { width: COL.num }]}>{index + 1}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.matricule }]}>{student.matricule}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.name }]}>
                {student.lastName} {student.firstName}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.gender }]}>
                {student.gender === 'M' ? 'M' : 'F'}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.dob }]}>{formatDate(student.dateOfBirth)}</Text>
            </View>
          ))}
        </View>

        <PdfFooter />
      </Page>
    </Document>
  )
}
