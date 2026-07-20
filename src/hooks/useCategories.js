import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { describeSyncError, markPushFailure, notifyChange, onLocalChange, registerSyncTable, syncAll } from '../lib/sync'

const FALLBACK_CATEGORIES = ['Bakery', 'Snacks', 'Beverages', 'Grocery', 'Dairy', 'Household']

// Explicit allowlist of real remote columns — see useSuppliers.js for why
// this isn't a denylist of local-only fields.
const REMOTE_FIELDS = ['id', 'name', 'created_at']

function toRemoteCategory(local) {
  const payload = {}
  for (const key of REMOTE_FIELDS) {
    if (local[key] !== undefined) payload[key] = local[key]
  }
  return payload
}

async function pushCategories(pending, table) {
  for (const record of pending) {
    const { error } = await supabase.from('categories').upsert(toRemoteCategory(record))
    if (!error) {
      await table.update(record.id, { sync_status: 'synced', sync_attempts: 0, sync_error: null })
    } else if (error.code === '23505') {
      // Someone already created this category name while we were offline — this
      // local duplicate is redundant, not a real conflict. Drop it; the next pull
      // brings in the real row under its own id.
      await table.delete(record.id)
    } else {
      await markPushFailure(table, record.id, describeSyncError(error, 'categories'))
    }
  }
}

registerSyncTable({
  name: 'categories',
  supabaseTable: 'categories',
  toRemotePayload: toRemoteCategory,
  fromRemoteRecord: (remote) => ({ ...remote, sync_status: 'synced', sync_attempts: 0, sync_error: null }),
  push: pushCategories,
  // categories' pull fetches the whole table (no LIMIT) — safe to reconcile deletes.
  reconcileDeletes: true,
})

export function useCategories() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = await db.categories.toArray()
    if (rows.length) {
      setCategories(rows.map((c) => c.name).sort((a, b) => a.localeCompare(b)))
    }
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

  useEffect(() => onLocalChange('categories', loadFromLocal), [loadFromLocal])

  const addCategory = useCallback(
    async (name) => {
      const trimmed = name.trim()
      if (!trimmed) return { success: false, message: 'Category name is required.' }
      const existing = await db.categories.toArray()
      if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
        return { success: true }
      }
      await db.categories.put({ id: newId(), name: trimmed, created_at: nowIso(), sync_status: 'pending' })
      await loadFromLocal()
      notifyChange('categories')
      if (navigator.onLine) syncAll()
      return { success: true }
    },
    [loadFromLocal],
  )

  return { categories, loading, addCategory, refresh }
}
