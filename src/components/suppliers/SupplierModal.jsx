import { useState } from 'react'
import Icon from '../common/Icon'

const inputClass =
  'px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const emptyForm = {
  name: '',
  company_name: '',
  contact_name: '',
  phone: '',
  email: '',
  delivery_day: '',
  order_day: '',
  notes: '',
}

export default function SupplierModal({ open, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({ ...form, name: form.name.trim() })
    setSubmitting(false)
    setForm(emptyForm)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-primary">Add Supplier</h2>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-lg flex flex-col gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Supplier Name</span>
            <input required value={form.name} onChange={handleChange('name')} className={inputClass} />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Company Name</span>
            <input value={form.company_name} onChange={handleChange('company_name')} className={inputClass} />
          </label>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Contact Name</span>
            <input value={form.contact_name} onChange={handleChange('contact_name')} className={inputClass} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md text-on-surface-variant">Phone</span>
              <input value={form.phone} onChange={handleChange('phone')} className={inputClass} />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md text-on-surface-variant">Email</span>
              <input type="email" value={form.email} onChange={handleChange('email')} className={inputClass} />
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md text-on-surface-variant">Delivery Day</span>
              <select value={form.delivery_day} onChange={handleChange('delivery_day')} className={inputClass}>
                <option value="">Not set</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-xs">
              <span className="font-label-md text-label-md text-on-surface-variant">Order Day</span>
              <select value={form.order_day} onChange={handleChange('order_day')} className={inputClass}>
                <option value="">Not set</option>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface-variant">Notes</span>
            <input value={form.notes} onChange={handleChange('notes')} className={inputClass} />
          </label>
          <div className="flex justify-end gap-sm mt-md">
            <button type="button" onClick={onClose} className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
