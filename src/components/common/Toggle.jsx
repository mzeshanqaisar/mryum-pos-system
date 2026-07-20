export default function Toggle({ checked, onChange, label, description, id }) {
  return (
    <div className="flex items-center justify-between gap-md">
      {(label || description) && (
        <div className="min-w-0">
          {label && <p className="font-label-md text-label-md text-on-surface">{label}</p>}
          {description && <p className="text-on-surface-variant font-body-md text-[12px]">{description}</p>}
        </div>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${
          checked ? 'bg-primary' : 'bg-surface-container-high'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
