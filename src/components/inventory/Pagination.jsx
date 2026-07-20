import Icon from '../common/Icon'

export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalItems)

  const pageNumbers = []
  for (let p = 1; p <= totalPages; p += 1) pageNumbers.push(p)

  return (
    <div className="px-lg py-md bg-surface-container-low/30 border-t border-outline-variant/10 flex flex-col sm:flex-row justify-between items-center gap-md">
      <p className="text-label-sm text-on-surface-variant">
        Showing {start}-{end} of {totalItems} products
      </p>
      <div className="flex gap-xs flex-wrap justify-center">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/20 text-secondary hover:bg-surface-container transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Icon name="chevron_left" />
        </button>
        {pageNumbers.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={
              p === page
                ? 'w-10 h-10 flex items-center justify-center rounded-lg bg-secondary text-on-secondary font-bold shadow-sm'
                : 'w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/20 text-secondary hover:bg-surface-container transition-all'
            }
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages || totalPages === 0}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant/20 text-secondary hover:bg-surface-container transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  )
}
