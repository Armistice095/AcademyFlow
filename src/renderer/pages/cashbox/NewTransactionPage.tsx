import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDownCircle, ArrowUpCircle, Check, Save, Search, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Card, CardContent } from '@renderer/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { FormField } from '@renderer/components/forms/FormField'
import { MoneyInput } from '@renderer/components/forms/MoneyInput'
import { useToast } from '@renderer/lib/use-toast'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useDebounce } from '@renderer/hooks/useDebounce'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { printReceiptWithFallback } from '@renderer/lib/print'
import { ReceiptPDF } from '@renderer/pdf/ReceiptPDF'
import { formatCFA } from '@renderer/lib/formatters'
import { cn } from '@renderer/lib/utils'
import {
  CASH_CATEGORY_LABELS,
  CASH_ENTRY_CATEGORIES,
  CASH_EXIT_CATEGORIES,
  type CashCategory
} from '@shared/constants/categories'
import type { StudentListItem } from '@shared/types/student.types'
import type { TuitionAccount } from '@shared/types/transaction.types'

export function NewTransactionPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { currentSchoolYear, loadCurrentSchoolYear } = useSettingsStore()

  useEffect(() => {
    void loadCurrentSchoolYear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [type, setType] = useState<'entry' | 'exit'>(
    searchParams.get('type') === 'exit' ? 'exit' : 'entry'
  )
  const [category, setCategory] = useState<CashCategory | ''>('')
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')

  const [studentQuery, setStudentQuery] = useState('')
  const debouncedStudentQuery = useDebounce(studentQuery, 300)
  const [studentResults, setStudentResults] = useState<StudentListItem[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null)
  const [account, setAccount] = useState<TuitionAccount | null>(null)
  const [installmentId, setInstallmentId] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const categories = type === 'entry' ? CASH_ENTRY_CATEGORIES : CASH_EXIT_CATEGORIES

  // Pré-remplissage depuis « Enregistrer un paiement » (StudentAccountPage).
  useEffect(() => {
    const studentId = searchParams.get('studentId')
    const preselectedInstallment = searchParams.get('installmentId')
    if (studentId) {
      api.students.findById(studentId).then((s) => {
        if (s) {
          setSelectedStudent({ ...s, className: null })
          setCategory('scolarite')
        }
      })
    }
    if (preselectedInstallment) setInstallmentId(preselectedInstallment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!debouncedStudentQuery.trim()) {
      setStudentResults([])
      return
    }
    api.students
      .search({ query: debouncedStudentQuery, pageSize: 6, schoolYearId: currentSchoolYear?.id })
      .then((res) => setStudentResults(res.items))
  }, [debouncedStudentQuery, currentSchoolYear])

  useEffect(() => {
    if (selectedStudent && category === 'scolarite') {
      api.cashbox.getStudentAccount(selectedStudent.id).then(setAccount)
    } else {
      setAccount(null)
      setInstallmentId('')
    }
  }, [selectedStudent, category])

  const selectedInstallment = account?.installments.find((i) => i.installmentId === installmentId)

  useEffect(() => {
    if (selectedInstallment) {
      setAmount(Math.max(selectedInstallment.expectedAmount - selectedInstallment.paidAmount, 0))
    }
  }, [selectedInstallment])

  const requiresStudent = category === 'frais_inscription' || category === 'scolarite'

  const handleSubmit = async (): Promise<void> => {
    setError(null)

    if (!category) {
      setError('Veuillez choisir une catégorie.')
      return
    }
    if (requiresStudent && !selectedStudent) {
      setError('Veuillez sélectionner un élève pour cette catégorie.')
      return
    }
    if (category === 'scolarite' && !installmentId) {
      setError('Veuillez sélectionner la tranche concernée.')
      return
    }
    if (amount <= 0) {
      setError('Le montant doit être positif.')
      return
    }

    setSubmitting(true)
    try {
      const transaction = await api.cashbox.createEntry({
        type,
        category,
        amount,
        description: description || undefined,
        studentId: selectedStudent?.id,
        installmentId: category === 'scolarite' ? installmentId : undefined
      })

      if (type === 'entry') {
        const receipt = await api.cashbox.getReceipt(transaction.id)
        if (receipt) {
          await printReceiptWithFallback(receipt.id, async () => {
            const [schoolInfo, operator] = await Promise.all([
              api.settings.getSchoolInfo(),
              api.auth.getCurrentUser()
            ])
            await openPdf(
              <ReceiptPDF
                receipt={receipt}
                transaction={transaction}
                student={selectedStudent}
                installmentLabel={selectedInstallment?.label ?? null}
                operatorName={operator?.fullName ?? '—'}
                schoolInfo={schoolInfo}
              />,
              `recu-${receipt.receiptNumber}.pdf`
            )
          })
        }
        toast({ title: 'Entrée enregistrée', description: 'Le reçu a été imprimé.' })
      } else {
        toast({ title: 'Sortie enregistrée' })
      }

      navigate('/cashbox', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'enregistrement.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setType('entry')
            setCategory('')
          }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors',
            type === 'entry'
              ? 'border-success bg-success/10 text-success'
              : 'border-input text-muted-foreground'
          )}
        >
          <ArrowDownCircle className="h-4 w-4" />
          Entrée de caisse
        </button>
        <button
          type="button"
          onClick={() => {
            setType('exit')
            setCategory('')
            setSelectedStudent(null)
          }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors',
            type === 'exit'
              ? 'border-destructive bg-destructive/10 text-destructive'
              : 'border-input text-muted-foreground'
          )}
        >
          <ArrowUpCircle className="h-4 w-4" />
          Sortie de caisse
        </button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <FormField label="Catégorie" htmlFor="category" required>
            <Select value={category} onValueChange={(v) => setCategory(v as CashCategory)}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CASH_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {requiresStudent && (
            <FormField label="Élève" required>
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
                  <span className="text-sm">
                    {selectedStudent.lastName} {selectedStudent.firstName} (
                    {selectedStudent.matricule})
                  </span>
                  <button type="button" onClick={() => setSelectedStudent(null)}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Rechercher un élève par nom ou matricule..."
                      className="pl-8"
                    />
                  </div>
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                      {studentResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedStudent(s)
                            setStudentQuery('')
                            setStudentResults([])
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                        >
                          <span>
                            {s.lastName} {s.firstName}
                          </span>
                          <span className="text-xs text-muted-foreground">{s.matricule}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </FormField>
          )}

          {category === 'scolarite' && selectedStudent && (
            <FormField label="Tranche" htmlFor="installment" required>
              {account && account.installments.length > 0 ? (
                <Select value={installmentId} onValueChange={setInstallmentId}>
                  <SelectTrigger id="installment">
                    <SelectValue placeholder="Choisir une tranche" />
                  </SelectTrigger>
                  <SelectContent>
                    {account.installments.map((i) => (
                      <SelectItem key={i.installmentId} value={i.installmentId}>
                        {i.label} — reste {formatCFA(Math.max(i.expectedAmount - i.paidAmount, 0))}
                        {i.status === 'en_arriere' ? ' (en arriéré)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun barème de frais configuré pour la classe de cet élève.
                </p>
              )}
            </FormField>
          )}

          <FormField label="Montant" htmlFor="amount" required>
            <MoneyInput id="amount" value={amount} onChange={setAmount} />
          </FormField>

          <FormField label={type === 'entry' ? 'Description' : 'Motif'} htmlFor="description">
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" onClick={() => navigate('/cashbox')}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              {type === 'entry' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {submitting ? 'Enregistrement...' : "Enregistrer l'opération"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
