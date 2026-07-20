// Every hook module that calls registerSyncTable() must be imported here — not
// just wherever its page happens to live. registerSyncTable() runs at module
// load time, so a table is only known to the sync engine once its hook module
// has been imported at least once. Without this file, a table whose hook is
// only ever imported by one page (e.g. useSales.js, imported only by Reports)
// would never be registered — and therefore never synced in the background —
// for a session that never visits that page. A cashier who only opens Billing
// all day would end up with offline sales stuck 'pending' forever, since
// nothing would ever have told the sync engine 'sales' exists.
//
// Import order here is also sync ORDER (sync.js's registry is a Map, iterated
// in insertion order) — and it matters. Tables with a foreign key should be
// registered after whatever they reference, so a same-pass push has a chance
// to succeed both sides instead of always needing a second pass:
//   suppliers, categories, customers  — no dependencies, go first
//   stock_movements                  — references products, but see note below
//   products                         — references suppliers
//   app_settings                     — no dependencies
//   purchase_orders/items            — reference suppliers + products
//   sales, refunds                   — reference products/customers, and an
//                                       existing (already-synced) sale
//   credit_transactions              — references customers + sales
// Getting this wrong doesn't corrupt anything (a failed push just retries next
// pass once its dependency has landed — markPushFailure's attempt counter is
// the actual safety net, this ordering is just an optimization), but it did
// once cause every offline sale referencing a same-session offline customer to
// 409 forever, since sales was registered — and therefore pushed — before
// customers ever got the chance to.
//
// stock_movements is registered ahead of products here despite depending on
// it, because useProducts.js itself imports useStockMovements.js (for
// adjustStock/bulkRestock) — ES modules execute their imports before their
// own body, so that dependency runs first no matter where it's listed. In
// practice this only costs one extra failed attempt (out of MAX_SYNC_ATTEMPTS)
// in the narrow case of restocking a product that was *also* created offline
// in the same session — it resolves on the very next pass once products has
// synced. Listed explicitly here anyway so the real order isn't a surprise.
import './../hooks/useStockMovements'
import './../hooks/useSuppliers'
import './../hooks/useCategories'
import './../hooks/useCustomers'
import './../hooks/useProducts'
import './../context/SettingsContext'
import './../hooks/useSupplierOrders'
import './../hooks/useSales'
import './../hooks/useCreditTransactions'
