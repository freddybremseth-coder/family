-- Create persistence tables used by FamilyHub bank and asset modules.
-- Fixes 404 from PostgREST when saving /rest/v1/assets and /rest/v1/bank_accounts.

create extension if not exists pgcrypto;

create table if not exists public.assets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Eiendel',
  category text not null default 'OTHER',
  value numeric not null default 0,
  currency text not null default 'NOK',
  purchase_price numeric,
  purchase_date date,
  linked_loan_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null default 'Bank',
  account_name text not null default 'Konto',
  account_number text,
  balance numeric not null default 0,
  currency text not null default 'NOK',
  type text not null default 'CHECKING',
  interest_rate numeric,
  credit_limit numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_user_id_idx on public.assets(user_id);
create index if not exists assets_name_idx on public.assets(user_id, name);
create index if not exists bank_accounts_user_id_idx on public.bank_accounts(user_id);
create index if not exists bank_accounts_name_idx on public.bank_accounts(user_id, account_name);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at
before update on public.assets
for each row execute function public.set_updated_at();

drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at
before update on public.bank_accounts
for each row execute function public.set_updated_at();

alter table public.assets enable row level security;
alter table public.bank_accounts enable row level security;

drop policy if exists assets_select_own on public.assets;
create policy assets_select_own on public.assets
  for select using (auth.uid() = user_id);

drop policy if exists assets_insert_own on public.assets;
create policy assets_insert_own on public.assets
  for insert with check (auth.uid() = user_id);

drop policy if exists assets_update_own on public.assets;
create policy assets_update_own on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists assets_delete_own on public.assets;
create policy assets_delete_own on public.assets
  for delete using (auth.uid() = user_id);

drop policy if exists bank_accounts_select_own on public.bank_accounts;
create policy bank_accounts_select_own on public.bank_accounts
  for select using (auth.uid() = user_id);

drop policy if exists bank_accounts_insert_own on public.bank_accounts;
create policy bank_accounts_insert_own on public.bank_accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists bank_accounts_update_own on public.bank_accounts;
create policy bank_accounts_update_own on public.bank_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists bank_accounts_delete_own on public.bank_accounts;
create policy bank_accounts_delete_own on public.bank_accounts
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.bank_accounts to authenticated;
