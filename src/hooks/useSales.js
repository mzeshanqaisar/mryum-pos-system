import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { markPushFailure, notifyChange, onLocalChange, registerSyncTable, retrySyncRecord, syncAll } from '../lib/sync'

// Sales go through the complete_sale RPC (it atomically writes sale_items,
// decrements stock, and — for credit sales — writes a credit_transactions
// charge server-side), so there's no plain upsert equivalent. A pending sale
// is created locally under a client-generated id and rekeyed to the id the
// RPC returns once it successfully pushes.
async function pushSales(pending, table) {
  const sorted = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  for (const sale of sorted) {
    const payload = {
      p_items: sale.sale_items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        price_at_sale: i.price_at_sale,
        discount_amount: i.discount_amount || 0,
      })),
      p_staff_name: sale.staff_name || 'Manager',
      p_tax_amount: Number(Number(sale.tax_amount).toFixed(2)),
      p_total_amount: Number(Number(sale.total_amount).toFixed(2)),
      p_customer_id: sale.customer_id ?? null,
      p_payment_method: sale.payment_method || 'cash',
      p_discount_amount: Number(Number(sale.discount_amount || 0).toFixed(2)),
    }
    const { data: realId, error } = await supabase.rpc('complete_sale', payload)
    if (error) {
      // A 409 here is almost always a foreign-key violation — the sale references
      // a product or customer that was itself offline-created and hasn't synced
      // yet. registerSyncTables.js orders products/customers before sales so this
      // resolves itself on the next pass in the normal case; markPushFailure's
      // attempt counter is what stops a genuinely broken reference (e.g. a
      // customer that was created then deleted again before ever syncing) from
      // retrying forever instead of surfacing as 'failed'.
      await markPushFailure(table, sale.id, error.message)
      continue
    }
    await table.delete(sale.id)
    await table.put({ ...sale, id: realId, sync_status: 'synced', sync_attempts: 0, sync_error: null })

    // complete_sale just wrote the authoritative credit_transactions charge
    // row server-side (for a credit sale) — resolve this sale's local charge
    // echo now, before the pull phase runs (syncAll always pushes every table
    // before pulling any of them). The echo has no way to adopt the real row's
    // server-generated id, so deleting it here and letting the very next
    // credit_transactions pull bring the real one in avoids ever showing both.
    if (sale.payment_method === 'credit' && sale.customer_id) {
      const linked = await db.credit_transactions.where('sale_id').equals(sale.id).toArray()
      const localCharge = linked.find((t) => t.type === 'charge')
      if (localCharge) {
        await db.credit_transactions.delete(localCharge.id)
        notifyChange('credit_transactions')
        notifyChange('customers')
      }
    }
  }
}

async function pullSales(table) {
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*, products(name, cost_price)), customers(name)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return
  for (const remote of data) {
    const local = await table.get(remote.id)
    if (local && (local.sync_status === 'pending' || local.sync_status === 'failed')) continue
    await table.put({ ...remote, sync_status: 'synced', sync_attempts: 0, sync_error: null })
  }
}

registerSyncTable({ name: 'sales', push: pushSales, pull: pullSales })

// Refunds are queued separately from sales itself — a refund mutates an
// *existing* sale (reverses stock, flips status to 'refunded', logs a refunds
// row) rather than creating one, so it can't go through pushSales' "create via
// complete_sale" path. Like adjust_stock/bulk_restock, refund_sale returns
// nothing to rekey against, so a successful push just clears the local queue
// entry; the sale's own pull (above) picks up the authoritative 'refunded'
// status on the next pass.
async function pushRefunds(pending, table) {
  const sorted = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  for (const record of sorted) {
    const { error } = await supabase.rpc('refund_sale', {
      p_sale_id: record.sale_id,
      p_reason: record.reason,
      p_staff_name: record.staff_name,
    })
    if (error) {
      await markPushFailure(table, record.id, error.message)
      continue
    }
    await table.delete(record.id)
  }
}

// No real pull: the app never reads the refunds table directly (Reports.jsx
// just checks sale.status) — it's a write-only audit log from the client's
// side. A no-op pull is still supplied explicitly rather than left to the
// registry's default (which assumes a `supabaseTable` this config doesn't set).
registerSyncTable({ name: 'refunds', push: pushRefunds, pull: async () => {} })

export function useSales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // sale_id -> 'pending' | 'failed', for the refund queued on that sale (if any) —
  // lets Reports.jsx show "refund syncing"/"refund sync failed" even though the
  // sale's own status already flipped to 'refunded' optimistically.
  const [refundStatusBySaleId, setRefundStatusBySaleId] = useState({})

  const loadFromLocal = useCallback(async () => {
    const rows = await db.sales.toArray()
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setSales(rows)

    const outstandingRefunds = await db.refunds.toArray()
    const byId = {}
    for (const r of outstandingRefunds) byId[r.sale_id] = r.sync_status
    setRefundStatusBySaleId(byId)
  }, [])

  // Local data shows instantly; sync (which can take a while to fail if
  // navigator.onLine is reporting a connection that isn't really there —
  // see useProducts.js) always runs strictly in the background afterward.
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

  useEffect(() => onLocalChange('refunds', loadFromLocal), [loadFromLocal])

  const refundSale = useCallback(
    async (saleId, reason, staffName) => {
      // A refund mutates an *existing* sale, so the sale has to actually exist
      // server-side first — one that's still 'pending' (never synced) or
      // 'failed' has no real row yet to refund.
      const sale = await db.sales.get(saleId)
      if (!sale) return { success: false, message: 'Sale not found locally — try Refresh first.' }
      if (sale.sync_status !== 'synced') {
        return { success: false, message: 'This sale is still syncing — wait for it to finish before refunding it.' }
      }

      await db.refunds.put({
        id: newId(),
        sale_id: saleId,
        reason: reason || null,
        staff_name: staffName || null,
        created_at: nowIso(),
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      })

      // Optimistic mirror of refund_sale: restore stock per line item and log a
      // matching local movement, then flip the sale to 'refunded'. Both stay
      // un-pending on purpose — refund_sale does the same restoration and status
      // flip server-side, so flagging either as pending would double-apply once
      // both a naive upsert and the RPC landed. The next sales/products pull
      // simply overwrites these with the server's authoritative values.
      for (const item of sale.sale_items || []) {
        if (!item.product_id) continue
        const product = await db.products.get(item.product_id)
        if (!product) continue
        const newStock = (product.stock_quantity || 0) + item.quantity
        await db.products.update(item.product_id, { stock_quantity: newStock })
        await db.stock_movements.put({
          id: newId(),
          product_id: item.product_id,
          change_type: 'return',
          quantity_change: item.quantity,
          resulting_stock: newStock,
          staff_name: staffName || null,
          note: `Refund of sale ${saleId}`,
          created_at: nowIso(),
          sync_status: 'synced', // display-only local echo — refund_sale writes the real row server-side
          sync_attempts: 0,
          sync_error: null,
        })
      }
      await db.sales.update(saleId, { status: 'refunded' })

      notifyChange('products')
      notifyChange('stock_movements')
      notifyChange('sales')
      notifyChange('refunds')
      if (navigator.onLine) syncAll()
      await loadFromLocal()
      return { success: true }
    },
    [loadFromLocal],
  )

  const retryRefundSync = useCallback(
    async (saleId) => {
      const outstanding = await db.refunds.where('sale_id').equals(saleId).first()
      if (!outstanding) return
      await retrySyncRecord('refunds', outstanding.id)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  const retrySync = useCallback(
    async (saleId) => {
      await retrySyncRecord('sales', saleId)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  return { sales, loading, error, refresh, refundSale, retrySync, refundStatusBySaleId, retryRefundSync }
}
