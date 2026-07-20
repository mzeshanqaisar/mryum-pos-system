import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { describeSyncError, markPushFailure, markPushSuccess, notifyChange, onLocalChange, reconcileDeletedRemotes, registerSyncTable, syncAll } from '../lib/sync'

// purchase_order_items lives as a separate remote table, but locally each
// order carries its items as an embedded array — much simpler to edit
// incrementally offline (add/increment/remove an item is just one Dexie
// write on the parent order) than tracking per-item sync state. On push, the
// whole item list for a 'pending' order is replaced remotely in one
// delete-then-insert — safe because this is a mutable draft list (what to
// tell the supplier next time), not an append-only ledger like sale_items.
async function pushPurchaseOrders(pending, table) {
  for (const order of pending) {
    if (order.deleted) {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', order.id)
      if (!error) {
        await table.delete(order.id)
      } else {
        await markPushFailure(table, order.id, describeSyncError(error, 'purchase orders'))
      }
      continue
    }

    const orderPayload = {
      id: order.id,
      supplier_id: order.supplier_id,
      status: order.status,
      notes: order.notes || null,
      created_at: order.created_at,
      received_at: order.received_at || null,
    }
    const { error: orderError } = await supabase.from('purchase_orders').upsert(orderPayload)
    if (orderError) {
      await markPushFailure(table, order.id, describeSyncError(orderError, 'purchase orders'))
      continue
    }

    const { error: deleteItemsError } = await supabase.from('purchase_order_items').delete().eq('purchase_order_id', order.id)
    if (deleteItemsError) {
      await markPushFailure(table, order.id, describeSyncError(deleteItemsError, 'purchase orders'))
      continue
    }

    const items = order.purchase_order_items || []
    if (items.length > 0) {
      const itemsPayload = items.map((i) => ({
        id: i.id,
        purchase_order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        cost_price: i.cost_price || 0,
      }))
      const { error: insertError } = await supabase.from('purchase_order_items').insert(itemsPayload)
      if (insertError) {
        await markPushFailure(table, order.id, describeSyncError(insertError, 'purchase orders'))
        continue
      }
    }

    await markPushSuccess(table, order.id)
  }
}

async function pullPurchaseOrders(table) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name), purchase_order_items(*, products(name, unit, pieces_per_box, cost_price))')
    .order('created_at', { ascending: false })
  if (error || !data) return
  for (const remote of data) {
    const local = await table.get(remote.id)
    if (local && (local.sync_status === 'pending' || local.sync_status === 'failed')) continue
    await table.put({ ...remote, deleted: false, sync_status: 'synced', sync_attempts: 0, sync_error: null })
  }
  // This pull fetches every order (no LIMIT) — safe to clean up any locally
  // cached order that's gone server-side (e.g. deleted directly in Supabase).
  await reconcileDeletedRemotes(table, data.map((r) => r.id))
}

registerSyncTable({ name: 'purchase_orders', push: pushPurchaseOrders, pull: pullPurchaseOrders })

export function useSupplierOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = (await db.purchase_orders.toArray()).filter((o) => !o.deleted)
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setOrders(rows)
  }, [])

  // Local data shows instantly; sync (which can take a while to fail if
  // navigator.onLine is reporting a connection that isn't really there —
  // see useProducts.js) always runs strictly in the background afterward.
  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    await loadFromLocal()
    setLoading(false)
    if (navigator.onLine) {
      syncAll().then(loadFromLocal)
    }
  }, [loadFromLocal])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => onLocalChange('purchase_orders', loadFromLocal), [loadFromLocal])

  const getPendingOrder = useCallback(
    (supplierId) => orders.find((o) => o.supplier_id === supplierId && o.status === 'pending') || null,
    [orders],
  )

  const findOrCreatePendingOrder = useCallback(
    async (supplierId) => {
      const existing = orders.find((o) => o.supplier_id === supplierId && o.status === 'pending')
      if (existing) return { success: true, order: existing }

      const record = {
        id: newId(),
        supplier_id: supplierId,
        status: 'pending',
        notes: null,
        created_at: nowIso(),
        received_at: null,
        deleted: false,
        purchase_order_items: [],
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      }
      await db.purchase_orders.put(record)
      await loadFromLocal()
      notifyChange('purchase_orders')
      if (navigator.onLine) syncAll()
      return { success: true, order: record }
    },
    [orders, loadFromLocal],
  )

  const addOrIncrementItem = useCallback(
    async (supplierId, productId, quantityPieces) => {
      const orderResult = await findOrCreatePendingOrder(supplierId)
      if (!orderResult.success) return orderResult

      const order = await db.purchase_orders.get(orderResult.order.id)
      const product = await db.products.get(productId)
      const items = [...(order.purchase_order_items || [])]
      const existingIdx = items.findIndex((i) => i.product_id === productId)

      if (existingIdx >= 0) {
        items[existingIdx] = { ...items[existingIdx], quantity: items[existingIdx].quantity + quantityPieces }
      } else {
        items.push({
          id: newId(),
          product_id: productId,
          quantity: quantityPieces,
          cost_price: product?.cost_price || 0,
          products: product
            ? { name: product.name, unit: product.unit, pieces_per_box: product.pieces_per_box, cost_price: product.cost_price }
            : null,
        })
      }

      await db.purchase_orders.update(order.id, {
        purchase_order_items: items,
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      })
      await loadFromLocal()
      notifyChange('purchase_orders')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [findOrCreatePendingOrder, loadFromLocal],
  )

  const removeItem = useCallback(
    async (itemId) => {
      const allOrders = await db.purchase_orders.toArray()
      const order = allOrders.find((o) => o.purchase_order_items?.some((i) => i.id === itemId))
      if (!order) return { success: false, message: 'Item not found locally.' }

      const items = order.purchase_order_items.filter((i) => i.id !== itemId)
      await db.purchase_orders.update(order.id, {
        purchase_order_items: items,
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      })
      await loadFromLocal()
      notifyChange('purchase_orders')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  const clearOrder = useCallback(
    async (orderId) => {
      const existing = await db.purchase_orders.get(orderId)
      if (!existing) return { success: false, message: 'Order not found locally.' }
      await db.purchase_orders.put({ ...existing, deleted: true, sync_status: 'pending', sync_attempts: 0, sync_error: null })
      await loadFromLocal()
      notifyChange('purchase_orders')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  return { orders, loading, getPendingOrder, addOrIncrementItem, removeItem, clearOrder, refresh }
}
