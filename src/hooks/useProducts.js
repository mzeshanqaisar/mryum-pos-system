import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { describeSyncError, markPushFailure, markPushSuccess, notifyChange, onLocalChange, registerSyncTable, retrySyncRecord, syncAll } from '../lib/sync'
import { queueAdjustStock, queueBulkRestock } from './useStockMovements'

// Explicit allowlist of real remote columns — see useSuppliers.js for why
// this isn't a denylist of local-only fields (a denylist is what let
// `updated_at` leak into the suppliers/customers/app_settings payloads and
// 400 forever, since those tables don't actually have that column). `deleted`
// is local-only too — the remote table has no tombstone column, a delete
// there is a real delete.
const REMOTE_FIELDS = [
  'id', 'name', 'category', 'price', 'stock_quantity', 'low_stock_threshold', 'image_url', 'batch_id',
  'created_at', 'cost_price', 'unit', 'expiry_date', 'updated_at', 'expiry_alert_days', 'pieces_per_box',
  'sub_category', 'piece_barcode', 'box_barcode', 'tax_percent', 'batch_received_date', 'is_active', 'supplier_id',
]

function toRemoteProduct(local) {
  const payload = {}
  for (const key of REMOTE_FIELDS) {
    if (local[key] !== undefined) payload[key] = local[key]
  }
  return payload
}

function fromRemoteProduct(remote) {
  return { ...remote, deleted: false, sync_status: 'synced', sync_attempts: 0, sync_error: null }
}

async function pushProducts(pending, table) {
  for (const record of pending) {
    if (record.deleted) {
      const { error } = await supabase.from('products').delete().eq('id', record.id)
      // A product referenced by existing sale_items/purchase_order_items can't
      // be hard-deleted — hidden from the UI either way; track attempts so a
      // permanent conflict eventually surfaces as 'failed' instead of looping.
      if (!error) {
        await table.delete(record.id)
      } else {
        await markPushFailure(table, record.id, describeSyncError(error, 'products'))
      }
      continue
    }
    const { error } = await supabase.from('products').upsert(toRemoteProduct(record))
    if (!error) {
      await markPushSuccess(table, record.id)
    } else {
      await markPushFailure(table, record.id, describeSyncError(error, 'products'))
    }
  }
}

registerSyncTable({
  name: 'products',
  supabaseTable: 'products',
  toRemotePayload: toRemoteProduct,
  fromRemoteRecord: fromRemoteProduct,
  push: pushProducts,
  // products' pull fetches the whole table (no LIMIT), so "not in this
  // result" reliably means "deleted server-side" — safe to clean up locally.
  reconcileDeletes: true,
})

export function useProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadFromLocal = useCallback(async () => {
    const rows = (await db.products.toArray()).filter((p) => !p.deleted)
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setProducts(rows)
  }, [])

  // Local data shows instantly, full stop — `navigator.onLine` only reflects
  // whether a network adapter is connected, not whether the internet is
  // actually reachable, so it's common for it to report `true` with no real
  // connection at all. Awaiting syncAll() before this used to mean every
  // list waited on that (genuinely slow — each of the ~10 tables takes a
  // real several-second timeout to fail, ~a minute total) before showing
  // anything it already had locally. Sync now always runs strictly in the
  // background: it can take as long as it needs without blocking the first,
  // already-correct render of whatever's in Dexie.
  const refresh = useCallback(async () => {
    setError(null)
    await loadFromLocal()
    setLoading(false)
    if (isSupabaseConfigured && navigator.onLine) {
      syncAll().then(loadFromLocal)
    }
  }, [loadFromLocal])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Other hook instances of `products` (e.g. Billing's grid vs. this page's own
  // copy) and other tables that touch product stock (CartContext, adjustStock)
  // all mutate the same Dexie table without sharing React state — this is what
  // keeps everyone's view in sync without a page reload.
  useEffect(() => onLocalChange('products', loadFromLocal), [loadFromLocal])

  const addProduct = useCallback(
    async (product) => {
      const record = {
        ...product,
        id: newId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted: false,
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      }
      await db.products.put(record)
      await loadFromLocal()
      notifyChange('products')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  const updateProduct = useCallback(
    async (id, updates) => {
      const existing = await db.products.get(id)
      if (!existing) return { success: false, message: 'Product not found locally — try Refresh first.' }
      const record = { ...existing, ...updates, updated_at: nowIso(), sync_status: 'pending', sync_attempts: 0, sync_error: null }
      await db.products.put(record)
      await loadFromLocal()
      notifyChange('products')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  const deleteProduct = useCallback(
    async (id) => {
      const existing = await db.products.get(id)
      if (!existing) return { success: false, message: 'Product not found locally.' }
      await db.products.put({
        ...existing,
        deleted: true,
        updated_at: nowIso(),
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      })
      await loadFromLocal()
      notifyChange('products')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  // Both queue a local stock_movements record and apply the change to the
  // local product immediately (see useStockMovements.js), then replay through
  // adjust_stock / bulk_restock once online — same offline-first + rekey-free
  // pattern as sales' complete_sale, just without a row id to rekey against.
  const adjustStock = useCallback(
    async (productId, change, changeType, note, staffName) => {
      const result = await queueAdjustStock(productId, change, changeType, note, staffName)
      if (result.success) await loadFromLocal()
      return result
    },
    [loadFromLocal],
  )

  const bulkRestock = useCallback(
    async (items, staffName) => {
      const result = await queueBulkRestock(items, staffName)
      if (result.success) await loadFromLocal()
      return result
    },
    [loadFromLocal],
  )

  const retrySync = useCallback(
    async (id) => {
      await retrySyncRecord('products', id)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  return {
    products,
    loading,
    error,
    refresh,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    bulkRestock,
    retrySync,
  }
}
