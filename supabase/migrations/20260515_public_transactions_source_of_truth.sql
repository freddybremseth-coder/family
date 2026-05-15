-- FamilyHub bruker public.transactions via Supabase REST /rest/v1/transactions.
-- Denne migrationen sikrer at transaksjoner lagres i Supabase som master,
-- med kolonnene frontend bruker. Den sletter ingen eksisterende data.

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  currency text not null default 'EUR',
  description text not null default '',
  category text not null default 'Diverse',
  type text not null default 'EXPENSE',
  payment_method text not null default 'Bank',
  is_accrual boolean not null default false,
  from_account_id text,
  to_account_id text,
  is_verified boolean not null default false,
  verified_at text,
  verification_source text,
  matched_receipt_id text,
  bank_statement_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists date text,
  add column if not exists amount numeric default 0,
  add column if not exists currency text default 'EUR',
  add column if not exists description text default '',
  add column if not exists category text default 'Diverse',
  add column if not exists type text default 'EXPENSE',
  add column if not exists payment_method text default 'Bank',
  add column if not exists is_accrual boolean default false,
  add column if not exists from_account_id text,
  add column if not exists to_account_id text,
  add column if not exists is_verified boolean default false,
  add column if not exists verified_at text,
  add column if not exists verification_source text,
  add column if not exists matched_receipt_id text,
  add column if not exists bank_statement_ref text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own on public.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists transactions_update_own on public.transactions;
create policy transactions_update_own on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_delete_own on public.transactions
  for delete using (auth.uid() = user_id);

create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
