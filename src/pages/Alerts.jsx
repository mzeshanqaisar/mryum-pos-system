import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import { useSupplierAlerts } from '../hooks/useSupplierAlerts'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'order_day', label: 'Order Day' },
]

const TYPE_STYLE = {
  out_of_stock: { icon: 'production_quantity_limits', badgeClass: 'bg-error-container text-on-error-container', label: 'Out of Stock' },
  low_stock: { icon: 'warning', badgeClass: 'bg-tertiary/10 text-tertiary', label: 'Low Stock' },
  order_day: { icon: 'event_upcoming', badgeClass: 'bg-secondary/10 text-secondary', label: 'Order Day' },
}

export default function Alerts() {
  const { alerts, loading } = useSupplierAlerts()
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts
    return alerts.filter((a) => a.type === filter)
  }, [alerts, filter])

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
            <div className="px-lg py-sm border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between sm:items-center gap-md">
              <div>
                <h2 className="font-headline-md text-headline-md text-primary">Alerts</h2>
                <p className="text-on-surface-variant font-body-md">Low stock, out-of-stock, and upcoming supplier order days.</p>
              </div>
              <div className="flex gap-xs flex-wrap">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`px-md py-sm rounded-xl font-label-md text-label-md transition-all ${
                      filter === f.value
                        ? 'bg-secondary text-on-secondary shadow-md'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-outline-variant/5">
              {!loading && filteredAlerts.length === 0 && (
                <p className="px-lg py-lg text-center text-on-surface-variant font-body-md">
                  {filter === 'all' ? 'No alerts right now — everything looks good.' : 'No alerts of this type right now.'}
                </p>
              )}
              {filteredAlerts.map((alert) => {
                const style = TYPE_STYLE[alert.type]
                return (
                  <button
                    key={alert.id}
                    type="button"
                    onClick={() => navigate(`/suppliers/${alert.supplierId}`)}
                    className="w-full flex items-center gap-md px-lg py-sm text-left hover:bg-secondary-container/5 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${style.badgeClass}`}>
                      <Icon name={style.icon} className="text-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body-md font-bold text-primary truncate">{alert.message}</p>
                      <p className="text-[12px] text-on-surface-variant">{alert.supplierName}</p>
                    </div>
                    <span className={`shrink-0 px-sm py-0.5 rounded-full text-[11px] font-bold ${style.badgeClass}`}>{style.label}</span>
                    <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <Footer />
      </main>
    </>
  )
}
