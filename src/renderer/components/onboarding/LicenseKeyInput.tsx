import { useRef } from 'react'
import { cn } from '@renderer/lib/utils'

const GROUP_COUNT = 4
const GROUP_LENGTH = 4

export interface LicenseKeyInputProps {
  /** 4 groupes de 4 caractères. */
  groups: string[]
  onChange: (groups: string[]) => void
  disabled?: boolean
  autoFocus?: boolean
  hasError?: boolean
}

const sanitize = (value: string): string =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, GROUP_LENGTH)

/**
 * Saisie de clé de licence au format `AF-XXXX-XXXX-XXXX-XXXX` sous forme de
 * 4 groupes de 4 caractères, avec passage automatique au groupe suivant,
 * retour arrière intelligent et collage réparti sur l'ensemble des groupes.
 * Plus lisible et plus rapide à vérifier visuellement qu'un champ unique.
 */
export function LicenseKeyInput({
  groups,
  onChange,
  disabled,
  autoFocus,
  hasError
}: LicenseKeyInputProps): JSX.Element {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])

  const setGroup = (index: number, value: string): void => {
    const next = [...groups]
    next[index] = value
    onChange(next)
  }

  const handleChange = (index: number, rawValue: string): void => {
    const value = sanitize(rawValue)
    setGroup(index, value)
    if (value.length === GROUP_LENGTH && index < GROUP_COUNT - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Backspace' && groups[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      setGroup(index - 1, groups[index - 1].slice(0, -1))
      event.preventDefault()
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowRight' && index < GROUP_COUNT - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>): void => {
    const pasted = event.clipboardData.getData('text')
    if (!pasted) return
    event.preventDefault()

    const cleaned = pasted
      .toUpperCase()
      .replace(/^AF-?/, '')
      .replace(/[^A-Z0-9]/g, '')

    const next = [...groups]
    let cursor = index
    for (let i = 0; i < cleaned.length && cursor < GROUP_COUNT; i += GROUP_LENGTH) {
      next[cursor] = cleaned.slice(i, i + GROUP_LENGTH)
      cursor += 1
    }
    onChange(next)
    inputRefs.current[Math.min(cursor, GROUP_COUNT - 1)]?.focus()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-white px-3.5 py-3 shadow-sm transition-all duration-200 focus-within:shadow-soft',
        hasError
          ? 'border-destructive/50 focus-within:ring-2 focus-within:ring-destructive/20'
          : 'border-gray-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary-100'
      )}
    >
      <span className="select-none font-mono text-sm font-semibold tracking-wide text-gray-400">
        AF
      </span>
      {groups.map((group, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-gray-300">–</span>
          <input
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="text"
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            value={group}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(index, e)}
            placeholder="XXXX"
            maxLength={GROUP_LENGTH}
            aria-label={`Segment ${index + 1} de la clé de licence`}
            className="w-[4.25rem] min-w-0 shrink-0 border-none bg-transparent text-center font-mono text-[15px] font-semibold uppercase tracking-[0.06em] leading-none text-gray-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      ))}
    </div>
  )
}

export function licenseGroupsToKey(groups: string[]): string {
  return `AF-${groups.join('-')}`
}

export const EMPTY_LICENSE_GROUPS: string[] = Array.from({ length: GROUP_COUNT }, () => '')
