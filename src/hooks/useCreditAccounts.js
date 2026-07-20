import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { db } from '../lib/db'
import { onLocalChange, syncAll } from '../lib/sync'
import { recordCreditPayment } from './useCreditAccount'
import { computeEffectiveCreditBalance } from '../lib/creditBalance'

export function useCreditAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    const rows = (await db.customers.toArray()).filter((c) => !c.deleted)
    const withBalances = await Promise.all(
      rows.map(async (c) => ({ ...c, credit_balance: await computeEffectiveCreditBalance(db, c.id, c.credit_balance) })),
    )
    withBalances.sort((a, b) => Number(b.credit_balance || 0) - Number(a.credit_balance || 0))
    setAccounts(withBalances)
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

  const recordPayment = useCallback(
    async (customerId, amount, staffName, note) => {
      const result = await recordCreditPayment(customerId, amount, staffName, note)
      if (result.success) await loadFromLocal()
      return result
    },
    [loadFromLocal],
  )

  return { accounts, loading, recordPayment, refresh }
}
