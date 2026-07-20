import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import SupplierModal from '../components/suppliers/SupplierModal'
import { useSuppliers } from '../hooks/useSuppliers'
import { useSupplierAlerts } from '../hooks/useSupplierAlerts'
import { useToast } from '../context/ToastContext'

export default function Suppliers() {
  const { addSupplier, retrySync } = useSuppliers()
  const { summaries } = useSupplierAlerts()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [supplierModalOpen, setSupplierModalOpen] = useState(false)

  // Suppliers whose order day is coming up soonest float to the top automatically.
  const sortedSummaries = useMemo(
    () => [...summaries].sort((a, b) => (a.daysUntilOrder ?? Infinity) - (b.daysUntilOrder ?? Infinity)),
    [summaries],
  )

  const handleAddSupplier = async (supplier) => {
    const result = await addSupplier(supplier)
    if (result.success) {
      showToast('Supplier added.')
      setSupplierModalOpen(false)
    } else {
      showToast(result.message || 'Could not add supplier.', 'error')
    }
    return result
  }

  const handleShowSyncError = (e, supplier) => {
    e.stopPropagation()
    showToast(supplier.sync_error || 'Sync failed — no further details available.', 'error')
  }

  const handleRetrySync = async (e, supplier) => {
    e.stopPropagation()
    await retrySync(supplier.id)
    showToast('Retrying sync…')
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
            <div className="px-lg py-sm border-b border-outline-variant/10 flex justify-between items-center gap-md">
              <div>
                <h2 className="font-headline-md text-headline-md text-primary">Suppliers</h2>
                <p className="text-on-surface-variant font-body-md">Who you buy ingredients and stock from.</p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(true)}
                className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
              >
                <Icon name="add" className="text-[18px]" />
                Add Supplier
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Name</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Company</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Contact</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Phone</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Alerts</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">
                      <Icon name="chevron_right" className="opacity-0" />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {sortedSummaries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                        No suppliers yet.
                      </td>
                    </tr>
                  )}
                  {sortedSummaries.map(({ supplier: s, outOfStock, lowStock, hasStockAlert, hasOrderDayAlert, daysUntilOrder }) => (
                    <tr
                      key={s.id}
                      onClick={() => navigate(`/suppliers/${s.id}`)}
                      className="cursor-pointer hover:bg-secondary-container/5 transition-colors"
                    >
                      <td className="px-lg py-sm font-body-md font-bold text-primary">
                        {s.name}
                        {s.sync_status === 'pending' && (
                          <p className="text-[11px] font-normal text-on-surface-variant">Waiting to sync</p>
                        )}
                        {s.sync_status === 'failed' && (
                          <div className="flex items-center gap-xs flex-wrap">
                            <button
                              type="button"
                              onClick={(e) => handleShowSyncError(e, s)}
                              className="text-[11px] font-normal text-error underline decoration-dotted"
                            >
                              Sync failed — tap for details
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRetrySync(e, s)}
                              className="text-[11px] font-label-md text-secondary underline"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{s.company_name || '—'}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{s.contact_name || '—'}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{s.phone || '—'}</td>
                      <td className="px-lg py-sm">
                        <div className="flex flex-wrap gap-xs">
                          {outOfStock.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-sm py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container whitespace-nowrap">
                              <Icon name="production_quantity_limits" className="text-[13px]" />
                              {outOfStock.length} out
                            </span>
                          )}
                          {lowStock.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-sm py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary whitespace-nowrap">
                              <Icon name="warning" className="text-[13px]" />
                              {lowStock.length} low
                            </span>
                          )}
                          {hasOrderDayAlert && (
                            <span className="inline-flex items-center gap-0.5 px-sm py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary whitespace-nowrap">
                              <Icon name="event_upcoming" className="text-[13px]" />
                              {daysUntilOrder === 0 ? 'Order today' : 'Order tomorrow'}
                            </span>
                          )}
                          {!hasStockAlert && !hasOrderDayAlert && <span className="text-[11px] text-on-surface-variant/40">—</span>}
                        </div>
                      </td>
                      <td className="px-lg py-sm text-right">
                        <Icon name="chevron_right" className="text-on-surface-variant" />
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

      <SupplierModal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSubmit={handleAddSupplier} />
    </>
  )
}
