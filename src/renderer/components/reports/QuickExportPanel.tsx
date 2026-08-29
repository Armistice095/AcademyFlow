import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { useToast } from '@renderer/lib/use-toast'
import { exportReportToExcel } from '@renderer/lib/excel'
import { useReportsStore } from '@renderer/stores/reports.store'
import { useExportCashReportPdf } from './useExportCashReportPdf'

/**
 * Panneau "Export rapide", persistant dans la sidebar des Rapports quel que
 * soit l'onglet actif (mockup). Exporte le rapport de la Vue générale
 * actuellement chargé dans `reports.store` — les 5 autres onglets gèrent
 * leurs propres agrégats et n'alimentent pas encore ce champ (voir plan §3).
 */
export function QuickExportPanel(): JSX.Element {
  const { toast } = useToast()
  const report = useReportsStore((state) => state.report)
  const { exportPdf, isExporting: isExportingPdf } = useExportCashReportPdf()
  const [isExportingExcel, setIsExportingExcel] = useState(false)

  const handleExcelExport = async (): Promise<void> => {
    if (!report) return
    setIsExportingExcel(true)
    try {
      await exportReportToExcel(report)
    } catch {
      toast({
        title: "Échec de l'export",
        description: 'Impossible de générer le fichier Excel.',
        variant: 'destructive'
      })
    } finally {
      setIsExportingExcel(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Export rapide</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Exportez le rapport actuel dans le format de votre choix.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            disabled={!report || isExportingPdf}
            onClick={() => void exportPdf()}
          >
            <FileText className="h-3.5 w-3.5 text-destructive" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            disabled={!report || isExportingExcel}
            onClick={() => void handleExcelExport()}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-success" />
            Excel
          </Button>
        </div>
        {!report && (
          <p className="text-xs text-muted-foreground">Disponible depuis l’onglet Vue générale.</p>
        )}
      </CardContent>
    </Card>
  )
}
