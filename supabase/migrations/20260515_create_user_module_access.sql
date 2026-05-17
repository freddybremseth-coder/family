-- Must run before 20260516_family_saas_profile_holidays.sql
-- Creates module access dependencies for Admin/SaaS module control.

create extension if not exists pgcrypto;

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

create table if not exists public.user_module_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null references public.module_catalog(id) on delete cascade,
  enabled boolean default true,
  family_id text,
  purchased_at timestamptz,
  expires_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, module_id)
);

create index if not exists user_module_access_family_idx on public.user_module_access(family_id);
create index if not exists user_module_access_user_idx on public.user_module_access(user_id);

alter table public.user_module_access enable row level security;

drop policy if exists user_module_access_own_select on public.user_module_access;
create policy user_module_access_own_select on public.user_module_access
  for select using (user_id = auth.uid());
