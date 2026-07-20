import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/common/Icon'
import { useProducts } from '../hooks/useProducts'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'

function Section({ icon, title, description, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 shadow-xl shadow-primary/5 p-lg space-y-md">
      <div className="flex items-center gap-sm pb-sm border-b border-outline-variant/10">
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div className="min-w-0">
          <h2 className="font-headline-md text-headline-md text-primary leading-tight">{title}</h2>
          {description && <p className="text-on-surface-variant font-body-md text-[13px] truncate">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function ReadField({ label, value, className = '' }) {
  return (
    <div className={`flex flex-col gap-xs ${className}`}>
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      <p className="px-md py-sm bg-surface-container-low border border-outline-variant/20 rounded-xl font-body-md text-body-md text-on-surface min-h-[42px] flex items-center">
        {value === '' || value === null || value === undefined ? <span className="text-on-surface-variant/50">—</span> : value}
      </p>
    </div>
  )
}

export default function ProductDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { products, loading } = useProducts()
  const { isManager } = useAuth()
  const { currency } = useSettings()

  const product = useMemo(() => products.find((p) => p.id === id), [products, id])

  const hasBoxPacking = Number(product?.pieces_per_box) > 1
  const hasExpiry = Boolean(product?.expiry_date)

  if (loading) {
    return (
      <main className="flex-1 min-w-0 bg-surface grain-bg flex items-center justify-center min-h-screen">
        <p className="text-on-surface-variant font-body-md">Loading product…</p>
      </main>
    )
  }

  if (!product) {
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
    <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(61,36,25,0.05)] px-margin-mobile lg:px-margin-desktop py-sm flex items-center justify-between gap-md">
        <div className="flex items-center gap-sm min-w-0">
          <button
            type="button"
            onClick={() => navigate('/inventory')}
            aria-label="Back"
            className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all shrink-0"
          >
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <h1 className="font-headline-md text-headline-md text-primary truncate">Product Detail</h1>
        </div>
        {isManager && (
          <button
            type="button"
            onClick={() => navigate(`/products/${id}/edit`)}
            className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shrink-0"
          >
            <Icon name="edit" className="text-[18px]" />
            Edit
          </button>
        )}
      </header>

      <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-lg space-y-sm">
        <section className="bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 shadow-xl shadow-primary/5 p-lg flex items-center gap-md">
          <div className="w-20 h-20 rounded-xl bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
            {product.image_url ? (
              <img className="w-full h-full object-cover" src={product.image_url} alt={product.name} />
            ) : (
              <Icon name="bakery_dining" className="text-on-surface-variant/40 text-[28px]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-headline-lg text-headline-lg text-primary truncate">{product.name}</h2>
            <div className="flex flex-wrap items-center gap-xs mt-xs">
              <span className="px-sm py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[12px] font-label-md">
                Stock: {product.stock_quantity} {product.unit || 'pieces'}
              </span>
              <span
                className={`px-sm py-0.5 rounded-full text-[12px] font-label-md ${
                  product.is_active === false ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/20 text-secondary'
                }`}
              >
                {product.is_active === false ? 'Inactive' : 'Active'}
              </span>
            </div>
          </div>
        </section>

        <Section icon="inventory_2" title="Basic Info" description="What this product is and how it's sold.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <ReadField label="Product Name" value={product.name} className="md:col-span-2" />
            <ReadField label="Category" value={product.category} />
            <ReadField label="Sub-category" value={product.sub_category} />
            <ReadField label="Selling Unit" value={product.unit} />
            <ReadField label="Piece Barcode" value={product.piece_barcode} />
          </div>
        </Section>

        {hasBoxPacking && (
          <Section icon="package_2" title="Box / Pack Configuration" description="This product also arrives in boxes.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <ReadField label="Box Barcode / QR" value={product.box_barcode} />
              <ReadField label="Pieces per Box" value={product.pieces_per_box} />
            </div>
          </Section>
        )}

        <Section icon="calendar_month" title="Expiry & Batch" description="Batch and expiry tracking.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <ReadField label="Current Stock Quantity" value={product.stock_quantity} />
            {hasExpiry && (
              <>
                <ReadField label="Expiry Date" value={product.expiry_date} />
                <ReadField label="Batch Received Date" value={product.batch_received_date} />
              </>
            )}
          </div>
        </Section>

        <Section icon="payments" title="Pricing" description="What it costs you, and what you sell it for.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <ReadField label={`Cost Price per piece (${currency})`} value={product.cost_price} />
            <ReadField label={`Selling Price per piece (${currency})`} value={product.price} />
            <ReadField label="Tax %" value={product.tax_percent} />
          </div>
        </Section>

        <Section icon="notifications" title="Stock Alerts" description="When staff get warned.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <ReadField label="Minimum Stock Alert" value={product.low_stock_threshold} />
            {hasExpiry && <ReadField label="Expiry Alert (days before)" value={product.expiry_alert_days} />}
          </div>
        </Section>
      </div>
    </main>
  )
}
