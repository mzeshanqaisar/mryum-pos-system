import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../common/Icon'
import { useTheme } from '../../context/ThemeContext'
import { useSettings } from '../../context/SettingsContext'
import { splitStoreName } from '../../lib/navName'
import { useSupplierAlerts } from '../../hooks/useSupplierAlerts'
import { useMobileNav } from '../../context/MobileNavContext'

const MAX_VISIBLE_NAV_ITEMS = 3

export default function TopHeader({ navItems = [], searchValue, onSearchChange, searchPlaceholder = 'Search...' }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, toggleTheme } = useTheme()
  const { settings, navNameLines } = useSettings()
  const { alerts } = useSupplierAlerts()
  const { toggle: toggleMobileNav } = useMobileNav()
  const storeName = settings.store_name || 'Mr YUM Bakers And General Store'
  const nameLines = splitStoreName(storeName, navNameLines)
  const isOnAlerts = location.pathname === '/alerts'

  const handleAlertsClick = () => {
    if (isOnAlerts) {
      navigate(-1)
    } else {
      navigate('/alerts')
    }
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const visibleItems = navItems.slice(0, MAX_VISIBLE_NAV_ITEMS)
  const overflowItems = navItems.slice(MAX_VISIBLE_NAV_ITEMS)
  const activeInOverflow = overflowItems.some((item) => item.active)

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(61,36,25,0.05)] px-margin-mobile lg:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-md">
      <div className="flex items-center gap-lg w-full md:w-auto py-sm min-w-0">
        <button
          type="button"
          onClick={toggleMobileNav}
          aria-label="Open menu"
          className="lg:hidden shrink-0 p-base rounded-full hover:bg-secondary-container/20 transition-all text-secondary"
        >
          <Icon name="menu" />
        </button>
        <div className="flex flex-col shrink-0 border-b-2 border-secondary-container leading-[0.85] max-w-[140px] lg:max-w-[280px]" title={storeName}>
          {nameLines.map((line, i) => (
            <span
              key={i}
              className="font-bebas text-[16px] lg:text-[30px] tracking-wider text-primary uppercase truncate origin-left"
            >
              {line}
            </span>
          ))}
        </div>
        {navItems.length > 0 && (
          <div className="hidden xl:flex items-center gap-base min-w-0">
            {visibleItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={
                  item.active
                    ? 'shrink-0 text-on-secondary-container bg-secondary-container rounded-full px-6 py-2 font-bold font-label-md text-label-md'
                    : 'shrink-0 text-on-surface-variant hover:text-secondary transition-colors duration-300 px-6 py-2 font-label-md text-label-md'
                }
              >
                {item.label}
              </button>
            ))}

            {overflowItems.length > 0 && (
              <div className="relative shrink-0" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={
                    activeInOverflow
                      ? 'flex items-center gap-xs text-on-secondary-container bg-secondary-container rounded-full px-6 py-2 font-bold font-label-md text-label-md'
                      : 'flex items-center gap-xs text-on-surface-variant hover:text-secondary transition-colors duration-300 px-6 py-2 font-label-md text-label-md'
                  }
                >
                  See More
                  <Icon name={moreOpen ? 'expand_less' : 'expand_more'} className="text-[18px]" />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 mt-1 w-56 max-h-72 overflow-y-auto bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-50 py-xs">
                    {overflowItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          item.onClick?.()
                          setMoreOpen(false)
                        }}
                        className={`w-full text-left px-md py-sm font-label-md text-label-md hover:bg-secondary-container/10 ${item.active ? 'text-secondary font-bold' : 'text-on-surface-variant'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-md w-full md:w-auto">
        {onSearchChange && (
          <div className="relative flex-1 md:w-96">
            <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[20px]" />
            <input
              className="w-full pl-xl pr-md py-2 bg-surface-container-low border border-secondary-fixed-dim/50 rounded-full text-secondary focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all font-body-md text-body-md"
              placeholder={searchPlaceholder}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            className="p-base rounded-full hover:bg-secondary-container/20 hover:scale-105 transition-all text-secondary"
          >
            <Icon name={mode === 'light' ? 'dark_mode' : 'light_mode'} />
          </button>
          <button type="button" className="p-base rounded-full hover:bg-secondary-container/20 hover:scale-105 transition-all text-secondary">
            <Icon name="schedule" />
          </button>
          <button
            type="button"
            onClick={handleAlertsClick}
            aria-label={isOnAlerts ? 'Back' : 'Alerts'}
            className={`relative p-base rounded-full hover:bg-secondary-container/20 hover:scale-105 transition-all text-secondary ${
              isOnAlerts ? 'bg-secondary-container/20' : ''
            }`}
          >
            <Icon name={isOnAlerts ? 'arrow_back' : 'notifications'} />
            {!isOnAlerts && alerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-[3px] rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
                {alerts.length > 9 ? '9+' : alerts.length}
              </span>
            )}
          </button>
          <button type="button" className="p-base rounded-full hover:bg-secondary-container/20 hover:scale-105 transition-all text-secondary">
            <Icon name="account_circle" />
          </button>
        </div>
      </div>
    </header>
  )
}
