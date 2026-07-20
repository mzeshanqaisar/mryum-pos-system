import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'

export default function ProductGrid({ products, onAddToCart }) {
  const { currency } = useSettings()

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-md text-on-surface-variant gap-sm">
        <Icon name="search_off" className="text-[48px] opacity-40" />
        <p className="font-body-md">No products match your search.</p>
      </div>
    )
  }

  return (
    <section className="bg-surface-container-lowest rounded-[32px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Product Name
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Category
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                Stock
              </th>
              <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {products.map((product) => {
              const outOfStock = product.stock_quantity <= 0
              return (
                <tr
                  key={product.id}
                  onClick={() => !outOfStock && onAddToCart(product)}
                  className={`group transition-colors ${
                    outOfStock ? 'opacity-50 pointer-events-none' : 'hover:bg-secondary-container/5 cursor-pointer'
                  }`}
                >
                  <td className="px-lg py-sm">
                    <div className="flex items-center gap-md">
                      <div className="w-12 h-12 rounded-lg bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
                        {product.image_url ? (
                          <img className="w-full h-full object-cover" src={product.image_url} alt={product.name} />
                        ) : (
                          <Icon name="bakery_dining" className="text-on-surface-variant/40" />
                        )}
                      </div>
                      <p className="font-body-md font-bold text-primary">{product.name}</p>
                    </div>
                  </td>
                  <td className="px-lg py-sm">
                    <span className="px-sm py-1 bg-surface-container text-on-surface-variant rounded-full text-label-sm font-label-sm">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-lg py-sm">
                    {outOfStock ? (
                      <span className="text-[12px] font-bold text-error">Out of Stock</span>
                    ) : (
                      <span className="text-[12px] text-on-surface-variant">
                        {product.stock_quantity} {product.unit || 'units'} left
                      </span>
                    )}
                  </td>
                  <td className="px-lg py-sm font-body-md text-on-surface font-semibold text-right">
                    {currency}
                    {Number(product.price).toFixed(2)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
