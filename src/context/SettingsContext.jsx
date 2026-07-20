import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { db, nowIso } from '../lib/db'
import { notifyChange, onLocalChange, registerSyncTable, syncAll } from '../lib/sync'

const defaults = {
  id: 1,
  store_name: 'Mr YUM Bakers And General Store',
  tax_rate: 0.08,
  currency_symbol: '$',
}

// Explicit allowlist of real remote columns — see useSuppliers.js for why this
// isn't a denylist of local-only fields. The remote `app_settings` table has
// no `updated_at` column, so sending it (as a denylist approach did) got a
// 400 back from every push, forever.
const REMOTE_FIELDS = ['id', 'store_name', 'tax_rate', 'currency_symbol', 'created_at']

function toRemoteSettings(local) {
  const payload = {}
  for (const key of REMOTE_FIELDS) {
    if (local[key] !== undefined) payload[key] = local[key]
  }
  return payload
}

function fromRemoteSettings(remote) {
  return { ...remote, sync_status: 'synced', sync_attempts: 0, sync_error: null }
}

registerSyncTable({
  name: 'app_settings',
  supabaseTable: 'app_settings',
  toRemotePayload: toRemoteSettings,
  fromRemoteRecord: fromRemoteSettings,
})

const NAV_NAME_LINES_KEY = 'mryum-nav-name-lines'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [navNameLines, setNavNameLinesState] = useState(() => {
    if (typeof window === 'undefined') return 1
    return Number(localStorage.getItem(NAV_NAME_LINES_KEY)) || 1
  })

  const setNavNameLines = useCallback((lines) => {
    setNavNameLinesState(lines)
    localStorage.setItem(NAV_NAME_LINES_KEY, String(lines))
  }, [])

  const loadFromLocal = useCallback(async () => {
    const row = await db.app_settings.get(1)
    if (row) setSettings(row)
  }, [])

  // Local data shows instantly; sync (which can take a while to fail if
  // navigator.onLine is reporting a connection that isn't really there —
  // see hooks/useProducts.js) always runs strictly in the background afterward.
  const fetchSettings = useCallback(async () => {
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
    fetchSettings()
  }, [fetchSettings])

  useEffect(() => onLocalChange('app_settings', loadFromLocal), [loadFromLocal])

  const updateSettings = useCallback(async (updates) => {
    const existing = (await db.app_settings.get(1)) || defaults
    const record = { ...existing, ...updates, id: 1, updated_at: nowIso(), sync_status: 'pending', sync_attempts: 0, sync_error: null }
    await db.app_settings.put(record)
    setSettings(record)
    notifyChange('app_settings')
    if (navigator.onLine) syncAll()
    return { success: true }
  }, [])

  const currency = settings.currency_symbol || '$'

  return (
    <SettingsContext.Provider
      value={{ settings, loading, updateSettings, refresh: fetchSettings, navNameLines, setNavNameLines, currency }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
