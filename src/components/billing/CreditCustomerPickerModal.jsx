import { useMemo, useState } from 'react'
import Icon from '../common/Icon'
import { fuzzyFilter } from '../../lib/fuzzyMatch'
import { useSettings } from '../../context/SettingsContext'

export default function CreditCustomerPickerModal({ open, customers, onClose, onSelect, onAddNew }) {
  const [search, setSearch] = useState('')
  const { currency } = useSettings()

  const filtered = useMemo(() => fuzzyFilter(customers, search, (c) => c.name), [customers, search])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 max-h-[80vh] flex flex-col"
      >
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-primary">Select Customer</h2>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>

        <div className="p-lg pb-sm">
          <div className="relative">
            <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[20px]" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name..."
              className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-full focus:ring-2 focus:ring-secondary/20 focus:border-secondary outline-none transition-all font-body-md text-body-md text-on-surface"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-lg pb-lg space-y-xs">
          {filtered.length === 0 && <p className="text-center text-on-surface-variant font-body-md py-lg">No matching customers.</p>}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full flex items-center justify-between gap-md px-md py-sm rounded-xl hover:bg-secondary-container/10 transition-all text-left"
            >
              <div className="min-w-0">
                <p className="font-body-md font-bold text-primary truncate">{c.name}</p>
                <p className="text-[12px] text-on-surface-variant">{c.phone || 'No phone'}</p>
              </div>
              {c.credit_balance > 0 && (
                <span className="shrink-0 text-[12px] font-bold text-error">
                  {currency}
                  {Number(c.credit_balance).toFixed(2)} due
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-lg pt-0">
          <button
            type="button"
            onClick={onAddNew}
            className="w-full flex items-center justify-center gap-xs px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
          >
            <Icon name="person_add" className="text-[18px]" />
            Add New Customer
          </button>
        </div>
      </div>
    </div>
  )
}
