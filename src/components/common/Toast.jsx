import { useEffect } from 'react'
import Icon from './Icon'
import { useToast } from '../../context/ToastContext'

export default function Toast() {
  const { toast, dismissToast } = useToast()

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(dismissToast, 3500)
    return () => clearTimeout(timer)
  }, [toast, dismissToast])

  if (!toast) return null

  const isError = toast.type === 'error'

  return (
    <div className="fixed top-md right-md z-[100] max-w-sm px-margin-mobile sm:px-0">
      <div
        className={`flex items-center gap-sm px-md py-sm rounded-xl shadow-xl pill-glow border ${
          isError
            ? 'bg-error-container border-error/20 text-on-error-container'
            : 'bg-surface-container-lowest border-secondary-container/40 text-primary'
        }`}
      >
        <Icon name={isError ? 'error' : 'check_circle'} className={isError ? 'text-error' : 'text-secondary'} />
        <p className="font-body-md text-body-md flex-1">{toast.message}</p>
        <button onClick={dismissToast} className="text-on-surface-variant/60 hover:text-on-surface-variant" aria-label="Dismiss">
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>
    </div>
  )
}
