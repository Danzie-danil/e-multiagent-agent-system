// context/ToastContext.jsx
import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 320)
  }, [])

  const show = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, type, title, message }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const success = useCallback((title, message, duration) => show({ type: 'success', title, message, duration }), [show])
  const error   = useCallback((title, message, duration) => show({ type: 'error',   title, message, duration }), [show])
  const warning = useCallback((title, message, duration) => show({ type: 'warning', title, message, duration }), [show])
  const info    = useCallback((title, message, duration) => show({ type: 'info',    title, message, duration }), [show])

  return (
    <ToastContext.Provider value={{ toasts, show, success, error, warning, info, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
