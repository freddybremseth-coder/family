-- FamilyHub SaaS profile, module marketplace and holiday cache.
-- Run in Supabase SQL editor or with supabase db push.

create extension if not exists pgcrypto;

alter table if exists public.user_profiles
  add column if not exists family_id text,
  add column if not exists family_name text,
  add column if not exists location text,
  add column if not exists address text,
  add column if not exists country_code text,
  add column if not exists region_code text,
  add column if not exists municipality text,
  add column if not exists timezone text default 'Europe/Oslo',
  add column if not exists plan text default 'basic',
  add column if not exists demo_data_mode text default 'empty',
  add column if not exists onboarding_completed boolean default false,
  add column if not exists updated_at timestamptz default now();

create unique index if not exists user_profiles_family_id_idx
  on public.user_profiles(family_id)
  where family_id is not null;

create index if not exists user_profiles_country_region_idx
  on public.user_profiles(country_code, region_code);

create table if not exists public.module_catalog (
  id text primary key,
  label text not null,
  description text,
  plan text default 'basic',
  price_monthly numeric default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.module_catalog(id, label, description, plan, price_monthly) values
  ('dashboard', 'Oversikt', 'Familieoversikt og nøkkeltall.', 'basic', 0),
  ('familyplan', 'Kalender', 'Familiekalender, oppgaver og ansvar.', 'basic', 0),
  ('shopping', 'Handleliste', 'Delte handlelister og måltidsplan.', 'basic', 0),
  ('transactions', 'Transaksjoner', 'Enkel økonomi og transaksjoner.', 'basic', 0),
  ('documents', 'Dokumentlager', 'Dokumenter, kontrakter og forsikringer.', 'addon', 0),
  ('bank', 'Bank og eiendeler', 'Kontoer, lån, eiendeler og nettoformue.', 'advanced', 0),
  ('receipts', 'Kvittering og AI', 'Kvitteringsscan, kontoutskrift og kategorilæring.', 'addon', 0),
  ('trends', 'Regninger', 'Regninger og faste betalinger.', 'advanced', 0),
  ('business', 'Business / RealtyFlow', 'Salg, provisjoner og business-likviditet.', 'addon', 0),
  ('members', 'Familiemedlemmer', 'Personer, lønn og faste inntekter.', 'basic', 0),
  ('settings', 'Innstillinger', 'Familie, AI, integrasjoner og SaaS-oppsett.', 'basic', 0)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  plan = excluded.plan,
  updated_at = now();

alter table if exists public.user_module_access
  add column if not exists family_id text,
  add column if not exists purchased_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists user_module_access_family_idx
  on public.user_module_access(family_id);

create table if not exists public.family_onboarding (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  family_id text not null,
  family_name text not null,
  demo_data_mode text default 'empty',
  plan text default 'basic',
  location text,
  address text,
  country_code text,
  region_code text,
  municipality text,
  timezone text default 'Europe/Oslo',
  supabase_setup_status text default 'not_started',
  ai_setup_status text default 'not_started',
  completed_steps text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, family_id)
);

alter table public.family_onboarding enable row level security;

drop policy if exists family_onboarding_own on public.family_onboarding;
create policy family_onboarding_own on public.family_onboarding
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.family_holidays (
  id uuid primary key default gen_random_uuid(),
  family_id text not null,
  holiday_date date not null,
  name text not null,
  local_name text,
  type text not null default 'Holiday',
  country_code text not null,
  region_code text,
  municipality text,
  source text,
  is_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(family_id, holiday_date, name, type)
);

create index if not exists family_holidays_family_date_idx
  on public.family_holidays(family_id, holiday_date);

create index if not exists family_holidays_location_idx
  on public.family_holidays(country_code, region_code, municipality);

alter table public.family_holidays enable row level security;

drop policy if exists family_holidays_own on public.family_holidays;
create policy family_holidays_own on public.family_holidays
  for all using (
    family_id in (select family_id from public.user_profiles where id = auth.uid())
  ) with check (
    family_id in (select family_id from public.user_profiles where id = auth.uid())
  );

create table if not exists public.holiday_sources (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  region_code text,
  source_name text not null,
  source_url text,
  supports_regions boolean default false,
  supports_municipality boolean default false,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(country_code, region_code, source_name)
);

insert into public.holiday_sources(country_code, region_code, source_name, source_url, supports_regions, supports_municipality, notes) values
  ('NO', null, 'Nager.Date', 'https://date.nager.at', false, false, 'Norway national public holidays'),
  ('ES', null, 'Nager.Date', 'https://date.nager.at', true, false, 'Spain national and regional public holidays when available'),
  ('GB', null, 'GOV.UK bank holidays', 'https://www.gov.uk/bank-holidays.json', true, false, 'UK bank holidays by region'),
  ('US', null, 'Nager.Date', 'https://date.nager.at', false, false, 'US federal holidays')
on conflict (country_code, region_code, source_name) do update set
  source_url = excluded.source_url,
  supports_regions = excluded.supports_regions,
  supports_municipality = excluded.supports_municipality,
  notes = excluded.notes,
  updated_at = now();
