// The displayed credit balance is always DERIVED, never stored-and-mutated:
// `customers.credit_balance` locally is a pure mirror of whatever the server
// last confirmed (only ever written by a pull, never optimistically edited
// by a charge or payment) — on top of that, every local credit_transactions
// record NOT YET reflected in that server-confirmed value is summed in live.
// This is what guarantees the number can never silently diverge from what's
// actually recorded: it IS a computation over the real transaction rows, not
// a separate field that a bug (or a race) could leave stale or wrong.
//
// "Not yet reflected" means anything that isn't 'synced' — both 'pending'
// AND 'failed'. A transaction that exhausted its retry attempts and flipped
// to 'failed' still genuinely happened (the customer really did take goods
// on credit, or really did pay something back); it just needs a human to
// resolve whatever's blocking it from reaching the server. Excluding
// 'failed' rows from the sum would silently erase a real transaction from
// the balance the moment its 3rd retry failed — the exact "vanishes with no
// trace" bug this whole balance-computation approach exists to prevent.
export async function computeEffectiveCreditBalance(db, customerId, baseBalance) {
  const transactions = await db.credit_transactions.where('customer_id').equals(customerId).toArray()
  let delta = 0
  for (const t of transactions) {
    if (t.sync_status === 'synced') continue
    if (t.type === 'charge') delta += Number(t.amount) || 0
    else if (t.type === 'payment') delta -= Number(t.amount) || 0
  }
  return Math.max(0, Number(baseBalance || 0) + delta)
}
