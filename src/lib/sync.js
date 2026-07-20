import { db } from './db'
import { isSupabaseConfigured, supabase } from './supabaseClient'

// Each local table registers itself here once (from its hook module) with
// enough info for the engine to push/pull it generically:
//   name             — the Dexie table name (matches the Supabase table name today)
//   supabaseTable    — the Supabase table to sync against (used by the default push/pull)
//   toRemotePayload  — strips local-only fields (sync_status) before sending
//   fromRemoteRecord — stamps an incoming Supabase row as sync_status: 'synced'
//   push(pending, table)  — OPTIONAL: replaces the default upsert loop, for tables
//                            that write through an RPC (sales, stock adjustments)
//                            instead of a plain table upsert
//   pull(table)            — OPTIONAL: replaces the default select('*'), for tables
//                            that need a joined/filtered read (e.g. sales' line items)
const registry = new Map()

export function registerSyncTable(config) {
  registry.set(config.name, config)
}

// Lets a write in one hook (e.g. CartContext decrementing stock) tell a
// different hook instance of the same table (e.g. Billing's useProducts) to
// re-read Dexie, without any prop drilling or shared React state between them.
export function notifyChange(name) {
  window.dispatchEvent(new CustomEvent('local-db-change', { detail: { table: name } }))
}

export function onLocalChange(name, callback) {
  const handler = (e) => {
    if (e.detail?.table === name) callback()
  }
  window.addEventListener('local-db-change', handler)
  return () => window.removeEventListener('local-db-change', handler)
}

// A record that fails to push this many times in a row stops being retried
// automatically and is marked 'failed' instead of 'pending' — this is what
// stops one permanently-broken record (e.g. a genuine data conflict) from
// re-attempting forever on every sync pass and spamming the network/console.
// A user action (e.g. "Retry sync") is needed to move it back to 'pending'.
export const MAX_SYNC_ATTEMPTS = 3

// Postgres' RLS-violation code — a write blocked by a `create policy ... with
// check (is_manager())` (or similar) rule comes back as this code with a
// message like `new row violates row-level security policy for table "X"`.
// This class of failure is never fixable by retrying: the account's role
// itself needs to change, not the data. Recognizing it lets the UI tell the
// user what's actually wrong instead of a generic "sync failed".
const RLS_VIOLATION_CODE = '42501'

// Turns a raw Postgrest error into something a non-technical user can act on.
// Falls back to the raw message for every other error class (network blips,
// validation errors, FK conflicts, etc.) — those are either self-explanatory
// or genuinely need investigation, not worth guessing a friendlier phrasing.
export function describeSyncError(error, tableLabel, requirement = 'a manager account') {
  if (error?.code === RLS_VIOLATION_CODE) {
    const what = tableLabel ? `add or edit ${tableLabel}` : 'make this change'
    return `Permission denied — only ${requirement} can ${what}. Ask a manager, or check your account's role under Settings → Staff.`
  }
  return error?.message || 'Unknown sync error'
}

// Call from a push function when a record's write to Supabase failed. Tracks
// the attempt count on the record itself so it survives across sync passes,
// and flips it to 'failed' once it's been tried MAX_SYNC_ATTEMPTS times.
export async function markPushFailure(table, id, message) {
  const record = await table.get(id)
  if (!record) return
  const attempts = (record.sync_attempts || 0) + 1
  const status = attempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending'
  await table.update(id, { sync_status: status, sync_attempts: attempts, sync_error: message || null })
}

// Call from a push function when a record's write to Supabase succeeded —
// clears any failure history so a record that failed twice then succeeded
// doesn't carry stale attempt/error state around.
export async function markPushSuccess(table, id, extra = {}) {
  await table.update(id, { sync_status: 'synced', sync_attempts: 0, sync_error: null, ...extra })
}

// Puts a 'failed' record back in the retry queue — used by a "Retry sync" UI
// action so a record that needed a fix (or just a flaky network) isn't stuck
// forever without the user explicitly asking to try it again.
export async function retrySyncRecord(tableName, id) {
  const table = db.table(tableName)
  await table.update(id, { sync_status: 'pending', sync_attempts: 0, sync_error: null })
  notifyChange(tableName)
  if (navigator.onLine) syncAll()
}

// Pushes every 'pending' local record across every table, THEN pulls the
// latest remote state for every table — two full phases, not interleaved
// per-table. This matters beyond serialization below: if table B's pull ran
// before table A's push (e.g. customers pulled before a queued sale's
// complete_sale had run), an optimistic local edit on B that a push on A is
// about to make true server-side (a credit sale bumping the customer's
// balance) could get clobbered by B's pull fetching the still-stale
// pre-push server value. Doing all pushes first means that by the time any
// pull runs, everything that succeeded this pass has already landed
// server-side, so every pull sees fresh, consistent data.
// Each table's push/pull is individually isolated — an uncaught error on one
// table (e.g. a request that was genuinely in flight when the connection
// dropped mid-pass, throwing instead of resolving to a clean {error}) must
// not abort the whole registry loop. Before this, one table failing this way
// skipped every table after it in the same pass — since 'sales' sits near
// the end of the registered order, an interrupted pass (very easy to trigger
// in practice: any table earlier in line still had a request in flight the
// moment the network actually dropped) could leave sales completely
// unprocessed even though nothing about sales itself was wrong, and the next
// pass would look exactly the same if it also got interrupted early.
async function runOnePass() {
  // After a long offline stretch, the access token can be at or past its
  // expiry by the time the connection returns — supabase-js refreshes it
  // automatically, but on its own schedule, which can lose a race against
  // the very first wave of requests firing right after the 'online' event.
  // Those requests would then all fail with an auth error, burning through
  // a table's whole retry budget on something that was already resolving
  // itself. getSession() proactively refreshes if the token is stale before
  // any push/pull below fires a single request.
  if (isSupabaseConfigured) {
    try {
      await supabase.auth.getSession()
    } catch {
      // Ignore — if this itself fails (e.g. truly no connection), the real
      // push/pull calls below will surface that normally.
    }
  }

  for (const config of registry.values()) {
    // A pass that started online can still be mid-flight, table by table,
    // when the connection actually drops (each table's push/pull is a real
    // awaited network round trip, and there are a dozen-plus tables) — once
    // that's happened there's no point letting every remaining table also
    // fail one by one with the same doomed request; bail out cleanly and let
    // the next pass (triggered by the 'online' event once reconnected) pick
    // up exactly where this one left off.
    if (!navigator.onLine) break
    try {
      await pushPending(config)
    } catch (err) {
      console.error(`[sync] push failed for '${config.name}', continuing with the rest of the registry`, err)
    }
  }
  for (const config of registry.values()) {
    if (!navigator.onLine) break
    try {
      await pullRemote(config)
      notifyChange(config.name)
    } catch (err) {
      console.error(`[sync] pull failed for '${config.name}', continuing with the rest of the registry`, err)
    }
  }
}

// syncAll() is called from a lot of independent places — every hook mounts
// and calls it, a write calls it right after, the periodic 30s interval
// calls it, and the browser's native 'online' event calls it. A boolean
// "syncing" flag checked-then-set is NOT enough to keep these from racing:
// the online-event handler runs on its own, asynchronously, genuinely
// interleaved with whatever else is executing — it doesn't respect a
// synchronous-check assumption the way a burst of calls from one script does.
// In testing, this let two passes both read the same 'pending' sales before
// either had rekeyed them, each independently calling complete_sale —
// the record that "won" got correctly rekeyed to 'synced'; the other's
// local copy was left behind still 'pending' under its old id even though
// its push had already succeeded server-side, so the NEXT pass would have
// pushed it again, creating a duplicate sale.
//
// The fix: every call is appended to a single promise chain, so passes are
// strictly serialized — the Nth pass cannot start reading the pending list
// until the (N-1)th pass has fully finished writing back its results, no
// matter which of the four-ish trigger sources called it. `queued` coalesces
// a burst of near-simultaneous calls (e.g. five hooks mounting at once) into
// one pass instead of running five back-to-back near-empty ones, while still
// letting a call that arrives *during* an active pass schedule a fresh one
// after it (since data may have changed since the active pass started).
let syncChain = Promise.resolve()
let queued = false

export function syncAll() {
  if (!isSupabaseConfigured || !navigator.onLine) return syncChain
  if (queued) return syncChain
  queued = true
  syncChain = syncChain.then(async () => {
    queued = false
    try {
      await runOnePass()
    } catch (err) {
      console.error('[sync] sync pass failed unexpectedly', err)
    }
  })
  return syncChain
}

// One-time (per app load) sweep for records left 'pending' with
// sync_attempts already at or past MAX_SYNC_ATTEMPTS — this can only happen
// from before the concurrency fix above existed (two racing passes both
// reading the same stale attempt count could under-write it, letting a
// record retry well past the intended cap without ever flipping to
// 'failed'). Safe to run unconditionally: a record legitimately still
// retrying (attempts < MAX_SYNC_ATTEMPTS) is untouched, and records that are
// intentionally left pending forever until a *different* operation resolves
// them (e.g. a credit charge tied to its sale) always have sync_attempts: 0
// since nothing ever increments them, so they're never touched either.
export async function cleanupStuckSyncRecords() {
  for (const name of registry.keys()) {
    const table = db.table(name)
    const stuck = await table.where('sync_status').equals('pending').toArray()
    for (const record of stuck) {
      if ((record.sync_attempts || 0) >= MAX_SYNC_ATTEMPTS) {
        await table.update(record.id, {
          sync_status: 'failed',
          sync_error: record.sync_error || 'Stuck retrying from before a sync fix — flagged for review.',
        })
      }
    }
  }
}

async function pushPending(config) {
  const table = db.table(config.name)
  const pending = await table.where('sync_status').equals('pending').toArray()
  if (pending.length === 0) return

  if (config.push) {
    await config.push(pending, table)
    return
  }

  for (const record of pending) {
    const payload = config.toRemotePayload(record)
    const { error } = await supabase.from(config.supabaseTable).upsert(payload)
    if (!error) {
      await markPushSuccess(table, record.id)
    } else {
      await markPushFailure(table, record.id, error.message)
    }
  }
}

// A row deleted directly in Supabase (dashboard, another device, anything
// outside this app's own tombstone-delete flow) needs to disappear locally
// too — a pull that only ever adds/updates never removes anything, so a
// remote delete would otherwise leave a ghost row cached forever. This is
// ONLY safe for a pull that fetched the table's *complete* current state
// (no LIMIT) — for a capped pull (sales' most-recent-500, credit_transactions'
// most-recent-1000, etc.), "not in this batch" usually just means "outside
// the window", not "deleted", so applying this there would silently erase
// real history. Opt-in per table via `reconcileDeletes: true`.
//
// Only 'synced' local rows are ever removed this way — a 'pending' or
// 'failed' row represents a local change (including this app's OWN
// in-flight tombstone delete) that hasn't reached the server yet and must
// never be clobbered by what the server currently shows.
export async function reconcileDeletedRemotes(table, remoteIds) {
  const remoteIdSet = new Set(remoteIds)
  const localSynced = await table.where('sync_status').equals('synced').toArray()
  for (const local of localSynced) {
    if (!remoteIdSet.has(local.id)) {
      await table.delete(local.id)
    }
  }
}

async function pullRemote(config) {
  const table = db.table(config.name)

  if (config.pull) {
    await config.pull(table)
    return
  }

  const { data, error } = await supabase.from(config.supabaseTable).select('*')
  if (error || !data) return
  for (const remote of data) {
    const local = await table.get(remote.id)
    // Don't clobber an edit that's still waiting to be pushed (or one that
    // failed and is waiting for review) with a stale remote copy.
    if (local && (local.sync_status === 'pending' || local.sync_status === 'failed')) continue
    await table.put(config.fromRemoteRecord(remote))
  }
  if (config.reconcileDeletes) {
    await reconcileDeletedRemotes(table, data.map((r) => r.id))
  }
}

let stopAutoSync = null

// Called once at app startup. Syncs immediately, then again whenever the
// browser regains a connection, plus a periodic retry as a safety net for
// connections that flap without firing a clean 'online' event.
export function startAutoSync() {
  if (stopAutoSync) return stopAutoSync
  const handler = () => syncAll()
  window.addEventListener('online', handler)
  const interval = setInterval(syncAll, 30000)
  // One-time sweep for anything left stuck 'pending' past MAX_SYNC_ATTEMPTS
  // from before the mutex fix existed, before the first real pass runs.
  cleanupStuckSyncRecords().then(syncAll)
  stopAutoSync = () => {
    window.removeEventListener('online', handler)
    clearInterval(interval)
    stopAutoSync = null
  }
  return stopAutoSync
}
