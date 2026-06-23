-- Mondeo-kontrakt v2: Selgerkreditt fra Extrade Holding AS til
-- Odin Jacobsen / Nordic Invest AS. Fast rente 9%, start 1. juni 2026,
-- min 33 000 kr/mnd. Hvis han betaler mindre øker lånet tilsvarende.
-- Hvert år legges KPI-justering inn.

create schema if not exists family;

-- 1. mondeo_loan_settings – utvid med kontraktsfelter
create table if not exists family.mondeo_loan_settings (
  id                           text primary key default gen_random_uuid()::text,
  user_id                      uuid not null references auth.users(id) on delete cascade,
  initial_principal            numeric not null default 4800000,
  start_date                   text not null,
  margin_pct                   numeric not null default 6,
  norges_bank_rate_pct         numeric not null default 4.5,
  norges_bank_rate_observed_at text,
  buyer_name                   text,
  notes                        text,
  created_at                   timestamptz default now(),
  updated_at                   timestamptz default now()
);

alter table family.mondeo_loan_settings add column if not exists fixed_annual_rate_pct numeric default 9;
alter table family.mondeo_loan_settings add column if not exists use_fixed_rate boolean default true;
alter table family.mondeo_loan_settings add column if not exists interest_start_date text;
alter table family.mondeo_loan_settings add column if not exists min_monthly_payment numeric default 33000;
alter table family.mondeo_loan_settings add column if not exists buyer_company text;
alter table family.mondeo_loan_settings add column if not exists buyer_org_number text;
alter table family.mondeo_loan_settings add column if not exists buyer_email text;
alter table family.mondeo_loan_settings add column if not exists seller_entity text;
alter table family.mondeo_loan_settings add column if not exists seller_org_number text;
alter table family.mondeo_loan_settings add column if not exists contract_storage_path text;
alter table family.mondeo_loan_settings add column if not exists contract_file_name text;

-- 2. mondeo_loan_payments – grunnstruktur (idempotent)
create table if not exists family.mondeo_loan_payments (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  date                  text not null,
  amount                numeric not null default 0,
  note                  text,
  posted_transaction_id text,
  created_at            timestamptz default now()
);
alter table family.mondeo_loan_payments add column if not exists method text;

create index if not exists idx_mondeo_loan_payments_user_date
  on family.mondeo_loan_payments (user_id, date);

-- 3. mondeo_kpi_adjustments – årlig KPI-justering av hovedstol
create table if not exists family.mondeo_kpi_adjustments (
  id               text primary key default gen_random_uuid()::text,
  user_id          uuid not null references auth.users(id) on delete cascade,
  year             integer not null,
  kpi_pct          numeric not null,
  applied_at       text,
  principal_before numeric,
  principal_after  numeric,
  note             text,
  created_at       timestamptz default now()
);
create unique index if not exists uq_mondeo_kpi_user_year
  on family.mondeo_kpi_adjustments (user_id, year);

-- 4. RLS
alter table family.mondeo_loan_settings enable row level security;
alter table family.mondeo_loan_payments enable row level security;
alter table family.mondeo_kpi_adjustments enable row level security;

drop policy if exists mondeo_settings_owner_all on family.mondeo_loan_settings;
create policy mondeo_settings_owner_all on family.mondeo_loan_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mondeo_payments_owner_all on family.mondeo_loan_payments;
create policy mondeo_payments_owner_all on family.mondeo_loan_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists mondeo_kpi_owner_all on family.mondeo_kpi_adjustments;
create policy mondeo_kpi_owner_all on family.mondeo_kpi_adjustments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. Storage-bucket for kontrakten (kreves at storage.buckets støttes;
--    feiler stille i miljøer uten storage). Privat — kun eieren leser.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('mondeo-documents', 'mondeo-documents', false)
    on conflict (id) do nothing;
  end if;
end $$;

-- Storage RLS-policies så hver bruker bare ser sin egen kontrakt
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    drop policy if exists mondeo_storage_owner_select on storage.objects;
    create policy mondeo_storage_owner_select on storage.objects
      for select using (bucket_id = 'mondeo-documents' and owner = auth.uid());
    drop policy if exists mondeo_storage_owner_insert on storage.objects;
    create policy mondeo_storage_owner_insert on storage.objects
      for insert with check (bucket_id = 'mondeo-documents' and owner = auth.uid());
    drop policy if exists mondeo_storage_owner_delete on storage.objects;
    create policy mondeo_storage_owner_delete on storage.objects
      for delete using (bucket_id = 'mondeo-documents' and owner = auth.uid());
  end if;
end $$;

-- 6. Grants
grant usage on schema family to anon, authenticated;
grant all on family.mondeo_loan_settings to authenticated;
grant all on family.mondeo_loan_payments to authenticated;
grant all on family.mondeo_kpi_adjustments to authenticated;
