import { formatCFA } from '@renderer/lib/formatters'

export interface RecoveryGaugeProps {
  rate: number
  totalPaid: number
  totalExpected: number
}

const SIZE = 220
const STROKE = 14
const CX = SIZE / 2
const CY = SIZE / 2
const RADIUS = SIZE / 2 - STROKE

function polarPoint(cx: number, cy: number, r: number, valuePct: number): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(100, valuePct))
  const thetaDeg = 180 - clamped * 1.8
  const thetaRad = (thetaDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(thetaRad), y: cy - r * Math.sin(thetaRad) }
}

function describeArc(valuePct: number): string {
  const start = polarPoint(CX, CY, RADIUS, 0)
  const end = polarPoint(CX, CY, RADIUS, valuePct)
  // Jauge = demi-cercle : l'arc balayé ne dépasse jamais 180°, donc on prend
  // toujours le "petit" arc (large-arc-flag = 0). Le mettre à 1 au-delà de
  // 50% (bug précédent) forçait SVG à tracer par le bas, hors du viewBox
  // (qui ne couvre que le demi-cercle supérieur) — d'où un arc tronqué,
  // visible seulement par bribes près des deux extrémités.
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 0 1 ${end.x} ${end.y}`
}

/**
 * Jauge semi-circulaire du taux de recouvrement global (F-019).
 * Anneau plat à deux tons de la couleur "succès" (piste claire + valeur
 * pleine) — design aligné sur la maquette produit.
 */
export function RecoveryGauge({ rate, totalPaid, totalExpected }: RecoveryGaugeProps): JSX.Element {
  const clampedRate = Math.max(0, Math.min(100, rate))

  return (
    <div className="flex flex-col items-center">
      <svg width={SIZE} height={SIZE / 2 + STROKE} viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`}>
        {/* Piste de fond — même teinte que l'arc de valeur, en clair */}
        <path
          d={describeArc(100)}
          fill="none"
          stroke="var(--color-success)"
          strokeOpacity={0.16}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Arc de valeur */}
        <path
          d={describeArc(clampedRate)}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={{ transition: 'd 0.7s ease-out' }}
        />
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          className="fill-foreground font-mono text-3xl font-bold"
        >
          {clampedRate.toFixed(1)}%
        </text>
      </svg>
      <p className="-mt-1 font-mono text-xs text-muted-foreground">
        {formatCFA(totalPaid)} / {formatCFA(totalExpected)}
      </p>
    </div>
  )
}
