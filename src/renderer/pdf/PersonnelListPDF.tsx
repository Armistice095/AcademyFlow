import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatCFA } from '@renderer/lib/formatters'
import type { Employee } from '@shared/types/personnel.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface PersonnelListPDFProps {
  employees: Employee[]
  schoolInfo: SchoolInfo
}

const COL = { num: 26, name: 160, role: 120, phone: 90, salary: 90 }

/** Liste imprimable du personnel actif (F-025). */
export function PersonnelListPDF({ employees, schoolInfo }: PersonnelListPDFProps): JSX.Element {
  return (
    <Document title="Liste du personnel">
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Liste du personnel</Text>
        <Text style={{ textAlign: 'center', marginTop: -12, marginBottom: 16, color: '#64748b' }}>
          {employees.length} employé{employees.length > 1 ? 's' : ''} actif
          {employees.length > 1 ? 's' : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableHeaderRow}>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.num }]}>N°</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.name }]}>Nom et prénom(s)</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.role }]}>Fonction</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.phone }]}>Téléphone</Text>
            <Text style={[pdfStyles.tableCellHeader, { width: COL.salary }]}>Salaire mensuel</Text>
          </View>
          {employees.map((employee, index) => (
            <View style={pdfStyles.tableRow} key={employee.id} wrap={false}>
              <Text style={[pdfStyles.tableCell, { width: COL.num }]}>{index + 1}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.name }]}>
                {employee.lastName} {employee.firstName}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.role }]}>{employee.role}</Text>
              <Text style={[pdfStyles.tableCell, { width: COL.phone }]}>
                {employee.phone ?? '—'}
              </Text>
              <Text style={[pdfStyles.tableCell, { width: COL.salary }]}>
                {formatCFA(employee.monthlySalary)}
              </Text>
            </View>
          ))}
          {employees.length === 0 && (
            <View style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.tableCell, { width: 486 }]}>
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
