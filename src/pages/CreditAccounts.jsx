import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import Icon from '../components/common/Icon'
import CustomerModal from '../components/customers/CustomerModal'
import { useCreditAccounts } from '../hooks/useCreditAccounts'
import { useCustomers } from '../hooks/useCustomers'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import { fuzzyFilter } from '../lib/fuzzyMatch'

export default function CreditAccounts() {
  const { accounts, loading, refresh } = useCreditAccounts()
  const { addCustomer } = useCustomers()
  const { showToast } = useToast()
  const { currency } = useSettings()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => fuzzyFilter(accounts, search, (c) => c.name), [accounts, search])

  const totalOutstanding = useMemo(() => accounts.reduce((sum, c) => sum + Number(c.credit_balance || 0), 0), [accounts])
  const withBalanceCount = useMemo(() => accounts.filter((c) => Number(c.credit_balance) > 0).length, [accounts])

  const handleAdd = async (customer) => {
    const result = await addCustomer(customer)
    if (result.success) {
      showToast('Customer added.')
      setModalOpen(false)
      await refresh()
    } else {
      showToast(result.message || 'Could not add customer.', 'error')
    }
    return result
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg h-screen overflow-hidden flex flex-col">
        <TopHeader searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search customer name..." />

        <div className="px-margin-mobile lg:px-margin-desktop pt-sm pb-sm flex-1 flex flex-col min-h-0 gap-sm">
          <div className="flex justify-end gap-sm shrink-0">
            <div className="px-md py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide leading-none">Total Outstanding</p>
              <p className="font-headline-md text-[16px] text-error font-bold leading-tight">
                {currency}
                {totalOutstanding.toFixed(2)}
              </p>
            </div>
            <div className="px-md py-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/10 shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide leading-none">With Balance</p>
              <p className="font-headline-md text-[16px] text-primary font-bold leading-tight">{withBalanceCount}</p>
            </div>
          </div>

          <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-lg py-sm border-b border-outline-variant/10 flex justify-between items-center gap-md shrink-0">
              <div>
                <h2 className="font-headline-md text-headline-md text-primary">Credit Accounts (Udhar Khata)</h2>
                <p className="text-on-surface-variant font-body-md">Track who owes what, and record payments as they pay it off.</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shrink-0"
              >
                <Icon name="add" className="text-[18px]" />
                Add Customer
              </button>
            </div>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-low">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Name
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Phone
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Balance
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-lg py-md text-center text-on-surface-variant font-body-md">
                        No matching customers.
                      </td>
                    </tr>
                  )}
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/credit-accounts/${c.id}`)}
                      className="cursor-pointer hover:bg-secondary-container/5 transition-colors"
                    >
                      <td className="px-lg py-sm font-body-md font-bold text-primary">{c.name}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{c.phone || '—'}</td>
                      <td
                        className={`px-lg py-sm font-body-md font-semibold ${
                          Number(c.credit_balance) > 0 ? 'text-error' : 'text-on-surface-variant'
                        }`}
                      >
                        {currency}
                        {Number(c.credit_balance || 0).toFixed(2)}
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

      <CustomerModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleAdd} />
    </>
  )
}
