import { useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'

function Field({ label, value }) {
  if (value === '' || value === null || value === undefined) return null
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <p className="px-md py-sm bg-surface-container-low border border-outline-variant/20 rounded-xl font-body-md text-body-md text-on-surface">
        {value}
      </p>
    </div>
  )
}

export default function ProductQuickViewModal({ open, product, isManager, onClose, onReorder }) {
  const navigate = useNavigate()
  const { currency } = useSettings()

  if (!open || !product) return null

  const hasExpiry = Boolean(product.expiry_date)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 max-h-[85vh] overflow-y-auto">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center gap-md">
          <div className="w-14 h-14 rounded-xl bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
            {product.image_url ? (
              <img className="w-full h-full object-cover" src={product.image_url} alt={product.name} />
            ) : (
              <Icon name="bakery_dining" className="text-on-surface-variant/40 text-[24px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-headline-md text-headline-md text-primary truncate">{product.name}</h2>
            <div className="flex flex-wrap items-center gap-xs mt-xs">
              <span className="px-sm py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[12px] font-label-md">
                {product.category}
              </span>
              <span
                className={`px-sm py-0.5 rounded-full text-[12px] font-label-md ${
                  product.is_active === false ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/20 text-secondary'
                }`}
              >
                {product.is_active === false ? 'Inactive' : 'Active'}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant shrink-0">
            <Icon name="close" />
          </button>
        </div>

        <div className="p-lg space-y-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Field label="Stock Quantity" value={`${product.stock_quantity} ${product.unit || 'units'}`} />
            <Field label="Low Stock Threshold" value={product.low_stock_threshold} />
            <Field label="Selling Price" value={`${currency}${Number(product.price).toFixed(2)}`} />
            <Field label="Cost Price" value={product.cost_price != null ? `${currency}${Number(product.cost_price).toFixed(2)}` : null} />
            <Field label="Batch ID" value={product.batch_id ? `#${product.batch_id}` : null} />
            {hasExpiry && <Field label="Expiry Date" value={product.expiry_date} />}
            <Field label="Sub-category" value={product.sub_category} />
            <Field label="Piece Barcode" value={product.piece_barcode} />
          </div>
        </div>

        <div className="px-lg py-md border-t border-outline-variant/10 flex justify-end gap-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
          >
            Close
          </button>
          {isManager && (
            <button
              type="button"
              onClick={() => onReorder(product)}
              className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
            >
              <Icon name="playlist_add" className="text-[18px]" />
              Add to Next Order
            </button>
          )}
          {isManager && (
            <button
              type="button"
              onClick={() => navigate(`/products/${product.id}/edit`)}
              className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
              <Icon name="edit" className="text-[18px]" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
