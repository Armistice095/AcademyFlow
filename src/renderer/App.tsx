import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@renderer/components/ui/toaster'
import { TooltipProvider } from '@renderer/components/ui/tooltip'
import { AppShell } from '@renderer/components/layout/AppShell'
import { AuthGuard } from '@renderer/components/layout/AuthGuard'
import { OnboardingGuard } from '@renderer/components/layout/OnboardingGuard'
import { OnboardingTransitionOutlet } from '@renderer/components/layout/OnboardingTransitionOutlet'
import { LicenseActivationPage } from '@renderer/pages/onboarding/LicenseActivationPage'
import { SchoolInfoOnboardingPage } from '@renderer/pages/onboarding/SchoolInfoOnboardingPage'
import { AdminAccountPage } from '@renderer/pages/onboarding/AdminAccountPage'
import { ClassesSetupPage } from '@renderer/pages/onboarding/ClassesSetupPage'
import { SchoolYearSetupPage } from '@renderer/pages/onboarding/SchoolYearSetupPage'
import { GoogleDriveSetupPage } from '@renderer/pages/onboarding/GoogleDriveSetupPage'
import { LoginPage } from '@renderer/pages/auth/LoginPage'
import { DashboardPage } from '@renderer/pages/dashboard/DashboardPage'
import { StudentsListPage } from '@renderer/pages/students/StudentsListPage'
import { StudentCreatePage } from '@renderer/pages/students/StudentCreatePage'
import { StudentDetailPage } from '@renderer/pages/students/StudentDetailPage'
import { ClassPromotionPage } from '@renderer/pages/students/ClassPromotionPage'
import { CashboxJournalPage } from '@renderer/pages/cashbox/CashboxJournalPage'
import { NewTransactionPage } from '@renderer/pages/cashbox/NewTransactionPage'
import { ReportsLayout } from '@renderer/pages/cashbox/reports/ReportsLayout'
import { OverviewReportPage } from '@renderer/pages/cashbox/reports/OverviewReportPage'
import { RevenueReportPage } from '@renderer/pages/cashbox/reports/RevenueReportPage'
import { ExpensesReportPage } from '@renderer/pages/cashbox/reports/ExpensesReportPage'
import { ArrearsReportPage } from '@renderer/pages/cashbox/reports/ArrearsReportPage'
import { ByClassReportPage } from '@renderer/pages/cashbox/reports/ByClassReportPage'
import { ByCashierReportPage } from '@renderer/pages/cashbox/reports/ByCashierReportPage'
import { StudentAccountPage } from '@renderer/pages/cashbox/StudentAccountPage'
import { PersonnelListPage } from '@renderer/pages/personnel/PersonnelListPage'
import { SalaryTrackingPage } from '@renderer/pages/personnel/SalaryTrackingPage'
import { SettingsPage } from '@renderer/pages/settings/SettingsPage'

/**
 * `HashRouter` plutôt que `BrowserRouter` : l'app est chargée depuis un
 * fichier local (`file://.../index.html`) une fois packagée, sans serveur
 * pour résoudre des chemins arbitraires — le hash routing est la pratique
 * standard pour React Router dans une app Electron.
 */
function App(): JSX.Element {
  return (
    <TooltipProvider>
      <HashRouter>
        <Routes>
          <Route element={<OnboardingGuard />}>
            <Route element={<OnboardingTransitionOutlet />}>
              <Route path="/onboarding/license" element={<LicenseActivationPage />} />
              <Route path="/onboarding/school" element={<SchoolInfoOnboardingPage />} />
              <Route path="/onboarding/admin" element={<AdminAccountPage />} />
              <Route path="/onboarding/classes" element={<ClassesSetupPage />} />
              <Route path="/onboarding/school-year" element={<SchoolYearSetupPage />} />
              <Route path="/onboarding/drive" element={<GoogleDriveSetupPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />

            <Route element={<AuthGuard />}>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />

                <Route path="students" element={<StudentsListPage />} />
                <Route path="students/new" element={<StudentCreatePage />} />
                <Route path="students/promotion" element={<ClassPromotionPage />} />
                <Route path="students/:id" element={<StudentDetailPage />} />

                <Route path="cashbox" element={<CashboxJournalPage />} />
                <Route path="cashbox/new" element={<NewTransactionPage />} />
                <Route path="cashbox/reports" element={<ReportsLayout />}>
                  <Route index element={<OverviewReportPage />} />
                  <Route path="recettes" element={<RevenueReportPage />} />
                  <Route path="depenses" element={<ExpensesReportPage />} />
                  <Route path="impayes" element={<ArrearsReportPage />} />
                  <Route path="par-classe" element={<ByClassReportPage />} />
                  <Route path="par-caissier" element={<ByCashierReportPage />} />
                </Route>
                <Route path="cashbox/student/:id" element={<StudentAccountPage />} />

                <Route path="personnel" element={<PersonnelListPage />} />
                <Route path="personnel/salaries" element={<SalaryTrackingPage />} />

                <Route path="settings" element={<SettingsPage />} />

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </HashRouter>
      <Toaster />
    </TooltipProvider>
  )
}

export default App
