import { useState } from 'react'
import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'

export default function RefundModal({ open, sale, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { currency } = useSettings()

  if (!open || !sale) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(reason)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-primary">Refund Sale</h2>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-lg flex flex-col gap-md">
          <p className="font-body-md text-on-surface-variant">
            This fully refunds a{' '}
            <span className="font-bold text-primary">
              {currency}
              {Number(sale.total_amount).toFixed(2)}
            </span>{' '}
            sale and restores stock for every item on it.
          </p>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Reason</span>
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer changed their mind"
              className="px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-sm mt-md">
            <button
              type="button"
              onClick={onClose}
              className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-md py-sm bg-error text-on-error rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {submitting ? 'Refunding…' : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
