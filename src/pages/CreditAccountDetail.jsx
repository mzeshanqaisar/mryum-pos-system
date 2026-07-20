import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import { useCreditAccount } from '../hooks/useCreditAccount'
import { useCreditTransactions } from '../hooks/useCreditTransactions'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'

const inputClass =
  'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

export default function CreditAccountDetail() {
  const { customerId } = useParams()
  const navigate = useNavigate()
  const { customer, loading, recordPayment } = useCreditAccount(customerId)
  const { transactions, loading: txLoading, refresh: refreshTx, retrySync: retryTxSync } = useCreditTransactions(customerId)
  const { profile } = useAuth()
  const { showToast } = useToast()
  const { currency } = useSettings()

  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const handleRequestPayment = (e) => {
    e.preventDefault()
    const value = Number(amount)
    if (!value || value <= 0) {
      showToast('Enter a valid amount received.', 'error')
      return
    }
    setConfirmOpen(true)
  }

  const handleConfirmPayment = async () => {
    setSubmitting(true)
    const result = await recordPayment(Number(amount), profile?.full_name || 'Staff', note.trim() || null)
    setSubmitting(false)
    setConfirmOpen(false)
    if (result.success) {
      showToast(`${currency}${Number(amount).toFixed(2)} recorded for ${customer.name}.`)
      setAmount('')
      setNote('')
      await refreshTx()
    } else {
      showToast(result.message || 'Could not record payment.', 'error')
    }
  }

  const handleRetryTxSync = async (tx) => {
    await retryTxSync(tx.id)
    showToast('Retrying sync…')
  }

  if (loading || !customer) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex items-center justify-center">
        <p className="text-on-surface-variant font-body-md">{loading ? 'Loading…' : 'Customer not found.'}</p>
      </main>
    )
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          <button
            type="button"
            onClick={() => navigate('/credit-accounts')}
            className="flex items-center gap-xs text-on-surface-variant hover:text-primary transition-all font-label-md text-label-md"
          >
            <Icon name="arrow_back" className="text-[18px]" />
            Back to Credit Accounts
          </button>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md space-y-sm">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-primary">{customer.name}</h2>
              <p className="text-on-surface-variant font-body-md">{customer.phone || 'No phone'}</p>
            </div>

            <div className="flex items-center justify-between bg-error-container/20 rounded-2xl px-lg py-md">
              <span className="font-body-md text-on-surface-variant">Outstanding Balance</span>
              <span className="font-headline-lg text-headline-lg text-error">
                {currency}
                {Number(customer.credit_balance || 0).toFixed(2)}
              </span>
            </div>

            <form onSubmit={handleRequestPayment} className="flex flex-col sm:flex-row gap-sm sm:items-end">
              <label className="flex flex-col gap-xs flex-1">
                <span className="font-label-md text-label-md text-on-surface-variant">Amount Received ({currency})</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-xs flex-1">
                <span className="font-label-md text-label-md text-on-surface-variant">Note (optional)</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
              </label>
              <button
                type="submit"
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shrink-0"
              >
                We Received This
              </button>
            </form>
          </section>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 px-lg py-md space-y-sm">
            <h3 className="font-headline-md text-headline-md text-primary mb-sm">History</h3>
            {txLoading && <p className="text-on-surface-variant font-body-md py-sm text-center">Loading…</p>}
            {!txLoading && transactions.length === 0 && (
              <p className="text-on-surface-variant font-body-md py-sm text-center">No transactions yet.</p>
            )}
            {transactions.map((tx) => {
              const isCharge = tx.type === 'charge'
              const isExpanded = expandedId === tx.id
              const items = tx.sales?.sale_items || []
              return (
                <div key={tx.id} className="rounded-xl border border-outline-variant/10 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => isCharge && setExpandedId(isExpanded ? null : tx.id)}
                    className={`w-full flex items-center justify-between gap-md px-md py-sm text-left ${isCharge ? 'hover:bg-surface-container-high' : ''}`}
                  >
                    <div className="flex items-center gap-sm min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCharge ? 'bg-error-container/40 text-error' : 'bg-secondary-container/40 text-secondary'
                        }`}
                      >
                        <Icon name={isCharge ? 'shopping_bag' : 'payments'} className="text-[16px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body-md font-bold text-primary">{isCharge ? 'Udhar Taken (Bill)' : 'Payment Received'}</p>
                        <p className="text-[12px] text-on-surface-variant">{new Date(tx.created_at).toLocaleString()}</p>
                        {tx.note && <p className="text-[12px] text-on-surface-variant italic">{tx.note}</p>}
                        {tx.sync_status === 'pending' && (
                          <p className="text-[11px] text-on-surface-variant">Waiting to sync</p>
                        )}
                        {tx.sync_status === 'failed' && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              showToast(tx.sync_error || 'Sync failed — no further details available.', 'error')
                            }}
                            className="inline-block text-[11px] text-error font-bold underline decoration-dotted cursor-pointer"
                          >
                            Sync failed — tap for details
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-xs shrink-0">
                      <span className={`font-body-md font-bold ${isCharge ? 'text-error' : 'text-secondary'}`}>
                        {isCharge ? '+' : '−'}
                        {currency}
                        {Number(tx.amount).toFixed(2)}
                      </span>
                      {tx.sync_status === 'failed' && !isCharge && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRetryTxSync(tx)
                          }}
                          className="px-sm py-1 rounded-lg font-label-md text-label-sm text-secondary hover:bg-secondary-container/40 transition-all"
                        >
                          Retry
                        </button>
                      )}
                      {isCharge && <Icon name={isExpanded ? 'expand_less' : 'expand_more'} className="text-on-surface-variant text-[18px]" />}
                    </div>
                  </button>
                  {isCharge && isExpanded && (
                    <div className="px-md pb-sm pt-0 bg-surface-container-low/50">
                      {items.length === 0 ? (
                        <p className="text-[12px] text-on-surface-variant py-sm">No item details available.</p>
                      ) : (
                        <div className="space-y-0.5 py-sm">
                          {items.map((item) => (
                            <div key={item.id} className="flex justify-between text-[12px] text-on-surface-variant">
                              <span>
                                {item.quantity} × {item.products?.name || 'Item'}
                              </span>
                              <span>
                                {currency}
                                {(item.quantity * item.price_at_sale).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </section>
        </div>

        <Footer />
      </main>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 p-lg space-y-md"
          >
            <h2 className="font-headline-md text-headline-md text-primary">Confirm Payment</h2>
            <p className="font-body-md text-on-surface-variant">
              Confirm that{' '}
              <span className="font-bold text-primary">
                {currency}
                {Number(amount || 0).toFixed(2)}
              </span>{' '}
              was received from{' '}
              <span className="font-bold text-primary">{customer.name}</span>?
            </p>
            <div className="flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={submitting}
                className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
