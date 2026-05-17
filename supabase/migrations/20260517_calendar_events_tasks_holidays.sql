-- FamilyHub calendar persistence and holidays.
-- Mirrors existing bank/assets persistence pattern, but for calendar events and tasks.

create extension if not exists pgcrypto;

create table if not exists public.calendar_events (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  title text,
  description text,
  event_type text default 'Appointment',
  assigned_to_id text,
  assigned_to_ids text[] default '{}',
  start_time text,
  end_time text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists calendar_events_assigned_idx on public.calendar_events using gin(assigned_to_ids);

alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_own on public.calendar_events;
create policy calendar_events_own on public.calendar_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date,
  title text,
  description text,
  priority text default 'Medium',
  assigned_to_id text,
  assigned_to_ids text[] default '{}',
  is_complete boolean default false,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_user_date_idx on public.tasks(user_id, task_date);
create index if not exists tasks_assigned_idx on public.tasks using gin(assigned_to_ids);

alter table public.tasks enable row level security;

drop policy if exists tasks_own on public.tasks;
create policy tasks_own on public.tasks
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

create index if not exists family_holidays_family_date_idx on public.family_holidays(family_id, holiday_date);
create index if not exists family_holidays_location_idx on public.family_holidays(country_code, region_code, municipality);

alter table public.family_holidays enable row level security;

drop policy if exists family_holidays_own_user_fallback on public.family_holidays;
create policy family_holidays_own_user_fallback on public.family_holidays
  for all using (family_id = ('user-' || auth.uid()::text))
  with check (family_id = ('user-' || auth.uid()::text));
