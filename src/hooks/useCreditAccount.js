import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { db, newId, nowIso } from '../lib/db'
import { notifyChange, onLocalChange, syncAll } from '../lib/sync'
import { computeEffectiveCreditBalance } from '../lib/creditBalance'

// Shared by useCreditAccount and useCreditAccounts so there's one write path.
// Queues a 'payment' credit_transactions record (pushed through the
// record_credit_payment RPC by useCreditTransactions' sync registration).
// Deliberately does NOT touch customers.credit_balance directly — the
// displayed balance is computed fresh from real 'pending' transaction rows
// (see lib/creditBalance.js) every time it's read, so there's no separately-
// mutated field that a later pull could clobber or that could drift from
// what actually happened. See CartContext.jsx for the matching fix on the
// charge side of this same balance.
export async function recordCreditPayment(customerId, amount, staffName, note) {
  if (!amount || amount <= 0) return { success: false, message: 'Payment amount must be greater than zero.' }

  const existing = await db.customers.get(customerId)
  if (!existing) return { success: false, message: 'Customer not found locally — try Refresh first.' }

  await db.credit_transactions.put({
    id: newId(),
    customer_id: customerId,
    type: 'payment',
    amount,
    staff_name: staffName || 'Staff',
    note: note || null,
    sale_id: null,
    created_at: nowIso(),
    sync_status: 'pending',
    sync_attempts: 0,
    sync_error: null,
  })

  notifyChange('customers')
  notifyChange('credit_transactions')
  if (navigator.onLine) syncAll()

  const newBalance = await computeEffectiveCreditBalance(db, customerId, existing.credit_balance)
  return { success: true, newBalance }
}

export function useCreditAccount(customerId) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    if (!customerId) return
    const row = await db.customers.get(customerId)
    if (!row || row.deleted) {
      setCustomer(null)
      return
    }
    const credit_balance = await computeEffectiveCreditBalance(db, customerId, row.credit_balance)
    setCustomer({ ...row, credit_balance })
  }, [customerId])

  // Local data shows instantly; sync (which can take a while to fail if
  // navigator.onLine is reporting a connection that isn't really there —
  // see useProducts.js) always runs strictly in the background afterward.
  const refresh = useCallback(async () => {
    if (!customerId) {
      setLoading(false)
      return
    }
    await loadFromLocal()
    setLoading(false)
    if (isSupabaseConfigured && navigator.onLine) {
      syncAll().then(loadFromLocal)
    }
  }, [customerId, loadFromLocal])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => onLocalChange('customers', loadFromLocal), [loadFromLocal])
  useEffect(() => onLocalChange('credit_transactions', loadFromLocal), [loadFromLocal])

  const recordPayment = useCallback(
    async (amount, staffName, note) => {
      const result = await recordCreditPayment(customerId, amount, staffName, note)
      if (result.success) await loadFromLocal()
      return result
    },
    [customerId, loadFromLocal],
  )

  return { customer, loading, recordPayment, refresh }
}
