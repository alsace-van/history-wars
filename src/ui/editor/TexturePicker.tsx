// v1.0 (17/05/2026) — Phase 5 Lot B.3 : input file + drag-and-drop + preview image
// Validation : max 4 MB, formats jpg/png/webp. Pas d'upload ici (delegue au parent).

import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { toast } from 'sonner'

const MAX_BYTES = 4 * 1024 * 1024
const ACCEPTED_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const

interface TexturePickerProps {
  /** URL actuelle (apres upload ou en edition d'un template existant). */
  currentUrl: string | null
  /** Callback quand un nouveau fichier est selectionne (avant upload). */
  onFileSelected: (file: File, dataUrl: string) => void
  /** Si true, le contenu est en cours d'upload (desactive le drop). */
  uploading?: boolean
}

export function TexturePicker({ currentUrl, onFileSelected, uploading }: TexturePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const validate = useCallback((file: File): boolean => {
    if (file.size > MAX_BYTES) {
      toast.error(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} MB, max 4 MB)`)
      return false
    }
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!ACCEPTED_EXT.includes(ext as (typeof ACCEPTED_EXT)[number])) {
      toast.error(`Format non supporte. JPG, PNG ou WebP uniquement.`)
      return false
    }
    return true
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!validate(file)) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onFileSelected(file, dataUrl)
    }
    reader.readAsDataURL(file)
  }, [onFileSelected, validate])

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    // Reset l'input pour permettre re-selection du meme fichier.
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (uploading) return
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!uploading) setDragOver(true)
  }

  const onDragLeave = () => setDragOver(false)

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
      style={{
        width: '100%',
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: dragOver ? 'rgba(239, 159, 39, 0.10)' : 'rgba(2, 6, 23, 0.4)',
        border: `1px dashed ${dragOver ? '#EF9F27' : 'rgba(226, 232, 240, 0.18)'}`,
        borderRadius: 2,
        cursor: uploading ? 'wait' : 'pointer',
        opacity: uploading ? 0.6 : 1,
        padding: 12,
        transition: 'background 120ms, border-color 120ms',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onInputChange}
        disabled={uploading}
        style={{ display: 'none' }}
      />
      {currentUrl ? (
        <img
          src={currentUrl}
          alt="texture"
          style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 2 }}
        />
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'rgba(226, 232, 240, 0.85)' }}>
            {uploading ? 'Upload en cours...' : 'Depose une image ou clique'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(226, 232, 240, 0.5)', fontStyle: 'italic' }}>
            JPG, PNG, WebP - max 4 MB
          </div>
        </>
      )}
    </div>
  )
}
