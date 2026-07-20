# Mr YUM Bakers And General Store — POS

A full point-of-sale system for Mr YUM Bakers And General Store: staff accounts with roles, a
Register (billing) screen, an Inventory Dashboard with full audit trail, Suppliers & Purchase
Orders, Customers, and Sales Reports — backed by Supabase.

Built with:

- **React 19 + Vite** — frontend
- **Tailwind CSS** — styling, using the exact color/font/spacing tokens from the Stitch-generated design
- **Supabase** — Postgres database, Auth, Storage, auto-generated REST API, and row-level security
- **React Router** — client-side routing
- Material Symbols (Google Fonts) for icons, Playfair Display + Plus Jakarta Sans for type

---

## 1. Run it locally

### Prerequisites

- Node.js 18+ (you have Node v24, which is fine)
- A free [Supabase](https://supabase.com) account

### Install dependencies

```bash
npm install
```

### Connect Supabase (required before the app can show real data)

1. Go to [supabase.com](https://supabase.com) → **New project**. Pick any name/region and set a database password.
2. Once the project is ready, open **SQL Editor** → **New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql) from this repo, and click **Run**.
   This creates every table (products, sales, sale_items, staff_profiles, suppliers,
   purchase_orders, customers, refunds, stock_movements, app_settings), the RPC functions
   (`complete_sale`, `adjust_stock`, `refund_sale`, `receive_purchase_order`), role-based row-level
   security, and a `product-images` Storage bucket. It's safe to re-run any time you pull schema
   changes — every statement is idempotent.
3. Open **Authentication → Providers** and make sure **Email** sign-in is enabled (it is by
   default). Optionally turn off "Confirm email" under **Authentication → Settings** while you're
   testing locally, so new accounts can sign in immediately.
4. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
5. Open the `.env` file in this project and set:

   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   `.env` is gitignored, so your keys are never committed. `.env.example` is the template that's
   safe to share.

### Start the dev server

```bash
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**). You'll land on **Sign In**.

### Create your first account and make it a Manager

1. On the Sign In screen, click **"New staff member? Create an account"** and register.
2. Every new account starts as **Cashier** (can use Register, Inventory, Reports, Customers, but
   not Suppliers/Settings/Adjust Stock/Refunds).
3. To promote yourself to **Manager**, run this once in the Supabase **SQL Editor** (replace the
   email):

   ```sql
   update staff_profiles
   set role = 'manager'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

4. Sign out and back in (or just refresh) — you'll now see **Suppliers** and **Settings** in the
   sidebar, and can add products, adjust stock, and issue refunds.
5. Add any further staff the same way — have them sign up, then promote/manage their role from
   **Settings → Staff Accounts** (as a Manager) instead of SQL.

### Other scripts

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build locally
npm run lint      # run oxlint
```

---

## 2. What's included

| Feature | Where |
|---|---|
| Staff accounts & roles (Manager / Cashier) | Supabase Auth + `staff_profiles`, `src/context/AuthContext.jsx`, `src/pages/Login.jsx` |
| Register / Billing | `src/pages/Billing.jsx` — browse by category, cart, customer picker, payment method, tax, receipt |
| Inventory Dashboard | `src/pages/InventoryDashboard.jsx` — search/filter, low-stock highlighting, CSV export |
| Stock movement audit trail | `stock_movements` table + `src/components/inventory/StockHistoryModal.jsx` — every sale, restock, waste, correction, refund, and PO receipt is logged |
| Cost price / profit tracking | `products.cost_price`, profit shown on Reports |
| Units & expiry dates | `products.unit`, `products.expiry_date`, expiry badges in the inventory table |
| Product image upload | Supabase Storage bucket `product-images`, wired into `ProductModal.jsx` |
| Suppliers & Purchase Orders | `src/pages/Suppliers.jsx` — create a PO, "Receive" adds stock + updates cost price atomically |
| Customers | `src/pages/Customers.jsx`, picker in the cart, linked to `sales.customer_id` |
| Payment method tracking | Cash / Card / Mobile selector in the cart, stored per sale |
| Refunds / void sale | Reports page → "Refund" (Manager only) — restores stock, marks the sale refunded |
| Printable / emailable receipt | `src/components/billing/ReceiptModal.jsx` — print via browser, or a pre-filled `mailto:` link |
| Reports: date range, profit, export | `src/pages/Reports.jsx` — Today / Week / Month / All Time, CSV export |
| Configurable tax rate, currency, store name | `app_settings` table, `src/pages/Settings.jsx` (Manager only) |
| Basic offline sale queue | `src/context/CartContext.jsx` — sales made while offline are queued in `localStorage` and synced automatically when the connection returns |
| Role-based access control | Row-level security in `supabase/schema.sql` (`is_manager()`) + UI gating throughout |

### How "Complete Sale" works

Checkout calls `complete_sale(items, staff_name, tax_amount, total_amount, customer_id,
payment_method)` (see `supabase/schema.sql`), which inserts the `sales` row, every `sale_items`
row, decrements `products.stock_quantity`, and logs a `stock_movements` row per item — all in one
atomic database transaction. A sale can never be recorded without the matching stock update and
audit trail entry.

### Roles: what a Cashier can and can't do

- **Can**: use the Register, browse/search Inventory, view Reports, manage Customers.
- **Can't**: add/edit/delete products, adjust stock, issue refunds, manage Suppliers/Purchase
  Orders, or change Settings — these require the **Manager** role, enforced both in the UI and at
  the database level (RLS), so it can't be bypassed by calling the API directly.

### Security note on Row Level Security

All writes to `products`, `suppliers`, `purchase_orders`, and `app_settings` require the
`is_manager()` check at the database level — not just in the UI. Sales, refunds, and stock
adjustments only happen through `security definer` RPC functions, so a client can never insert a
sale or move stock by writing to those tables directly. Any authenticated staff member can read
all data; there's no public/anonymous access.

### Known simplifications (things a larger POS vendor would build out further)

- **Offline mode** is a simple localStorage queue, not a full offline-first PWA — while offline,
  the local product list won't reflect a queued sale's stock deduction until it syncs.
- **Refunds are full refunds only** (no partial/line-item refunds).
- **Email receipts** use a `mailto:` link (opens the customer's/staff's email client) rather than
  server-sent email, since that would require an SMTP or email-API key you'd need to supply.
- **Reports** cover date-range totals, profit, and CSV export, but not charts/graphs.

---

## 3. Deploy

### Frontend → Vercel

1. Push this project to a GitHub (or GitLab/Bitbucket) repository.
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import that repository.
3. Vercel auto-detects Vite; leave the defaults (Build Command `npm run build`, Output Directory `dist`).
4. Before deploying, add your environment variables under **Settings → Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
5. Click **Deploy**. Every subsequent push to your main branch redeploys automatically.
6. In Supabase, go to **Authentication → URL Configuration** and add your Vercel domain to the
   allowed redirect URLs, so sign-in works from production too.

### Backend → Supabase

Nothing to deploy — Supabase already hosts your Postgres database, Auth, and Storage once you've
run `supabase/schema.sql` (step 1 above). If you make further schema changes, run the updated SQL
in the same **SQL Editor** — it's written to be safe to re-run.

---

## 4. Project structure

```
mr-yum-pos/
├── supabase/
│   └── schema.sql              # tables, RLS, RPCs, storage bucket — safe to re-run
├── src/
│   ├── components/
│   │   ├── common/             # Icon, Toast
│   │   ├── layout/              # Sidebar, TopHeader, Footer, MobileFAB
│   │   ├── inventory/            # SummaryCards, InventoryTable, Pagination, ProductModal,
│   │   │                         # AdjustStockModal, StockHistoryModal
│   │   ├── billing/              # ProductGrid, CartPanel, ReceiptModal
│   │   ├── suppliers/            # SupplierModal, CreatePOModal
│   │   ├── customers/            # CustomerModal
│   │   └── reports/              # RefundModal
│   ├── context/                  # AuthContext, SettingsContext, CartContext, ToastContext
│   ├── hooks/                    # useProducts, useSales, useSuppliers, usePurchaseOrders, useCustomers
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── csv.js                # CSV export helper
│   ├── pages/                    # Login, Billing, InventoryDashboard, Reports, Suppliers,
│   │                              # Customers, Settings
│   ├── App.jsx                    # routes + auth/role guards
│   └── main.jsx
├── .env.example
├── .env                           # your local keys (gitignored)
└── tailwind.config.js             # Stitch design tokens (colors, fonts, spacing, radii)
```
