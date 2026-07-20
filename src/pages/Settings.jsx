import { useEffect, useState } from 'react'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import { useSettings } from '../context/SettingsContext'
import { useTheme, SCHEMES } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useStaffList } from '../hooks/useStaffList'
import { supabase } from '../lib/supabaseClient'
import { splitStoreName } from '../lib/navName'
import CurrencyPicker from '../components/settings/CurrencyPicker'

const NAV_NAME_LINE_OPTIONS = [1, 2, 3]

const inputClass =
  'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

export default function Settings() {
  const { settings, updateSettings, navNameLines, setNavNameLines } = useSettings()
  const { scheme, mode, setScheme } = useTheme()
  const { showToast } = useToast()
  const { user } = useAuth()
  const { staff, loading: staffLoading, refresh: fetchStaff } = useStaffList()

  const [form, setForm] = useState({ store_name: '', tax_rate: '8', currency_symbol: '$' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      store_name: settings.store_name || '',
      tax_rate: String(Math.round((settings.tax_rate ?? 0.08) * 10000) / 100),
      currency_symbol: settings.currency_symbol || '$',
    })
  }, [settings])

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSaving(true)
    const result = await updateSettings({
      store_name: form.store_name.trim(),
      tax_rate: Number(form.tax_rate) / 100,
      currency_symbol: form.currency_symbol.trim() || '$',
    })
    if (result.success) {
      showToast('Settings saved.')
    } else {
      showToast(result.message || 'Could not save settings.', 'error')
    }
    setSaving(false)
  }

  const handleRoleChange = async (staffId, role) => {
    // Deliberately online-only: promoting/demoting a manager is a privilege
    // change, and there's no safe way to apply that optimistically offline —
    // a client that locally believed it was promoted would see manager-only
    // screens before the server had actually agreed. It needs an immediate,
    // authoritative confirmation, not a queued write.
    if (!navigator.onLine) {
      showToast('Connect to the internet to change a staff role.', 'error')
      return
    }
    const { error } = await supabase.from('staff_profiles').update({ role }).eq('id', staffId)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Role updated.')
    fetchStaff()
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md">
            <div className="mb-md">
              <h2 className="font-headline-md text-headline-md text-primary">Store Settings</h2>
              <p className="text-on-surface-variant font-body-md">Controls the tax rate and currency used across Register and Reports.</p>
            </div>

            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-md max-w-2xl">
              <label className="flex flex-col gap-xs md:col-span-3">
                <span className="font-label-md text-label-md text-on-surface-variant">Store Name</span>
                <input
                  value={form.store_name}
                  onChange={(e) => setForm((f) => ({ ...f, store_name: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant">Tax Rate (%)</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.tax_rate}
                  onChange={(e) => setForm((f) => ({ ...f, tax_rate: e.target.value }))}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-xs">
                <span className="font-label-md text-label-md text-on-surface-variant">Currency</span>
                <CurrencyPicker
                  value={form.currency_symbol}
                  onChange={(symbol) => setForm((f) => ({ ...f, currency_symbol: symbol }))}
                />
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            </form>
          </section>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md">
            <div className="mb-md">
              <h2 className="font-headline-md text-headline-md text-primary">Navbar Name Style</h2>
              <p className="text-on-surface-variant font-body-md">Choose how the store name wraps in the top-left logo.</p>
            </div>

            <div className="flex flex-wrap gap-sm">
              {NAV_NAME_LINE_OPTIONS.map((n) => {
                const active = navNameLines === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNavNameLines(n)}
                    className={`flex flex-col items-start gap-xs px-md py-sm rounded-2xl border-2 transition-all min-w-[120px] ${
                      active ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/20 hover:border-outline-variant/40'
                    }`}
                  >
                    <span className={`font-label-md text-label-sm ${active ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                      {n} {n === 1 ? 'Line' : 'Lines'}
                    </span>
                    <span className="font-bebas leading-[0.85] text-secondary uppercase tracking-wide">
                      {splitStoreName(form.store_name || settings.store_name, n).map((line, i) => (
                        <span key={i} className="block text-[13px]">
                          {line}
                        </span>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md">
            <div className="mb-md">
              <h2 className="font-headline-md text-headline-md text-primary">Color Scheme</h2>
              <p className="text-on-surface-variant font-body-md">
                Pick the accent colors used across the whole app. Use the sun/moon icon in the navbar to switch the chosen
                scheme between its dark and light look.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-sm">
              {SCHEMES.map((s) => {
                const active = scheme === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScheme(s.id)}
                    className={`flex flex-col items-center gap-xs p-sm rounded-2xl border-2 transition-all hover:-translate-y-0.5 ${
                      active ? 'border-primary bg-primary/5 shadow-md' : 'border-outline-variant/20 hover:border-outline-variant/40'
                    }`}
                  >
                    <div className="relative flex items-center">
                      {s.swatch.map((c, i) => (
                        <span
                          key={c}
                          className="w-6 h-6 rounded-full border-2 border-surface-container-lowest"
                          style={{ backgroundColor: c, marginLeft: i === 0 ? 0 : -8 }}
                        />
                      ))}
                      {active && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center">
                          <Icon name="check" className="text-[12px]" />
                        </span>
                      )}
                    </div>
                    <span className={`font-label-md text-label-sm ${active ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                      {s.label}
                    </span>
                    {active && (
                      <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/70">{mode} mode</span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
            <div className="px-lg py-sm border-b border-outline-variant/10">
              <h2 className="font-headline-md text-headline-md text-primary">Staff Accounts</h2>
              <p className="text-on-surface-variant font-body-md">Promote staff to Manager to give them access to Suppliers and Settings.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Name
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {!staffLoading && staff.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                        No staff accounts yet.
                      </td>
                    </tr>
                  )}
                  {staff.map((member) => (
                    <tr key={member.id} className="hover:bg-secondary-container/5 transition-colors">
                      <td className="px-lg py-sm font-body-md text-on-surface flex items-center gap-xs">
                        <Icon name="account_circle" className="text-on-surface-variant/60" />
                        {member.full_name}
                        {member.id === user?.id && (
                          <span className="text-label-sm text-secondary font-label-sm">(you)</span>
                        )}
                      </td>
                      <td className="px-lg py-sm">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          className="px-md py-1 bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
                        >
                          <option value="cashier">Cashier</option>
                          <option value="manager">Manager</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </>
  )
}
