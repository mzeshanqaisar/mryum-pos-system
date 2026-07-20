import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/common/Icon'
import Toggle from '../components/common/Toggle'
import { useProducts } from '../hooks/useProducts'
import { useCategories } from '../hooks/useCategories'
import { useSuppliers } from '../hooks/useSuppliers'
import { useToast } from '../context/ToastContext'
import { useSettings } from '../context/SettingsContext'
import { supabase } from '../lib/supabaseClient'
import SupplierPickerModal from '../components/suppliers/SupplierPickerModal'
import SupplierModal from '../components/suppliers/SupplierModal'
import { toPieces, fromPieces } from '../lib/orderQuantity'

const SUB_CATEGORIES = {
  Bakery: ['Bread', 'Cakes', 'Pastries', 'Cookies', 'Buns'],
  Snacks: ['Biscuits', 'Chips', 'Namkeen', 'Confectionery'],
  Beverages: ['Soft Drinks', 'Juices', 'Water', 'Tea & Coffee'],
  Grocery: ['Staples', 'Spices', 'Oil & Ghee', 'Canned Goods'],
  Dairy: ['Milk', 'Cheese', 'Yogurt', 'Butter'],
  Household: ['Cleaning', 'Paper Goods', 'Personal Care'],
}

const UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'Gram' },
  { value: 'liter', label: 'Litre' },
]

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = {
  name: '',
  supplierId: '',
  category: '',
  subCategory: '',
  unit: 'piece',
  pieceBarcode: '',
  hasBoxConfig: false,
  boxBarcode: '',
  piecesPerBox: '',
  boxCostPrice: '',
  hasExpiry: false,
  initialStock: '',
  initialStockBoxes: '',
  expiryDate: '',
  batchReceivedDate: today(),
  costPrice: '',
  sellingPrice: '',
  taxPercent: '',
  minStockAlert: '10',
  expiryAlertDays: '3',
  image: null,
  status: 'active',
}

function Section({ icon, title, description, children, right }) {
  return (
    <section className="bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 shadow-xl shadow-primary/5 p-lg space-y-md">
      <div className="flex items-center justify-between gap-md pb-sm border-b border-outline-variant/10">
        <div className="flex items-center gap-sm min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon name={icon} className="text-[20px]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-headline-md text-headline-md text-primary leading-tight">{title}</h2>
            {description && <p className="text-on-surface-variant font-body-md text-[13px] truncate">{description}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function Field({ label, error, children, required, hint, className = '', labelRight }) {
  return (
    <label className={`flex flex-col gap-xs ${className}`}>
      <span className="flex items-center justify-between gap-sm">
        <span className="font-label-md text-label-md text-on-surface-variant">
          {label} {required && <span className="text-error">*</span>}
        </span>
        {labelRight}
      </span>
      {children}
      {hint && !error && <span className="text-[12px] text-on-surface-variant/70">{hint}</span>}
      {error && <span className="text-[12px] text-error">{error}</span>}
    </label>
  )
}

function Collapse({ open, children }) {
  return (
    <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
      <div className="overflow-hidden min-h-0">
        <div className="space-y-md pt-md">{children}</div>
      </div>
    </div>
  )
}

function ScanButton({ onClick }) {
  return (
    <div className="relative group shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-label="Scan barcode"
        className="w-[42px] h-[42px] flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-secondary transition-all"
      >
        <Icon name="barcode_scanner" className="text-[20px]" />
      </button>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-sm py-1 rounded-lg bg-surface-container-highest text-on-surface text-[11px] font-label-md opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
        Scan barcode
      </span>
    </div>
  )
}

export default function AddProduct() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = Boolean(id)
  const { products, loading: productsLoading, addProduct, updateProduct } = useProducts()
  const { categories, addCategory } = useCategories()
  const { suppliers, addSupplier } = useSuppliers()
  const { showToast } = useToast()
  const { currency } = useSettings()

  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false)
  const [addSupplierModalOpen, setAddSupplierModalOpen] = useState(false)

  const existingProduct = useMemo(() => products.find((p) => p.id === id), [products, id])

  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const lastAutoCostRef = useRef('')
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!isEditMode || !existingProduct || hydratedRef.current) return
    hydratedRef.current = true
    const hasBoxConfig = Number(existingProduct.pieces_per_box) > 1
    const stockBreakdown = hasBoxConfig
      ? fromPieces(existingProduct.stock_quantity, existingProduct.pieces_per_box)
      : { boxes: 0, pieces: existingProduct.stock_quantity ?? 0 }
    setForm({
      name: existingProduct.name || '',
      supplierId: existingProduct.supplier_id || '',
      category: existingProduct.category || '',
      subCategory: existingProduct.sub_category || '',
      unit: existingProduct.unit || 'piece',
      pieceBarcode: existingProduct.piece_barcode || '',
      hasBoxConfig,
      boxBarcode: existingProduct.box_barcode || '',
      piecesPerBox: existingProduct.pieces_per_box ? String(existingProduct.pieces_per_box) : '',
      boxCostPrice: '',
      hasExpiry: Boolean(existingProduct.expiry_date),
      initialStock: existingProduct.stock_quantity != null ? String(stockBreakdown.pieces) : '',
      initialStockBoxes: hasBoxConfig && stockBreakdown.boxes ? String(stockBreakdown.boxes) : '',
      expiryDate: existingProduct.expiry_date || '',
      batchReceivedDate: existingProduct.batch_received_date || today(),
      costPrice: existingProduct.cost_price != null ? String(existingProduct.cost_price) : '',
      sellingPrice: existingProduct.price != null ? String(existingProduct.price) : '',
      taxPercent: existingProduct.tax_percent != null ? String(existingProduct.tax_percent) : '',
      minStockAlert: existingProduct.low_stock_threshold != null ? String(existingProduct.low_stock_threshold) : '10',
      expiryAlertDays: existingProduct.expiry_alert_days != null ? String(existingProduct.expiry_alert_days) : '3',
      image: null,
      status: existingProduct.is_active === false ? 'inactive' : 'active',
    })
    if (existingProduct.image_url) setImagePreview(existingProduct.image_url)
  }, [isEditMode, existingProduct])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  const setValue = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  // Auto-fill cost-per-piece from the box cost, unless the user has since overridden it manually.
  useEffect(() => {
    if (!form.hasBoxConfig) return
    const pieces = Number(form.piecesPerBox)
    const boxCost = Number(form.boxCostPrice)
    if (pieces > 0 && boxCost > 0) {
      const computed = (boxCost / pieces).toFixed(2)
      setForm((f) => {
        if (f.costPrice === '' || f.costPrice === lastAutoCostRef.current) {
          lastAutoCostRef.current = computed
          return { ...f, costPrice: computed }
        }
        return f
      })
    }
  }, [form.piecesPerBox, form.boxCostPrice, form.hasBoxConfig])

  const costPerPieceFromBox = useMemo(() => {
    const pieces = Number(form.piecesPerBox)
    const boxCost = Number(form.boxCostPrice)
    if (pieces > 0 && boxCost > 0) return (boxCost / pieces).toFixed(2)
    return null
  }, [form.piecesPerBox, form.boxCostPrice])

  const categoryOptions = useMemo(() => {
    if (form.category && !categories.includes(form.category)) return [...categories, form.category].sort((a, b) => a.localeCompare(b))
    return categories
  }, [categories, form.category])

  const subCategoryOptions = useMemo(() => {
    const base = form.category ? SUB_CATEGORIES[form.category] || [] : []
    if (form.subCategory && !base.includes(form.subCategory)) return [...base, form.subCategory]
    return base
  }, [form.category, form.subCategory])

  const validateField = (field, value) => {
    if (field === 'name' && !value.trim()) return 'Product name is required.'
    if (field === 'category' && !value) return 'Please select a category.'
    if (field === 'sellingPrice' && (!value || Number(value) <= 0)) return 'Selling price is required.'
    return null
  }

  const handleBlur = (field) => () => {
    const message = validateField(field, form[field])
    setErrors((e) => ({ ...e, [field]: message }))
  }

  const validateAll = () => {
    const nextErrors = {}
    ;['name', 'category', 'sellingPrice'].forEach((field) => {
      const message = validateField(field, form[field])
      if (message) nextErrors[field] = message
    })
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleFile = (file) => {
    if (!file) return
    setForm((f) => ({ ...f, image: file }))
    setImagePreview(URL.createObjectURL(file))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleCancel = () => navigate(isEditMode ? `/products/${id}` : '/inventory')

  const selectedSupplier = useMemo(() => suppliers.find((s) => s.id === form.supplierId), [suppliers, form.supplierId])

  const handleAddSupplier = async (supplierData) => {
    const result = await addSupplier(supplierData)
    if (result.success) {
      setForm((f) => ({ ...f, supplierId: result.supplier.id }))
      setAddSupplierModalOpen(false)
      showToast('Supplier added.')
    } else {
      showToast(result.message || 'Could not add supplier.', 'error')
    }
    return result
  }

  const handleAddCategory = async () => {
    const trimmed = newCategoryName.trim()
    if (!trimmed) return
    setSavingCategory(true)
    const result = await addCategory(trimmed)
    setSavingCategory(false)
    if (result.success) {
      setForm((f) => ({ ...f, category: trimmed, subCategory: '' }))
      setErrors((e) => ({ ...e, category: null }))
      setNewCategoryName('')
      setAddingCategory(false)
      showToast('Category added.')
    } else {
      showToast(result.message || 'Could not add category.', 'error')
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (!validateAll()) {
      showToast('Please fix the highlighted fields.', 'error')
      return
    }

    setSubmitting(true)

    let imageUrl = isEditMode ? existingProduct?.image_url || null : null
    let skippedImageUpload = false
    if (form.image) {
      if (!navigator.onLine) {
        // There's no local queue for binary uploads (unlike table rows) — rather
        // than block the whole product save on a photo, save everything else now
        // and let the cashier re-attach the photo once back online.
        skippedImageUpload = true
      } else {
        setUploading(true)
        const path = `${Date.now()}-${form.image.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, form.image, { upsert: false })
        if (uploadError) {
          setUploading(false)
          setSubmitting(false)
          showToast(`Image upload failed: ${uploadError.message}`, 'error')
          return
        }
        const { data } = supabase.storage.from('product-images').getPublicUrl(path)
        imageUrl = data.publicUrl
        setUploading(false)
      }
    }

    const payload = {
      name: form.name.trim(),
      supplier_id: form.supplierId || null,
      category: form.category,
      sub_category: form.subCategory || null,
      unit: form.unit,
      piece_barcode: form.pieceBarcode.trim() || null,
      pieces_per_box: form.hasBoxConfig && form.piecesPerBox ? Number(form.piecesPerBox) : null,
      box_barcode: form.hasBoxConfig ? form.boxBarcode.trim() || null : null,
      stock_quantity: form.hasBoxConfig
        ? toPieces(form.initialStockBoxes, form.initialStock, form.piecesPerBox)
        : Number(form.initialStock) || 0,
      expiry_date: form.hasExpiry ? form.expiryDate || null : null,
      batch_received_date: form.hasExpiry ? form.batchReceivedDate || null : null,
      cost_price: Number(form.costPrice) || 0,
      price: Number(form.sellingPrice) || 0,
      tax_percent: Number(form.taxPercent) || 0,
      low_stock_threshold: Number(form.minStockAlert) || 0,
      expiry_alert_days: form.hasExpiry ? Number(form.expiryAlertDays) || 0 : 0,
      image_url: imageUrl,
      is_active: form.status === 'active',
    }

    const result = isEditMode ? await updateProduct(id, payload) : await addProduct(payload)
    setSubmitting(false)

    if (result.success) {
      setSaved(true)
      if (skippedImageUpload) {
        showToast(`${isEditMode ? 'Product updated' : 'Product added'} — offline, so the photo wasn't uploaded. Add it again once you're back online.`)
      } else {
        showToast(isEditMode ? 'Product updated.' : 'Product added.')
      }
      setTimeout(() => navigate(isEditMode ? `/products/${id}` : '/inventory'), 600)
    } else {
      showToast(result.message || `Could not ${isEditMode ? 'update' : 'add'} product.`, 'error')
    }
  }

  const inputClass = (field) =>
    `w-full px-md py-sm bg-surface-container-low border rounded-xl outline-none transition-all font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-secondary/20 ${
      errors[field] ? 'border-error focus:border-error focus:ring-error/20' : 'border-outline-variant/30 focus:border-secondary'
    }`

  if (isEditMode && productsLoading) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex items-center justify-center min-h-screen">
        <p className="text-on-surface-variant font-body-md">Loading product…</p>
      </main>
    )
  }

  if (isEditMode && !productsLoading && !existingProduct) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col items-center justify-center min-h-screen gap-sm">
        <p className="text-on-surface-variant font-body-md">Product not found.</p>
        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md"
        >
          Back to Inventory
        </button>
      </main>
    )
  }

  return (
    <>
    <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(61,36,25,0.05)] px-margin-mobile lg:px-margin-desktop py-sm flex items-center justify-between gap-md">
        <div className="flex items-center gap-sm min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Back"
            className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all shrink-0"
          >
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <h1 className="font-headline-md text-headline-md text-primary truncate">{isEditMode ? 'Edit Product' : 'Add New Product'}</h1>
        </div>
        <div className="flex items-center gap-sm shrink-0">
          <button
            type="button"
            onClick={handleCancel}
            className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="hidden sm:flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name={saved ? 'check_circle' : 'save'} className="text-[18px]" />
            {saved ? 'Saved' : submitting ? (uploading ? 'Uploading…' : 'Saving…') : isEditMode ? 'Save Changes' : 'Save Product'}
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-32 space-y-sm">
        <Section icon="inventory_2" title="Basic Info" description="What this product is and how it's sold.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Product Name" required error={errors.name} className="md:col-span-2">
              <input
                value={form.name}
                onChange={set('name')}
                onBlur={handleBlur('name')}
                placeholder="e.g. Super Biscuits"
                className={inputClass('name')}
              />
            </Field>

            <Field
              label="Category"
              required
              error={errors.category}
              labelRight={
                !addingCategory && (
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="flex items-center gap-0.5 text-secondary text-[12px] font-label-md hover:underline"
                  >
                    <Icon name="add" className="text-[14px]" />
                    Add Category
                  </button>
                )
              }
            >
              {addingCategory ? (
                <div className="flex gap-sm">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddCategory()
                      }
                      if (e.key === 'Escape') {
                        setAddingCategory(false)
                        setNewCategoryName('')
                      }
                    }}
                    placeholder="New category name…"
                    className={inputClass('category')}
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={savingCategory}
                    className="shrink-0 px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
                  >
                    {savingCategory ? '…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCategory(false)
                      setNewCategoryName('')
                    }}
                    className="shrink-0 p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all"
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </div>
              ) : (
                <select
                  value={form.category}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, category: e.target.value, subCategory: '' }))
                  }}
                  onBlur={handleBlur('category')}
                  className={inputClass('category')}
                >
                  <option value="">Select category…</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Sub-category" hint="Optional">
              <select
                value={form.subCategory}
                onChange={set('subCategory')}
                disabled={!form.category}
                className={`${inputClass('subCategory')} disabled:opacity-50`}
              >
                <option value="">{form.category ? 'Select sub-category…' : 'Choose a category first'}</option>
                {subCategoryOptions.map((sc) => (
                  <option key={sc} value={sc}>
                    {sc}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Selling Unit">
              <select value={form.unit} onChange={set('unit')} className={inputClass('unit')}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Piece Barcode" hint="Scan or type the barcode for a single piece">
              <div className="flex gap-sm">
                <input
                  value={form.pieceBarcode}
                  onChange={set('pieceBarcode')}
                  placeholder="e.g. 8901234567890"
                  className={inputClass('pieceBarcode')}
                />
                <ScanButton onClick={() => showToast('Connect a barcode scanner to use this.', 'error')} />
              </div>
            </Field>

            <Field label="Supplier" hint="Who this product is reordered from" className="md:col-span-2">
              <button
                type="button"
                onClick={() => setSupplierPickerOpen(true)}
                className={`${inputClass('supplierId')} flex items-center justify-between text-left`}
              >
                <span className={selectedSupplier ? 'text-on-surface' : 'text-on-surface-variant/60'}>
                  {selectedSupplier ? selectedSupplier.company_name || selectedSupplier.name : 'No supplier set'}
                </span>
                <Icon name="expand_more" className="text-[18px] text-on-surface-variant shrink-0" />
              </button>
            </Field>
          </div>
        </Section>

        <Section
          icon="package_2"
          title="Box / Pack Configuration"
          description="For items that arrive in boxes but sell per piece."
          right={
            <Toggle
              id="hasBoxConfig"
              checked={form.hasBoxConfig}
              onChange={(v) => setValue('hasBoxConfig', v)}
            />
          }
        >
          <Collapse open={form.hasBoxConfig}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Box Barcode / QR" hint="Optional">
                <div className="flex gap-sm">
                  <input
                    value={form.boxBarcode}
                    onChange={set('boxBarcode')}
                    placeholder="e.g. 8901234567906"
                    className={inputClass('boxBarcode')}
                  />
                  <ScanButton onClick={() => showToast('Connect a barcode scanner to use this.', 'error')} />
                </div>
              </Field>
              <Field label="Pieces per Box">
                <input
                  type="number"
                  min="0"
                  value={form.piecesPerBox}
                  onChange={set('piecesPerBox')}
                  placeholder="e.g. 8"
                  className={inputClass('piecesPerBox')}
                />
              </Field>
              <Field label={`Box Cost Price (${currency})`} className="md:col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.boxCostPrice}
                  onChange={set('boxCostPrice')}
                  placeholder="e.g. 24.00"
                  className={inputClass('boxCostPrice')}
                />
              </Field>
            </div>
            {costPerPieceFromBox && (
              <p className="text-[13px] font-label-md text-secondary bg-secondary-container/10 rounded-lg px-sm py-1.5 inline-block">
                Cost per piece: {currency}
                {costPerPieceFromBox}
              </p>
            )}
          </Collapse>
        </Section>

        <Section
          icon="calendar_month"
          title="Expiry & Batch"
          description="Track batches that can expire."
          right={<Toggle id="hasExpiry" checked={form.hasExpiry} onChange={(v) => setValue('hasExpiry', v)} />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            {form.hasBoxConfig ? (
              <>
                <Field label={isEditMode ? 'Current Stock — Boxes' : 'Initial Stock — Boxes'} hint="Fractional boxes allowed, e.g. 2.5">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.initialStockBoxes}
                    onChange={set('initialStockBoxes')}
                    placeholder="0"
                    className={inputClass('initialStockBoxes')}
                  />
                </Field>
                <Field label={isEditMode ? 'Current Stock — Pieces' : 'Initial Stock — Pieces'}>
                  <input
                    type="number"
                    min="0"
                    value={form.initialStock}
                    onChange={set('initialStock')}
                    placeholder="0"
                    className={inputClass('initialStock')}
                  />
                </Field>
              </>
            ) : (
              <Field label={isEditMode ? 'Current Stock Quantity' : 'Initial Stock Quantity'}>
                <input
                  type="number"
                  min="0"
                  value={form.initialStock}
                  onChange={set('initialStock')}
                  placeholder="0"
                  className={inputClass('initialStock')}
                />
              </Field>
            )}
          </div>
          {form.hasBoxConfig && (form.initialStockBoxes || form.initialStock) && (
            <p className="text-[13px] font-label-md text-secondary bg-secondary-container/10 rounded-lg px-sm py-1.5 inline-block">
              Total: {toPieces(form.initialStockBoxes, form.initialStock, form.piecesPerBox)} pieces
            </p>
          )}
          <Collapse open={form.hasExpiry}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <Field label="Expiry Date">
                <div className="relative">
                  <input
                    type="date"
                    value={form.expiryDate}
                    onChange={set('expiryDate')}
                    className={`${inputClass('expiryDate')} pr-10`}
                  />
                  <Icon
                    name="calendar_month"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]"
                  />
                </div>
              </Field>
              <Field label="Batch Received Date" hint="Defaults to today">
                <div className="relative">
                  <input
                    type="date"
                    value={form.batchReceivedDate}
                    onChange={set('batchReceivedDate')}
                    className={`${inputClass('batchReceivedDate')} pr-10`}
                  />
                  <Icon
                    name="calendar_month"
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]"
                  />
                </div>
              </Field>
            </div>
          </Collapse>
        </Section>

        <Section icon="payments" title="Pricing" description="What it costs you, and what you sell it for.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label={`Cost Price per piece (${currency})`} hint={form.hasBoxConfig ? 'Auto-filled from box cost, editable' : undefined}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={set('costPrice')}
                placeholder="0.00"
                className={inputClass('costPrice')}
              />
            </Field>
            <Field label={`Selling Price per piece (${currency})`} required error={errors.sellingPrice}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={set('sellingPrice')}
                onBlur={handleBlur('sellingPrice')}
                placeholder="0.00"
                className={inputClass('sellingPrice')}
              />
            </Field>
            <Field label="Tax %" hint="Optional">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.taxPercent}
                onChange={set('taxPercent')}
                placeholder="0"
                className={inputClass('taxPercent')}
              />
            </Field>
          </div>
        </Section>

        <Section icon="notifications" title="Stock Alerts" description="Get warned before you run out.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Minimum Stock Alert" hint="Get notified when stock falls below this">
              <input
                type="number"
                min="0"
                value={form.minStockAlert}
                onChange={set('minStockAlert')}
                className={inputClass('minStockAlert')}
              />
            </Field>
            {form.hasExpiry && (
              <Field label="Expiry Alert (days before)">
                <input
                  type="number"
                  min="0"
                  value={form.expiryAlertDays}
                  onChange={set('expiryAlertDays')}
                  className={inputClass('expiryAlertDays')}
                />
              </Field>
            )}
          </div>
        </Section>

        <Section icon="image" title="Extra" description="Photo and visibility.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <Field label="Product Image" hint="Optional">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-sm p-md rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  dragActive
                    ? 'border-secondary bg-secondary-container/10'
                    : 'border-outline-variant/30 hover:border-secondary/50 hover:bg-surface-container-low'
                }`}
              >
                <div className="w-14 h-14 rounded-lg bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
                  {imagePreview ? (
                    <img className="w-full h-full object-cover" src={imagePreview} alt="Preview" />
                  ) : (
                    <Icon name="bakery_dining" className="text-on-surface-variant/40" />
                  )}
                </div>
                <p className="text-on-surface-variant font-body-md text-[13px]">Drag & drop an image, or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </div>
            </Field>

            <Field label="Status">
              <div className="px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl flex items-center h-[42px]">
                <Toggle
                  id="status"
                  checked={form.status === 'active'}
                  onChange={(v) => setValue('status', v ? 'active' : 'inactive')}
                  label={form.status === 'active' ? 'Active' : 'Inactive'}
                />
              </div>
            </Field>
          </div>
        </Section>
      </form>

      <div className="sticky bottom-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10 px-margin-mobile lg:px-margin-desktop py-sm flex items-center justify-end gap-sm shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <button
          type="button"
          onClick={handleCancel}
          className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex items-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none"
        >
          <Icon name={saved ? 'check_circle' : 'save'} className="text-[18px]" />
          {saved ? 'Saved' : submitting ? (uploading ? 'Uploading…' : 'Saving…') : 'Save Product'}
        </button>
      </div>
    </main>

    <SupplierPickerModal
      open={supplierPickerOpen}
      suppliers={suppliers}
      onClose={() => setSupplierPickerOpen(false)}
      onSelect={(supplier) => {
        setForm((f) => ({ ...f, supplierId: supplier.id }))
        setSupplierPickerOpen(false)
      }}
      onAddNew={() => {
        setSupplierPickerOpen(false)
        setAddSupplierModalOpen(true)
      }}
    />
    <SupplierModal open={addSupplierModalOpen} onClose={() => setAddSupplierModalOpen(false)} onSubmit={handleAddSupplier} />
    </>
  )
}
