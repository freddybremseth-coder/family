-- Crypto-portefølje pr bruker
create table if not exists public.crypto_assets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  amount numeric not null,
  average_buy_price numeric not null,   -- i NOK
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crypto_assets_user_idx on public.crypto_assets (user_id, symbol);

alter table public.crypto_assets enable row level security;

create policy "Egne crypto read"   on public.crypto_assets for select using (auth.uid() = user_id);
create policy "Egne crypto insert" on public.crypto_assets for insert with check (auth.uid() = user_id);
create policy "Egne crypto update" on public.crypto_assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Egne crypto delete" on public.crypto_assets for delete using (auth.uid() = user_id);
