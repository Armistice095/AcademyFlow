import { Document, Page, Text, View, Image } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter } from './shared'
import { formatDate } from '@renderer/lib/formatters'
import type { EnrollmentWithDetails, Student } from '@shared/types/student.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface StudentFilePDFProps {
  student: Student
  history: EnrollmentWithDetails[]
  schoolInfo: SchoolInfo
}

const STATUS_LABELS: Record<string, string> = {
  admis: 'Admis(e)',
  redoublant: 'Redoublant(e)',
  transféré: 'Transféré(e)'
}

/** Fiche individuelle de l'élève (F-012). */
export function StudentFilePDF({ student, history, schoolInfo }: StudentFilePDFProps): JSX.Element {
  return (
    <Document title={`Fiche élève - ${student.firstName} ${student.lastName}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Fiche individuelle de l'élève</Text>

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <View style={pdfStyles.section}>
              <Text style={pdfStyles.sectionTitle}>Identité</Text>
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Matricule</Text>
                <Text style={pdfStyles.value}>{student.matricule}</Text>
              </View>
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Nom et prénom(s)</Text>
                <Text style={pdfStyles.value}>
                  {student.lastName} {student.firstName}
                </Text>
              </View>
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Sexe</Text>
                <Text style={pdfStyles.value}>{student.gender === 'M' ? 'Masculin' : 'Féminin'}</Text>
              </View>
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Date de naissance</Text>
                <Text style={pdfStyles.value}>{formatDate(student.dateOfBirth)}</Text>
              </View>
              {student.placeOfBirth && (
                <View style={pdfStyles.row}>
                  <Text style={pdfStyles.label}>Lieu de naissance</Text>
                  <Text style={pdfStyles.value}>{student.placeOfBirth}</Text>
                </View>
              )}
              <View style={pdfStyles.row}>
                <Text style={pdfStyles.label}>Nationalité</Text>
                <Text style={pdfStyles.value}>{student.nationality}</Text>
              </View>
              {student.address && (
                <View style={pdfStyles.row}>
                  <Text style={pdfStyles.label}>Adresse</Text>
                  <Text style={pdfStyles.value}>{student.address}</Text>
                </View>
              )}
              {student.previousSchool && (
                <View style={pdfStyles.row}>
                  <Text style={pdfStyles.label}>École de provenance</Text>
                  <Text style={pdfStyles.value}>{student.previousSchool}</Text>
                </View>
              )}
            </View>
          </View>
          {student.photoPath && (
            <Image src={student.photoPath} style={{ width: 80, height: 96, objectFit: 'cover' }} />
          )}
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Responsables</Text>
          {(student.guardians ?? []).map((guardian) => (
            <View style={pdfStyles.row} key={guardian.id}>
              <Text style={pdfStyles.label}>{guardian.relationship}</Text>
              <Text style={pdfStyles.value}>
                {guardian.lastName} {guardian.firstName} — {guardian.phone}
                {guardian.profession ? ` (${guardian.profession})` : ''}
              </Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Parcours scolaire</Text>
          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow}>
              <Text style={[pdfStyles.tableCellHeader, { width: 130 }]}>Année scolaire</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 100 }]}>Classe</Text>
              <Text style={[pdfStyles.tableCellHeader, { width: 100 }]}>Statut</Text>
            </View>
            {history.map((entry) => (
              <View style={pdfStyles.tableRow} key={entry.id}>
                <Text style={[pdfStyles.tableCell, { width: 130 }]}>{entry.schoolYearLabel}</Text>
                <Text style={[pdfStyles.tableCell, { width: 100 }]}>{entry.className}</Text>
                <Text style={[pdfStyles.tableCell, { width: 100 }]}>
                  {STATUS_LABELS[entry.status] ?? entry.status}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <PdfFooter />
      </Page>
    </Document>
  )
}
