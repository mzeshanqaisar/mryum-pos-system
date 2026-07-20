import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { markPushFailure, notifyChange, onLocalChange, registerSyncTable, syncAll } from '../lib/sync'

// Every stock change funnels through here as a queued 'pending' local record —
// a single adjust_stock correction, or one line of a multi-product
// bulk_restock batch (grouped back together by restock_batch_id so the whole
// batch replays as ONE bulk_restock call, keeping its original atomicity).
// Neither RPC returns a row id to rekey against (adjust_stock returns the new
// stock count, bulk_restock returns nothing), so — same as credit_transactions
// payments — a successful push just deletes the local queue entry and lets
// the very next pull bring in the real, server-generated audit row.
async function pushStockMovements(pending, table) {
  const sorted = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

  for (const record of sorted.filter((r) => r.op === 'adjust_stock')) {
    const { error } = await supabase.rpc('adjust_stock', {
      p_product_id: record.product_id,
      p_change: record.quantity_change,
      p_change_type: record.change_type,
      p_note: record.note || null,
      p_staff_name: record.staff_name || null,
    })
    if (error) {
      await markPushFailure(table, record.id, error.message)
      continue
    }
    await table.delete(record.id)
  }

  const batches = new Map()
  for (const record of sorted.filter((r) => r.op === 'bulk_restock_item')) {
    if (!batches.has(record.restock_batch_id)) batches.set(record.restock_batch_id, [])
    batches.get(record.restock_batch_id).push(record)
  }
  for (const items of batches.values()) {
    const { error } = await supabase.rpc('bulk_restock', {
      p_items: items.map((i) => ({
        product_id: i.product_id,
        quantity_added: i.quantity_change,
        expiry_date: i.expiry_date || null,
        batch_received_date: i.batch_received_date || null,
        cost_price: i.cost_price ?? null,
      })),
      p_staff_name: items[0].staff_name || null,
    })
    if (error) {
      for (const i of items) await markPushFailure(table, i.id, error.message)
      continue
    }
    for (const i of items) await table.delete(i.id)
  }
}

async function pullStockMovements(table) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error || !data) return
  for (const remote of data) {
    const local = await table.get(remote.id)
    if (local && (local.sync_status === 'pending' || local.sync_status === 'failed')) continue
    await table.put({ ...remote, sync_status: 'synced', sync_attempts: 0, sync_error: null })
  }
}

registerSyncTable({ name: 'stock_movements', push: pushStockMovements, pull: pullStockMovements })

// Queues a single stock correction (adjustment/waste/return/initial) offline-first:
// applied to the local product immediately (greatest(0, ...) clamp, mirroring the
// RPC), then replayed through adjust_stock once online. Left un-pending on the
// product itself for the same reason sales' stock decrement is — adjust_stock
// changes stock server-side too, so flagging the product pending would double-apply
// once both a naive product upsert and this RPC landed.
export async function queueAdjustStock(productId, change, changeType, note, staffName) {
  const existing = await db.products.get(productId)
  if (!existing) return { success: false, message: 'Product not found locally — try Refresh first.' }

  const newStock = Math.max(0, (existing.stock_quantity || 0) + change)
  await db.products.update(productId, { stock_quantity: newStock })
  await db.stock_movements.put({
    id: newId(),
    op: 'adjust_stock',
    product_id: productId,
    change_type: changeType,
    quantity_change: change,
    resulting_stock: newStock,
    staff_name: staffName || null,
    note: note || null,
    created_at: nowIso(),
    sync_status: 'pending',
    sync_attempts: 0,
    sync_error: null,
  })
  notifyChange('products')
  notifyChange('stock_movements')
  if (navigator.onLine) syncAll()
  return { success: true }
}

// Queues a whole restock session (one or more products) offline-first, mirroring
// bulk_restock's own behavior: bumps stock and refreshes cost/expiry/batch on
// each product optimistically (only overwriting a field if this restock actually
// provided a value for it, same as the RPC's coalesce()), then logs one queued
// movement per item, grouped under one restock_batch_id so they replay as a
// single atomic bulk_restock call once online.
export async function queueBulkRestock(items, staffName) {
  const batchId = newId()
  const missing = []

  for (const item of items) {
    const existing = await db.products.get(item.product_id)
    if (!existing) {
      missing.push(item.product_id)
      continue
    }
    const newStock = (existing.stock_quantity || 0) + item.quantity_added
    const productUpdates = { stock_quantity: newStock }
    if (item.cost_price != null) productUpdates.cost_price = item.cost_price
    if (item.expiry_date) productUpdates.expiry_date = item.expiry_date
    if (item.batch_received_date) productUpdates.batch_received_date = item.batch_received_date
    await db.products.update(item.product_id, productUpdates)

    await db.stock_movements.put({
      id: newId(),
      op: 'bulk_restock_item',
      restock_batch_id: batchId,
      product_id: item.product_id,
      change_type: 'restock',
      quantity_change: item.quantity_added,
      resulting_stock: newStock,
      staff_name: staffName || null,
      note: 'Bulk restock',
      expiry_date: item.expiry_date || null,
      batch_received_date: item.batch_received_date || null,
      cost_price: item.cost_price ?? null,
      created_at: nowIso(),
      sync_status: 'pending',
      sync_attempts: 0,
      sync_error: null,
    })
  }

  if (missing.length > 0) {
    return { success: false, message: `${missing.length} product(s) not found locally — try Refresh first.` }
  }

  notifyChange('products')
  notifyChange('stock_movements')
  if (navigator.onLine) syncAll()
  return { success: true }
}

export function useStockMovements(productId) {
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    if (!productId) return
    const rows = await db.stock_movements.where('product_id').equals(productId).toArray()
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setMovements(rows.slice(0, 50))
  }, [productId])

  useEffect(() => {
    if (!productId) return undefined
    let cancelled = false
    setLoading(true)

    const run = async () => {
      if (isSupabaseConfigured && navigator.onLine) await syncAll()
      if (!cancelled) {
        await loadFromLocal()
        setLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [productId, loadFromLocal])

  useEffect(() => onLocalChange('stock_movements', loadFromLocal), [loadFromLocal])

  return { movements, loading }
}
