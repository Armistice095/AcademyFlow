import { Document, Page, Text, View } from '@react-pdf/renderer'
import { pdfStyles, PdfHeader, PdfFooter, SignatureBlock } from './shared'
import { formatDate } from '@renderer/lib/formatters'
import type { Student } from '@shared/types/student.types'
import type { SchoolInfo } from '@shared/types/settings.types'

export interface EnrollmentCertPDFProps {
  student: Student
  className: string
  schoolYearLabel: string
  schoolInfo: SchoolInfo
}

/** Attestation d'inscription (F-009). */
export function EnrollmentCertPDF({
  student,
  className,
  schoolYearLabel,
  schoolInfo
}: EnrollmentCertPDFProps): JSX.Element {
  return (
    <Document title={`Attestation d'inscription - ${student.firstName} ${student.lastName}`}>
      <Page size="A4" style={pdfStyles.page}>
        <PdfHeader schoolInfo={schoolInfo} />
        <Text style={pdfStyles.title}>Attestation d’inscription</Text>

        <Text style={pdfStyles.paragraph}>
          Je soussigné(e), Directeur/Directrice de {schoolInfo.name || "l'établissement"}, atteste
          par la présente que l’élève désigné(e) ci-dessous est régulièrement inscrit(e) dans notre
          établissement au titre de l’année scolaire {schoolYearLabel}, en classe de {className}.
        </Text>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Identité de l’élève</Text>
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
          <View style={pdfStyles.row}>
            <Text style={pdfStyles.label}>Classe</Text>
            <Text style={pdfStyles.value}>{className}</Text>
          </View>
        </View>

        <Text style={pdfStyles.paragraph}>
          En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de
          droit.
        </Text>

        <SignatureBlock schoolInfo={schoolInfo} />
        <PdfFooter />
      </Page>
    </Document>
  )
}
