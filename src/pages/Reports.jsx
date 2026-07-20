import { useMemo, useState } from 'react'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import RefundModal from '../components/reports/RefundModal'
import ReceiptModal from '../components/billing/ReceiptModal'
import DatePickerPopover from '../components/reports/DatePickerPopover'
import { useSales } from '../hooks/useSales'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
]

function rangeStart(preset) {
  const now = new Date()
  if (preset === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  if (preset === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }
  if (preset === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  if (preset === 'year') {
    return new Date(now.getFullYear(), 0, 1).getTime()
  }
  return 0
}

export default function Reports() {
  const { sales, loading, error, refundSale, retrySync, refundStatusBySaleId, retryRefundSync } = useSales()
  const { showToast } = useToast()
  const { profile, isManager } = useAuth()
  const { currency } = useSettings()

  const [range, setRange] = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [refundTarget, setRefundTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)

  const detailReceipt = useMemo(() => {
    if (!detailTarget) return null
    const items = (detailTarget.sale_items || []).map((item) => ({
      product: { id: item.product_id, name: item.products?.name || 'Item', price: Number(item.price_at_sale) },
      quantity: item.quantity,
      discount: Number(item.discount_amount || 0),
    }))
    const itemDiscountTotal = items.reduce((sum, i) => sum + i.discount, 0)
    const grossSubtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
    return {
      items,
      subtotal: grossSubtotal,
      discount: Number(detailTarget.discount_amount || 0),
      itemDiscountTotal,
      tax: Number(detailTarget.tax_amount),
      total: Number(detailTarget.total_amount),
      staffName: detailTarget.staff_name || '—',
      customerName: detailTarget.customers?.name || null,
      paymentMethod: detailTarget.payment_method,
      createdAt: detailTarget.created_at,
      status: detailTarget.status,
    }
  }, [detailTarget])

  const filteredSales = useMemo(() => {
    if (range === 'custom' && customDate) {
      const start = new Date(customDate)
      start.setHours(0, 0, 0, 0)
      const end = new Date(customDate)
      end.setHours(23, 59, 59, 999)
      return sales.filter((s) => {
        const t = new Date(s.created_at).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })
    }
    const start = rangeStart(range)
    return sales.filter((s) => new Date(s.created_at).getTime() >= start)
  }, [sales, range, customDate])

  const completedSales = useMemo(() => filteredSales.filter((s) => s.status !== 'refunded'), [filteredSales])

  const totalSales = useMemo(() => completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0), [completedSales])

  const profit = useMemo(() => {
    return completedSales.reduce((sum, sale) => {
      const saleProfit = (sale.sale_items || []).reduce((itemSum, item) => {
        const cost = Number(item.products?.cost_price ?? 0)
        return itemSum + (Number(item.price_at_sale) - cost) * item.quantity
      }, 0)
      return sum + saleProfit
    }, 0)
  }, [completedSales])

  const handleRefund = async (reason) => {
    const result = await refundSale(refundTarget.id, reason, profile?.full_name)
    if (result.success) {
      showToast('Sale refunded and stock restored.')
      setRefundTarget(null)
    } else {
      showToast(result.message || 'Could not refund sale.', 'error')
    }
  }

  const handleRetrySync = async (e, sale) => {
    e.stopPropagation()
    await retrySync(sale.id)
    showToast('Retrying sync…')
  }

  const handleExportCsv = () => {
    const rows = filteredSales.map((s) => ({
      date: new Date(s.created_at).toLocaleString(),
      staff: s.staff_name || '',
      payment_method: s.payment_method === 'credit' ? 'udhar (credit)' : 'cash',
      customer: s.customers?.name || '',
      status: s.status,
      items: (s.sale_items || []).reduce((sum, i) => sum + i.quantity, 0),
      tax: Number(s.tax_amount).toFixed(2),
      total: Number(s.total_amount).toFixed(2),
    }))
    downloadCsv('sales-export.csv', rows)
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg h-screen overflow-hidden flex flex-col">
        <TopHeader />

        <div className="px-margin-mobile lg:px-margin-desktop pt-sm pb-sm flex-1 flex flex-col min-h-0 gap-sm">
          {!isSupabaseConfigured && (
            <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md shrink-0">
              Supabase isn&apos;t configured yet. Add your project URL and anon key to <code>.env</code> and restart the dev
              server to load sales data.
            </div>
          )}
          {error && <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md shrink-0">{error}</div>}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md shrink-0">
            <div className="flex gap-xs flex-wrap items-center">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setRange(preset.value)}
                  className={`px-md py-sm rounded-xl font-label-md text-label-md transition-all ${
                    range === preset.value
                      ? 'bg-secondary text-on-secondary shadow-md'
                      : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <DatePickerPopover
                value={customDate}
                active={range === 'custom'}
                onChange={(dateStr) => {
                  setCustomDate(dateStr)
                  setRange(dateStr ? 'custom' : 'today')
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
            >
              <Icon name="download" className="text-[18px]" />
              Export CSV
            </button>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-4 gap-gutter shrink-0">
            <div className="relative overflow-hidden px-md py-sm rounded-2xl bg-gradient-to-br from-surface-container-low to-secondary-container/10 border border-secondary-container/20 pill-glow group transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-sm mb-xs">
                <div className="w-9 h-9 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary shrink-0">
                  <Icon name="payments" className="text-[20px]" />
                </div>
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest truncate">Total Sales</h3>
              </div>
              <p className="font-headline-md text-headline-md text-primary">
                {currency}
                {totalSales.toFixed(2)}
              </p>
            </div>

            <div className="relative overflow-hidden px-md py-sm rounded-2xl bg-gradient-to-br from-surface-container-low to-tertiary-fixed/30 border border-tertiary-fixed/50 pill-glow group transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-sm mb-xs">
                <div className="w-9 h-9 bg-tertiary/10 rounded-lg flex items-center justify-center text-tertiary shrink-0">
                  <Icon name="receipt_long" className="text-[20px]" />
                </div>
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest truncate">Transactions</h3>
              </div>
              <p className="font-headline-md text-headline-md text-tertiary">{completedSales.length}</p>
            </div>

            <div className="relative overflow-hidden px-md py-sm rounded-2xl bg-gradient-to-br from-surface-container-low to-primary-fixed/20 border border-primary-fixed/50 pill-glow group transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-sm mb-xs">
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                  <Icon name="trending_up" className="text-[20px]" />
                </div>
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest truncate">Avg. Sale</h3>
              </div>
              <p className="font-headline-md text-headline-md text-primary-fixed-dim">
                {currency}
                {(completedSales.length ? totalSales / completedSales.length : 0).toFixed(2)}
              </p>
            </div>

            <div className="relative overflow-hidden px-md py-sm rounded-2xl bg-gradient-to-br from-surface-container-low to-secondary-container/10 border border-secondary-container/20 pill-glow group transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-sm mb-xs">
                <div className="w-9 h-9 bg-secondary/10 rounded-lg flex items-center justify-center text-secondary shrink-0">
                  <Icon name="query_stats" className="text-[20px]" />
                </div>
                <h3 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest truncate">Est. Profit</h3>
              </div>
              <p className="font-headline-md text-headline-md text-secondary">
                {currency}
                {profit.toFixed(2)}
              </p>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-lg py-sm border-b border-outline-variant/10 shrink-0">
              <h2 className="font-headline-md text-headline-md text-primary">Transactions</h2>
              <p className="text-on-surface-variant font-body-md">Every sale in the selected range.</p>
            </div>

            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-low">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Time</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Staff</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Payment</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Items</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Status</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">Total</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {!loading && filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                        No sales recorded in this range.
                      </td>
                    </tr>
                  )}
                  {filteredSales.slice(0, 100).map((sale) => {
                    const isCredit = sale.payment_method === 'credit'
                    return (
                      <tr
                        key={sale.id}
                        onClick={() => setDetailTarget(sale)}
                        className="cursor-pointer hover:bg-secondary-container/5 transition-colors"
                      >
                        <td className="px-lg py-sm font-body-md text-on-surface">
                          {new Date(sale.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-lg py-sm font-body-md text-on-surface-variant">{sale.staff_name || '—'}</td>
                        <td className="px-lg py-sm">
                          <span
                            className={`inline-block px-sm py-1 rounded-full text-label-sm font-label-sm ${
                              isCredit ? 'bg-tertiary/10 text-tertiary' : 'bg-secondary/10 text-secondary'
                            }`}
                          >
                            {isCredit ? 'Udhar (Credit)' : 'Cash'}
                          </span>
                          {isCredit && sale.customers?.name && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">{sale.customers.name}</p>
                          )}
                        </td>
                        <td className="px-lg py-sm font-body-md text-on-surface-variant">
                          {(sale.sale_items || []).reduce((sum, item) => sum + item.quantity, 0)} items
                        </td>
                        <td className="px-lg py-sm">
                          <span
                            className={`px-sm py-1 rounded-full text-label-sm font-label-sm ${
                              sale.status === 'refunded' ? 'bg-error-container text-on-error-container' : 'bg-secondary/10 text-secondary'
                            }`}
                          >
                            {sale.status === 'refunded' ? 'Refunded' : 'Completed'}
                          </span>
                          {sale.sync_status === 'pending' && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">Waiting to sync</p>
                          )}
                          {sale.sync_status === 'failed' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                showToast(sale.sync_error || 'Sync failed — no further details available.', 'error')
                              }}
                              className="text-[11px] text-error font-bold underline decoration-dotted mt-0.5"
                            >
                              Sync failed — tap for details
                            </button>
                          )}
                          {sale.status === 'refunded' && refundStatusBySaleId[sale.id] === 'pending' && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5">Refund syncing…</p>
                          )}
                          {sale.status === 'refunded' && refundStatusBySaleId[sale.id] === 'failed' && (
                            <p className="text-[11px] text-error font-bold mt-0.5">Refund sync failed</p>
                          )}
                        </td>
                        <td className="px-lg py-sm font-body-md text-on-surface font-semibold text-right">
                          {currency}
                          {Number(sale.total_amount).toFixed(2)}
                        </td>
                        <td className="px-lg py-sm text-right">
                          {sale.sync_status === 'failed' && (
                            <button
                              type="button"
                              onClick={(e) => handleRetrySync(e, sale)}
                              className="px-md py-1 rounded-xl font-label-md text-label-sm text-secondary hover:bg-secondary-container/40 transition-all"
                            >
                              Retry Sync
                            </button>
                          )}
                          {refundStatusBySaleId[sale.id] === 'failed' && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation()
                                await retryRefundSync(sale.id)
                                showToast('Retrying refund sync…')
                              }}
                              className="px-md py-1 rounded-xl font-label-md text-label-sm text-secondary hover:bg-secondary-container/40 transition-all"
                            >
                              Retry Refund
                            </button>
                          )}
                          {isManager && sale.status !== 'refunded' && sale.sync_status === 'synced' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRefundTarget(sale)
                              }}
                              className="px-md py-1 rounded-xl font-label-md text-label-sm text-error hover:bg-error-container/40 transition-all"
                            >
                              Refund
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <Footer />
      </main>

      <RefundModal open={Boolean(refundTarget)} sale={refundTarget} onClose={() => setRefundTarget(null)} onSubmit={handleRefund} />
      <ReceiptModal open={Boolean(detailTarget)} receipt={detailReceipt} onClose={() => setDetailTarget(null)} />
    </>
  )
}
