import Icon from './Icon'

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  submitting = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 px-lg py-md space-y-sm"
      >
        <div className="flex items-center gap-sm">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              danger ? 'bg-error-container/40 text-error' : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon name={danger ? 'warning' : 'help'} className="text-[20px]" />
          </div>
          <h2 className="font-headline-md text-headline-md text-primary">{title}</h2>
        </div>
        {message && <p className="font-body-md text-on-surface-variant">{message}</p>}
        <div className="flex justify-end gap-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`px-md py-sm rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none ${
              danger ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
            }`}
          >
            {submitting ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
