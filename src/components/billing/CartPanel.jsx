import { useEffect, useState } from 'react'
import Icon from '../common/Icon'
import ReceiptModal from './ReceiptModal'
import CreditCustomerPickerModal from './CreditCustomerPickerModal'
import CustomerModal from '../customers/CustomerModal'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { useCustomers } from '../../hooks/useCustomers'
import { useSettings } from '../../context/SettingsContext'

function CartItemRow({ product, quantity, itemDiscount, isExpanded, onToggleExpand, onCollapse, updateQuantity, updateItemDiscount, removeFromCart, currency }) {
  const lineTotal = Number(product.price) * quantity
  const currentPerPiece = Number(product.price) - (itemDiscount || 0) / quantity
  const [priceInput, setPriceInput] = useState(currentPerPiece.toFixed(2))

  // A cashier can discount down to what the item cost us (never sell at a loss) and
  // never mark it up past the listed sale price — the field is clamped to that band.
  const floor = Math.min(Number(product.cost_price) || 0, Number(product.price))
  const ceiling = Number(product.price)

  useEffect(() => {
    if (isExpanded) setPriceInput(currentPerPiece.toFixed(2))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const applyPrice = (rawValue) => {
    if (rawValue === '') return null
    const parsed = Number(rawValue)
    if (Number.isNaN(parsed)) return null
    const clamped = Math.min(ceiling, Math.max(floor, parsed))
    const newDiscount = Math.max(0, (product.price - clamped) * quantity)
    updateItemDiscount(product.id, newDiscount)
    return clamped
  }

  const handlePriceChange = (e) => {
    const raw = e.target.value
    setPriceInput(raw)
    applyPrice(raw)
  }

  const handleBlur = () => {
    const clamped = applyPrice(priceInput)
    if (clamped !== null) setPriceInput(clamped.toFixed(2))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const clamped = applyPrice(priceInput)
      if (clamped !== null) setPriceInput(clamped.toFixed(2))
      e.currentTarget.blur()
      onCollapse()
    }
  }

  return (
    <div className="border-b border-dashed border-outline-variant/20 last:border-0">
      <div onClick={onToggleExpand} className="flex items-center gap-sm py-0.1 cursor-pointer">
        <p className="flex-1 min-w-0 truncate font-body-md font-bold text-primary text-[18px]">{product.name}</p>

        <div className="flex items-center gap-xs shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => updateQuantity(product.id, quantity - 1)}
            className="w-6 h-6 flex items-center justify-center rounded-full border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-all"
          >
            <Icon name="remove" className="text-[16px]" />
          </button>
          <span className="w-5 text-center text-[16px] font-label-md text-on-surface-variant">{quantity}</span>
          <button
            type="button"
            onClick={() => updateQuantity(product.id, quantity + 1)}
            disabled={quantity >= product.stock_quantity}
            className="w-6 h-6 flex items-center justify-center rounded-full border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container transition-all disabled:opacity-40"
          >
            <Icon name="add" className="text-[16px]" />
          </button>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-body-md font-bold text-primary text-[16px]">
            {currency}
            {(lineTotal - (itemDiscount || 0)).toFixed(2)}
          </p>
          {itemDiscount > 0 && (
            <p className="text-[11px] text-error line-through">
              {currency}
              {lineTotal.toFixed(2)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            removeFromCart(product.id)
          }}
          className="shrink-0 p-0.5 rounded-full hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-all"
        >
          <Icon name="delete" className="text-[16px]" />
        </button>
      </div>

      {isExpanded && (
        <div onClick={(e) => e.stopPropagation()} className="pb-sm px-0.5">
          <label className="flex items-center justify-between gap-sm px-sm py-xs bg-surface-container-low rounded-xl">
            <span className="font-label-md text-label-sm text-on-surface-variant">Sell at ({currency}/piece)</span>
            <input
              type="number"
              min={floor}
              max={ceiling}
              step="0.01"
              value={priceInput}
              onChange={handlePriceChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={Number(product.price).toFixed(2)}
              className="w-24 px-sm py-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-right text-on-surface"
            />
          </label>
          {floor > 0 && (
            <p className="px-sm pt-0.5 text-[10px] text-on-surface-variant/70">
              Won&apos;t go below {currency}
              {floor.toFixed(2)} (cost) or above {currency}
              {ceiling.toFixed(2)} (list price)
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function CartPanel() {
  const {
    items,
    updateQuantity,
    updateItemDiscount,
    removeFromCart,
    subtotal,
    grossSubtotal,
    discount,
    itemDiscountTotal,
    maxOrderDiscount,
    orderDiscount,
    setOrderDiscount,
    tax,
    total,
    itemCount,
    staffName,
    completeSale,
    isCompleting,
    clearCart,
  } = useCart()
  const { showToast } = useToast()
  const { customers, addCustomer } = useCustomers()
  const { currency } = useSettings()

  const [receipt, setReceipt] = useState(null)
  const [creditPickerOpen, setCreditPickerOpen] = useState(false)
  const [newCustomerModalOpen, setNewCustomerModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const handleCashClick = () => {
    if (itemCount === 0) {
      showToast('Add items to the cart before completing a sale.', 'error')
      return
    }
    finalizeSale('cash', null)
  }

  const handleCreditClick = () => {
    if (itemCount === 0) {
      showToast('Add items to the cart before completing a sale.', 'error')
      return
    }
    setCreditPickerOpen(true)
  }

  const handleCancelOrder = () => {
    if (itemCount === 0) return
    if (!window.confirm('Cancel this order and clear the cart?')) return
    clearCart()
  }

  const finalizeSale = async (method, customer) => {
    const snapshot = {
      items: items.map((i) => ({ ...i })),
      subtotal: grossSubtotal,
      discount,
      itemDiscountTotal,
      tax,
      total,
      staffName,
      customerName: customer?.name || null,
      paymentMethod: method,
      createdAt: Date.now(),
    }
    const result = await completeSale({
      paymentMethod: method,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
    })
    if (result.success) {
      showToast(
        result.offline
          ? 'Offline — sale saved and will sync when back online.'
          : method === 'credit'
            ? `Sale added to ${customer.name}'s account.`
            : 'Sale completed and stock updated.',
      )
      setReceipt(snapshot)
    } else {
      showToast(result.message || 'Could not complete sale.', 'error')
    }
  }

  const handleAddCustomerForCredit = async (customerForm) => {
    const result = await addCustomer(customerForm)
    if (result.success) {
      setNewCustomerModalOpen(false)
      await finalizeSale('credit', result.customer)
    } else {
      showToast(result.message || 'Could not add customer.', 'error')
    }
    return result
  }

  return (
    <aside className="w-full xl:w-96 shrink-0 bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 flex flex-col max-h-[85vh] xl:max-h-[calc(100vh-160px)] xl:sticky xl:top-[120px]">
      <div className="px-5 py-2 border-b border-outline-variant/10">
        <h2 className="font-headline-md text-headline-md text-primary">Current Order</h2>
        <p className="text-on-surface-variant font-body-md">
          {itemCount} item{itemCount === 1 ? '' : 's'} in cart
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5  ">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-md text-on-surface-variant gap-sm">
            <Icon name="shopping_basket" className="text-[40px] opacity-40" />
            <p className="font-body-md text-center">Tap a product to add it to the order.</p>
          </div>
        )}
        {items.map(({ product, quantity, discount: itemDiscount }) => (
          <CartItemRow
            key={product.id}
            product={product}
            quantity={quantity}
            itemDiscount={itemDiscount}
            isExpanded={expandedId === product.id}
            onToggleExpand={() => setExpandedId(expandedId === product.id ? null : product.id)}
            onCollapse={() => setExpandedId(null)}
            updateQuantity={updateQuantity}
            updateItemDiscount={updateItemDiscount}
            removeFromCart={removeFromCart}
            currency={currency}
          />
        ))}
      </div>

      <div className="px-lg py-md border-t border-outline-variant/10 space-y-sm">
        <div className="space-y-1 text-body-md font-body-md text-on-surface-variant">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              {currency}
              {subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>
              {currency}
              {tax.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-sm px-sm py-1.5 bg-secondary-container/10 border border-secondary-container/30 rounded-xl">
          <Icon name="sell" className="text-secondary text-[18px] shrink-0" />
          <span className="flex-1 min-w-0 font-label-md text-label-sm text-on-surface-variant">Overall Discount</span>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="font-label-md text-label-sm text-on-surface-variant">{currency}</span>
            <input
              type="number"
              min="0"
              max={maxOrderDiscount}
              step="0.01"
              value={orderDiscount || ''}
              placeholder="0.00"
              onChange={(e) => setOrderDiscount(e.target.value)}
              className="w-20 px-xs py-1 bg-surface-container-lowest border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary font-label-md text-label-sm text-right text-secondary font-bold"
            />
          </div>
        </div>

        <div className="flex justify-between font-headline-md text-headline-md text-primary pt-xs border-t border-dashed border-outline-variant/30">
          <span>Total</span>
          <span>
            {currency}
            {total.toFixed(2)}
          </span>
        </div>

        <div className="flex gap-xs mt-sm">
          <button
            type="button"
            onClick={handleCashClick}
            disabled={isCompleting || itemCount === 0}
            className="flex-1 flex items-center justify-center gap-xs bg-primary text-on-primary py-sm rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name="payments" className="text-[18px]" />
            {isCompleting ? 'Completing…' : 'Cash'}
          </button>
          <button
            type="button"
            onClick={handleCreditClick}
            disabled={isCompleting || itemCount === 0}
            className="flex-1 flex items-center justify-center gap-xs bg-tertiary text-on-tertiary py-sm rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name="account_balance_wallet" className="text-[18px]" />
            Udhar
          </button>
        </div>
        <button
          type="button"
          onClick={handleCancelOrder}
          disabled={itemCount === 0}
          className="w-full py-1 rounded-lg font-label-md text-label-sm text-on-surface-variant hover:bg-error-container/30 hover:text-error transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          Cancel Order
        </button>
      </div>

      <CreditCustomerPickerModal
        open={creditPickerOpen}
        customers={customers}
        onClose={() => setCreditPickerOpen(false)}
        onSelect={(customer) => {
          setCreditPickerOpen(false)
          finalizeSale('credit', customer)
        }}
        onAddNew={() => {
          setCreditPickerOpen(false)
          setNewCustomerModalOpen(true)
        }}
      />

      <CustomerModal open={newCustomerModalOpen} onClose={() => setNewCustomerModalOpen(false)} onSubmit={handleAddCustomerForCredit} />

      <ReceiptModal open={Boolean(receipt)} receipt={receipt} onClose={() => setReceipt(null)} />
    </aside>
  )
}
