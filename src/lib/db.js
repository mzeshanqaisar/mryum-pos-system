import Dexie from 'dexie'

// The local-first store. One IndexedDB database for the whole app — each
// Supabase table gets a mirrored local table here as it's migrated over.
// Every local table carries the same fields as its Supabase counterpart plus
// two bookkeeping fields: `updated_at` and `sync_status` ('pending' | 'synced').
// Tables that support deleting also carry a `deleted` tombstone flag instead
// of ever actually removing the local row before it's synced.
export const db = new Dexie('mryum_local')

db.version(2).stores({
  products: 'id, sync_status, updated_at',
  sales: 'id, sync_status, updated_at, created_at, status, customer_id',
  customers: 'id, sync_status, updated_at, deleted',
  credit_transactions: 'id, sync_status, updated_at, customer_id, created_at',
  app_settings: 'id, sync_status, updated_at',
  categories: 'id, sync_status, updated_at, name',
  suppliers: 'id, sync_status, updated_at, deleted',
  purchase_orders: 'id, sync_status, updated_at, supplier_id, status',
  purchase_order_items: 'id, sync_status, updated_at, purchase_order_id',
  staff_profiles: 'id, sync_status, updated_at',
  stock_movements: 'id, sync_status, updated_at, product_id, created_at',
  refunds: 'id, sync_status, updated_at, sale_id',
})

// v3: index credit_transactions by sale_id — needed so a synced sale can find
// and resolve its locally-echoed 'charge' record (see CartContext.jsx /
// useSales.js) without a full table scan.
db.version(3).stores({
  credit_transactions: 'id, sync_status, updated_at, customer_id, created_at, sale_id',
})

// v4: device_sessions — a per-account mirror of just enough of the last
// network-verified Supabase session to recognize and sign that same account
// back in with zero connectivity (see lib/offlineAuth.js). Keyed by user_id
// (not a single slot) so more than one staff member can have a cached,
// offline-usable login on the same shared shop device.
db.version(4).stores({
  device_sessions: 'user_id, email, last_verified_at',
})

export function newId() {
  return crypto.randomUUID()
}

export function nowIso() {
  return new Date().toISOString()
}
