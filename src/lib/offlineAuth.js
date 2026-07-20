import { db } from './db'

// How long a device is trusted to sign a previously-verified account back in
// with zero connectivity. Long enough that a normal day/week offline never
// locks anyone out, short enough that a lost/stolen device (or an account
// that should have been de-authorized) doesn't grant indefinite offline
// access on the strength of a single login from a month ago.
export const OFFLINE_TRUST_DAYS = 30

export function isWithinTrustWindow(lastVerifiedAt) {
  if (!lastVerifiedAt) return false
  const ageMs = Date.now() - new Date(lastVerifiedAt).getTime()
  return ageMs < OFFLINE_TRUST_DAYS * 24 * 60 * 60 * 1000
}

// Called whenever supabase-js hands us a real, network-verified session
// (sign-in, token refresh, initial load while online) — mirrors just enough
// of it into Dexie so the SAME account can be recognized and signed back in
// later with zero connectivity, and so more than one staff account can be
// cached on the same shared device (supabase-js itself only ever remembers
// one "current" session in its own storage slot, so it can't do this alone).
// Refreshing last_verified_at on every real session sighting — not just an
// explicit password login — means simply opening the app online periodically
// keeps offline access alive without ever needing to re-type a password.
export async function cacheDeviceSession(session) {
  if (!session?.user) return
  await db.device_sessions.put({
    user_id: session.user.id,
    email: session.user.email,
    full_name: session.user.user_metadata?.full_name || null,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    last_verified_at: new Date().toISOString(),
  })
  localStorage.setItem('mryum_last_active_user', session.user.id)
}

// For the Login page's account switcher — every cached account still inside
// its trust window, most-recently-used first.
export async function getCachedDeviceSessions() {
  const rows = await db.device_sessions.toArray()
  return rows
    .filter((r) => isWithinTrustWindow(r.last_verified_at))
    .sort((a, b) => new Date(b.last_verified_at).getTime() - new Date(a.last_verified_at).getTime())
}

// For app-boot recovery: which account was active on this device last, so a
// cold start with zero connectivity knows who to resume as.
export async function getLastActiveDeviceSession() {
  const userId = localStorage.getItem('mryum_last_active_user')
  if (!userId) return null
  const row = await db.device_sessions.get(userId)
  if (!row || !isWithinTrustWindow(row.last_verified_at)) return null
  return row
}

export async function getCachedDeviceSession(userId) {
  const row = await db.device_sessions.get(userId)
  if (!row || !isWithinTrustWindow(row.last_verified_at)) return null
  return row
}

// Builds a session-shaped object good enough for this app's own UI gating
// (RequireAuth / isManager / "signed in as") from a cached row. Deliberately
// NOT handed to the supabase-js client via setSession() — the cached access
// token is, by definition, the one that couldn't be silently refreshed
// (that's why we fell back to this cache), so registering it would just
// trigger another doomed refresh attempt against a network that isn't there.
// Real Supabase calls stay unauthenticated until the next successful
// reconnect re-establishes a genuine session (see AuthContext's online
// handler) — until then, local reads/writes are unaffected since Dexie
// itself needs no token at all, and any queued sync push simply waits.
export function buildOfflineSession(row) {
  return {
    __offline: true,
    user: { id: row.user_id, email: row.email, user_metadata: { full_name: row.full_name } },
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_at: row.expires_at,
  }
}
