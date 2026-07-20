import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Icon from '../components/common/Icon'
import { useProducts } from '../hooks/useProducts'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const today = () => new Date().toISOString().slice(0, 10)

function Stepper({ value, onChange, min = 1 }) {
  const handleSet = (next) => onChange(Math.max(min, next))
  return (
    <div className="flex items-center gap-sm">
      <button
        type="button"
        onClick={() => handleSet(Number(value || min) - 1)}
        className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-95 transition-all shrink-0"
        aria-label="Decrease"
      >
        <Icon name="remove" className="text-[22px]" />
      </button>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => handleSet(Number(e.target.value) || min)}
        className="w-full h-12 text-center bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-headline-md text-headline-md text-primary"
      />
      <button
        type="button"
        onClick={() => handleSet(Number(value || min) + 1)}
        className="w-12 h-12 flex items-center justify-center rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-95 transition-all shrink-0"
        aria-label="Increase"
      >
        <Icon name="add" className="text-[22px]" />
      </button>
    </div>
  )
}

export default function Restock() {
  const navigate = useNavigate()
  const { products, bulkRestock } = useProducts()
  const { showToast } = useToast()
  const { profile } = useAuth()

  const [barcode, setBarcode] = useState('')
  const [nameQuery, setNameQuery] = useState('')
  const [nameMenuOpen, setNameMenuOpen] = useState(false)

  const [scannedProduct, setScannedProduct] = useState(null)
  const [scanType, setScanType] = useState('piece')
  const [unrecognized, setUnrecognized] = useState(null)
  const [cardVisible, setCardVisible] = useState(false)

  const [boxCount, setBoxCount] = useState(1)
  const [pieceQty, setPieceQty] = useState(1)
  const [expiryDate, setExpiryDate] = useState('')
  const [batchReceivedDate, setBatchReceivedDate] = useState(today())
  const [costPrice, setCostPrice] = useState('')
  const [itemError, setItemError] = useState('')

  const [restockList, setRestockList] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  const barcodeRef = useRef(null)
  const nameFieldRef = useRef(null)

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (nameFieldRef.current && !nameFieldRef.current.contains(e.target)) setNameMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (scannedProduct) {
      setCardVisible(false)
      const t = setTimeout(() => setCardVisible(true), 20)
      return () => clearTimeout(t)
    }
    setCardVisible(false)
    return undefined
  }, [scannedProduct])

  const hasBoxPacking = (p) => Number(p?.pieces_per_box) > 1
  const hasExpiry = (p) => Boolean(p?.expiry_date)

  const selectProduct = (product, type) => {
    setScannedProduct(product)
    setScanType(hasBoxPacking(product) ? type : 'piece')
    setUnrecognized(null)
    setBoxCount(1)
    setPieceQty(1)
    setExpiryDate('')
    setBatchReceivedDate(today())
    setCostPrice(product.cost_price ? String(product.cost_price) : '')
    setItemError('')
    setBarcode('')
    setNameQuery('')
    setNameMenuOpen(false)
    // TODO(native app): trigger a short success beep/vibration here once a
    // scanner/device bridge is available.
  }

  const handleBarcodeSubmit = (e) => {
    e.preventDefault()
    const code = barcode.trim()
    if (!code) return
    const boxMatch = products.find((p) => p.box_barcode && p.box_barcode === code)
    const pieceMatch = products.find((p) => p.piece_barcode && p.piece_barcode === code)
    if (boxMatch) {
      selectProduct(boxMatch, 'box')
    } else if (pieceMatch) {
      selectProduct(pieceMatch, 'piece')
    } else {
      setScannedProduct(null)
      setUnrecognized(code)
      setBarcode('')
    }
  }

  const nameMatches = useMemo(() => {
    const query = nameQuery.trim().toLowerCase()
    if (!query) return []
    return products.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8)
  }, [products, nameQuery])

  const piecesPerBox = Number(scannedProduct?.pieces_per_box) || 0
  const totalPieces = scanType === 'box' ? Number(boxCount || 0) * piecesPerBox : Number(pieceQty || 0)

  const resetScanState = () => {
    setScannedProduct(null)
    setUnrecognized(null)
    setBoxCount(1)
    setPieceQty(1)
    setExpiryDate('')
    setBatchReceivedDate(today())
    setCostPrice('')
    setItemError('')
    setBarcode('')
    barcodeRef.current?.focus()
  }

  const handleAddToList = () => {
    if (!scannedProduct) return
    if (totalPieces <= 0) {
      setItemError('Quantity must be greater than 0.')
      return
    }
    if (hasExpiry(scannedProduct) && !expiryDate) {
      setItemError('Expiry date is required for this product.')
      return
    }

    setRestockList((list) => [
      ...list,
      {
        id: `${scannedProduct.id}-${Date.now()}`,
        productId: scannedProduct.id,
        productName: scannedProduct.name,
        scanType,
        quantityAdded: totalPieces,
        expiryDate: hasExpiry(scannedProduct) ? expiryDate : null,
        batchReceivedDate: hasExpiry(scannedProduct) ? batchReceivedDate : null,
        costPrice: costPrice ? Number(costPrice) : null,
      },
    ])

    resetScanState()
  }

  const handleRemove = (id) => setRestockList((list) => list.filter((item) => item.id !== id))

  const totalPiecesInList = restockList.reduce((sum, item) => sum + item.quantityAdded, 0)

  const handleCancel = () => navigate('/inventory')

  const handleConfirm = async () => {
    if (restockList.length === 0) return
    setSubmitting(true)
    const payload = restockList.map((item) => ({
      product_id: item.productId,
      quantity_added: item.quantityAdded,
      expiry_date: item.expiryDate,
      batch_received_date: item.batchReceivedDate,
      cost_price: item.costPrice,
    }))
    const result = await bulkRestock(payload, profile?.full_name)
    setSubmitting(false)

    if (result.success) {
      setSaved(true)
      showToast(`Restock saved — ${restockList.length} product${restockList.length === 1 ? '' : 's'} updated.`)
      setTimeout(() => {
        setRestockList([])
        setSaved(false)
        resetScanState()
      }, 700)
    } else {
      showToast(result.message || 'Could not save restock.', 'error')
    }
  }

  const scanAccent =
    unrecognized ? 'error' : scanType === 'box' ? 'primary' : 'tertiary'

  return (
    <main className="flex-1 min-w-0 bg-surface grain-bg flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(61,36,25,0.05)] px-margin-mobile lg:px-margin-desktop py-sm flex items-center justify-between gap-md">
        <div className="flex items-center gap-sm min-w-0">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Back"
            className="p-base rounded-full hover:bg-surface-container-high text-on-surface-variant transition-all shrink-0"
          >
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <h1 className="font-headline-md text-headline-md text-primary truncate">Restock Inventory</h1>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all shrink-0"
        >
          Cancel
        </button>
      </header>

      <div className="flex-1 px-margin-mobile lg:px-margin-desktop pt-sm pb-40 space-y-md">
        <section className="bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 shadow-xl shadow-primary/5 p-lg space-y-sm">
          <form onSubmit={handleBarcodeSubmit} className="relative">
            <Icon
              name="barcode_scanner"
              className="absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[28px]"
            />
            <input
              ref={barcodeRef}
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan piece or box barcode..."
              autoFocus
              className="w-full h-16 pl-14 pr-md bg-surface-container-low border-2 border-outline-variant/30 rounded-2xl outline-none focus:ring-4 focus:ring-secondary/20 focus:border-secondary font-headline-md text-headline-md text-primary transition-all"
            />
          </form>

          <div className="relative" ref={nameFieldRef}>
            <p className="font-label-md text-label-md text-on-surface-variant mb-xs">Or search product by name</p>
            <div className="relative">
              <Icon name="search" className="absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[20px]" />
              <input
                value={nameQuery}
                onChange={(e) => {
                  setNameQuery(e.target.value)
                  setNameMenuOpen(true)
                }}
                onFocus={() => setNameMenuOpen(true)}
                placeholder="Type a product name…"
                className="w-full pl-xl pr-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
              />
            </div>
            {nameMenuOpen && nameMatches.length > 0 && (
              <div className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl">
                {nameMatches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProduct(p, hasBoxPacking(p) ? 'box' : 'piece')}
                    className="w-full text-left px-md py-sm text-body-md font-body-md text-on-surface hover:bg-secondary-container/10 flex items-center justify-between gap-sm"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-on-surface-variant text-[12px] shrink-0">{p.stock_quantity} in stock</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {unrecognized && (
          <section className="bg-error-container/20 border border-error/30 rounded-[24px] p-lg flex items-center gap-md">
            <div className="w-12 h-12 rounded-full bg-error-container flex items-center justify-center text-on-error-container shrink-0">
              <Icon name="error" className="text-[24px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-label-md text-label-md text-error">Barcode not recognized</p>
              <p className="text-on-surface-variant font-body-md text-[13px] truncate">"{unrecognized}" doesn't match any product.</p>
            </div>
            <Link
              to="/products/add"
              className="shrink-0 flex items-center gap-xs px-md py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
            >
              <Icon name="add" className="text-[18px]" />
              Add as New Product
            </Link>
          </section>
        )}

        {scannedProduct && (
          <section
            className={`bg-surface-container-lowest rounded-[24px] border shadow-xl p-lg space-y-md transition-all duration-300 ease-out ${
              cardVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            } ${scanAccent === 'primary' ? 'border-primary/30 shadow-primary/10' : 'border-tertiary/30 shadow-tertiary/10'}`}
          >
            <div className="flex items-center gap-md">
              <div className="w-16 h-16 rounded-xl bg-surface-container border border-outline-variant/20 overflow-hidden flex items-center justify-center shrink-0">
                {scannedProduct.image_url ? (
                  <img className="w-full h-full object-cover" src={scannedProduct.image_url} alt={scannedProduct.name} />
                ) : (
                  <Icon name="bakery_dining" className="text-on-surface-variant/40 text-[28px]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-headline-md text-headline-lg text-primary truncate">{scannedProduct.name}</h2>
                <span className="inline-block mt-0.5 px-sm py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[12px] font-label-md">
                  Current stock: {scannedProduct.stock_quantity} {scannedProduct.unit || 'pieces'}
                </span>
              </div>
            </div>

            {hasBoxPacking(scannedProduct) ? (
              <div className="flex rounded-xl border border-outline-variant/30 overflow-hidden w-fit">
                <button
                  type="button"
                  onClick={() => setScanType('box')}
                  className={`px-md py-sm font-label-md text-label-md transition-all flex items-center gap-xs ${
                    scanType === 'box' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  📦 Box scanned — 1 Box = {piecesPerBox} pieces
                </button>
                <button
                  type="button"
                  onClick={() => setScanType('piece')}
                  className={`px-md py-sm font-label-md text-label-md transition-all flex items-center gap-xs ${
                    scanType === 'piece' ? 'bg-tertiary text-on-tertiary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  🔹 Piece scanned
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-xs px-md py-sm rounded-xl bg-tertiary/10 text-tertiary font-label-md text-label-md w-fit">
                🔹 Piece scanned
              </span>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              {scanType === 'box' ? (
                <div className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Number of boxes</span>
                  <Stepper value={boxCount} onChange={setBoxCount} />
                  <span className="text-[13px] font-label-md text-primary">Total pieces to add: {totalPieces}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Quantity</span>
                  <Stepper value={pieceQty} onChange={setPieceQty} />
                </div>
              )}
            </div>

            {hasExpiry(scannedProduct) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md pt-sm border-t border-outline-variant/10">
                <label className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Expiry Date <span className="text-error">*</span>
                  </span>
                  <div className="relative">
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-md py-sm pr-10 bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
                    />
                    <Icon
                      name="calendar_month"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Batch Received Date</span>
                  <div className="relative">
                    <input
                      type="date"
                      value={batchReceivedDate}
                      onChange={(e) => setBatchReceivedDate(e.target.value)}
                      className="w-full px-md py-sm pr-10 bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
                    />
                    <Icon
                      name="calendar_month"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]"
                    />
                  </div>
                </label>
                <label className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface-variant">Cost Price (optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="px-md py-sm bg-surface-container-low border border-outline-variant/30 rounded-xl outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary font-body-md text-body-md text-on-surface"
                  />
                </label>
              </div>
            )}

            {itemError && <p className="text-[13px] text-error font-label-md">{itemError}</p>}

            <div className="flex justify-end gap-sm">
              <button
                type="button"
                onClick={resetScanState}
                className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleAddToList}
                className="flex items-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
              >
                <Icon name="playlist_add" className="text-[18px]" />
                Add to List
              </button>
            </div>
          </section>
        )}

        <section className="bg-surface-container-lowest rounded-[24px] border border-outline-variant/10 shadow-xl shadow-primary/5 overflow-hidden">
          <div className="px-lg py-sm border-b border-outline-variant/10 flex items-center justify-between gap-md">
            <h2 className="font-headline-md text-headline-md text-primary">Restock List</h2>
            <span className="px-sm py-1 rounded-full bg-secondary-container/20 text-secondary font-label-md text-label-sm">
              {restockList.length} item{restockList.length === 1 ? '' : 's'} added
            </span>
          </div>
          {restockList.length === 0 ? (
            <p className="text-on-surface-variant font-body-md text-center py-lg">Scan a product above to start adding to this restock.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Product
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Qty Added
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10">
                      Expiry
                    </th>
                    <th className="px-lg py-sm font-headline-md text-label-md text-on-surface-variant border-b border-outline-variant/10 text-right">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {restockList.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary-container/5 transition-colors">
                      <td className="px-lg py-sm font-body-md font-bold text-primary">{item.productName}</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{item.quantityAdded} pcs</td>
                      <td className="px-lg py-sm font-body-md text-on-surface-variant">{item.expiryDate || '—'}</td>
                      <td className="px-lg py-sm text-right">
                        <button
                          type="button"
                          onClick={() => handleRemove(item.id)}
                          className="p-base rounded-full hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-all"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="sticky bottom-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/10 px-margin-mobile lg:px-margin-desktop py-sm flex flex-col sm:flex-row items-center justify-between gap-sm shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
        <p className="font-label-md text-label-md text-on-surface-variant">
          {restockList.length} product{restockList.length === 1 ? '' : 's'}, {totalPiecesInList} total pieces will be added
        </p>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={handleCancel}
            className="px-md py-sm rounded-xl font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={restockList.length === 0 || submitting}
            className="flex items-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:pointer-events-none"
          >
            <Icon name={saved ? 'check_circle' : 'save'} className="text-[18px]" />
            {saved ? 'Saved' : submitting ? 'Saving…' : 'Confirm & Save Restock'}
          </button>
        </div>
      </div>
    </main>
  )
}
