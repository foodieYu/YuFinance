import { useApp } from '../context/TransactionContext'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp()
  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg pointer-events-auto
            text-sm font-medium transition-all duration-300
            ${t.type === 'success'
              ? 'bg-sage-DEFAULT text-white'
              : 'bg-terracotta-DEFAULT text-white'}`}
        >
          {t.type === 'success'
            ? <CheckCircle size={18} />
            : <AlertCircle size={18} />}
          <span>{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
