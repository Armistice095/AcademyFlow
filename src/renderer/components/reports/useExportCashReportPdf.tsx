import { useState } from 'react'
import { api } from '@renderer/lib/ipc'
import { openPdf } from '@renderer/lib/pdf'
import { useToast } from '@renderer/lib/use-toast'
import { CashReportPDF } from '@renderer/pdf/CashReportPDF'
import { useReportsStore } from '@renderer/stores/reports.store'

/**
 * Export PDF du rapport actuellement chargé dans `reports.store`. Partagé par
 * le bouton d'en-tête de `OverviewReportPage` et le panneau `QuickExportPanel`
 * pour ne pas dupliquer la logique de génération.
 */
export function useExportCashReportPdf(): { exportPdf: () => Promise<void>; isExporting: boolean } {
  const { toast } = useToast()
  const report = useReportsStore((state) => state.report)
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = async (): Promise<void> => {
    if (!report) return
    setIsExporting(true)
    try {
      const schoolInfo = await api.settings.getSchoolInfo()
      await openPdf(
        <CashReportPDF report={report} schoolInfo={schoolInfo} />,
        `rapport-${report.from}-${report.to}.pdf`
      )
    } catch {
      toast({
        title: "Échec de l'export",
        description: 'Impossible de générer le PDF.',
        variant: 'destructive'
      })
    } finally {
      setIsExporting(false)
    }
  }

  return { exportPdf, isExporting }
}
