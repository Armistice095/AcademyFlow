import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CircleAlert,
  LogIn,
  type LucideIcon,
  Sparkles,
  UserPlus,
  Wallet,
  XCircle
} from 'lucide-react'
import type { ActivityKind, AlertSeverity } from '@shared/types/dashboard.types'

export interface ActivityMeta {
  icon: LucideIcon
  className: string
}

const ACTIVITY_META: Record<ActivityKind, ActivityMeta> = {
  cash_entry: { icon: Wallet, className: 'bg-success/10 text-success' },
  cash_exit: { icon: Banknote, className: 'bg-destructive/10 text-destructive' },
  cash_cancelled: { icon: XCircle, className: 'bg-destructive/10 text-destructive' },
  student_enrolled: { icon: UserPlus, className: 'bg-accent-500/10 text-accent-600' },
  salary_paid: { icon: Banknote, className: 'bg-warning/10 text-warning' },
  user_login: { icon: LogIn, className: 'bg-gray-100 text-muted-foreground' },
  other: { icon: Sparkles, className: 'bg-gray-100 text-muted-foreground' }
}

export function getActivityMeta(kind: ActivityKind): ActivityMeta {
  return ACTIVITY_META[kind]
}

/** Signe affiché devant le montant d'une activité (`+`/`-`), `null` si l'activité n'a pas de montant à afficher. */
const ACTIVITY_AMOUNT_SIGN: Partial<Record<ActivityKind, 1 | -1>> = {
  cash_entry: 1,
  cash_exit: -1,
  cash_cancelled: -1,
  salary_paid: -1
}

export function getActivityAmountSign(kind: ActivityKind): 1 | -1 | null {
  return ACTIVITY_AMOUNT_SIGN[kind] ?? null
}

const ALERT_META: Record<AlertSeverity, ActivityMeta> = {
  danger: { icon: CircleAlert, className: 'bg-destructive/10 text-destructive' },
  warning: { icon: AlertTriangle, className: 'bg-warning/10 text-warning' },
  info: { icon: CalendarClock, className: 'bg-accent-500/10 text-accent-600' }
}

export function getAlertMeta(severity: AlertSeverity): ActivityMeta {
  return ALERT_META[severity]
}
