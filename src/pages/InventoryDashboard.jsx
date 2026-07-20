import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import MobileFAB from '../components/layout/MobileFAB'
import Icon from '../components/common/Icon'
import SummaryCards from '../components/inventory/SummaryCards'
import InventoryTable from '../components/inventory/InventoryTable'
import AdjustStockModal from '../components/inventory/AdjustStockModal'
import StockHistoryModal from '../components/inventory/StockHistoryModal'
import ProductQuickViewModal from '../components/inventory/ProductQuickViewModal'
import ReorderModal from '../components/inventory/ReorderModal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { useProducts } from '../hooks/useProducts'
import { useSales } from '../hooks/useSales'
import { useSupplierOrders } from '../hooks/useSupplierOrders'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

const PAGE_SIZE = 8

export default function InventoryDashboard() {
  const { products, loading, error, deleteProduct, adjustStock } = useProducts()
  const { sales } = useSales()
  const { addOrIncrementItem } = useSupplierOrders()
  const { showToast } = useToast()
  const { profile, isManager } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [stockFilter, setStockFilter] = useState(null)
  const [page, setPage] = useState(1)
  const [summaryOpen, setSummaryOpen] = useState(false)

  const [adjustTarget, setAdjustTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [quickViewTarget, setQuickViewTarget] = useState(null)
  const [reorderTarget, setReorderTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return ['All', ...unique]
  }, [products])

  const isExpiringSoon = (p) => {
    if (!p.expiry_date) return false
    const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const alertDays = p.expiry_alert_days ?? 3
    return daysLeft >= 0 && daysLeft <= alertDays
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products
      .filter((p) => {
        if (activeCategory !== 'All' && p.category !== activeCategory) return false
        if (stockFilter === 'low' && !(p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold)) return false
        if (stockFilter === 'out' && p.stock_quantity > 0) return false
        if (stockFilter === 'expiring' && !isExpiringSoon(p)) return false
        if (query) {
          const matchesName = p.name.toLowerCase().includes(query)
          const matchesCategory = p.category?.toLowerCase().includes(query)
          if (!matchesName && !matchesCategory) return false
        }
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, activeCategory, stockFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const lowStockCount = useMemo(
    () => products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_threshold).length,
    [products],
  )

  const outOfStockCount = useMemo(() => products.filter((p) => p.stock_quantity <= 0).length, [products])

  const expiringSoonCount = useMemo(() => products.filter(isExpiringSoon).length, [products])

  const newToday = useMemo(() => {
    const today = new Date().toDateString()
    return products.filter((p) => p.created_at && new Date(p.created_at).toDateString() === today).length
  }, [products])

  const recentSalesTotal = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return sales
      .filter((s) => new Date(s.created_at).getTime() >= startOfToday)
      .reduce((sum, s) => sum + Number(s.total_amount), 0)
  }, [sales])

  const navItems = categories.map((cat) => ({
    label: cat,
    active: activeCategory === cat,
    onClick: () => {
      setActiveCategory(cat)
      setPage(1)
    },
  }))

  const handleFilterSelect = (type) => {
    setStockFilter((current) => (current === type ? null : type))
    setPage(1)
  }

  const handleAddProduct = () => {
    navigate('/products/add')
  }

  const handleDeleteProduct = (product) => {
    setDeleteTarget(product)
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteProduct(deleteTarget.id)
    setDeleting(false)
    if (result.success) {
      showToast('Product removed.')
      setDeleteTarget(null)
    } else {
      showToast(result.message || 'Could not delete product.', 'error')
    }
  }

  const handleAdjustSubmit = async (change, changeType, note) => {
    const result = await adjustStock(adjustTarget.id, change, changeType, note, profile?.full_name)
    if (result.success) {
      showToast(`Stock updated for ${adjustTarget.name}.`)
      setAdjustTarget(null)
    } else {
      showToast(result.message || 'Could not update stock.', 'error')
    }
  }

  const handleReorderSubmit = async (supplierId, productId, quantity) => {
    const result = await addOrIncrementItem(supplierId, productId, quantity)
    if (result.success) {
      showToast('Added to next order.')
      setReorderTarget(null)
    } else {
      showToast(result.message || 'Could not add to next order.', 'error')
    }
  }

  const handleExportCsv = () => {
    const rows = filteredProducts.map((p) => ({
      name: p.name,
      category: p.category,
      unit: p.unit,
      stock_quantity: p.stock_quantity,
      low_stock_threshold: p.low_stock_threshold,
      price: p.price,
      cost_price: p.cost_price,
      batch_id: p.batch_id,
      expiry_date: p.expiry_date,
    }))
    downloadCsv('inventory-export.csv', rows)
  }

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader
          navItems={navItems}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          searchPlaceholder="Search Inventory..."
        />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm">
          {!isSupabaseConfigured && (
            <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md mb-sm">
              Supabase isn&apos;t configured yet. Add your project URL and anon key to <code>.env</code> and restart the dev
              server to load real inventory data.
            </div>
          )}
          {error && <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md mb-sm">{error}</div>}

          {summaryOpen ? (
            <div className="relative space-y-sm mb-sm">
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                aria-label="Hide summary"
                className="absolute -top-2 -right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-primary text-on-primary shadow-md hover:scale-110 active:scale-95 transition-all"
              >
                <Icon name="close" className="text-[16px]" />
              </button>
              <SummaryCards
                totalProducts={products.length}
                newToday={newToday}
                lowStockCount={lowStockCount}
                outOfStockCount={outOfStockCount}
                expiringSoonCount={expiringSoonCount}
                recentSalesTotal={recentSalesTotal}
                activeFilter={stockFilter}
                onFilterSelect={handleFilterSelect}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex items-center gap-xs px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
                >
                  <Icon name="download" className="text-[18px]" />
                  Export CSV
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              aria-label="Show summary"
              className="relative flex items-center justify-center w-full h-6 my-xs group"
            >
              <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-primary group-hover:bg-primary/70 transition-all" />
              <span className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-on-primary shadow-md group-hover:scale-110 transition-all">
                <Icon name="expand_more" className="text-[16px]" />
              </span>
            </button>
          )}

          <InventoryTable
            products={pagedProducts}
            isManager={isManager}
            onAddProduct={handleAddProduct}
            stockFilter={stockFilter}
            onFilterChange={handleFilterSelect}
            onAdjustStock={setAdjustTarget}
            onHistory={setHistoryTarget}
            onDelete={handleDeleteProduct}
            onQuickView={setQuickViewTarget}
            pagination={
              !loading
                ? {
                    page: currentPage,
                    totalPages,
                    totalItems: filteredProducts.length,
                    pageSize: PAGE_SIZE,
                    onPageChange: setPage,
                  }
                : null
            }
          />
        </div>

        <Footer />
      </main>

      {isManager && <MobileFAB onClick={handleAddProduct} label="Add product" />}

      <AdjustStockModal
        open={Boolean(adjustTarget)}
        product={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSubmit={handleAdjustSubmit}
      />
      <StockHistoryModal open={Boolean(historyTarget)} product={historyTarget} onClose={() => setHistoryTarget(null)} />
      <ProductQuickViewModal
        open={Boolean(quickViewTarget)}
        product={quickViewTarget}
        isManager={isManager}
        onClose={() => setQuickViewTarget(null)}
        onReorder={setReorderTarget}
      />
      <ReorderModal
        open={Boolean(reorderTarget)}
        product={reorderTarget}
        onBack={() => setReorderTarget(null)}
        onSubmit={handleReorderSubmit}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove product?"
        message={deleteTarget && `"${deleteTarget.name}" will be removed from inventory. This can't be undone.`}
        confirmLabel="Remove"
        danger
        submitting={deleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  )
}
