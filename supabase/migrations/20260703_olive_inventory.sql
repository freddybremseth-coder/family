-- Olivenolje-inventar for Dona Anna
create table if not exists public.olive_inventory (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  quantity numeric not null,
  unit text not null check (unit in ('Liters', 'Bottles', 'Pallets')),
  location text not null check (location in ('Spain', 'Norway', 'Transit')),
  price_per_unit_eur numeric,
  batch_label text,
  harvest_year integer,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists olive_inventory_user_idx on public.olive_inventory (user_id, location);

alter table public.olive_inventory enable row level security;

create policy "Egne olive read"   on public.olive_inventory for select using (auth.uid() = user_id);
create policy "Egne olive insert" on public.olive_inventory for insert with check (auth.uid() = user_id);
create policy "Egne olive update" on public.olive_inventory for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Egne olive delete" on public.olive_inventory for delete using (auth.uid() = user_id);
