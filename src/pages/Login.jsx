import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/common/Icon'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { getCachedDeviceSessions } from '../lib/offlineAuth'

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}

export default function Login() {
  const { signIn, signInOffline, signUp, session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const online = useOnlineStatus()
  const [mode, setMode] = useState('signIn')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [cachedAccounts, setCachedAccounts] = useState([])
  const [cachedAccountsLoaded, setCachedAccountsLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      const dest = location.state?.from?.pathname || '/billing'
      navigate(dest, { replace: true })
    }
  }, [session, loading, navigate, location])

  useEffect(() => {
    getCachedDeviceSessions().then((rows) => {
      setCachedAccounts(rows)
      setCachedAccountsLoaded(true)
    })
  }, [])

  const inputClass =
    'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    const result =
      mode === 'signIn' ? await signIn(email, password) : await signUp(email, password, fullName)
    if (!result.success) {
      setMessage({ type: 'error', text: result.message })
    } else if (mode === 'signUp') {
      setMessage({
        type: 'success',
        text: 'Account created. Check your inbox to confirm your email, then sign in.',
      })
      setMode('signIn')
    }
    setSubmitting(false)
  }

  const handleContinueOffline = async (userId) => {
    setSubmitting(true)
    setMessage(null)
    const result = await signInOffline(userId)
    if (!result.success) setMessage({ type: 'error', text: result.message })
    setSubmitting(false)
  }

  // Offline with nothing cached on this device yet: the password form can't
  // possibly succeed (there's no way to verify a password with no network),
  // so showing it would just invite a confusing failed submit. Say plainly
  // what's needed instead.
  const offlineWithNoAccounts = !online && cachedAccountsLoaded && cachedAccounts.length === 0
  // Offline with at least one previously-verified account: lead with the
  // switcher, since that's the only path that can actually work right now.
  const offlineWithAccounts = !online && cachedAccounts.length > 0
  const formVisible = online || showForm || (offlineWithNoAccounts && cachedAccountsLoaded)

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface grain-bg px-margin-mobile">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 p-lg">
        <div className="text-center mb-lg">
          <h1 className="font-headline-md text-headline-md text-secondary">Mr YUM</h1>
          <p className="font-body-md text-on-surface-variant">Artisan POS — Staff Sign In</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md mb-md">
            Supabase isn&apos;t configured yet. Add your project URL and anon key to <code>.env</code> and restart the dev
            server before signing in.
          </div>
        )}

        {!online && (
          <div className="p-md rounded-xl bg-secondary-container/30 text-primary font-body-md mb-md flex items-center gap-xs">
            <Icon name="wifi_off" className="text-[18px]" />
            No internet connection.
          </div>
        )}

        {message && (
          <div
            className={`p-md rounded-xl font-body-md mb-md ${
              message.type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/30 text-primary'
            }`}
          >
            {message.text}
          </div>
        )}

        {offlineWithNoAccounts && (
          <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md mb-md">
            This device hasn&apos;t signed in to any account yet, so there&apos;s nothing cached to use offline. Connect to
            the internet to sign in for the first time — after that, this same account can sign back in offline anytime.
          </div>
        )}

        {cachedAccounts.length > 0 && (
          <div className="flex flex-col gap-sm mb-md">
            <span className="font-label-md text-label-md text-on-surface-variant">
              {online ? 'Continue as' : 'Continue offline as'}
            </span>
            {cachedAccounts.map((acc) => (
              <button
                key={acc.user_id}
                type="button"
                disabled={submitting}
                onClick={() => handleContinueOffline(acc.user_id)}
                className="w-full flex items-center gap-sm px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl hover:border-secondary transition-colors text-left disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center font-label-md text-label-md text-primary shrink-0">
                  {(acc.full_name || acc.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-body-md text-body-md text-on-surface truncate">{acc.full_name || acc.email}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant truncate">{acc.email}</span>
                </div>
              </button>
            ))}
            {!formVisible && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                disabled={!online}
                className="w-full text-center mt-xs font-label-md text-label-md text-secondary hover:underline disabled:opacity-40 disabled:hover:no-underline"
              >
                {online ? 'Sign in with a different account' : 'Connect to the internet to use a different account'}
              </button>
            )}
          </div>
        )}

        {formVisible && (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-md">
              {mode === 'signUp' && (
                <label className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Full Name</span>
                  <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
                </label>
              )}
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant">Password</span>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                />
              </label>

              <button
                type="submit"
                disabled={submitting || !online}
                className="w-full mt-sm bg-primary text-on-primary py-sm rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-xs"
              >
                <Icon name={mode === 'signIn' ? 'login' : 'person_add'} className="text-[18px]" />
                {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn')
                setMessage(null)
              }}
              className="w-full text-center mt-md font-label-md text-label-md text-secondary hover:underline"
            >
              {mode === 'signIn' ? "New staff member? Create an account" : 'Already have an account? Sign in'}
            </button>

            {mode === 'signUp' && (
              <p className="text-label-sm text-on-surface-variant mt-sm text-center">
                New accounts start as Cashier. A Manager can promote you from the Staff settings.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
