import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'

function Card({ icon, iconClass, bgClass, label, value, valueClass, tag, tagClass, onClick, active }) {
  const clickable = Boolean(onClick)
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={`p-md rounded-2xl bg-surface-container-lowest border pill-glow transition-all hover:-translate-y-0.5 ${
        clickable ? 'cursor-pointer' : ''
      } ${active ? 'border-primary ring-2 ring-primary/40' : 'border-outline-variant/10'}`}
    >
      <div className="flex justify-between items-start mb-sm">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgClass} ${iconClass}`}>
          <Icon name={icon} className="text-[18px]" />
        </div>
        {tag && <span className={`text-[10px] font-label-sm px-xs py-0.5 rounded-full ${tagClass}`}>{tag}</span>}
      </div>
      <h3 className="font-label-md text-[10px] text-on-surface-variant uppercase tracking-widest mb-0.5">{label}</h3>
      <p className={`font-headline-md text-headline-md ${valueClass}`}>{value}</p>
    </div>
  )
}

export default function SummaryCards({
  totalProducts,
  newToday,
  lowStockCount,
  outOfStockCount,
  expiringSoonCount,
  recentSalesTotal,
  activeFilter,
  onFilterSelect,
}) {
  const { currency } = useSettings()
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-sm">
      <Card
        icon="inventory"
        bgClass="bg-secondary/10"
        iconClass="text-secondary"
        label="Total Products"
        value={totalProducts.toLocaleString()}
        valueClass="text-primary"
        tag={`+${newToday} today`}
        tagClass="bg-secondary/5 text-secondary"
      />
      <Card
        icon="warning"
        bgClass="bg-tertiary/10"
        iconClass="text-tertiary"
        label="Low Stock"
        value={lowStockCount}
        valueClass="text-tertiary"
        tag={lowStockCount > 0 ? 'Action' : 'Clear'}
        tagClass={lowStockCount > 0 ? 'bg-error-container text-on-error-container' : 'bg-secondary/5 text-secondary'}
        onClick={() => onFilterSelect?.('low')}
        active={activeFilter === 'low'}
      />
      <Card
        icon="production_quantity_limits"
        bgClass="bg-error/10"
        iconClass="text-error"
        label="Out of Stock"
        value={outOfStockCount}
        valueClass="text-error"
        onClick={() => onFilterSelect?.('out')}
        active={activeFilter === 'out'}
      />
      <Card
        icon="event_busy"
        bgClass="bg-tertiary/10"
        iconClass="text-tertiary"
        label="Expiring Soon"
        value={expiringSoonCount}
        valueClass="text-tertiary"
        onClick={() => onFilterSelect?.('expiring')}
        active={activeFilter === 'expiring'}
      />
      <Card
        icon="trending_up"
        bgClass="bg-primary/10"
        iconClass="text-primary"
        label="Recent Sales"
        value={`${currency}${recentSalesTotal.toFixed(2)}`}
        valueClass="text-primary"
        tag="Today"
        tagClass="bg-primary/5 text-primary"
      />
    </section>
  )
}
