-- ============================================================
-- FAMILIE-HUB · DELT SUPABASE-SKJEMA (Strategi A)
-- ------------------------------------------------------------
-- Kjør dette i SAMME Supabase-prosjekt som FamilieHub allerede bruker.
-- Etter at dette er kjørt vil olivia (olivenfarm) og realtyflow-pro
-- skrive sine egne data hit (med samme auth.uid()), og FamilieHub
-- leser dem via views for den konsoliderte økonomi-oversikten.
--
-- Modellen er enkel: hver app eier sine egne tabeller (olivia_* og
-- realtyflow_*), men auth.users er felles. Family-appen leser alt
-- via views som filtrerer på auth.uid().
-- ============================================================


-- ───────────────────────────────────────────────────────────
-- 1. OLIVIA (olivenfarm Dona Anna) – produksjon, salg, kostnader
-- ───────────────────────────────────────────────────────────

create table if not exists public.olivia_harvests (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  year        int  not null,
  liters      numeric not null default 0,
  variety     text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists public.olivia_sales (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  product     text,                                     -- 'oil' | 'table_olives' | 'other'
  quantity    numeric not null default 0,
  unit        text default 'L',
  amount      numeric not null default 0,
  currency    text default 'EUR',
  customer    text,
  channel     text,                                     -- 'cooperativa' | 'direct' | 'market' | 'export'
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists public.olivia_costs (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  category    text not null,                            -- picking | pruning | maintenance | utilities | other
  amount      numeric not null default 0,
  currency    text default 'EUR',
  vendor      text,
  notes       text,
  created_at  timestamptz default now()
);

alter table public.olivia_harvests enable row level security;
alter table public.olivia_sales    enable row level security;
alter table public.olivia_costs    enable row level security;

create policy "olivia_harvests_owner_all" on public.olivia_harvests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "olivia_sales_owner_all"    on public.olivia_sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "olivia_costs_owner_all"    on public.olivia_costs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────
-- 2. REALTYFLOW-PRO – eiendomsmeglerprovisjoner & deals
-- ───────────────────────────────────────────────────────────

create table if not exists public.realtyflow_deals (
  id                 text primary key default gen_random_uuid()::text,
  user_id            uuid not null references auth.users(id) on delete cascade,
  customer_name      text not null default '',
  developer          text,
  property_ref       text,
  total_sale_value   numeric not null default 0,
  commission_pct     numeric not null default 0,
  gross_commission   numeric not null default 0,
  net_commission     numeric not null default 0,
  currency           text default 'EUR',
  status             text default 'Reserved',          -- Reserved | Contracted | Completed | Cancelled
  business_unit      text default 'realtyflow',
  sale_date          text,
  contract_date      text,
  completion_date    text,
  metadata           jsonb default '{}',
  created_at         timestamptz default now()
);

create table if not exists public.realtyflow_payouts (
  id                 text primary key default gen_random_uuid()::text,
  user_id            uuid not null references auth.users(id) on delete cascade,
  deal_id            text references public.realtyflow_deals(id) on delete cascade,
  expected_date      text,
  amount             numeric not null default 0,
  currency           text default 'EUR',
  status             text default 'Expected',         -- Expected | Paid | Overdue | Cancelled
  paid_date          text,
  notes              text,
  created_at         timestamptz default now()
);

alter table public.realtyflow_deals   enable row level security;
alter table public.realtyflow_payouts enable row level security;

create policy "realtyflow_deals_owner_all" on public.realtyflow_deals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "realtyflow_payouts_owner_all" on public.realtyflow_payouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ───────────────────────────────────────────────────────────
-- 3. CROSS-APP VALUTAKURSER (delt cache)
-- ───────────────────────────────────────────────────────────

create table if not exists public.fx_rates (
  pair        text primary key,                          -- 'EUR_NOK', 'USD_NOK', ...
  rate        numeric not null,
  updated_at  timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy "fx_rates_read_all" on public.fx_rates for select using (true);


-- ───────────────────────────────────────────────────────────
-- 4. KONSOLIDERTE VIEWS FOR FAMILIE-HUB
-- ───────────────────────────────────────────────────────────

create or replace view public.family_economy_olivia as
  select
    user_id,
    date_trunc('month', to_timestamp(date, 'YYYY-MM-DD'))::date as month,
    sum(case when product is not null then amount else 0 end)   as revenue_eur,
    0::numeric                                                  as cost_eur
  from public.olivia_sales
  group by user_id, month
  union all
  select
    user_id,
    date_trunc('month', to_timestamp(date, 'YYYY-MM-DD'))::date as month,
    0::numeric                                                  as revenue_eur,
    sum(amount)                                                 as cost_eur
  from public.olivia_costs
  group by user_id, month;

create or replace view public.family_economy_realtyflow as
  select
    user_id,
    date_trunc('month', to_timestamp(coalesce(completion_date, contract_date, sale_date), 'YYYY-MM-DD'))::date as month,
    sum(net_commission)  as net_commission_eur,
    count(*)             as deals
  from public.realtyflow_deals
  where status in ('Contracted','Completed')
  group by user_id, month;

create or replace view public.family_economy_mondeo as
  select
    p.user_id,
    date_trunc('month', to_timestamp(p.date, 'YYYY-MM-DD'))::date as month,
    sum(t.amount)         as interest_income_nok,
    sum(p.amount)         as paid_nok
  from public.mondeo_loan_payments p
  left join public.transactions t on t.id = p.posted_transaction_id
  group by p.user_id, month;


-- ───────────────────────────────────────────────────────────
-- 5. KONSOLIDERT MÅNEDS-ROLLUP (alt i NOK)
-- Bruker fx_rates for EUR→NOK konvertering.
-- ───────────────────────────────────────────────────────────

create or replace view public.family_economy_monthly as
with eur as (
  select rate from public.fx_rates where pair = 'EUR_NOK' limit 1
)
select
  coalesce(o.user_id, r.user_id, m.user_id) as user_id,
  coalesce(o.month, r.month, m.month)       as month,
  coalesce(o.revenue_eur, 0) * coalesce((select rate from eur), 11.55)  as olivia_revenue_nok,
  coalesce(o.cost_eur, 0)    * coalesce((select rate from eur), 11.55)  as olivia_cost_nok,
  coalesce(r.net_commission_eur, 0) * coalesce((select rate from eur), 11.55) as realtyflow_net_nok,
  coalesce(m.interest_income_nok, 0)        as mondeo_interest_nok
from public.family_economy_olivia o
full outer join public.family_economy_realtyflow r
  on o.user_id = r.user_id and o.month = r.month
full outer join public.family_economy_mondeo m
  on coalesce(o.user_id, r.user_id) = m.user_id
  and coalesce(o.month, r.month) = m.month;


-- ───────────────────────────────────────────────────────────
-- FERDIG
-- ───────────────────────────────────────────────────────────
-- Neste steg:
--   1. Konfigurer olivia og realtyflow-pro med SAMME
--      VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY.
--   2. Skrivinger i olivia/realtyflow-pro må sette user_id = auth.uid().
--   3. Family-appen leser fra public.family_economy_monthly.
