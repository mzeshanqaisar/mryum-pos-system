import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { db } from '../lib/db'
import { markPushFailure, notifyChange, onLocalChange, registerSyncTable, retrySyncRecord, syncAll } from '../lib/sync'

// 'charge' transactions never get pushed here — they're either a local echo
// tied to an offline sale (resolved directly by pushSales in useSales.js once
// that sale syncs, see the comment there) or already the real, server-written
// row from complete_sale (pulled in as 'synced'). 'payment' transactions are
// queued locally by useCreditAccount's recordPayment and pushed here through
// the record_credit_payment RPC. The RPC returns just the new balance, not a
// row id, so there's no rekey step (unlike sales) — the pending local record
// is simply dropped once the RPC succeeds, and the immediately-following pull
// picks up the real, server-generated row.
async function pushCreditTransactions(pending, table) {
  const sorted = [...pending].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  for (const record of sorted) {
    if (record.type !== 'payment') continue // charge echoes resolve via their sale, not here
    const { error } = await supabase.rpc('record_credit_payment', {
      p_customer_id: record.customer_id,
      p_amount: record.amount,
      p_staff_name: record.staff_name,
      p_note: record.note || null,
    })
    if (error) {
      // Was retrying forever with no attempt tracking at all before this fix —
      // a payment that genuinely can't apply (e.g. the customer was deleted)
      // would 409/error on every pass indefinitely with nothing ever flagging
      // it for review.
      await markPushFailure(table, record.id, error.message)
      continue
    }
    // Deliberately NOT calling notifyChange() here. The displayed balance is
    // (customers.credit_balance) + (sum of un-synced credit_transactions) —
    // deleting this now-synced pending row removes the second half of that
    // sum, but customers.credit_balance in Dexie is still the PRE-payment
    // value at this exact point (its own pull hasn't run yet — pushes for
    // every table finish before any table's pull begins). Notifying here
    // would recompute against that stale base with nothing left to offset
    // it, flashing the balance back to its pre-payment amount for the
    // several seconds until customers' own pull corrects it. Silently
    // deleting and leaving the UI showing its last (correct, optimistic)
    // render until customers' pull naturally fires notifyChange('customers')
    // with the real new balance already in place avoids that flash entirely.
    await table.delete(record.id)
  }
}

async function pullCreditTransactions(table) {
  const { data, error } = await supabase
    .from('credit_transactions')
    .select('*, sales(id, created_at, sale_items(*, products(name)))')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error || !data) return
  for (const remote of data) {
    const local = await table.get(remote.id)
    if (local && (local.sync_status === 'pending' || local.sync_status === 'failed')) continue
    await table.put({ ...remote, sync_status: 'synced', sync_attempts: 0, sync_error: null })
  }
}

registerSyncTable({ name: 'credit_transactions', push: pushCreditTransactions, pull: pullCreditTransactions })

export function useCreditTransactions(customerId) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFromLocal = useCallback(async () => {
    if (!customerId) return
    const rows = await db.credit_transactions.where('customer_id').equals(customerId).toArray()
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setTransactions(rows)
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

  useEffect(() => onLocalChange('credit_transactions', loadFromLocal), [loadFromLocal])

  const retrySync = useCallback(
    async (id) => {
      await retrySyncRecord('credit_transactions', id)
      await loadFromLocal()
    },
    [loadFromLocal],
  )

  return { transactions, loading, refresh, retrySync }
}
