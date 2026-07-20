import { useState } from 'react'
import Icon from '../common/Icon'

const TYPES = [
  { value: 'restock', label: 'Restock (add)' },
  { value: 'waste', label: 'Waste / Damage (remove)' },
  { value: 'adjustment', label: 'Manual Correction' },
]

export default function AdjustStockModal({ open, product, onClose, onSubmit }) {
  const [changeType, setChangeType] = useState('restock')
  const [amount, setAmount] = useState('10')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [restockByBox, setRestockByBox] = useState(false)

  if (!open || !product) return null

  const piecesPerBox = Number(product.pieces_per_box) || 0
  const hasBoxPacking = piecesPerBox > 1
  const useBoxMode = changeType === 'restock' && hasBoxPacking && restockByBox

  const inputClass =
    'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const qty = Number(amount)
    if (!qty) return
    let signedChange = useBoxMode ? qty * piecesPerBox : qty
    if (changeType === 'restock') signedChange = Math.abs(signedChange)
    if (changeType === 'waste') signedChange = -Math.abs(signedChange)
    const finalNote = useBoxMode ? `${note ? note + ' — ' : ''}${qty} box(es) x ${piecesPerBox} pieces`.trim() : note
    setSubmitting(true)
    await onSubmit(signedChange, changeType, finalNote)
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-primary">Adjust Stock</h2>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-lg flex flex-col gap-md">
          <p className="font-body-md text-on-surface-variant">
            <span className="font-bold text-primary">{product.name}</span> currently has{' '}
            <span className="font-bold">{product.stock_quantity}</span> {product.unit || 'units'}
            {hasBoxPacking && (
              <span className="text-label-sm">
                {' '}
                (~{Math.floor(product.stock_quantity / piecesPerBox)} box{Math.floor(product.stock_quantity / piecesPerBox) === 1 ? '' : 'es'})
              </span>
            )}
            .
          </p>

          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Type</span>
            <select
              value={changeType}
              onChange={(e) => {
                setChangeType(e.target.value)
                if (e.target.value !== 'restock') setRestockByBox(false)
              }}
              className={inputClass}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {changeType === 'restock' && hasBoxPacking && (
            <div className="flex rounded-xl border border-outline-variant/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setRestockByBox(false)}
                className={`flex-1 px-md py-sm font-label-md text-label-md transition-all ${
                  !restockByBox ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                By Pieces
              </button>
              <button
                type="button"
                onClick={() => setRestockByBox(true)}
                className={`flex-1 px-md py-sm font-label-md text-label-md transition-all ${
                  restockByBox ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                By Boxes ({piecesPerBox}/box)
              </button>
            </div>
          )}

          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">
              {changeType === 'adjustment' ? 'Change (use a minus sign to decrease)' : useBoxMode ? 'Boxes' : 'Quantity'}
            </span>
            <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} autoFocus />
            {useBoxMode && Number(amount) > 0 && (
              <span className="text-label-sm text-on-surface-variant">
                = {Number(amount) * piecesPerBox} pieces
              </span>
            )}
          </label>

          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Delivery from supplier, dropped tray..."
              className={inputClass}
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
              className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
