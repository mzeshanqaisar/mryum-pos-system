import { createPortal } from 'react-dom'
import Icon from '../common/Icon'
import { useSettings } from '../../context/SettingsContext'

function nameLines(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  for (let i = 0; i < words.length; i += 2) {
    lines.push(words.slice(i, i + 2).join(' '))
  }
  return lines.length ? lines : ['']
}

export default function ReceiptModal({ open, receipt, onClose }) {
  const { settings, currency } = useSettings()

  if (!open || !receipt) return null

  const paymentLabel = receipt.paymentMethod === 'credit' ? 'Udhar (Credit)' : 'Cash'
  const itemDiscountTotal = Number(receipt.itemDiscountTotal || 0)
  const discount = Number(receipt.discount || 0) + itemDiscountTotal

  const receiptText = [
    settings.store_name || 'Mr YUM Bakers And General Store',
    `Date: ${new Date(receipt.createdAt).toLocaleString()}`,
    `Staff: ${receipt.staffName}`,
    receipt.customerName ? `Customer: ${receipt.customerName}` : null,
    `Payment: ${paymentLabel}`,
    '',
    ...receipt.items.map((i) => {
      const line = `${i.quantity} x ${i.product.name} @ ${currency}${i.product.price.toFixed(2)} = ${currency}${(i.quantity * i.product.price).toFixed(2)}`
      return i.discount > 0 ? `${line} (-${currency}${Number(i.discount).toFixed(2)} discount)` : line
    }),
    '',
    `Subtotal: ${currency}${receipt.subtotal.toFixed(2)}`,
    discount > 0 ? `Discount: -${currency}${discount.toFixed(2)}` : null,
    `Tax: ${currency}${receipt.tax.toFixed(2)}`,
    `Total: ${currency}${receipt.total.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const mailtoHref = `mailto:?subject=${encodeURIComponent('Your Receipt — ' + (settings.store_name || 'Mr YUM Bakers'))}&body=${encodeURIComponent(receiptText)}`

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center pt-24 bg-on-background/40 backdrop-blur-sm px-margin-mobile print:bg-transparent print:static"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-container-lowest rounded-[24px] shadow-2xl border border-outline-variant/10 max-h-[80vh] overflow-y-auto print:shadow-none print:border-0 print:max-h-none"
      >
        <div id="receipt-content" className="px-md pt-md pb-lg font-body-md text-on-surface">
          <div className="text-center mb-md">
            <h3 className="font-headline-md text-headline-md text-primary">{settings.store_name || 'Mr YUM Bakers'}</h3>
            <p className="text-[12px] text-on-surface-variant">{new Date(receipt.createdAt).toLocaleString()}</p>
            {receipt.status === 'refunded' && (
              <span className="inline-block mt-xs px-sm py-0.5 rounded-full text-label-sm font-label-sm bg-error-container text-on-error-container">
                Refunded
              </span>
            )}
          </div>

          <div className="text-[13px] text-on-surface-variant mb-sm space-y-0.5">
            <p>Staff: {receipt.staffName}</p>
            {receipt.customerName && <p>Customer: {receipt.customerName}</p>}
            <p>Payment: {paymentLabel}</p>
          </div>

          <div className="border-t border-dashed border-outline-variant/40 my-sm" />

          <div className="space-y-1.5">
            {receipt.items.map((item) => {
              const lineTotal = item.quantity * item.product.price
              const netTotal = lineTotal - (item.discount || 0)
              const hasDiscount = item.discount > 0
              const newPerPiece = hasDiscount ? item.product.price - item.discount / item.quantity : item.product.price
              return (
                <div key={item.product.id} className="grid grid-cols-[1fr_auto_auto] gap-x-sm items-start text-[13px]">
                  <span className="min-w-0 leading-tight break-all">
                    {nameLines(item.product.name).map((line, i) => (
                      <span key={i} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                  <span className="text-center whitespace-nowrap leading-tight px-xs">
                    {hasDiscount && (
                      <span className="block text-error line-through text-[11px]">
                        {currency}
                        {item.product.price.toFixed(2)}
                      </span>
                    )}
                    <span className="block">
                      {currency}
                      {newPerPiece.toFixed(2)} x {item.quantity}
                    </span>
                  </span>
                  <span className="text-right whitespace-nowrap leading-tight">
                    {hasDiscount && (
                      <span className="block text-error line-through text-[11px]">
                        {currency}
                        {lineTotal.toFixed(2)}
                      </span>
                    )}
                    <span className="block font-bold text-primary">
                      {currency}
                      {netTotal.toFixed(2)}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>

          <div className="border-t border-dashed border-outline-variant/40 my-sm" />

          <div className="space-y-1 text-[13px]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>
                {currency}
                {receipt.subtotal.toFixed(2)}
              </span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-error">
                <span>Discount</span>
                <span>
                  -{currency}
                  {discount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax</span>
              <span>
                {currency}
                {receipt.tax.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-headline-md text-headline-md text-primary pt-1">
              <span>Total</span>
              <span>
                {currency}
                {receipt.total.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-center text-[12px] text-on-surface-variant mt-md">Thank you for your order!</p>
        </div>

        <div className="p-lg pt-0 flex gap-sm print:hidden">
          <a
            href={mailtoHref}
            className="flex-1 flex items-center justify-center gap-xs px-md py-sm bg-surface-container-high text-on-surface rounded-xl font-label-md text-label-md hover:bg-surface-container-highest transition-all"
          >
            <Icon name="mail" className="text-[18px]" />
            Email
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
          >
            <Icon name="print" className="text-[18px]" />
            Print
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
