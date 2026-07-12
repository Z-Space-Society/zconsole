import { useRef } from 'react'

interface ShutterProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  label?: string
}

/** The camera shutter — a hidden multi-image file input behind the round button. */
export function Shutter({ onFiles, disabled, label = 'Add Photo' }: ShutterProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // allow re-selecting the same files
    if (files.length) onFiles(files)
  }

  return (
    <>
      <button
        className="shutter"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label="Add photos to the roll"
      >
        <span className="lbl">{label}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleChange}
      />
    </>
  )
}
