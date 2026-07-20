export default function Icon({ name, className = '', fill = false, style }) {
  return (
    <span className={`material-symbols-outlined${fill ? ' fill' : ''} ${className}`} style={style}>
      {name}
    </span>
  )
}
