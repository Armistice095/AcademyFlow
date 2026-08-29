import { cn } from '@renderer/lib/utils'

/** Bloc de chargement animé (pulse), pour les écrans squelettes. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-gray-100', className)} {...props} />
}

export { Skeleton }
