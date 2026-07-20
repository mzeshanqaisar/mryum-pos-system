import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useSuppliers } from '../hooks/useSuppliers'
import { useSupplierOrders } from '../hooks/useSupplierOrders'
import { useProducts } from '../hooks/useProducts'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import { toPieces, fromPieces } from '../lib/orderQuantity'
import { daysUntilWeekday } from '../lib/supplierAlerts'

const inputClass =
  'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

function InfoField({ label, value }) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <p className="font-body-md text-body-md text-on-surface">{value || <span className="text-on-surface-variant/50">—</span>}</p>
    </div>
  )
}

export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { suppliers, loading: suppliersLoading } = useSuppliers()
  const { getPendingOrder, addOrIncrementItem, removeItem, clearOrder } = useSupplierOrders()
  const { products } = useProducts()
  const { showToast } = useToast()
  const { currency } = useSettings()

  const [productId, setProductId] = useState('')
  const [boxes, setBoxes] = useState('')
  const [pieces, setPieces] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const supplier = useMemo(() => suppliers.find((s) => s.id === id), [suppliers, id])
  const pendingOrder = getPendingOrder(id)
  const items = pendingOrder?.purchase_order_items || []

  const supplierProducts = useMemo(() => products.filter((p) => p.supplier_id === id), [products, id])
  const selectedProduct = useMemo(() => supplierProducts.find((p) => p.id === productId), [supplierProducts, productId])
  const hasBoxPacking = Number(selectedProduct?.pieces_per_box) > 1

  const outOfStock = useMemo(() => supplierProducts.filter((p) => p.stock_quantity <= 0), [supplierProducts])
  const lowStock = useMemo(
    () => supplierProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold ?? 0)),
    [supplierProducts],
  )
  const daysUntilOrder = useMemo(() => daysUntilWeekday(supplier?.order_day), [supplier])
  const hasOrderDayAlert = daysUntilOrder !== null && daysUntilOrder <= 1

  const handleQuickAdd = (product) => {
    setProductId(product.id)
    setBoxes('')
    setPieces('')
  }

  const estimatedTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const rate = Number(item.products?.cost_price)
        return rate > 0 ? sum + rate * item.quantity : sum
      }, 0),
    [items],
  )

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!productId) return
    const quantity = toPieces(boxes, pieces, selectedProduct?.pieces_per_box)
    if (quantity <= 0) {
      showToast('Enter at least one box or piece.', 'error')
      return
    }
    setSubmitting(true)
    const result = await addOrIncrementItem(id, productId, quantity)
    setSubmitting(false)
    if (result.success) {
      showToast('Added to next order.')
      setProductId('')
      setBoxes('')
      setPieces('')
    } else {
      showToast(result.message || 'Could not add item.', 'error')
    }
  }

  const handleRemoveItem = async (itemId) => {
    const result = await removeItem(itemId)
    if (!result.success) showToast(result.message || 'Could not remove item.', 'error')
  }

  const handleClearOrder = async () => {
    if (!pendingOrder) return
    setClearing(true)
    const result = await clearOrder(pendingOrder.id)
    setClearing(false)
    setClearConfirmOpen(false)
    if (result.success) {
      showToast('Order list cleared.')
    } else {
      showToast(result.message || 'Could not clear order.', 'error')
    }
  }

  if (suppliersLoading) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex items-center justify-center min-h-screen">
        <p className="text-on-surface-variant font-body-md">Loading supplier…</p>
      </main>
    )
  }

  if (!supplier) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col items-center justify-center min-h-screen gap-sm">
        <p className="text-on-surface-variant font-body-md">Supplier not found.</p>
        <button
          type="button"
          onClick={() => navigate('/suppliers')}
          className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md"
        >
          Back to Suppliers
        </button>
      </main>
    )
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-all font-label-md text-label-md"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Back to Suppliers
          </button>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md space-y-sm">
            <h2 className="font-headline-lg text-headline-lg text-primary">{supplier.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
              <InfoField label="Company" value={supplier.company_name} />
              <InfoField label="Contact" value={supplier.contact_name} />
              <InfoField label="Phone" value={supplier.phone} />
              <InfoField label="Email" value={supplier.email} />
              <InfoField label="Delivery Day" value={supplier.delivery_day} />
              <InfoField label="Order Day" value={supplier.order_day} />
            </div>
          </section>

          {(hasOrderDayAlert || outOfStock.length > 0 || lowStock.length > 0) && (
            <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md space-y-sm">
              <div className="flex items-center gap-sm">
                <Icon name="notifications_active" className="text-tertiary text-[22px]" />
                <h3 className="font-headline-md text-headline-md text-primary">Restock Alerts</h3>
              </div>

              {hasOrderDayAlert && (
                <div className="flex items-center gap-sm px-md py-sm rounded-xl bg-secondary/10 text-secondary font-label-md text-label-md">
                  <Icon name="event_upcoming" className="text-[20px] shrink-0" />
                  {daysUntilOrder === 0
                    ? `Order day for ${supplier.name} is today — review what to add below.`
                    : `Order day for ${supplier.name} is tomorrow — review what to add below.`}
                </div>
              )}

              {(outOfStock.length > 0 || lowStock.length > 0) && (
                <div className="space-y-xs">
                  {outOfStock.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-md p-sm rounded-xl bg-error-container/20">
                      <div className="flex items-center gap-sm min-w-0">
                        <Icon name="production_quantity_limits" className="text-error text-[18px] shrink-0" />
                        <p className="font-body-md font-bold text-primary truncate">{p.name}</p>
                        <span className="shrink-0 px-sm py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container">
                          Out of stock
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(p)}
                        className="shrink-0 px-sm py-1 rounded-lg font-label-md text-label-sm text-secondary hover:bg-secondary-container/10 transition-all"
                      >
                        Add to order
                      </button>
                    </div>
                  ))}
                  {lowStock.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-md p-sm rounded-xl bg-tertiary/5">
                      <div className="flex items-center gap-sm min-w-0">
                        <Icon name="warning" className="text-tertiary text-[18px] shrink-0" />
                        <p className="font-body-md font-bold text-primary truncate">{p.name}</p>
                        <span className="shrink-0 px-sm py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary">
                          {p.stock_quantity} left
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(p)}
                        className="shrink-0 px-sm py-1 rounded-lg font-label-md text-label-sm text-secondary hover:bg-secondary-container/10 transition-all"
                      >
                        Add to order
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md space-y-sm">
            <div className="flex items-center justify-between gap-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-primary">Next Order</h3>
                <p className="text-on-surface-variant font-body-md">What to tell the order-taker to bring next time.</p>
              </div>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(true)}
                  className="shrink-0 px-md py-sm rounded-xl font-label-md text-label-md text-error hover:bg-error-container/40 transition-all"
                >
                  Clear List
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-on-surface-variant font-body-md py-sm text-center">Nothing added yet.</p>
            ) : (
              <div className="space-y-xs">
                {items.map((item) => {
                  const breakdown = fromPieces(item.quantity, item.products?.pieces_per_box)
                  const label =
                    breakdown.boxes > 0
                      ? `${breakdown.boxes} box${breakdown.boxes === 1 ? '' : 'es'}${breakdown.pieces > 0 ? ` + ${breakdown.pieces} pieces` : ''}`
                      : `${breakdown.pieces} ${item.products?.unit || 'pieces'}`
                  const rate = Number(item.products?.cost_price)
                  const hasRate = rate > 0
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-md p-sm rounded-xl bg-surface-container-low/50">
                      <div className="min-w-0">
                        <p className="font-body-md font-bold text-primary truncate">{item.products?.name || 'Item'}</p>
                        <p className="text-[12px] text-on-surface-variant">{label}</p>
                      </div>
                      <div className="flex items-center gap-sm shrink-0">
                        <span className={`text-[12px] font-label-md ${hasRate ? 'text-on-surface-variant' : 'text-on-surface-variant/50 italic'}`}>
                          {hasRate ? `${currency}${(rate * item.quantity).toFixed(2)}` : 'rate not set'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-base rounded-full hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-all"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between gap-md px-sm pt-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Estimated Total (based on last purchase rate)</span>
                  <span className="font-headline-md text-headline-md text-primary">
                    {currency}
                    {estimatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-sm sm:items-end pt-sm border-t border-outline-variant/10">
              <label className="flex flex-col gap-xs flex-1">
                <span className="font-label-md text-label-md text-on-surface-variant">Product</span>
                <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass}>
                  <option value="">
                    {supplierProducts.length === 0 ? 'No products from this supplier yet' : '— Select product —'}
                  </option>
                  {supplierProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {hasBoxPacking && (
                <label className="flex flex-col gap-xs w-full sm:w-24">
                  <span className="font-label-md text-label-md text-on-surface-variant">Boxes</span>
                  <input type="number" min="0" step="0.5" value={boxes} onChange={(e) => setBoxes(e.target.value)} className={inputClass} />
                </label>
              )}
              <label className="flex flex-col gap-xs w-full sm:w-24">
                <span className="font-label-md text-label-md text-on-surface-variant">Pieces</span>
                <input type="number" min="0" value={pieces} onChange={(e) => setPieces(e.target.value)} className={inputClass} />
              </label>
              <button
                type="submit"
                disabled={submitting || !productId}
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shrink-0 disabled:opacity-60"
              >
                {submitting ? 'Adding…' : 'Add'}
              </button>
            </form>
          </section>
        </div>

        <Footer />
      </main>

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear next order?"
        message="This removes every item from this supplier's next-order list."
        confirmLabel="Clear List"
        danger
        submitting={clearing}
        onConfirm={handleClearOrder}
        onClose={() => setClearConfirmOpen(false)}
      />
    </>
  )
}
