import Icon from '../common/Icon'

export default function MobileFAB({ icon = 'add', onClick, label = 'Quick action' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="lg:hidden fixed bottom-md right-md w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
    >
      <Icon name={icon} className="text-[32px]" />
    </button>
  )
}
