-- Detaljerte kvittering-linjer for handelshistorikk og smart handleliste-forslag
create table if not exists public.receipt_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id text,               -- pekpke til scanned_receipts hvis den finnes
  transaction_id text,           -- eller til transactions
  date date not null,
  vendor text not null,          -- 'Mercadona', 'Carrefour', 'Family Cash' osv.
  name text not null,            -- 'Leche entera 1L', 'Aceite oliva virgen extra'
  normalized_name text,          -- lowercase + fjernet parenteser/tall for matching
  quantity numeric default 1,
  unit text,                     -- 'L', 'kg', 'stk', '500g'
  price_per_unit numeric,        -- pris pr enhet
  total_price numeric not null,
  currency text not null default 'EUR',
  category text,                 -- 'Meieri', 'Kolonial', 'Frukt', 'Kjøtt', 'Rengjøring'
  created_at timestamptz not null default now()
);

create index if not exists receipt_items_user_normalized_idx on public.receipt_items (user_id, normalized_name);
create index if not exists receipt_items_user_date_idx on public.receipt_items (user_id, date desc);
create index if not exists receipt_items_vendor_idx on public.receipt_items (vendor);

alter table public.receipt_items enable row level security;

drop policy if exists "hh receipt_items read" on public.receipt_items;
drop policy if exists "hh receipt_items insert" on public.receipt_items;
drop policy if exists "hh receipt_items update" on public.receipt_items;
drop policy if exists "hh receipt_items delete" on public.receipt_items;

create policy "hh receipt_items read" on public.receipt_items
  for select using (public.is_data_accessible_to_member(user_id));
create policy "hh receipt_items insert" on public.receipt_items
  for insert with check (public.is_data_accessible_to_member(user_id));
create policy "hh receipt_items update" on public.receipt_items
  for update using (public.is_data_accessible_to_member(user_id)) with check (public.is_data_accessible_to_member(user_id));
create policy "hh receipt_items delete" on public.receipt_items
  for delete using (public.is_data_accessible_to_member(user_id));

notify pgrst, 'reload schema';
