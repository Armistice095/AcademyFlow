import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { NewStudentForm } from './components/NewStudentForm'
import { ReenrollStudentPanel } from './components/ReenrollStudentPanel'

/**
 * Inscription élève — deux parcours distincts :
 * - "Nouveau" : élève inexistant en base, formulaire complet.
 * - "Ancien" : élève déjà en base, simple réinscription (classe + année en cours).
 */
export function StudentCreatePage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">Nouveau</TabsTrigger>
          <TabsTrigger value="existing">Ancien</TabsTrigger>
        </TabsList>

        <TabsContent value="new">
          <NewStudentForm />
        </TabsContent>

        <TabsContent value="existing">
          <ReenrollStudentPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
