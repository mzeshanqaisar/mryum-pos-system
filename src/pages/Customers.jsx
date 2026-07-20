import { useState } from 'react'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import CustomerModal from '../components/customers/CustomerModal'
import { useCustomers } from '../hooks/useCustomers'
import { useToast } from '../context/ToastContext'

export default function Customers() {
  const { customers, addCustomer, deleteCustomer, retrySync } = useCustomers()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)

  const handleRetrySync = async (customer) => {
    await retrySync(customer.id)
    showToast('Retrying sync…')
  }

  const handleAdd = async (customer) => {
    const result = await addCustomer(customer)
    if (result.success) {
      showToast('Customer added.')
      setModalOpen(false)
    } else {
      showToast(result.message || 'Could not add customer.', 'error')
    }
    return result
  }

  const handleDelete = async (customer) => {
    if (!window.confirm(`Remove "${customer.name}" from customers?`)) return
    const result = await deleteCustomer(customer.id)
    if (result.success) {
      showToast('Customer removed.')
    } else {
      showToast(result.message || 'Could not remove customer.', 'error')
    }
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg h-screen overflow-hidden flex flex-col">
        <TopHeader />

        <div className="px-margin-mobile lg:px-margin-desktop pt-sm pb-sm flex-1 flex flex-col min-h-0">
          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-lg py-sm border-b border-outline-variant/10 flex justify-between items-center gap-md shrink-0">
              <div>
                <h2 className="font-headline-md text-headline-md text-primary">Customers</h2>
                <p className="text-on-surface-variant font-body-md">Attach a customer to a sale from the Register screen.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
              >
                <Icon name="add" className="text-[18px]" />
                Add Customer
              </button>
            </div>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-low">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Name</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Phone</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Email</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">Notes</th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                        No customers yet.
                      </td>
                    </tr>
                  )}
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary-container/5 transition-colors">
                      <td className="px-lg py-sm font-body-md font-bold text-primary">
                        {c.name}
                        {c.sync_status === 'pending' && (
                          <p className="text-[11px] font-normal text-on-surface-variant">Waiting to sync</p>
                        )}
                        {c.sync_status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => showToast(c.sync_error || 'Sync failed — no further details available.', 'error')}
                            className="text-[11px] font-normal text-error underline decoration-dotted"
                          >
                            Sync failed — tap for details
                          </button>
                        )}
                      </td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{c.phone || '—'}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{c.email || '—'}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{c.notes || '—'}</td>
                      <td className="px-lg py-sm text-right">
                        <div className="flex justify-end gap-xs">
                          {c.sync_status === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetrySync(c)}
                              className="px-sm py-1 rounded-lg font-label-md text-label-sm text-secondary hover:bg-secondary-container/40 transition-all"
                            >
                              Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(c)}
                            className="p-base rounded-full hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-all"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
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

      <CustomerModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAdd} />
    </>
  )
}
