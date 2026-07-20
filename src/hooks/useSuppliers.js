import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { describeSyncError, markPushFailure, markPushSuccess, notifyChange, onLocalChange, registerSyncTable, retrySyncRecord, syncAll } from '../lib/sync'

// Explicit allowlist, not a denylist of local-only fields — the remote
// `suppliers` table has no `updated_at` column (only `products` does), so a
// denylist that only stripped sync_status/deleted silently sent `updated_at`
// through and got a 400 back from every push, forever. Listing exactly what
// the table actually has means a new local-only field can never leak again.
const REMOTE_FIELDS = ['id', 'name', 'contact_name', 'phone', 'email', 'notes', 'created_at', 'company_name', 'delivery_day', 'order_day']

function toRemoteSupplier(local) {
  const payload = {}
  for (const key of REMOTE_FIELDS) {
    if (local[key] !== undefined) payload[key] = local[key]
  }
  return payload
}

function fromRemoteSupplier(remote) {
  return { ...remote, deleted: false, sync_status: 'synced', sync_attempts: 0, sync_error: null }
}

async function pushSuppliers(pending, table) {
  for (const record of pending) {
    if (record.deleted) {
      const { error } = await supabase.from('suppliers').delete().eq('id', record.id)
      if (!error) {
        // Confirmed gone remotely (or never existed there) — the tombstone has done its job.
        await table.delete(record.id)
      } else {
        // A supplier referenced by existing purchase orders can't be hard-deleted —
        // hidden from the UI either way; track attempts so a permanent conflict
        // eventually surfaces as 'failed' instead of retrying forever.
        await markPushFailure(table, record.id, describeSyncError(error, 'suppliers'))
      }
      continue
    }
    const { error } = await supabase.from('suppliers').upsert(toRemoteSupplier(record))
    if (!error) {
      await markPushSuccess(table, record.id)
    } else {
      await markPushFailure(table, record.id, describeSyncError(error, 'suppliers'))
    }
  }
}

registerSyncTable({
  name: 'suppliers',
  supabaseTable: 'suppliers',
  toRemotePayload: toRemoteSupplier,
  fromRemoteRecord: fromRemoteSupplier,
  push: pushSuppliers,
  // suppliers' pull fetches the whole table (no LIMIT) — safe to reconcile deletes.
  reconcileDeletes: true,
})

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = (await db.suppliers.toArray()).filter((s) => !s.deleted)
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setSuppliers(rows)
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

  useEffect(() => onLocalChange('suppliers', loadFromLocal), [loadFromLocal])

  const addSupplier = useCallback(
    async (supplier) => {
      const record = {
        ...supplier,
        id: newId(),
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted: false,
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      }
      await db.suppliers.put(record)
      await loadFromLocal()
      notifyChange('suppliers')
      if (navigator.onLine) syncAll()
      return { success: true, supplier: record }
    },
    [loadFromLocal],
  )

  const deleteSupplier = useCallback(
    async (id) => {
      const existing = await db.suppliers.get(id)
      if (!existing) return { success: false, message: 'Supplier not found locally.' }
      await db.suppliers.put({ ...existing, deleted: true, updated_at: nowIso(), sync_status: 'pending', sync_attempts: 0, sync_error: null })
      await loadFromLocal()
      notifyChange('suppliers')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  const retrySync = useCallback(
    async (id) => {
      await retrySyncRecord('suppliers', id)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  return { suppliers, loading, addSupplier, deleteSupplier, retrySync, refresh }
}
