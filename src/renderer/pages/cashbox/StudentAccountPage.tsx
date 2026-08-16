import { useParams } from 'react-router-dom'
import { PlaceholderPage } from '@renderer/components/layout/PlaceholderPage'

export function StudentAccountPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()

  return (
    <PlaceholderPage
      title={`Compte de scolarité (${id})`}
      description="Détail des tranches attendues/payées et solde pour cet élève."
      phase="Phase 7"
    />
  )
}
