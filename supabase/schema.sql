-- Mr YUM Bakers And General Store — POS database schema (v2)
-- Safe to re-run: uses "if not exists" / "add column if not exists" everywhere.
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query).

-- ============================================================================
-- 1. Core tables
-- ============================================================================

create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

insert into categories (name) values
  ('Bakery'), ('Snacks'), ('Beverages'), ('Grocery'), ('Dairy'), ('Household')
on conflict (name) do nothing;

create table if not exists products (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  category             text not null,
  price                numeric(10, 2) not null default 0,
  stock_quantity       integer not null default 0,
  low_stock_threshold  integer not null default 10,
  image_url            text,
  batch_id             text,
  created_at           timestamptz not null default now()
);

-- New professional-inventory columns on products
alter table products add column if not exists cost_price numeric(10, 2) not null default 0;
alter table products add column if not exists unit text not null default 'piece';
alter table products add column if not exists expiry_date date;
alter table products add column if not exists updated_at timestamptz not null default now();
-- Days before expiry_date to start showing an "expiring soon" alert for this product.
alter table products add column if not exists expiry_alert_days integer not null default 3;
-- Pieces per case/box, for products received in boxes but sold individually (e.g. 8 pieces per box). Null/1 means not applicable.
alter table products add column if not exists pieces_per_box integer;
alter table products add column if not exists sub_category text;
alter table products add column if not exists piece_barcode text;
alter table products add column if not exists box_barcode text;
alter table products add column if not exists tax_percent numeric(5, 2) not null default 0;
alter table products add column if not exists batch_received_date date;
alter table products add column if not exists is_active boolean not null default true;

create table if not exists sales (
  id            uuid primary key default gen_random_uuid(),
  total_amount  numeric(10, 2) not null,
  tax_amount    numeric(10, 2) not null default 0,
  staff_name    text,
  created_at    timestamptz not null default now()
);

-- New columns on sales
alter table sales add column if not exists customer_id uuid;
alter table sales add column if not exists payment_method text not null default 'cash';
alter table sales add column if not exists status text not null default 'completed';
-- Order-level discount applied on top of any per-item discounts, before tax.
alter table sales add column if not exists discount_amount numeric(10, 2) not null default 0;

create table if not exists sale_items (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references sales(id) on delete cascade,
  product_id      uuid references products(id) on delete set null,
  quantity        integer not null,
  price_at_sale   numeric(10, 2) not null
);

alter table sale_items add column if not exists discount_amount numeric(10, 2) not null default 0;

create index if not exists sale_items_sale_id_idx on sale_items(sale_id);
create index if not exists sale_items_product_id_idx on sale_items(product_id);
create index if not exists sales_created_at_idx on sales(created_at);

-- ============================================================================
-- 2. Staff accounts & roles (Supabase Auth)
-- ============================================================================

create table if not exists staff_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default 'Staff Member',
  role        text not null default 'cashier' check (role in ('manager', 'cashier')),
  created_at  timestamptz not null default now()
);

-- Auto-create a staff_profiles row (default role: cashier) whenever someone signs up.
-- Promote your first account to manager manually — see the README.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.staff_profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'cashier')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function is_manager()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_profiles where id = auth.uid() and role = 'manager'
  );
$$;

-- ============================================================================
-- 3. Suppliers & purchase orders
-- ============================================================================

create table if not exists suppliers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table suppliers add column if not exists company_name text;
-- Day of week the supplier delivers goods (e.g. 'Monday'), and the day of week their order-taker calls/visits to take the next order.
alter table suppliers add column if not exists delivery_day text;
alter table suppliers add column if not exists order_day text;

-- Which supplier a product is reordered from. Set on the product, not per-order.
alter table products add column if not exists supplier_id uuid references suppliers(id) on delete set null;

create table if not exists purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references suppliers(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  notes         text,
  created_at    timestamptz not null default now(),
  received_at   timestamptz
);

create table if not exists purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  purchase_order_id   uuid not null references purchase_orders(id) on delete cascade,
  product_id          uuid references products(id) on delete set null,
  quantity            integer not null,
  cost_price           numeric(10, 2) not null default 0
);

create index if not exists po_items_po_id_idx on purchase_order_items(purchase_order_id);

-- ============================================================================
-- 4. Customers
-- ============================================================================

create table if not exists customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  notes       text,
  created_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sales_customer_id_fkey') then
    alter table sales
      add constraint sales_customer_id_fkey foreign key (customer_id) references customers(id) on delete set null;
  end if;
end $$;

-- ============================================================================
-- 4a. Credit accounts (udhar / khata)
-- ============================================================================

alter table customers add column if not exists credit_balance numeric(10, 2) not null default 0;

create table if not exists credit_transactions (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  type          text not null check (type in ('charge', 'payment')),
  amount        numeric(10, 2) not null,
  sale_id       uuid references sales(id) on delete set null,
  note          text,
  staff_name    text,
  created_at    timestamptz not null default now()
);

create index if not exists credit_transactions_customer_id_idx on credit_transactions(customer_id);
create index if not exists credit_transactions_created_at_idx on credit_transactions(created_at);

-- ============================================================================
-- 5. Refunds
-- ============================================================================

create table if not exists refunds (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references sales(id) on delete cascade,
  amount      numeric(10, 2) not null,
  reason      text,
  staff_name  text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 6. Stock movement audit trail
-- ============================================================================

create table if not exists stock_movements (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references products(id) on delete set null,
  change_type       text not null check (change_type in ('sale', 'restock', 'adjustment', 'waste', 'return', 'purchase_order', 'initial')),
  quantity_change   integer not null,
  resulting_stock   integer not null,
  staff_name        text,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists stock_movements_product_id_idx on stock_movements(product_id);
create index if not exists stock_movements_created_at_idx on stock_movements(created_at);

-- ============================================================================
-- 7. App settings (single row: tax rate, currency, store name)
-- ============================================================================

create table if not exists app_settings (
  id              smallint primary key default 1 check (id = 1),
  store_name      text not null default 'Mr YUM Bakers And General Store',
  tax_rate        numeric(5, 4) not null default 0.08,
  currency_symbol text not null default '$',
  created_at      timestamptz not null default now()
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================================
-- 8. RPCs
-- ============================================================================

-- Records a sale + its line items, deducts stock, and logs a stock movement
-- per item — all atomically, so a sale can never exist without matching
-- inventory + audit records.
-- Dropped first: adding p_discount_amount changes the parameter signature, and
-- Postgres treats a different signature as a distinct overload rather than a
-- replacement, so the old 6-arg version would otherwise be left behind.
drop function if exists complete_sale(jsonb, text, numeric, numeric, uuid, text);
create or replace function complete_sale(
  p_items jsonb,          -- [{ "product_id": uuid, "quantity": int, "price_at_sale": numeric, "discount_amount": numeric }, ...]
  p_staff_name text,
  p_tax_amount numeric,
  p_total_amount numeric,
  p_customer_id uuid default null,
  p_payment_method text default 'cash',
  p_discount_amount numeric default 0
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_new_stock integer;
begin
  insert into sales (total_amount, tax_amount, staff_name, customer_id, payment_method, status, discount_amount)
  values (p_total_amount, p_tax_amount, p_staff_name, p_customer_id, coalesce(p_payment_method, 'cash'), 'completed', coalesce(p_discount_amount, 0))
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into sale_items (sale_id, product_id, quantity, price_at_sale, discount_amount)
    values (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::integer,
      (v_item->>'price_at_sale')::numeric,
      coalesce((v_item->>'discount_amount')::numeric, 0)
    );

    update products
    set stock_quantity = greatest(0, stock_quantity - (v_item->>'quantity')::integer),
        updated_at = now()
    where id = (v_item->>'product_id')::uuid
    returning stock_quantity into v_new_stock;

    insert into stock_movements (product_id, change_type, quantity_change, resulting_stock, staff_name, note)
    values (
      (v_item->>'product_id')::uuid,
      'sale',
      -((v_item->>'quantity')::integer),
      coalesce(v_new_stock, 0),
      p_staff_name,
      'Sale ' || v_sale_id
    );
  end loop;

  -- Udhar (credit) sale: add the bill to the customer's account balance.
  if p_payment_method = 'credit' and p_customer_id is not null then
    update customers
    set credit_balance = credit_balance + p_total_amount
    where id = p_customer_id;

    insert into credit_transactions (customer_id, type, amount, sale_id, staff_name, note)
    values (p_customer_id, 'charge', p_total_amount, v_sale_id, p_staff_name, 'Sale ' || v_sale_id);
  end if;

  return v_sale_id;
end;
$$;

-- Generic stock adjustment (restock / waste / manual correction), logged atomically.
create or replace function adjust_stock(
  p_product_id uuid,
  p_change integer,           -- positive to add, negative to remove
  p_change_type text,         -- 'restock' | 'adjustment' | 'waste' | 'return'
  p_note text,
  p_staff_name text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_stock integer;
begin
  update products
  set stock_quantity = greatest(0, stock_quantity + p_change),
      updated_at = now()
  where id = p_product_id
  returning stock_quantity into v_new_stock;

  if v_new_stock is null then
    raise exception 'Product not found';
  end if;

  insert into stock_movements (product_id, change_type, quantity_change, resulting_stock, staff_name, note)
  values (p_product_id, p_change_type, p_change, v_new_stock, p_staff_name, p_note);

  return v_new_stock;
end;
$$;

-- Applies a whole restock session (one or more scanned products) in a single
-- transaction: bumps stock, refreshes expiry/batch/cost on the product row,
-- and logs one stock movement per item.
create or replace function bulk_restock(
  p_items jsonb,        -- [{ product_id, quantity_added, expiry_date, batch_received_date, cost_price }, ...]
  p_staff_name text
)
returns void
language plpgsql
security definer
as $$
declare
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_new_stock integer;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity_added')::integer;

    update products
    set stock_quantity = stock_quantity + v_qty,
        expiry_date = coalesce((v_item->>'expiry_date')::date, expiry_date),
        batch_received_date = coalesce((v_item->>'batch_received_date')::date, batch_received_date),
        cost_price = coalesce((v_item->>'cost_price')::numeric, cost_price),
        updated_at = now()
    where id = v_product_id
    returning stock_quantity into v_new_stock;

    if v_new_stock is null then
      raise exception 'Product not found: %', v_product_id;
    end if;

    insert into stock_movements (product_id, change_type, quantity_change, resulting_stock, staff_name, note)
    values (v_product_id, 'restock', v_qty, v_new_stock, p_staff_name, coalesce(v_item->>'note', 'Bulk restock'));
  end loop;
end;
$$;

-- Fully refunds a sale: restores stock for every line item, logs the
-- movements, records a refund row, and marks the sale as refunded.
create or replace function refund_sale(
  p_sale_id uuid,
  p_reason text,
  p_staff_name text
)
returns void
language plpgsql
security definer
as $$
declare
  v_item record;
  v_new_stock integer;
  v_total numeric;
begin
  select total_amount into v_total from sales where id = p_sale_id;
  if v_total is null then
    raise exception 'Sale not found';
  end if;

  for v_item in select * from sale_items where sale_id = p_sale_id
  loop
    if v_item.product_id is not null then
      update products
      set stock_quantity = stock_quantity + v_item.quantity,
          updated_at = now()
      where id = v_item.product_id
      returning stock_quantity into v_new_stock;

      insert into stock_movements (product_id, change_type, quantity_change, resulting_stock, staff_name, note)
      values (v_item.product_id, 'return', v_item.quantity, coalesce(v_new_stock, 0), p_staff_name, 'Refund of sale ' || p_sale_id);
    end if;
  end loop;

  update sales set status = 'refunded' where id = p_sale_id;

  insert into refunds (sale_id, amount, reason, staff_name)
  values (p_sale_id, v_total, p_reason, p_staff_name);
end;
$$;

-- Records a payment against a customer's udhar (credit) balance.
create or replace function record_credit_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_staff_name text,
  p_note text default null
)
returns numeric
language plpgsql
security definer
as $$
declare
  v_new_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

  update customers
  set credit_balance = greatest(0, credit_balance - p_amount)
  where id = p_customer_id
  returning credit_balance into v_new_balance;

  if v_new_balance is null then
    raise exception 'Customer not found';
  end if;

  insert into credit_transactions (customer_id, type, amount, staff_name, note)
  values (p_customer_id, 'payment', p_amount, p_staff_name, p_note);

  return v_new_balance;
end;
$$;

-- Marks a purchase order as received: increases stock for every line item,
-- updates the product's cost price, and logs each movement atomically.
create or replace function receive_purchase_order(
  p_purchase_order_id uuid,
  p_staff_name text
)
returns void
language plpgsql
security definer
as $$
declare
  v_item record;
  v_new_stock integer;
begin
  for v_item in select * from purchase_order_items where purchase_order_id = p_purchase_order_id
  loop
    if v_item.product_id is not null then
      update products
      set stock_quantity = stock_quantity + v_item.quantity,
          cost_price = v_item.cost_price,
          updated_at = now()
      where id = v_item.product_id
      returning stock_quantity into v_new_stock;

      insert into stock_movements (product_id, change_type, quantity_change, resulting_stock, staff_name, note)
      values (v_item.product_id, 'purchase_order', v_item.quantity, coalesce(v_new_stock, 0), p_staff_name, 'PO ' || p_purchase_order_id);
    end if;
  end loop;

  update purchase_orders set status = 'received', received_at = now() where id = p_purchase_order_id;
end;
$$;

-- ============================================================================
-- 9. Row Level Security — authenticated staff only, manager-gated writes
-- ============================================================================

alter table categories enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table staff_profiles enable row level security;
alter table suppliers enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table customers enable row level security;
alter table refunds enable row level security;
alter table stock_movements enable row level security;
alter table app_settings enable row level security;
alter table credit_transactions enable row level security;

-- staff_profiles: everyone can read (needed to show names/roles); only a
-- manager can change roles; a user may update their own full_name.
drop policy if exists "Staff can read profiles" on staff_profiles;
create policy "Staff can read profiles" on staff_profiles for select using (auth.role() = 'authenticated');
drop policy if exists "Users manage their own profile" on staff_profiles;
create policy "Users manage their own profile" on staff_profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Managers manage all profiles" on staff_profiles;
create policy "Managers manage all profiles" on staff_profiles for all using (is_manager()) with check (is_manager());

-- categories: any authenticated staff can read; only managers can add new ones.
drop policy if exists "Staff can read categories" on categories;
create policy "Staff can read categories" on categories for select using (auth.role() = 'authenticated');
drop policy if exists "Managers write categories" on categories;
create policy "Managers write categories" on categories for insert with check (is_manager());

-- products: any authenticated staff can read; only managers can write.
drop policy if exists "Staff can read products" on products;
create policy "Staff can read products" on products for select using (auth.role() = 'authenticated');
drop policy if exists "Managers write products" on products;
create policy "Managers write products" on products for insert with check (is_manager());
drop policy if exists "Managers update products" on products;
create policy "Managers update products" on products for update using (is_manager()) with check (is_manager());
drop policy if exists "Managers delete products" on products;
create policy "Managers delete products" on products for delete using (is_manager());

-- sales / sale_items / stock_movements / refunds: read-only for staff via
-- table access — all writes happen through the security-definer RPCs above.
drop policy if exists "Staff can read sales" on sales;
create policy "Staff can read sales" on sales for select using (auth.role() = 'authenticated');
drop policy if exists "Staff can read sale_items" on sale_items;
create policy "Staff can read sale_items" on sale_items for select using (auth.role() = 'authenticated');
drop policy if exists "Staff can read stock_movements" on stock_movements;
create policy "Staff can read stock_movements" on stock_movements for select using (auth.role() = 'authenticated');
drop policy if exists "Staff can read refunds" on refunds;
create policy "Staff can read refunds" on refunds for select using (auth.role() = 'authenticated');
drop policy if exists "Staff can read credit_transactions" on credit_transactions;
create policy "Staff can read credit_transactions" on credit_transactions for select using (auth.role() = 'authenticated');

-- suppliers / purchase_orders / purchase_order_items: staff can read, managers can write.
drop policy if exists "Staff can read suppliers" on suppliers;
create policy "Staff can read suppliers" on suppliers for select using (auth.role() = 'authenticated');
drop policy if exists "Managers write suppliers" on suppliers;
create policy "Managers write suppliers" on suppliers for all using (is_manager()) with check (is_manager());

drop policy if exists "Staff can read purchase_orders" on purchase_orders;
create policy "Staff can read purchase_orders" on purchase_orders for select using (auth.role() = 'authenticated');
drop policy if exists "Managers write purchase_orders" on purchase_orders;
create policy "Managers write purchase_orders" on purchase_orders for all using (is_manager()) with check (is_manager());

drop policy if exists "Staff can read po_items" on purchase_order_items;
create policy "Staff can read po_items" on purchase_order_items for select using (auth.role() = 'authenticated');
drop policy if exists "Managers write po_items" on purchase_order_items;
create policy "Managers write po_items" on purchase_order_items for all using (is_manager()) with check (is_manager());

-- customers: any staff can read/add/update (needed at checkout).
drop policy if exists "Staff manage customers" on customers;
create policy "Staff manage customers" on customers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- app_settings: readable by anyone (no sensitive data — needed so the Login
-- screen and CartContext can read the tax rate/store name before sign-in);
-- only managers can update.
drop policy if exists "Staff can read settings" on app_settings;
drop policy if exists "Anyone can read settings" on app_settings;
create policy "Anyone can read settings" on app_settings for select using (true);
drop policy if exists "Managers update settings" on app_settings;
create policy "Managers update settings" on app_settings for update using (is_manager()) with check (is_manager());

grant execute on function complete_sale(jsonb, text, numeric, numeric, uuid, text, numeric) to authenticated;
grant execute on function adjust_stock(uuid, integer, text, text, text) to authenticated;
grant execute on function refund_sale(uuid, text, text) to authenticated;
grant execute on function receive_purchase_order(uuid, text) to authenticated;
grant execute on function record_credit_payment(uuid, numeric, text, text) to authenticated;
grant execute on function bulk_restock(jsonb, text) to authenticated;

-- ============================================================================
-- 10. Storage bucket for product images
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Staff can upload product images" on storage.objects;
create policy "Staff can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "Staff can update product images" on storage.objects;
create policy "Staff can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

drop policy if exists "Staff can delete product images" on storage.objects;
create policy "Staff can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');

-- ============================================================================
-- No seed data — add real products via the Inventory Dashboard's "Add
-- Product" button, or insert rows here yourself as your stock arrives.
-- ============================================================================
