import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSettings } from './SettingsContext'
import { db, newId, nowIso } from '../lib/db'
import { notifyChange, onLocalChange, syncAll } from '../lib/sync'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { settings } = useSettings()
  const taxRate = settings.tax_rate ?? 0.08

  const [items, setItems] = useState([])
  const [orderDiscount, setOrderDiscountState] = useState(0)
  const [staffName, setStaffName] = useState('Manager')
  const [customerId, setCustomerId] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [isCompleting, setIsCompleting] = useState(false)
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [failedSyncCount, setFailedSyncCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    const [pending, failed] = await Promise.all([
      db.sales.where('sync_status').equals('pending').count(),
      db.sales.where('sync_status').equals('failed').count(),
    ])
    setPendingOfflineCount(pending)
    setFailedSyncCount(failed)
  }, [])

  useEffect(() => {
    refreshPendingCount()
    // Sales sync in the background (App's startAutoSync) — this just keeps the
    // "N sales waiting to sync" badge accurate as that happens.
    return onLocalChange('sales', refreshPendingCount)
  }, [refreshPendingCount])

  const addToCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        const nextQty = Math.min(existing.quantity + 1, product.stock_quantity)
        return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: nextQty } : i))
      }
      return [...prev, { product, quantity: 1, discount: 0 }]
    })
  }, [])

  const updateQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      prev.map((i) =>
        i.product.id === productId
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.product.stock_quantity)) }
          : i,
      ),
    )
  }, [])

  const updateItemDiscount = useCallback((productId, discount) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i
        const lineTotal = i.product.price * i.quantity
        return { ...i, discount: Math.max(0, Math.min(Number(discount) || 0, lineTotal)) }
      }),
    )
  }, [])

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setOrderDiscountState(0)
  }, [])

  const setOrderDiscount = useCallback((value) => {
    setOrderDiscountState(Math.max(0, Number(value) || 0))
  }, [])

  // Gross, before any discount — used only to derive per-item clamping.
  const grossSubtotal = useMemo(() => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0), [items])
  const itemDiscountTotal = useMemo(
    () => items.reduce((sum, i) => sum + Math.min(Number(i.discount) || 0, i.product.price * i.quantity), 0),
    [items],
  )
  // Subtotal already nets out per-item discounts, so it updates live as soon as a
  // per-piece discount is entered — the overall discount below is applied on top of it.
  const subtotal = useMemo(() => grossSubtotal - itemDiscountTotal, [grossSubtotal, itemDiscountTotal])
  // Total cost basis of everything in the cart — the overall discount is capped so the
  // sale can never clear below this, on top of whatever per-item discounts already did.
  const totalCost = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.product.cost_price) || 0) * i.quantity, 0),
    [items],
  )
  const maxOrderDiscount = useMemo(() => Math.max(0, subtotal - totalCost), [subtotal, totalCost])
  const effectiveOrderDiscount = useMemo(() => Math.max(0, Math.min(orderDiscount, maxOrderDiscount)), [orderDiscount, maxOrderDiscount])
  const discount = effectiveOrderDiscount
  const taxableAmount = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount])
  const tax = useMemo(() => taxableAmount * taxRate, [taxableAmount, taxRate])
  const total = useMemo(() => taxableAmount + tax, [taxableAmount, tax])
  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items])

  const completeSale = useCallback(async (overrides = {}) => {
    if (items.length === 0) return { success: false, message: 'Cart is empty.' }
    setIsCompleting(true)
    try {
      const finalPaymentMethod = overrides.paymentMethod ?? paymentMethod
      const finalCustomerId = overrides.customerId !== undefined ? overrides.customerId : customerId
      const finalCustomerName = overrides.customerName ?? null
      const wasOffline = !navigator.onLine

      const sale = {
        id: newId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        staff_name: staffName || 'Manager',
        tax_amount: Number(tax.toFixed(2)),
        total_amount: Number(total.toFixed(2)),
        customer_id: finalCustomerId,
        payment_method: finalPaymentMethod,
        discount_amount: Number(effectiveOrderDiscount.toFixed(2)),
        status: 'completed',
        sync_status: 'pending',
        sale_items: items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          price_at_sale: i.product.price,
          discount_amount: Number((i.discount || 0).toFixed(2)),
          products: { name: i.product.name, cost_price: i.product.cost_price },
        })),
        customers: finalCustomerName ? { name: finalCustomerName } : null,
      }

      // Written to Dexie first so the sale is never lost, then pushed through
      // complete_sale in the background (sales table registered in useSales.js) —
      // works identically online or offline, so there's no separate offline branch.
      await db.sales.put(sale)

      // Decrement stock locally so the grid can't oversell before this syncs.
      // Left un-pending on purpose: complete_sale decrements stock server-side
      // too, so flagging this a pending product edit would double-decrement it
      // once both the sale's RPC and a naive product upsert landed. The next
      // products pull simply overwrites this with the server's real count.
      for (const item of items) {
        const existing = await db.products.get(item.product.id)
        if (existing) {
          await db.products.update(item.product.id, {
            stock_quantity: Math.max(0, (existing.stock_quantity || 0) - item.quantity),
          })
        }
      }
      notifyChange('products')

      // A credit sale is also a real charge against the customer's account —
      // write it as an actual local credit_transactions record (not just an
      // optimistic bump to customers.credit_balance) so it's: (a) visible in
      // their history immediately, offline or not, and (b) impossible to lose
      // — a bare field mutation with no backing record was exactly the bug: if
      // a customers pull landed before this sale's complete_sale had actually
      // run server-side, the optimistic balance got silently overwritten with
      // the stale pre-charge value, and if the sale then failed to sync for
      // any reason, that charge vanished with no trace anywhere. The displayed
      // balance is computed from real 'pending' transaction rows like this one
      // (see lib/creditBalance.js) — customers.credit_balance itself is never
      // touched here, only ever by a real pull, so there's nothing left for a
      // pull to clobber. sale_id is resolved from this sale's local id to its
      // real server id once the sale syncs — see pushSales in useSales.js.
      if (finalPaymentMethod === 'credit' && finalCustomerId) {
        await db.credit_transactions.put({
          id: newId(),
          customer_id: finalCustomerId,
          type: 'charge',
          amount: sale.total_amount,
          sale_id: sale.id,
          staff_name: staffName || 'Manager',
          note: `Sale ${sale.id}`,
          created_at: sale.created_at,
          // Local echo of the sales(...) join useCreditTransactions expects, so
          // the itemized charge detail shows immediately, not just after sync.
          sales: { id: sale.id, created_at: sale.created_at, sale_items: sale.sale_items },
          sync_status: 'pending',
          sync_attempts: 0,
          sync_error: null,
        })
        notifyChange('credit_transactions')
        notifyChange('customers')
      }
      notifyChange('sales')
      await refreshPendingCount()

      clearCart()
      if (navigator.onLine) syncAll()
      return { success: true, offline: wasOffline, saleId: sale.id }
    } catch (err) {
      return { success: false, message: err.message }
    } finally {
      setIsCompleting(false)
    }
  }, [items, staffName, tax, total, customerId, paymentMethod, clearCart, effectiveOrderDiscount, refreshPendingCount])

  const value = {
    items,
    addToCart,
    updateQuantity,
    updateItemDiscount,
    removeFromCart,
    clearCart,
    subtotal,
    grossSubtotal,
    discount,
    itemDiscountTotal,
    totalCost,
    maxOrderDiscount,
    orderDiscount: effectiveOrderDiscount,
    setOrderDiscount,
    tax,
    total,
    itemCount,
    staffName,
    setStaffName,
    customerId,
    setCustomerId,
    paymentMethod,
    setPaymentMethod,
    completeSale,
    isCompleting,
    taxRate,
    pendingOfflineCount,
    failedSyncCount,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
