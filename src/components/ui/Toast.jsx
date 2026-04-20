// components/ui/Toast.jsx
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToast } from '../../context/ToastContext'
import './Toast.css'

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map(toast => {
        const Icon = ICONS[toast.type] || Info
        return (
          <div key={toast.id} className={`toast toast--${toast.type} ${toast.leaving ? 'toast--leaving' : ''}`} role="alert">
            <Icon className="toast__icon" size={18} aria-hidden="true" />
            <div className="toast__body">
              {toast.title && <p className="toast__title">{toast.title}</p>}
              {toast.message && <p className="toast__message">{toast.message}</p>}
            </div>
            <button className="toast__close" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
