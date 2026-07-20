import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import { useCart } from '../../context/CartContext'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useSettings } from '../../context/SettingsContext'
import { useMobileNav } from '../../context/MobileNavContext'

const NAV_ITEMS = [
  { label: 'Register', icon: 'point_of_sale', to: '/billing' },
  { label: 'Inventory', icon: 'inventory_2', to: '/inventory' },
  { label: 'Orders', icon: 'receipt_long', comingSoon: true },
  { label: 'Customers', icon: 'group', to: '/customers' },
  { label: 'Credit (Udhar)', icon: 'account_balance_wallet', to: '/credit-accounts' },
  { label: 'Reports', icon: 'analytics', to: '/reports' },
  { label: 'Suppliers', icon: 'local_shipping', to: '/suppliers', managerOnly: true },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { pendingOfflineCount, failedSyncCount } = useCart()
  const { showToast } = useToast()
  const { profile, isManager, signOut } = useAuth()
  const isSettingsActive = location.pathname === '/settings'
  const { settings } = useSettings()
  const { open: mobileNavOpen, close: closeMobileNav } = useMobileNav()

  const storeName = settings.store_name || 'Mr YUM Bakers And General Store'
  const storeInitial = storeName.trim().charAt(0).toUpperCase() || 'M'

  const handleSignOut = async () => {
    const result = await signOut()
    // Navigate regardless — the local session clears either way, so the user
    // is signed out visibly even if the server-side revoke below failed.
    navigate('/login')
    if (!result.success) {
      showToast(result.message || 'Signed out, but the server session may still be active until it expires.', 'error')
    }
  }

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.managerOnly || isManager)

  return (
    <>
      <div className="hidden lg:block w-16 h-screen shrink-0" />

      <aside
        className="group hidden lg:flex flex-col h-screen py-lg fixed top-0 left-0 w-16 shadow-none hover:w-64 hover:shadow-2xl hover:shadow-primary/10 bg-surface-container-low dark:bg-surface-container-highest border-r border-outline-variant/10 z-50 overflow-hidden transition-all duration-200 ease-in-out"
      >
        <div className="w-64 flex flex-col h-full shrink-0">
          <div className="px-4 mb-lg flex items-center gap-md h-8 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0 font-headline-md font-bold">
              {storeInitial}
            </div>
            <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <h1 className="font-headline-md text-headline-md text-secondary truncate leading-none" title={storeName}>
                {storeName}
              </h1>
              <p className="font-body-md text-[11px] text-on-surface-variant opacity-70 whitespace-nowrap">Artisan POS</p>
            </div>
          </div>

          <nav className="flex-1 flex flex-col gap-xs overflow-y-auto">
            {visibleNavItems.map((item) => {
              if (item.comingSoon) {
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => showToast(`${item.label} is coming soon.`)}
                    className="flex items-center gap-md px-4 py-sm mx-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all duration-200 text-left"
                  >
                    <Icon name={item.icon} className="shrink-0" />
                    <span
                      className="font-label-md text-label-md whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    >
                      {item.label}
                    </span>
                  </button>
                )
              }
              const isActive = location.pathname === item.to
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={`flex items-center gap-md px-4 py-sm mx-2 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-secondary text-on-secondary shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <Icon name={item.icon} fill={isActive} className="shrink-0" />
                  <span
                    className="font-label-md text-label-md whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  >
                    {item.label}
                  </span>
                </NavLink>
              )
            })}
          </nav>

          <div className="px-2 mt-auto pt-sm border-t border-outline-variant/10">
            {pendingOfflineCount > 0 && (
              <div
                className="mb-xs px-sm py-1 rounded-full bg-error-container text-on-error-container text-label-sm font-label-sm text-center whitespace-nowrap overflow-hidden opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              >
                {pendingOfflineCount} sale{pendingOfflineCount === 1 ? '' : 's'} pending sync
              </div>
            )}
            {failedSyncCount > 0 && (
              <div
                className="mb-xs px-sm py-1 rounded-full bg-error text-on-error text-label-sm font-label-sm text-center whitespace-nowrap overflow-hidden opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              >
                {failedSyncCount} sale{failedSyncCount === 1 ? '' : 's'} failed — see Reports
              </div>
            )}
            <div className="flex items-center gap-sm py-sm mx-2">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0">
                <Icon name="account_circle" className="text-[24px]" />
              </div>
              <div className="min-w-0 flex-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <p className="font-label-md text-label-md text-primary truncate whitespace-nowrap">{profile?.full_name || 'Staff Profile'}</p>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant whitespace-nowrap">{profile?.role || 'Cashier'}</p>
              </div>
              {isManager && (
                <NavLink
                  to="/settings"
                  aria-label="Settings"
                  className={`shrink-0 p-base rounded-full transition-all opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto ${
                    isSettingsActive
                      ? 'text-secondary bg-secondary-container/40'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <Icon name="settings" fill={isSettingsActive} className="text-[20px]" />
                </NavLink>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="shrink-0 p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
              >
                <Icon name="logout" className="text-[20px]" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-on-background/50 backdrop-blur-sm" onClick={closeMobileNav} />
          <aside className="relative w-72 max-w-[80vw] h-full bg-surface-container-low dark:bg-surface-container-highest border-r border-outline-variant/10 flex flex-col py-lg shadow-2xl">
            <div className="px-4 mb-lg flex items-center justify-between gap-md shrink-0">
              <div className="flex items-center gap-md min-w-0">
                <div className="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0 font-headline-md font-bold">
                  {storeInitial}
                </div>
                <div className="min-w-0">
                  <h1 className="font-headline-md text-headline-md text-secondary truncate leading-none" title={storeName}>
                    {storeName}
                  </h1>
                  <p className="font-body-md text-[11px] text-on-surface-variant opacity-70 whitespace-nowrap">Artisan POS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobileNav}
                aria-label="Close menu"
                className="shrink-0 p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
              >
                <Icon name="close" />
              </button>
            </div>

            <nav className="flex-1 flex flex-col gap-xs overflow-y-auto">
              {visibleNavItems.map((item) => {
                if (item.comingSoon) {
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        showToast(`${item.label} is coming soon.`)
                        closeMobileNav()
                      }}
                      className="flex items-center gap-md px-4 py-sm mx-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-all duration-200 text-left"
                    >
                      <Icon name={item.icon} className="shrink-0" />
                      <span className="font-label-md text-label-md whitespace-nowrap">{item.label}</span>
                    </button>
                  )
                }
                const isActive = location.pathname === item.to
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={closeMobileNav}
                    className={`flex items-center gap-md px-4 py-sm mx-2 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-secondary text-on-secondary shadow-md'
                        : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <Icon name={item.icon} fill={isActive} className="shrink-0" />
                    <span className="font-label-md text-label-md whitespace-nowrap">{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="px-2 pt-sm border-t border-outline-variant/10 shrink-0">
              {pendingOfflineCount > 0 && (
                <div className="mb-xs px-sm py-1 rounded-full bg-error-container text-on-error-container text-label-sm font-label-sm text-center whitespace-nowrap overflow-hidden">
                  {pendingOfflineCount} sale{pendingOfflineCount === 1 ? '' : 's'} pending sync
                </div>
              )}
              {failedSyncCount > 0 && (
                <div className="mb-xs px-sm py-1 rounded-full bg-error text-on-error text-label-sm font-label-sm text-center whitespace-nowrap overflow-hidden">
                  {failedSyncCount} sale{failedSyncCount === 1 ? '' : 's'} failed — see Reports
                </div>
              )}
              <div className="flex items-center gap-sm py-sm mx-2">
                <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary shrink-0">
                  <Icon name="account_circle" className="text-[24px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-label-md text-label-md text-primary truncate whitespace-nowrap">{profile?.full_name || 'Staff Profile'}</p>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant whitespace-nowrap">{profile?.role || 'Cashier'}</p>
                </div>
                {isManager && (
                  <NavLink
                    to="/settings"
                    onClick={closeMobileNav}
                    aria-label="Settings"
                    className={`shrink-0 p-base rounded-full transition-all ${
                      isSettingsActive ? 'text-secondary bg-secondary-container/40' : 'text-on-surface-variant hover:bg-surface-container-high'
                    }`}
                  >
                    <Icon name="settings" fill={isSettingsActive} className="text-[20px]" />
                  </NavLink>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeMobileNav()
                    handleSignOut()
                  }}
                  aria-label="Sign out"
                  className="shrink-0 p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
                >
                  <Icon name="logout" className="text-[20px]" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
