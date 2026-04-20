// components/ui/Modal.jsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../utils/cn'
import './Modal.css'

export function Modal({
  id,
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closable = true,
  className,
}) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => { if (e.key === 'Escape' && closable) onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, closable, onClose])

  if (!isOpen) return null

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && closable) onClose()
  }

  const modalContent = (
    <div
      id={id}
      className="modal-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
    >
      <div className={cn('modal', `modal--${size}`, className)}>
        <div className="modal__header">
          <h2 id={`${id}-title`} className="modal__title">{title}</h2>
          {closable && (
            <button className="modal__close" onClick={onClose} aria-label="Close dialog">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
