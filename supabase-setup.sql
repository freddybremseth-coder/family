-- ============================================================
-- FamilieHub – Supabase tabelloppset
-- Kjør dette i Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. USER PROFILES (trial + abonnement) ───────────────────
create table if not exists public.user_profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  trial_started_at       timestamptz not null default now(),
  subscription_status    text not null default 'trial',  -- trial | active | cancelled | expired | lifetime
  subscription_plan      text default 'monthly',         -- monthly | annual
  subscription_expires_at timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz default now()
);

-- Add column for existing installs
alter table public.user_profiles
  add column if not exists subscription_plan text default 'monthly';

alter table public.user_profiles enable row level security;

create policy "Bruker ser egen profil"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Bruker lager egen profil"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "Bruker oppdaterer egen profil"
  on public.user_profiles for update
  using (auth.uid() = id);

-- Funksjon: opprett profil automatisk ved signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, trial_started_at, subscription_status)
  values (new.id, now(), 'trial')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger: kjøres automatisk ved ny bruker
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. TRANSACTIONS ─────────────────────────────────────────
create table if not exists public.transactions (
  id             text primary key default gen_random_uuid()::text,
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           text not null,
  amount         numeric not null default 0,
  currency       text not null default 'NOK',
  description    text not null default '',
  category       text not null default '',
  type           text not null default 'EXPENSE',   -- INCOME | EXPENSE | TRANSFER
  payment_method text not null default 'Bank',      -- Bank | Kontant | On-Chain
  is_accrual     boolean default false,
  tax_amount     numeric,
  from_account_id text,
  to_account_id  text,
  created_at     timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Bruker ser egne transaksjoner"
  on public.transactions for select using (auth.uid() = user_id);

create policy "Bruker lager egne transaksjoner"
  on public.transactions for insert with check (auth.uid() = user_id);

create policy "Bruker oppdaterer egne transaksjoner"
  on public.transactions for update using (auth.uid() = user_id);

create policy "Bruker sletter egne transaksjoner"
  on public.transactions for delete using (auth.uid() = user_id);


-- ── 3. FAMILY MEMBERS ───────────────────────────────────────
create table if not exists public.family_members (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  birth_date            text,
  monthly_salary        numeric default 0,
  monthly_benefits      numeric default 0,
  monthly_child_benefit numeric default 0,
  created_at            timestamptz default now()
);

alter table public.family_members enable row level security;

create policy "Bruker ser egne familiemedlemmer"
  on public.family_members for select using (auth.uid() = user_id);

create policy "Bruker lager egne familiemedlemmer"
  on public.family_members for insert with check (auth.uid() = user_id);

create policy "Bruker oppdaterer egne familiemedlemmer"
  on public.family_members for update using (auth.uid() = user_id);

create policy "Bruker sletter egne familiemedlemmer"
  on public.family_members for delete using (auth.uid() = user_id);


-- ── 4. REAL ESTATE DEALS ────────────────────────────────────
create table if not exists public.real_estate_deals (
  id                   text primary key default gen_random_uuid()::text,
  user_id              uuid not null references auth.users(id) on delete cascade,
  developer_id         text,
  customer_name        text not null default '',
  lead_source          text default '',
  total_sale_value     numeric default 0,
  gross_commission_base numeric default 0,
  commission_pct       numeric default 0,
  our_gross_commission numeric default 0,
  our_net_commission   numeric default 0,
  status               text default 'Reserved',
  currency             text default 'NOK',
  business_unit        text default 'Private',
  sale_date            text,
  reservation_date     text,
  contract_date        text,
  completion_date      text,
  commission_payouts   jsonb default '[]',
  customer_payments    jsonb default '[]',
  created_at           timestamptz default now()
);

alter table public.real_estate_deals enable row level security;

create policy "Bruker ser egne eiendomsdealer"
  on public.real_estate_deals for select using (auth.uid() = user_id);

create policy "Bruker lager egne eiendomsdealer"
  on public.real_estate_deals for insert with check (auth.uid() = user_id);

create policy "Bruker oppdaterer egne eiendomsdealer"
  on public.real_estate_deals for update using (auth.uid() = user_id);

create policy "Bruker sletter egne eiendomsdealer"
  on public.real_estate_deals for delete using (auth.uid() = user_id);


-- ── 5. FARM OPERATIONS ──────────────────────────────────────
create table if not exists public.farm_operations (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        text not null,
  type        text not null default 'Expense',
  category    text not null default 'Other',
  amount      numeric not null default 0,
  description text default '',
  currency    text default 'NOK',
  created_at  timestamptz default now()
);

alter table public.farm_operations enable row level security;

create policy "Bruker ser egne gårdsoperasjoner"
  on public.farm_operations for select using (auth.uid() = user_id);

create policy "Bruker lager egne gårdsoperasjoner"
  on public.farm_operations for insert with check (auth.uid() = user_id);

create policy "Bruker oppdaterer egne gårdsoperasjoner"
  on public.farm_operations for update using (auth.uid() = user_id);

create policy "Bruker sletter egne gårdsoperasjoner"
  on public.farm_operations for delete using (auth.uid() = user_id);


-- ── 6. PURCHASE HISTORY (smart shopping cart) ───────────────
create table if not exists public.purchase_history (
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

create index if not exists idx_purchase_history_user_normalized
  on public.purchase_history (user_id, normalized_name);

create index if not exists idx_purchase_history_user_purchased
  on public.purchase_history (user_id, purchased_at desc);

alter table public.purchase_history enable row level security;

create policy "User reads own purchase history"
  on public.purchase_history for select using (auth.uid() = user_id);

create policy "User inserts own purchase history"
  on public.purchase_history for insert with check (auth.uid() = user_id);

create policy "User deletes own purchase history"
  on public.purchase_history for delete using (auth.uid() = user_id);


-- ── 7. GROCERY ITEMS (active shopping list, persisted) ──────
create table if not exists public.grocery_items (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  quantity    numeric default 1,
  unit        text default 'stk',
  store       text default 'Andre',
  is_bought   boolean default false,
  is_suggestion boolean default false,
  category    text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.grocery_items enable row level security;

create policy "User reads own grocery items"
  on public.grocery_items for select using (auth.uid() = user_id);

create policy "User inserts own grocery items"
  on public.grocery_items for insert with check (auth.uid() = user_id);

create policy "User updates own grocery items"
  on public.grocery_items for update using (auth.uid() = user_id);

create policy "User deletes own grocery items"
  on public.grocery_items for delete using (auth.uid() = user_id);


-- ── 8. MONDEO EIENDOM – SALGSFINANSIERING ──────────────────
-- Mondeo Eiendom AS solgt for 4.8 MNOK. Kjøper betaler rente
-- = Norges Bank styringsrente + 6 %. Kjøper styrer selv avdrag.

create table if not exists public.mondeo_loan_settings (
  id                          text primary key default gen_random_uuid()::text,
  user_id                     uuid not null references auth.users(id) on delete cascade,
  initial_principal           numeric not null default 4800000,
  start_date                  text not null,
  margin_pct                  numeric not null default 6,
  norges_bank_rate_pct        numeric not null default 4.5,
  norges_bank_rate_observed_at text,
  buyer_name                  text,
  notes                       text,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

alter table public.mondeo_loan_settings enable row level security;

create policy "Bruker ser egne mondeo-innstillinger"
  on public.mondeo_loan_settings for select using (auth.uid() = user_id);
create policy "Bruker lager egne mondeo-innstillinger"
  on public.mondeo_loan_settings for insert with check (auth.uid() = user_id);
create policy "Bruker oppdaterer egne mondeo-innstillinger"
  on public.mondeo_loan_settings for update using (auth.uid() = user_id);
create policy "Bruker sletter egne mondeo-innstillinger"
  on public.mondeo_loan_settings for delete using (auth.uid() = user_id);

create table if not exists public.mondeo_loan_payments (
  id                    text primary key default gen_random_uuid()::text,
  user_id               uuid not null references auth.users(id) on delete cascade,
  date                  text not null,
  amount                numeric not null default 0,
  note                  text,
  posted_transaction_id text,
  created_at            timestamptz default now()
);

create index if not exists idx_mondeo_loan_payments_user_date
  on public.mondeo_loan_payments (user_id, date);

alter table public.mondeo_loan_payments enable row level security;

create policy "Bruker ser egne mondeo-betalinger"
  on public.mondeo_loan_payments for select using (auth.uid() = user_id);
create policy "Bruker lager egne mondeo-betalinger"
  on public.mondeo_loan_payments for insert with check (auth.uid() = user_id);
create policy "Bruker oppdaterer egne mondeo-betalinger"
  on public.mondeo_loan_payments for update using (auth.uid() = user_id);
create policy "Bruker sletter egne mondeo-betalinger"
  on public.mondeo_loan_payments for delete using (auth.uid() = user_id);


-- ── 9. ADMIN: GI FREDDY LIFETIME-ABONNEMENT ─────────────────
-- Kjør dette ETTER at freddy.bremseth@gmail.com har logget inn minst én gang
-- (slik at auth.users-raden eksisterer)

update public.user_profiles
set
  subscription_status    = 'lifetime',
  subscription_expires_at = null
where id = (
  select id from auth.users where email = 'freddy.bremseth@gmail.com' limit 1
);

-- Alternativ hvis brukeren ikke har logget inn enda – insert direkte:
-- insert into public.user_profiles (id, subscription_status)
-- select id, 'lifetime' from auth.users where email = 'freddy.bremseth@gmail.com'
-- on conflict (id) do update set subscription_status = 'lifetime';


-- ── FERDIG ──────────────────────────────────────────────────
-- 5 tabeller opprettet med RLS + auto-trigger for nye brukere.
-- Freddy får lifetime-status via SQL over.
-- Neste steg:
--   1. Opprett Stripe-produkt: FamilieHub Pro, 20 NOK/mnd
--   2. Legg til Vercel env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
--      STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY
--   3. Sett Stripe webhook-URL til: https://din-app.vercel.app/api/stripe/webhook
