import { StyleSheet, View, Text, Image } from '@react-pdf/renderer'
import { formatDateTime } from '@renderer/lib/formatters'
import type { SchoolInfo } from '@shared/types/settings.types'

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#0f172a'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e11d48',
    paddingBottom: 12,
    marginBottom: 20
  },
  logo: { width: 44, height: 44, objectFit: 'contain' },
  schoolName: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  schoolDetail: { fontSize: 8, color: '#64748b' },
  title: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 18,
    textTransform: 'uppercase'
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 6,
    textTransform: 'uppercase',
    color: '#334155'
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, color: '#64748b' },
  value: { flex: 1, fontWeight: 500 },
  paragraph: { lineHeight: 1.6, marginBottom: 10, textAlign: 'justify' },
  table: { display: 'flex', width: 'auto', marginTop: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1'
  },
  tableCell: { padding: 5, fontSize: 9 },
  tableCellHeader: { padding: 5, fontSize: 9, fontWeight: 700 },
  signatureBlock: { marginTop: 40, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureArea: { alignItems: 'center', width: 160 },
  stampImage: { width: 70, height: 70, objectFit: 'contain', marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
    paddingTop: 6
  }
})

export function PdfHeader({ schoolInfo }: { schoolInfo: SchoolInfo }): JSX.Element {
  return (
    <View style={pdfStyles.header}>
      {schoolInfo.logoDataUrl && <Image src={schoolInfo.logoDataUrl} style={pdfStyles.logo} />}
      <View>
        <Text style={pdfStyles.schoolName}>{schoolInfo.name || 'Établissement scolaire'}</Text>
        {schoolInfo.address && <Text style={pdfStyles.schoolDetail}>{schoolInfo.address}</Text>}
        <Text style={pdfStyles.schoolDetail}>
          {[schoolInfo.phone, schoolInfo.email].filter(Boolean).join('  •  ')}
        </Text>
      </View>
    </View>
  )
}

export function PdfFooter(): JSX.Element {
  return (
    <Text style={pdfStyles.footer} fixed>
      Document généré le {formatDateTime(new Date())} via AcademyFlow
    </Text>
  )
}

export function SignatureBlock({ schoolInfo }: { schoolInfo: SchoolInfo }): JSX.Element {
  return (
    <View style={pdfStyles.signatureBlock}>
      <View style={pdfStyles.signatureArea}>
        <Text>Le Directeur / La Directrice</Text>
        {schoolInfo.stampDataUrl && (
          <Image src={schoolInfo.stampDataUrl} style={pdfStyles.stampImage} />
        )}
      </View>
    </View>
  )
}
