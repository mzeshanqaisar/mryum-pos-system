import { useState } from 'react'
import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'
import { toPieces } from '../../lib/orderQuantity'

const inputClass =
  'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

export default function ReorderModal({ open, product, onBack, onSubmit }) {
  const [boxes, setBoxes] = useState('')
  const [pieces, setPieces] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { currency } = useSettings()

  if (!open || !product) return null

  const hasBoxPacking = Number(product.pieces_per_box) > 1
  const hasSupplier = Boolean(product.supplier_id)
  const rate = Number(product.cost_price)
  const hasRate = rate > 0

  const handleBack = () => {
    setBoxes('')
    setPieces('')
    onBack()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const quantity = toPieces(boxes, pieces, product.pieces_per_box)
    if (quantity <= 0) return
    setSubmitting(true)
    await onSubmit(product.supplier_id, product.id, quantity)
    setSubmitting(false)
    setBoxes('')
    setPieces('')
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center gap-sm">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md text-primary truncate">Add to Next Order</h2>
            <p className="text-[12px] text-on-surface-variant truncate">{product.name}</p>
          </div>
        </div>

        {!hasSupplier ? (
          <div className="p-lg space-y-md">
            <p className="font-body-md text-on-surface-variant">
              This product has no supplier set — add one in Edit Product first.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleBack}
                className="px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-lg flex flex-col gap-md">
            <p className={`text-[12px] font-label-md ${hasRate ? 'text-on-surface-variant' : 'text-on-surface-variant/50 italic'}`}>
              {hasRate ? `Last purchase rate: ${currency}${rate.toFixed(2)} per ${product.unit || 'piece'}` : 'Purchase rate not set'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
              {hasBoxPacking && (
                <label className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Boxes</span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    value={boxes}
                    onChange={(e) => setBoxes(e.target.value)}
                    placeholder="0"
                    className={inputClass}
                  />
                </label>
              )}
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant">Pieces</span>
                <input
                  type="number"
                  min="0"
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex justify-end gap-sm mt-md">
              <button
                type="button"
                onClick={handleBack}
                className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
              >
                {submitting ? 'Adding…' : 'Add to Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
