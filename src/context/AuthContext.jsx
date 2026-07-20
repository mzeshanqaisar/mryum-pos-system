import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { db } from '../lib/db'
import { buildOfflineSession, cacheDeviceSession, getCachedDeviceSession, getLastActiveDeviceSession } from '../lib/offlineAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Tracks whether the CURRENT `session` came from the offline cache rather
  // than a live Supabase confirmation — read by the 'online' reconciliation
  // handler below to know whether it needs to double-check anything (a
  // normal, already-live session never needs re-checking just because the
  // browser fired an 'online' event).
  const sessionRef = useRef(null)
  sessionRef.current = session

  // Cached so isManager still resolves correctly offline — without this, a
  // manager who opens the app with no connection would silently fall back to
  // cashier-level access (profile stuck null) purely because the fetch below
  // couldn't complete, not because their role actually changed.
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const cached = await db.staff_profiles.get(userId)
    if (cached) setProfile(cached)

    if (navigator.onLine) {
      const { data } = await supabase.from('staff_profiles').select('*').eq('id', userId).single()
      if (data) {
        await db.staff_profiles.put({ ...data, sync_status: 'synced' })
        setProfile(data)
      } else if (!cached) {
        setProfile(null)
      }
    }
  }, [])

  // Re-checks auth whenever the browser regains connectivity. A session
  // that's already live needs nothing. A session running on the offline
  // cache (or no session at all, on a device that's never been online since
  // launch) gets one real attempt to establish/confirm the true state —
  // this is also what upgrades a cached offline session to a real one, and
  // what catches the rare case where the cached refresh token turns out to
  // have actually been revoked/expired server-side while we were offline.
  const reconcileWithServer = useCallback(async () => {
    if (!isSupabaseConfigured) return
    if (sessionRef.current && !sessionRef.current.__offline) return
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      setSession(data.session)
      await cacheDeviceSession(data.session)
      loadProfile(data.session.user.id)
    } else if (sessionRef.current?.__offline) {
      // We were running on a cached session; now that we can actually reach
      // the server, it says there's no valid session after all — the
      // refresh token itself is dead, not just unreachable. Fall back to a
      // real sign-in rather than silently staying "logged in" against an
      // account that can no longer sync anything.
      setSession(null)
      setProfile(null)
    }
  }, [loadProfile])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setSession(data.session)
        await cacheDeviceSession(data.session)
        // Not awaited — loadProfile shows its cached copy synchronously
        // before it ever touches the network, and its own network leg can
        // take a real several-second timeout to fail if navigator.onLine is
        // reporting a connection that isn't actually there. Blocking the
        // whole app's boot ("Loading…") on that would hold up the entire
        // UI for no reason when a cached profile is already available.
        loadProfile(data.session.user.id)
      } else if (!navigator.onLine) {
        // getSession() found nothing usable — on a live connection that
        // just means "not signed in", but offline it's ambiguous: it's also
        // exactly what happens when a real session's access token expired
        // and the automatic refresh couldn't reach the network. Recover the
        // last account that was actually verified online on this device (if
        // any, and if still within the trust window) rather than bouncing a
        // legitimately-signed-in staff member to the login screen just
        // because they opened the app on a bad connection.
        const cached = await getLastActiveDeviceSession()
        if (cached) {
          const offlineSession = buildOfflineSession(cached)
          setSession(offlineSession)
          loadProfile(cached.user_id)
        }
      }
      setLoading(false)
    })()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      loadProfile(newSession?.user?.id)
      if (newSession) cacheDeviceSession(newSession)
    })

    window.addEventListener('online', reconcileWithServer)

    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('online', reconcileWithServer)
    }
  }, [loadProfile, reconcileWithServer])

  const signIn = useCallback(async (email, password) => {
    if (!navigator.onLine) {
      return {
        success: false,
        message: 'No internet connection. The very first sign-in for an account needs to reach the server once — please connect and try again.',
      }
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { success: false, message: error.message }
      return { success: true }
    } catch {
      // navigator.onLine said we were online but the request itself still
      // couldn't complete (a connection that drops the instant a real
      // request goes out, captive portals, etc.) — supabase-js lets a raw
      // network failure here throw instead of resolving to a clean
      // { error }, which would otherwise surface as an uncaught "fetch
      // failed" instead of a message the user can actually act on.
      return { success: false, message: 'Could not reach the server. Check your connection and try again.' }
    }
  }, [])

  // Resumes a previously-verified account straight from the local cache —
  // no network round trip at all, so this works fully offline. Used by the
  // Login page's "Continue as ..." account switcher.
  const signInOffline = useCallback(
    async (userId) => {
      const cached = await getCachedDeviceSession(userId)
      if (!cached) return { success: false, message: 'That account is no longer available offline on this device — connect to the internet to sign in again.' }
      const offlineSession = buildOfflineSession(cached)
      setSession(offlineSession)
      await loadProfile(cached.user_id)
      return { success: true }
    },
    [loadProfile],
  )

  const signUp = useCallback(async (email, password, fullName) => {
    if (!navigator.onLine) {
      return { success: false, message: 'No internet connection. Creating a brand-new account needs to reach the server once — please connect and try again.' }
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) return { success: false, message: error.message }
      return { success: true }
    } catch {
      return { success: false, message: 'Could not reach the server. Check your connection and try again.' }
    }
  }, [])

  const signOut = useCallback(async () => {
    // Deliberately leaves this account's device_sessions cache row alone —
    // signing out just clears the ACTIVE session, not this device's memory
    // of the account, so it still shows up in the offline switcher to sign
    // back into later (that's the whole point of caching it in the first
    // place). Only a genuinely new/different account needs a fresh online
    // verification.
    if (session?.__offline) {
      setSession(null)
      setProfile(null)
      return { success: true }
    }
    // The local session is cleared either way (supabase-js drops it from local
    // storage regardless of whether the server-side revoke succeeds), so this
    // is never a no-op — the user is signed out visibly even offline. Still
    // worth surfacing a failed server-side revoke rather than swallowing it,
    // so the caller can warn that the old token may remain valid server-side
    // until it naturally expires.
    const { error } = await supabase.auth.signOut()
    if (error) return { success: false, message: error.message }
    return { success: true }
  }, [session])

  const value = {
    session,
    user: session?.user || null,
    profile,
    isManager: profile?.role === 'manager',
    isOfflineSession: Boolean(session?.__offline),
    loading,
    signIn,
    signInOffline,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
