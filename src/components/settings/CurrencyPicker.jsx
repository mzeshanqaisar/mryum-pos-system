import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../common/Icon'
import { CURRENCIES } from '../../lib/currencies'

export default function CurrencyPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const searchRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (btnRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setCoords({ top: rect.bottom + 6, left: rect.left, width: rect.width })
      setQuery('')
      setTimeout(() => searchRef.current?.focus(), 50)
    }
    setOpen((v) => !v)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CURRENCIES
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    )
  }, [query])

  const active = CURRENCIES.find((c) => c.symbol === value)

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className="flex items-center justify-between gap-sm w-full px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface transition-all"
      >
        <span className="truncate">{active ? `${active.symbol} — ${active.code} (${active.country})` : value || 'Select currency'}</span>
        <Icon name="expand_more" className="text-[18px] text-secondary shrink-0" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: Math.max(coords.width, 300) }}
            className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl z-[100] overflow-hidden flex flex-col max-h-80"
          >
            <div className="p-sm border-b border-outline-variant/10 shrink-0">
              <div className="relative">
                <Icon name="search" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search currency, country, code..."
                  autoComplete="off"
                  className="w-full pl-9 pr-md py-2 bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && <p className="px-md py-sm text-on-surface-variant font-body-md text-body-md">No matches.</p>}
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onChange(c.symbol)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-md py-sm flex items-center justify-between gap-sm hover:bg-secondary-container/10 transition-all ${
                    c.symbol === value ? 'bg-secondary/10' : ''
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-body-md text-body-md text-on-surface truncate">{c.name}</span>
                    <span className="text-[11px] text-on-surface-variant truncate">
                      {c.country} · {c.code}
                    </span>
                  </span>
                  <span className="font-label-md text-label-md text-secondary shrink-0">{c.symbol}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
