-- Single source of truth for FamilyHub persistence in public schema.
-- Safe to run multiple times. Ensures transactions, members, assets and bank_accounts
-- exist in the same Supabase project the frontend writes to.

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  amount numeric not null default 0,
  currency text not null default 'NOK',
  description text not null default '',
  category text not null default 'Diverse',
  type text not null default 'EXPENSE',
  payment_method text default 'Bank',
  is_accrual boolean not null default false,
  from_account_id text,
  to_account_id text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verification_source text,
  matched_receipt_id text,
  bank_statement_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  birth_date date,
  monthly_salary numeric not null default 0,
  monthly_benefits numeric not null default 0,
  monthly_child_benefit numeric not null default 0,
  salary_day integer,
  salary_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Add missing columns if tables already existed with an older/partial schema.
alter table public.transactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.transactions add column if not exists currency text not null default 'NOK';
alter table public.transactions add column if not exists description text not null default '';
alter table public.transactions add column if not exists category text not null default 'Diverse';
alter table public.transactions add column if not exists type text not null default 'EXPENSE';
alter table public.transactions add column if not exists payment_method text default 'Bank';
alter table public.transactions add column if not exists is_accrual boolean not null default false;
alter table public.transactions add column if not exists from_account_id text;
alter table public.transactions add column if not exists to_account_id text;
alter table public.transactions add column if not exists is_verified boolean not null default false;
alter table public.transactions add column if not exists verified_at timestamptz;
alter table public.transactions add column if not exists verification_source text;
alter table public.transactions add column if not exists matched_receipt_id text;
alter table public.transactions add column if not exists bank_statement_ref text;
alter table public.transactions add column if not exists created_at timestamptz not null default now();
alter table public.transactions add column if not exists updated_at timestamptz not null default now();

alter table public.members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.members add column if not exists birth_date date;
alter table public.members add column if not exists monthly_salary numeric not null default 0;
alter table public.members add column if not exists monthly_benefits numeric not null default 0;
alter table public.members add column if not exists monthly_child_benefit numeric not null default 0;
alter table public.members add column if not exists salary_day integer;
alter table public.members add column if not exists salary_account_id text;
alter table public.members add column if not exists created_at timestamptz not null default now();
alter table public.members add column if not exists updated_at timestamptz not null default now();

alter table public.assets add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.assets add column if not exists category text not null default 'OTHER';
alter table public.assets add column if not exists value numeric not null default 0;
alter table public.assets add column if not exists currency text not null default 'NOK';
alter table public.assets add column if not exists purchase_price numeric;
alter table public.assets add column if not exists purchase_date date;
alter table public.assets add column if not exists linked_loan_account_id text;
alter table public.assets add column if not exists created_at timestamptz not null default now();
alter table public.assets add column if not exists updated_at timestamptz not null default now();

alter table public.bank_accounts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.bank_accounts add column if not exists bank_name text not null default 'Bank';
alter table public.bank_accounts add column if not exists account_name text not null default 'Konto';
alter table public.bank_accounts add column if not exists account_number text;
alter table public.bank_accounts add column if not exists balance numeric not null default 0;
alter table public.bank_accounts add column if not exists currency text not null default 'NOK';
alter table public.bank_accounts add column if not exists type text not null default 'CHECKING';
alter table public.bank_accounts add column if not exists interest_rate numeric;
alter table public.bank_accounts add column if not exists credit_limit numeric;
alter table public.bank_accounts add column if not exists created_at timestamptz not null default now();
alter table public.bank_accounts add column if not exists updated_at timestamptz not null default now();

create index if not exists transactions_user_id_date_idx on public.transactions(user_id, date desc);
create index if not exists members_user_id_name_idx on public.members(user_id, name);
create index if not exists assets_user_id_name_idx on public.assets(user_id, name);
create index if not exists bank_accounts_user_id_name_idx on public.bank_accounts(user_id, account_name);

create or replace function public.familyhub_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.familyhub_set_updated_at();
drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at before update on public.members for each row execute function public.familyhub_set_updated_at();
drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets for each row execute function public.familyhub_set_updated_at();
drop trigger if exists bank_accounts_set_updated_at on public.bank_accounts;
create trigger bank_accounts_set_updated_at before update on public.bank_accounts for each row execute function public.familyhub_set_updated_at();

alter table public.transactions enable row level security;
alter table public.members enable row level security;
alter table public.assets enable row level security;
alter table public.bank_accounts enable row level security;

-- Replace policies with simple own-row policies.
drop policy if exists transactions_select_own on public.transactions;
drop policy if exists transactions_insert_own on public.transactions;
drop policy if exists transactions_update_own on public.transactions;
drop policy if exists transactions_delete_own on public.transactions;
create policy transactions_select_own on public.transactions for select using (auth.uid() = user_id);
create policy transactions_insert_own on public.transactions for insert with check (auth.uid() = user_id);
create policy transactions_update_own on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transactions_delete_own on public.transactions for delete using (auth.uid() = user_id);

drop policy if exists members_select_own on public.members;
drop policy if exists members_insert_own on public.members;
drop policy if exists members_update_own on public.members;
drop policy if exists members_delete_own on public.members;
create policy members_select_own on public.members for select using (auth.uid() = user_id);
create policy members_insert_own on public.members for insert with check (auth.uid() = user_id);
create policy members_update_own on public.members for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy members_delete_own on public.members for delete using (auth.uid() = user_id);

drop policy if exists assets_select_own on public.assets;
drop policy if exists assets_insert_own on public.assets;
drop policy if exists assets_update_own on public.assets;
drop policy if exists assets_delete_own on public.assets;
create policy assets_select_own on public.assets for select using (auth.uid() = user_id);
create policy assets_insert_own on public.assets for insert with check (auth.uid() = user_id);
create policy assets_update_own on public.assets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy assets_delete_own on public.assets for delete using (auth.uid() = user_id);

drop policy if exists bank_accounts_select_own on public.bank_accounts;
drop policy if exists bank_accounts_insert_own on public.bank_accounts;
drop policy if exists bank_accounts_update_own on public.bank_accounts;
drop policy if exists bank_accounts_delete_own on public.bank_accounts;
create policy bank_accounts_select_own on public.bank_accounts for select using (auth.uid() = user_id);
create policy bank_accounts_insert_own on public.bank_accounts for insert with check (auth.uid() = user_id);
create policy bank_accounts_update_own on public.bank_accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy bank_accounts_delete_own on public.bank_accounts for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.assets to authenticated;
grant select, insert, update, delete on public.bank_accounts to authenticated;
