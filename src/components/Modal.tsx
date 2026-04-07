import { useEffect, type ReactNode } from 'react'

export function Modal({
  open,
  title,
  onClose,
  children,
  showHeader = true,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  showHeader?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modalOverlay" role="presentation" onMouseDown={onClose}>
      <div
        className={showHeader ? 'modal' : 'modal modalNoHeader'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showHeader ? (
          <div className="modalHeader">
            <div className="modalTitle">{title}</div>
            <button className="iconButton" type="button" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
        ) : null}
        <div className="modalBody">{children}</div>
        {!showHeader ? (
          <button className="modalCloseFloating" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        ) : null}
      </div>
    </div>
  )
}
