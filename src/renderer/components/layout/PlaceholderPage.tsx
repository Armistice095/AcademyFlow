import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'

export interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

/** Page temporaire affichée tant que la logique métier de la page n'est pas implémentée. */
export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Badge variant="secondary">{phase}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Cette page fait partie du layout et du routing (Phase 3). Sa logique métier sera
          implémentée dans la phase indiquée ci-dessus.
        </p>
      </CardContent>
    </Card>
  )
}
