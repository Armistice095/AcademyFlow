import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { SchoolYearPage } from './SchoolYearPage'
import { TuitionFeesPage } from './TuitionFeesPage'
import { SchoolInfoPage } from './SchoolInfoPage'
import { PrinterSettingsPage } from './PrinterSettingsPage'
import { BackupSettingsPage } from './BackupSettingsPage'
import { UsersSettingsPage } from './UsersSettingsPage'

export function SettingsPage(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Configuration de l’année scolaire, des barèmes de frais, de l’établissement, de
          l’impression, de la sauvegarde et des comptes utilisateurs.
        </p>
      </div>

      <Tabs defaultValue="school-year">
        <TabsList>
          <TabsTrigger value="school-year">Année scolaire</TabsTrigger>
          <TabsTrigger value="tuition-fees">Barème des frais</TabsTrigger>
          <TabsTrigger value="school-info">Établissement</TabsTrigger>
          <TabsTrigger value="printer">Imprimante</TabsTrigger>
          <TabsTrigger value="backup">Sauvegarde</TabsTrigger>
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
        </TabsList>
        <TabsContent value="school-year">
          <SchoolYearPage />
        </TabsContent>
        <TabsContent value="tuition-fees">
          <TuitionFeesPage />
        </TabsContent>
        <TabsContent value="school-info">
          <SchoolInfoPage />
        </TabsContent>
        <TabsContent value="printer">
          <PrinterSettingsPage />
        </TabsContent>
        <TabsContent value="backup">
          <BackupSettingsPage />
        </TabsContent>
        <TabsContent value="users">
          <UsersSettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
