import { useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 Mo

export interface ImageUploadProps {
  label: string
  hint?: string
  value: string | null
  onChange: (dataUrl: string | null) => void
  /** Ratio d'affichage de la zone de prévisualisation. 'avatar' : aperçu circulaire (photo de personne). */
  shape?: 'square' | 'wide' | 'avatar'
}

/** Upload d'image avec prévisualisation — lit le fichier en base64 côté renderer (pas d'IPC nécessaire). */
export function ImageUpload({
  label,
  hint,
  value,
  onChange,
  shape = 'square'
}: ImageUploadProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('Image trop volumineuse (2 Mo maximum).')
      return
    }

    const reader = new FileReader()
    reader.onload = () => onChange(reader.result as string)
    reader.onerror = () => setError('Échec de la lecture du fichier.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden border border-dashed border-input bg-muted',
            shape === 'avatar' ? 'h-20 w-20 rounded-full' : 'rounded-lg',
            shape === 'square' && 'h-20 w-20',
            shape === 'wide' && 'h-20 w-40'
          )}
        >
          {value ? (
            <img
              src={value}
              alt={label}
              className={cn(
                'h-full w-full',
                shape === 'avatar' ? 'object-cover' : 'object-contain'
              )}
            />
          ) : (
            <ImagePlus className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {value ? 'Changer' : 'Choisir un fichier'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
            >
              <X className="h-3.5 w-3.5" />
              Retirer
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}
