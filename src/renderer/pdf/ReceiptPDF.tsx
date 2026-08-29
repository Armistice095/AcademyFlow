import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { formatCFA, formatDateTime } from '@renderer/lib/formatters'
import { formatAmountInWords } from '@renderer/lib/numberToWords'
import { CASH_CATEGORY_LABELS, type CashCategory } from '@shared/constants/categories'
import type { Receipt, Transaction } from '@shared/types/transaction.types'
import type { Student } from '@shared/types/student.types'
import type { SchoolInfo } from '@shared/types/settings.types'

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: 'Helvetica', color: '#0f172a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#e11d48',
    paddingBottom: 8,
    marginBottom: 12
  },
  logo: { width: 32, height: 32, objectFit: 'contain' },
  schoolName: { fontSize: 11, fontWeight: 700 },
  schoolDetail: { fontSize: 7, color: '#64748b' },
  title: { fontSize: 13, fontWeight: 700, textAlign: 'center', marginBottom: 4 },
  receiptNumber: { fontSize: 9, textAlign: 'center', color: '#64748b', marginBottom: 14 },
  row: { flexDirection: 'row', marginBottom: 5 },
  label: { width: 100, color: '#64748b' },
  value: { flex: 1, fontWeight: 500 },
  amountBox: {
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 10,
    alignItems: 'center'
  },
  amountValue: { fontSize: 18, fontWeight: 700, color: '#e11d48' },
  amountWords: { fontSize: 8, marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  footer: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between' },
  footerBlock: { alignItems: 'center', width: 130 },
  footerLine: {
    marginTop: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#94a3b8',
    width: '100%',
    textAlign: 'center',
    paddingTop: 2,
    fontSize: 7,
    color: '#64748b'
  }
})

export interface ReceiptPDFProps {
  receipt: Receipt
  transaction: Transaction
  student: Student | null
  installmentLabel: string | null
  operatorName: string
  schoolInfo: SchoolInfo
}

/** Reçu de paiement (F-018) — format A5, généré immédiatement après chaque entrée de caisse. */
export function ReceiptPDF({
  receipt,
  transaction,
  student,
  installmentLabel,
  operatorName,
  schoolInfo
}: ReceiptPDFProps): JSX.Element {
  return (
    <Document title={`Reçu ${receipt.receiptNumber}`}>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          {schoolInfo.logoDataUrl && <Image src={schoolInfo.logoDataUrl} style={styles.logo} />}
          <View>
            <Text style={styles.schoolName}>{schoolInfo.name || 'Établissement scolaire'}</Text>
            {schoolInfo.address && <Text style={styles.schoolDetail}>{schoolInfo.address}</Text>}
            <Text style={styles.schoolDetail}>{schoolInfo.phone}</Text>
          </View>
        </View>

        <Text style={styles.title}>Reçu de paiement</Text>
        <Text style={styles.receiptNumber}>
          N° {receipt.receiptNumber} — {formatDateTime(receipt.createdAt)}
        </Text>

        {student && (
          <View style={styles.row}>
            <Text style={styles.label}>Élève</Text>
            <Text style={styles.value}>
              {student.lastName} {student.firstName} ({student.matricule})
            </Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.label}>Type de frais</Text>
          <Text style={styles.value}>
            {CASH_CATEGORY_LABELS[transaction.category as CashCategory]}
          </Text>
        </View>
        {installmentLabel && (
          <View style={styles.row}>
            <Text style={styles.label}>Tranche</Text>
            <Text style={styles.value}>{installmentLabel}</Text>
          </View>
        )}
        {transaction.description && (
          <View style={styles.row}>
            <Text style={styles.label}>Motif</Text>
            <Text style={styles.value}>{transaction.description}</Text>
          </View>
        )}

        <View style={styles.amountBox}>
          <Text style={styles.amountValue}>{formatCFA(transaction.amount)}</Text>
          <Text style={styles.amountWords}>{formatAmountInWords(transaction.amount)}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBlock}>
            <Text style={styles.footerLine}>Opérateur : {operatorName}</Text>
          </View>
          <View style={styles.footerBlock}>
            <Text style={styles.footerLine}>Signature / Cachet</Text>
          </View>
        </View>

        {receipt.printCount > 0 && (
          <Text style={{ marginTop: 10, fontSize: 7, textAlign: 'center', color: '#94a3b8' }}>
            Copie n° {receipt.printCount + 1}
          </Text>
        )}
      </Page>
    </Document>
  )
}
