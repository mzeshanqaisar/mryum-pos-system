import Icon from '../common/Icon'
import { useStockMovements } from '../../hooks/useStockMovements'

const TYPE_LABELS = {
  sale: 'Sale',
  restock: 'Restock',
  adjustment: 'Correction',
  waste: 'Waste / Damage',
  return: 'Refund / Return',
  purchase_order: 'Purchase Order',
  initial: 'Initial Stock',
}

export default function StockHistoryModal({ open, product, onClose }) {
  const { movements, loading } = useStockMovements(open ? product?.id : null)

  if (!open || !product) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-on-background/40 backdrop-blur-sm px-margin-mobile">
      <div className="w-full max-w-lg bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 max-h-[85vh] overflow-y-auto">
        <div className="px-lg py-md border-b border-outline-variant/10 flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-primary">Stock History</h2>
            <p className="text-on-surface-variant font-body-md text-[14px]">{product.name}</p>
          </div>
          <button type="button" onClick={onClose} className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant">
            <Icon name="close" />
          </button>
        </div>
        <div className="p-lg">
          {loading && <p className="text-on-surface-variant font-body-md">Loading…</p>}
          {!loading && movements.length === 0 && (
            <p className="text-on-surface-variant font-body-md">No movements recorded yet.</p>
          )}
          <div className="space-y-sm">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-sm rounded-xl bg-surface-container-low/50">
                <div>
                  <p className="font-body-md font-bold text-primary">{TYPE_LABELS[m.change_type] || m.change_type}</p>
                  <p className="text-[12px] text-on-surface-variant">
                    {new Date(m.created_at).toLocaleString()} {m.staff_name ? `· ${m.staff_name}` : ''}
                  </p>
                  {m.note && <p className="text-[12px] text-on-surface-variant italic">{m.note}</p>}
                </div>
                <div className={`font-headline-md text-headline-md ${m.quantity_change >= 0 ? 'text-secondary' : 'text-error'}`}>
                  {m.quantity_change >= 0 ? '+' : ''}
                  {m.quantity_change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
