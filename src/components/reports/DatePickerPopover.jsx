import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../common/Icon'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateStr(s) {
  if (!s) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isSameDay(a, b) {
  return Boolean(a) && Boolean(b) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7

  const cells = []
  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - startWeekday + 1
    if (dayNum < 1) {
      const day = daysInPrevMonth + dayNum
      cells.push({ day, outside: true, date: new Date(year, month - 1, day) })
    } else if (dayNum > daysInMonth) {
      const day = dayNum - daysInMonth
      cells.push({ day, outside: true, date: new Date(year, month + 1, day) })
    } else {
      cells.push({ day: dayNum, outside: false, date: new Date(year, month, dayNum) })
    }
  }
  return cells
}

export default function DatePickerPopover({ value, onChange, active, label = 'Pick Date' }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseDateStr(value) || new Date())
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const popRef = useRef(null)

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
      setCoords({ top: rect.bottom + 6, left: rect.left })
      setViewDate(parseDateStr(value) || new Date())
    }
    setOpen((v) => !v)
  }

  const selected = parseDateStr(value)
  const today = new Date()
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const cells = buildMonthGrid(year, month)

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        className={`flex items-center gap-xs pl-md pr-9 py-sm rounded-xl font-label-md text-label-md transition-all relative ${
          active ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
        }`}
      >
        {selected ? selected.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : label}
        <Icon
          name="calendar_month"
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] pointer-events-none ${
            active ? 'text-on-secondary' : 'text-secondary'
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="w-72 p-sm bg-surface-container-lowest border border-outline-variant/20 rounded-2xl shadow-xl z-[100]"
          >
            <div className="flex items-center justify-between mb-xs px-xs">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
                aria-label="Previous month"
              >
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
              <span className="font-label-md text-label-md text-primary">
                {viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </span>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
                aria-label="Next month"
              >
                <Icon name="chevron_right" className="text-[18px]" />
              </button>
            </div>

            <div className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-[11px] font-label-sm text-on-surface-variant py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const isSelected = isSameDay(cell.date, selected)
                const isToday = isSameDay(cell.date, today)
                return (
                  <button
                    key={cell.date.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(toDateStr(cell.date))
                      setOpen(false)
                    }}
                    className={`h-8 rounded-lg text-label-sm font-label-md transition-all ${
                      isSelected
                        ? 'bg-secondary text-on-secondary font-bold'
                        : isToday
                          ? 'border border-secondary text-secondary'
                          : cell.outside
                            ? 'text-on-surface-variant/30 hover:bg-surface-container-high'
                            : 'text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>

            <div className="flex justify-between mt-sm px-xs">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-label-sm font-label-md text-on-surface-variant hover:text-error transition-all"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = new Date()
                  setViewDate(t)
                  onChange(toDateStr(t))
                  setOpen(false)
                }}
                className="text-label-sm font-label-md text-secondary hover:underline"
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
