-- ============================================================
-- FAMILIE-HUB – Supabase schema "family"
-- ============================================================
-- KJØR DETTE I REALTYFLOW PRO SIN SUPABASE (master).
-- Alle FamilieHub-tabeller legges i schema `family` så de ikke
-- kolliderer med RealtyFlow sine egne tabeller i `public`.
--
-- ETTER SQL-EN:
--   1. Supabase Dashboard → Project Settings → API → "Exposed schemas"
--      legg til: family
--   2. Family-appens .env.local skal peke til samme prosjekt som
--      RealtyFlow Pro (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).
-- ============================================================

create schema if not exists family;
grant usage on schema family to anon, authenticated;
alter default privileges in schema family
  grant select, insert, update, delete on tables to authenticated;


-- ── 1. USER PROFILES (trial + abonnement) ───────────────────
create table if not exists family.user_profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  trial_started_at        timestamptz not null default now(),
  subscription_status     text not null default 'trial',
  subscription_plan       text default 'monthly',
  subscription_expires_at timestamptz,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  created_at              timestamptz default now()
);

alter table family.user_profiles enable row level security;

drop policy if exists "family_user_profiles_owner_select" on family.user_profiles;
drop policy if exists "family_user_profiles_owner_insert" on family.user_profiles;
drop policy if exists "family_user_profiles_owner_update" on family.user_profiles;

create policy "family_user_profiles_owner_select" on family.user_profiles
  for select using (auth.uid() = id);
create policy "family_user_profiles_owner_insert" on family.user_profiles
  for insert with check (auth.uid() = id);
create policy "family_user_profiles_owner_update" on family.user_profiles
  for update using (auth.uid() = id);

-- Auto-opprett profil ved nye signup-er (kjør én gang per prosjekt)
create or replace function family.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into family.user_profiles (id, trial_started_at, subscription_status)
  values (new.id, now(), 'trial')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_family on auth.users;
create trigger on_auth_user_created_family
  after insert on auth.users
  for each row execute procedure family.handle_new_user();


-- ── 2. TRANSACTIONS ─────────────────────────────────────────
create table if not exists family.transactions (
  id              text primary key default gen_random_uuid()::text,
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            text not null,
  amount          numeric not null default 0,
  currency        text not null default 'NOK',
  description     text not null default '',
  category        text not null default '',
  type            text not null default 'EXPENSE',
  payment_method  text not null default 'Bank',
  is_accrual      boolean default false,
  tax_amount      numeric,
  from_account_id text,
  to_account_id   text,
  created_at      timestamptz default now()
);

alter table family.transactions enable row level security;

drop policy if exists "family_transactions_owner_all" on family.transactions;
create policy "family_transactions_owner_all" on family.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 3. FAMILY MEMBERS ───────────────────────────────────────
create table if not exists family.members (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  birth_date            text,
  monthly_salary        numeric default 0,
  monthly_benefits      numeric default 0,
  monthly_child_benefit numeric default 0,
  created_at            timestamptz default now()
);

alter table family.members enable row level security;

drop policy if exists "family_members_owner_all" on family.members;
create policy "family_members_owner_all" on family.members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 4. SHOPPING – grocery list og purchase history ──────────
create table if not exists family.grocery_items (
  id            text primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  quantity      numeric default 1,
  unit          text default 'stk',
  store         text default 'Andre',
  is_bought     boolean default false,
  is_suggestion boolean default false,
  category      text,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table family.grocery_items enable row level security;

drop policy if exists "family_grocery_owner_all" on family.grocery_items;
create policy "family_grocery_owner_all" on family.grocery_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists family.purchase_history (
  id              text primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  item_name       text not null,
  normalized_name text not null,
  purchased_at    timestamptz not null default now(),
  quantity        numeric default 1,
  unit            text default 'stk',
  store           text,
  created_at      timestamptz default now()
);

create index if not exists idx_family_purchase_history_user_normalized
  on family.purchase_history (user_id, normalized_name);
create index if not exists idx_family_purchase_history_user_purchased
  on family.purchase_history (user_id, purchased_at desc);

alter table family.purchase_history enable row level security;

drop policy if exists "family_purchase_owner_all" on family.purchase_history;
create policy "family_purchase_owner_all" on family.purchase_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 5a. REAL ESTATE DEALS (family-appens egne notater) ──────
-- RealtyFlow Pro er autoritativ kilde for deals via
-- public.business_financial_events. Disse er kun lokale notater
-- som ikke alltid speiler RealtyFlow.

create table if not exists family.real_estate_deals (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  developer_id          text,
  customer_name         text not null default '',
  lead_source           text default '',
  total_sale_value      numeric default 0,
  gross_commission_base numeric default 0,
  commission_pct        numeric default 0,
  our_gross_commission  numeric default 0,
  our_net_commission    numeric default 0,
  status                text default 'Reserved',
  currency              text default 'NOK',
  business_unit         text default 'Private',
  sale_date             text,
  reservation_date      text,
  contract_date         text,
  completion_date       text,
  commission_payouts    jsonb default '[]',
  customer_payments     jsonb default '[]',
  created_at            timestamptz default now()
);

alter table family.real_estate_deals enable row level security;
drop policy if exists "family_real_estate_deals_owner_all" on family.real_estate_deals;
create policy "family_real_estate_deals_owner_all" on family.real_estate_deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 5b. FARM OPERATIONS (family-appens egne notater) ────────
-- Dona Anna autoritativ kilde er public.harvest_records +
-- public.farm_expenses i RealtyFlows olivia-modul.

create table if not exists family.farm_operations (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  type        text not null default 'Expense',
  category    text not null default 'Other',
  amount      numeric not null default 0,
  description text default '',
  currency    text default 'EUR',
  created_at  timestamptz default now()
);

alter table family.farm_operations enable row level security;
drop policy if exists "family_farm_operations_owner_all" on family.farm_operations;
create policy "family_farm_operations_owner_all" on family.farm_operations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 6. MONDEO EIENDOM AS – salgsfinansiering ───────────────
-- Salget av Mondeo Eiendom AS (4.8 MNOK) finansieres som lån.
-- Rente = Norges Bank styringsrente + 6 %.

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

create table if not exists family.mondeo_loan_payments (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  date                  text not null,
  amount                numeric not null default 0,
  note                  text,
  posted_transaction_id text,
  created_at            timestamptz default now()
);

create index if not exists idx_family_mondeo_payments_user_date
  on family.mondeo_loan_payments (user_id, date);

alter table family.mondeo_loan_settings enable row level security;
alter table family.mondeo_loan_payments enable row level security;

drop policy if exists "family_mondeo_settings_owner_all" on family.mondeo_loan_settings;
drop policy if exists "family_mondeo_payments_owner_all" on family.mondeo_loan_payments;

create policy "family_mondeo_settings_owner_all" on family.mondeo_loan_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "family_mondeo_payments_owner_all" on family.mondeo_loan_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ── 7. KONSOLIDERT ØKONOMI-VIEW ─────────────────────────────
-- Leser fra RealtyFlows sentrale `public.business_financial_events`
-- (som allerede har olive_harvest, commission, kdp_royalty osv.)
-- og kombinerer med family.transactions + Mondeo-renter.
--
-- Forutsetter at public.business_financial_events finnes
-- (opprettes av RealtyFlow Pro migration 20260506100000).

create or replace view family.economy_monthly as
with bfe as (
  select
    date_trunc('month', event_date)::date as month,
    direction,
    stream,
    sum(amount) as amount_eur
  from public.business_financial_events
  where status in ('recognized', 'paid')
  group by 1, 2, 3
),
fx as (
  select coalesce(
    (select rate from public.fx_rates where pair = 'EUR_NOK' limit 1),
    11.55
  ) as eur_nok
),
mondeo as (
  select
    user_id,
    date_trunc('month', to_timestamp(date, 'YYYY-MM-DD'))::date as month,
    sum(amount) as paid_nok
  from family.mondeo_loan_payments
  group by 1, 2
),
mondeo_interest as (
  select
    user_id,
    date_trunc('month', to_timestamp(date, 'YYYY-MM-DD'))::date as month,
    sum(amount) as interest_nok
  from family.transactions
  where category = 'Renteinntekt'
  group by 1, 2
)
select
  coalesce(mi.user_id, m.user_id) as user_id,
  coalesce(b.month, m.month, mi.month) as month,
  (coalesce((select amount_eur from bfe where month = b.month and stream = 'olive_harvest'), 0)
    + coalesce((select amount_eur from bfe where month = b.month and stream = 'olive_subsidy'), 0)
    - coalesce((select amount_eur from bfe where month = b.month and stream = 'olive_expense'), 0)
  ) * (select eur_nok from fx) as olivia_net_nok,
  coalesce((select amount_eur from bfe where month = b.month and stream = 'commission'), 0)
    * (select eur_nok from fx) as realtyflow_net_nok,
  coalesce(mi.interest_nok, 0) as mondeo_interest_nok,
  coalesce(m.paid_nok, 0)      as mondeo_paid_nok
from bfe b
full outer join mondeo m         on b.month = m.month
full outer join mondeo_interest mi on coalesce(b.month, m.month) = mi.month;


-- ── 8. ADMIN: GI FREDDY LIFETIME-ABONNEMENT ─────────────────
update family.user_profiles
set subscription_status = 'lifetime', subscription_expires_at = null
where id = (select id from auth.users where email = 'freddy.bremseth@gmail.com' limit 1);


-- ── FERDIG ──────────────────────────────────────────────────
-- Etter at dette er kjørt:
--   1. Settings → API → legg `family` til "Exposed schemas"
--   2. Pek family-appens VITE_SUPABASE_URL + ANON_KEY mot
--      samme prosjekt som RealtyFlow Pro
--   3. Family-appens supabase-klient er konfigurert med
--      db: { schema: 'family' } så .from('xxx') treffer
--      family.xxx automatisk
