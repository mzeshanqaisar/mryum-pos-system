import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { describeSyncError, markPushFailure, markPushSuccess, notifyChange, onLocalChange, registerSyncTable, retrySyncRecord, syncAll } from '../lib/sync'
import { computeEffectiveCreditBalance } from '../lib/creditBalance'

// Explicit allowlist of real remote columns — see useSuppliers.js for why this
// isn't a denylist of local-only fields. The remote `customers` table has no
// `updated_at` column, so sending it (as a denylist approach did) got a 400
// back from every push, forever.
const REMOTE_FIELDS = ['id', 'name', 'phone', 'email', 'notes', 'created_at', 'credit_balance']

function toRemoteCustomer(local) {
  const payload = {}
  for (const key of REMOTE_FIELDS) {
    if (local[key] !== undefined) payload[key] = local[key]
  }
  return payload
}

function fromRemoteCustomer(remote) {
  return { ...remote, deleted: false, sync_status: 'synced', sync_attempts: 0, sync_error: null }
}

async function pushCustomers(pending, table) {
  for (const record of pending) {
    if (record.deleted) {
      const { error } = await supabase.from('customers').delete().eq('id', record.id)
      // A delete can fail (e.g. the customer still has sales/credit_transactions
      // referencing it) — hidden from the UI either way; track attempts so a
      // permanent conflict eventually surfaces as 'failed' instead of looping.
      if (!error) {
        await table.delete(record.id)
      } else {
        await markPushFailure(table, record.id, describeSyncError(error, 'customers', 'a signed-in staff account'))
      }
      continue
    }
    const { error } = await supabase.from('customers').upsert(toRemoteCustomer(record))
    if (!error) {
      await markPushSuccess(table, record.id)
    } else {
      await markPushFailure(table, record.id, describeSyncError(error, 'customers', 'a signed-in staff account'))
    }
  }
}

registerSyncTable({
  name: 'customers',
  supabaseTable: 'customers',
  toRemotePayload: toRemoteCustomer,
  fromRemoteRecord: fromRemoteCustomer,
  push: pushCustomers,
  // customers' pull fetches the whole table (no LIMIT) — safe to reconcile deletes.
  reconcileDeletes: true,
})

export function useCustomers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = (await db.customers.toArray()).filter((c) => !c.deleted)
    const withBalances = await Promise.all(
      rows.map(async (c) => ({ ...c, credit_balance: await computeEffectiveCreditBalance(db, c.id, c.credit_balance) })),
    )
    withBalances.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setCustomers(withBalances)
  }, [])

  // Local data shows instantly; sync (which can take a while to fail if
  // navigator.onLine is reporting a connection that isn't really there —
  // see useProducts.js) always runs strictly in the background afterward.
  const refresh = useCallback(async () => {
    await loadFromLocal()
    setLoading(false)
    if (isSupabaseConfigured && navigator.onLine) {
      syncAll().then(loadFromLocal)
    }
  }, [loadFromLocal])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => onLocalChange('customers', loadFromLocal), [loadFromLocal])
  useEffect(() => onLocalChange('credit_transactions', loadFromLocal), [loadFromLocal])

  const addCustomer = useCallback(
    async (customer) => {
      const record = {
        ...customer,
        id: newId(),
        credit_balance: Number(customer.credit_balance) || 0,
        created_at: nowIso(),
        updated_at: nowIso(),
        deleted: false,
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      }
      await db.customers.put(record)
      await loadFromLocal()
      notifyChange('customers')
      if (navigator.onLine) syncAll()
      return { success: true, customer: record }
    },
    [loadFromLocal],
  )

  const deleteCustomer = useCallback(
    async (id) => {
      const existing = await db.customers.get(id)
      if (!existing) return { success: false, message: 'Customer not found locally.' }
      await db.customers.put({
        ...existing,
        deleted: true,
        updated_at: nowIso(),
        sync_status: 'pending',
        sync_attempts: 0,
        sync_error: null,
      })
      await loadFromLocal()
      notifyChange('customers')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  const retrySync = useCallback(
    async (id) => {
      await retrySyncRecord('customers', id)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  return { customers, loading, addCustomer, deleteCustomer, retrySync, refresh }
}
