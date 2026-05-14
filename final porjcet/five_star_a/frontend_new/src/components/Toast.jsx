import { useAppStore } from '../stores/appStore'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function Toast({ toast }) {
  const { removeToast } = useAppStore()
  const Icon = icons[toast.type] || Info

  return (
    <div className={`toast toast-${toast.type}`}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="flex-1 text-sm">{toast.message}</span>
      <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useAppStore()
  
  if (toasts.length === 0) return null
  
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
