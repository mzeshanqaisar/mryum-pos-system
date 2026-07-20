import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopHeader from '../components/layout/TopHeader'
import Footer from '../components/layout/Footer'
import ProductGrid from '../components/billing/ProductGrid'
import CartPanel from '../components/billing/CartPanel'
import Icon from '../components/common/Icon'
import { useProducts } from '../hooks/useProducts'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabaseClient'

export default function Billing() {
  const { products, loading, error } = useProducts()
  const { addToCart, itemCount } = useCart()
  const { isManager } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [cartOpenMobile, setCartOpenMobile] = useState(false)

  const categories = useMemo(() => {
    const unique = Array.from(new Set(products.map((p) => p.category)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return ['All', ...unique]
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((p) => {
      if (activeCategory !== 'All' && p.category !== activeCategory) return false
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query)
        const matchesCategory = p.category?.toLowerCase().includes(query)
        if (!matchesName && !matchesCategory) return false
      }
      return true
    })
  }, [products, activeCategory, search])

  const navItems = categories.map((cat) => ({
    label: cat,
    active: activeCategory === cat,
    onClick: () => setActiveCategory(cat),
  }))

  return (
    <>
      <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
        <TopHeader navItems={navItems} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search products..." />

        <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-sm space-y-sm">
          {!isSupabaseConfigured && (
            <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md">
              Supabase isn&apos;t configured yet. Add your project URL and anon key to <code>.env</code> and restart the dev
              server to load real products.
            </div>
          )}
          {error && <div className="p-md rounded-xl bg-error-container text-on-error-container font-body-md">{error}</div>}

          <div className="flex flex-col xl:flex-row gap-gutter items-start">
            <section className="flex-1 min-w-0 py-md">
              <div className="mb-sm flex items-start justify-between gap-md">
                <div>
                  <h2 className="font-headline-md text-headline-md text-primary">Register</h2>
                  <p className="text-on-surface-variant font-body-md">Tap a product to add it to the current order.</p>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => navigate('/products/restock')}
                    className="flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md shrink-0"
                  >
                    <Icon name="package_2" className="text-[18px]" />
                    Restock
                  </button>
                )}
              </div>
              {loading ? (
                <p className="text-on-surface-variant font-body-md py-md text-center">Loading products…</p>
              ) : (
                <ProductGrid products={filteredProducts} onAddToCart={addToCart} />
              )}
            </section>

            <div className="hidden xl:block">
              <CartPanel />
            </div>
          </div>
        </div>

        <Footer />
      </main>

      <div className="xl:hidden">
        {cartOpenMobile && (
          <div
            className="fixed inset-0 z-[80] bg-on-background/40 backdrop-blur-sm flex items-end"
            onClick={() => setCartOpenMobile(false)}
          >
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <CartPanel />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCartOpenMobile(true)}
          aria-label="Open cart"
          className="fixed bottom-md right-md w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
        >
          <Icon name="shopping_cart" className="text-[28px]" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center rounded-full bg-secondary text-on-secondary text-[11px] font-bold">
              {itemCount}
            </span>
          )}
        </button>
      </div>
    </>
  )
}
