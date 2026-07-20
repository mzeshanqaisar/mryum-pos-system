import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import Pagination from './Pagination'
import { useSettings } from '../../context/SettingsContext'
import { fromPieces } from '../../lib/orderQuantity'

function stockStatus(product) {
  if (product.stock_quantity <= 0) {
    return { label: 'Out of Stock', dotClass: 'bg-error', textClass: 'text-error', barClass: 'bg-error', pulse: true }
  }
  if (product.stock_quantity <= product.low_stock_threshold) {
    return { label: 'Low Stock', dotClass: 'bg-tertiary', textClass: 'text-tertiary', barClass: 'bg-tertiary', pulse: true }
  }
  return { label: 'Healthy', dotClass: 'bg-secondary', textClass: 'text-secondary', barClass: 'bg-secondary', pulse: false }
}

function stockLabel(product) {
  const perBox = Number(product.pieces_per_box)
  if (!(perBox > 1)) return `${product.stock_quantity} ${product.unit || 'units'} remaining`
  const { boxes, pieces } = fromPieces(product.stock_quantity, perBox)
  if (boxes <= 0) return `${pieces} piece${pieces === 1 ? '' : 's'} remaining`
  if (pieces <= 0) return `${boxes} box${boxes === 1 ? '' : 'es'} remaining`
  return `${boxes} box${boxes === 1 ? '' : 'es'}, ${pieces} piece${pieces === 1 ? '' : 's'} remaining`
}

function stockPercent(product) {
  const reference = Math.max(product.low_stock_threshold * 4, 20)
  return Math.min(100, Math.max(4, Math.round((product.stock_quantity / reference) * 100)))
}

function expiryBadge(product) {
  if (!product.expiry_date) return null
  const daysLeft = Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const alertDays = product.expiry_alert_days ?? 3
  if (daysLeft < 0) return { label: 'Expired', className: 'bg-error-container text-on-error-container' }
  if (daysLeft <= alertDays) return { label: `Expires in ${daysLeft}d`, className: 'bg-tertiary/10 text-tertiary' }
  return null
}

const FILTER_OPTIONS = [
  { value: 'low', label: 'Low Stock', icon: 'warning' },
  { value: 'out', label: 'Out of Stock', icon: 'production_quantity_limits' },
  { value: 'expiring', label: 'Expiring Soon', icon: 'event_busy' },
]

const FILTER_SUBTITLES = {
  low: 'Showing products that are running low on stock.',
  out: 'Showing products that are currently out of stock.',
  expiring: 'Showing products expiring soon.',
}

function FilterMenu({ stockFilter, onFilterChange }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (btnRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 4, left: rect.right - 192 })
    }
    setOpen((v) => !v)
  }

  const active = FILTER_OPTIONS.find((o) => o.value === stockFilter)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={`flex items-center gap-xs px-md py-sm rounded-xl font-label-md text-label-md transition-all ${
          active ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
        }`}
      >
        <Icon name="filter_list" className="text-[18px]" />
        {active ? active.label : 'Filter'}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-[100] overflow-hidden"
          >
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onFilterChange(opt.value)
                }}
                className={`w-full text-left px-md py-sm text-body-md font-body-md text-secondary hover:bg-secondary-container/10 flex items-center gap-xs ${
                  stockFilter === opt.value ? 'font-bold' : ''
                }`}
              >
                <Icon name={opt.icon} className="text-[18px]" />
                {opt.label}
              </button>
            ))}
            {stockFilter && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onFilterChange(null)
                }}
                className="w-full text-left px-md py-sm text-body-md font-body-md text-on-surface-variant hover:bg-secondary-container/10 flex items-center gap-xs border-t border-outline-variant/10"
              >
                <Icon name="filter_list_off" className="text-[18px]" />
                Clear Filter
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

function RowMenu({ product, isManager, onAdjustStock, onHistory, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
      >
        <Icon name="more_vert" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 mt-1 w-44 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-10 overflow-hidden"
        >
          {isManager && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onAdjustStock(product)
              }}
              className="w-full text-left px-md py-sm text-body-md font-body-md text-secondary hover:bg-secondary-container/10 flex items-center gap-xs"
            >
              <Icon name="add_box" className="text-[18px]" />
              Adjust Stock
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onHistory(product)
            }}
            className="w-full text-left px-md py-sm text-body-md font-body-md text-secondary hover:bg-secondary-container/10 flex items-center gap-xs"
          >
            <Icon name="history" className="text-[18px]" />
            History
          </button>
          {isManager && (
            <>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate(`/products/${product.id}/edit`)
                }}
                className="w-full text-left px-md py-sm text-body-md font-body-md text-secondary hover:bg-secondary-container/10 flex items-center gap-xs"
              >
                <Icon name="edit" className="text-[18px]" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onDelete(product)
                }}
                className="w-full text-left px-md py-sm text-body-md font-body-md text-error hover:bg-error-container/40 flex items-center gap-xs"
              >
                <Icon name="delete" className="text-[18px]" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function InventoryTable({
  products,
  isManager,
  onAddProduct,
  stockFilter,
  onFilterChange,
  onAdjustStock,
  onHistory,
  onDelete,
  onQuickView,
  pagination,
}) {
  const { currency } = useSettings()
  return (
    <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
      <div className="px-lg py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-primary">Current Inventory</h2>
          <p className="text-on-surface-variant font-body-md">
            {FILTER_SUBTITLES[stockFilter] || 'Manage your artisanal breads and fine pastries.'}
          </p>
        </div>
        <div className="flex gap-sm">
          <FilterMenu stockFilter={stockFilter} onFilterChange={onFilterChange} />
          {isManager && (
            <button
              type="button"
              onClick={onAddProduct}
              className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
              <Icon name="add" className="text-[18px]" />
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Product Name
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Category
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Stock Level
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Price
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Status
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                  No products match your search.
                </td>
              </tr>
            )}
            {products.map((product) => {
              const status = stockStatus(product)
              const percent = stockPercent(product)
              const expiry = expiryBadge(product)
              return (
                <tr
                  key={product.id}
                  onClick={() => onQuickView(product)}
                  className="group hover:bg-secondary-container/5 transition-colors cursor-pointer"
                >
                  <td className="px-lg py-sm">
                    <div className="flex items-center gap-md">
                      <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
                        {product.image_url ? (
                          <img className="w-full h-full object-cover" src={product.image_url} alt={product.name} />
                        ) : (
                          <Icon name="bakery_dining" className="text-on-surface-variant/40" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-xs flex-wrap">
                          <p className="font-body-md font-bold text-primary">{product.name}</p>
                          {expiry && (
                            <span className={`px-sm py-0.5 rounded-full text-[10px] font-bold ${expiry.className}`}>{expiry.label}</span>
                          )}
                        </div>
                        <p className="text-[12px] text-on-surface-variant">Batch ID: #{product.batch_id || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-sm">
                    <span className="px-sm py-1 bg-surface-container text-on-surface-variant rounded-full text-label-sm font-label-sm">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-lg py-sm">
                    <div className="w-full max-w-[100px] bg-surface-container h-1.5 rounded-full overflow-hidden">
                      <div className={`${status.barClass} h-full rounded-full`} style={{ width: `${percent}%` }} />
                    </div>
                    <p
                      className={`text-[12px] mt-1 ${
                        status.label === 'Healthy' ? 'text-on-surface-variant' : `font-bold ${status.textClass}`
                      }`}
                    >
                      {stockLabel(product)}
                    </p>
                  </td>
                  <td className="px-lg py-sm font-body-md text-on-surface font-semibold">
                    {currency}
                    {Number(product.price).toFixed(2)}
                  </td>
                  <td className="px-lg py-sm">
                    <div className={`flex items-center gap-xs ${status.textClass}`}>
                      <span className={`w-2 h-2 rounded-full ${status.dotClass}${status.pulse ? ' animate-pulse' : ''}`} />
                      <span className="text-label-sm font-label-sm">{status.label}</span>
                    </div>
                  </td>
                  <td className="px-lg py-sm text-right">
                    <RowMenu
                      product={product}
                      isManager={isManager}
                      onAdjustStock={onAdjustStock}
                      onHistory={onHistory}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </section>
  )
}
