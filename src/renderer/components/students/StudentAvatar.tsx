import { cn } from '@renderer/lib/utils'

export interface StudentAvatarProps {
  firstName: string
  lastName: string
  photoPath?: string | null
  className?: string
  /** 'sm' (36px, tableaux) | 'md' (48px) | 'lg' (64px, en-tête de fiche) | 'xl' (80px, carte profil). */
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE_CLASSES: Record<
  NonNullable<StudentAvatarProps['size']>,
  { box: string; text: string }
> = {
  sm: { box: 'h-9 w-9', text: 'text-xs' },
  md: { box: 'h-12 w-12', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-lg' },
  xl: { box: 'h-20 w-20', text: 'text-2xl' }
}

/**
 * Palette de secours (photo absente) — dérivée de la charte AcademyFlow,
 * suffisamment désaturée pour rester lisible en petite taille (36px).
 */
const PALETTE = [
  { bg: 'bg-primary-100', text: 'text-primary-700' },
  { bg: 'bg-accent-400/20', text: 'text-accent-600' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' }
]

function hashName(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function getInitials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0) ?? ''
  const b = lastName.trim().charAt(0) ?? ''
  return `${b}${a}`.toUpperCase() || '?'
}

/**
 * Avatar élève — photo si disponible, sinon un rond initiales/couleur
 * (couleur stable pour un même nom, pour la reconnaissance visuelle au fil
 * du défilement plutôt qu'un silhouette générique identique pour tous).
 */
export function StudentAvatar({
  firstName,
  lastName,
  photoPath,
  className,
  size = 'sm'
}: StudentAvatarProps): JSX.Element {
  const { box, text } = SIZE_CLASSES[size]

  if (photoPath) {
    return (
      <img
        src={photoPath}
        alt=""
        className={cn(box, 'shrink-0 rounded-full border border-border object-cover', className)}
      />
    )
  }

  const { bg, text: textColor } = PALETTE[hashName(`${lastName}${firstName}`) % PALETTE.length]

  return (
    <div
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        text,
        bg,
        textColor,
        className
      )}
      aria-hidden="true"
    >
      {getInitials(firstName, lastName)}
    </div>
  )
}
