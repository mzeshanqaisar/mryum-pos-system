const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Order day is a recurring weekday name (e.g. "Monday"), not a specific date —
// this returns how many days from today until its next occurrence (0 = today).
export function daysUntilWeekday(dayName) {
  if (!dayName) return null
  const targetIndex = WEEKDAYS.findIndex((d) => d.toLowerCase() === dayName.toLowerCase())
  if (targetIndex === -1) return null
  const todayIndex = new Date().getDay()
  return (targetIndex - todayIndex + 7) % 7
}

export function buildSupplierSummaries(suppliers, products) {
  return suppliers.map((supplier) => {
    const supplierProducts = products.filter((p) => p.supplier_id === supplier.id)
    const outOfStock = supplierProducts.filter((p) => p.stock_quantity <= 0)
    const lowStock = supplierProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold ?? 0))
    const daysUntilOrder = daysUntilWeekday(supplier.order_day)
    // "A day before order day" — fires the day before and on the day itself.
    const hasOrderDayAlert = daysUntilOrder !== null && daysUntilOrder <= 1
    const hasStockAlert = outOfStock.length > 0 || lowStock.length > 0
    return {
      supplier,
      outOfStock,
      lowStock,
      daysUntilOrder,
      hasStockAlert,
      hasOrderDayAlert,
      alertCount: outOfStock.length + lowStock.length + (hasOrderDayAlert ? 1 : 0),
    }
  })
}

export function buildAlertFeed(summaries) {
  const alerts = []
  summaries.forEach(({ supplier, outOfStock, lowStock, daysUntilOrder, hasOrderDayAlert }) => {
    outOfStock.forEach((p) =>
      alerts.push({
        id: `out-${p.id}`,
        type: 'out_of_stock',
        severity: 'error',
        supplierId: supplier.id,
        supplierName: supplier.name,
        productId: p.id,
        productName: p.name,
        message: `${p.name} is out of stock`,
      }),
    )
    lowStock.forEach((p) =>
      alerts.push({
        id: `low-${p.id}`,
        type: 'low_stock',
        severity: 'warning',
        supplierId: supplier.id,
        supplierName: supplier.name,
        productId: p.id,
        productName: p.name,
        message: `${p.name} is running low (${p.stock_quantity} left)`,
      }),
    )
    if (hasOrderDayAlert) {
      alerts.push({
        id: `order-${supplier.id}`,
        type: 'order_day',
        severity: 'info',
        supplierId: supplier.id,
        supplierName: supplier.name,
        daysUntilOrder,
        message:
          daysUntilOrder === 0
            ? `Order day for ${supplier.name} is today — review what to add.`
            : `Order day for ${supplier.name} is tomorrow — review what to add.`,
      })
    }
  })
  return alerts
}
