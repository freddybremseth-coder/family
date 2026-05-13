-- FamilieHub admin users and per-user module access
-- Run in the FamilyHub Supabase project.

create table if not exists family.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  family_name text,
  subscription_status text not null default 'trial',
  trial_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table family.user_profiles add column if not exists email text;
alter table family.user_profiles add column if not exists family_name text;
alter table family.user_profiles add column if not exists subscription_status text not null default 'trial';
alter table family.user_profiles add column if not exists trial_started_at timestamptz not null default now();
alter table family.user_profiles add column if not exists created_at timestamptz not null default now();
alter table family.user_profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists family.user_module_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (user_id, module_id)
);

create or replace function family.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = any (
    array['freddy.bremseth@gmail.com']::text[]
  );
$$;

create or replace function family.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = family, public
as $$
begin
  insert into family.user_profiles (id, email, family_name, subscription_status, trial_started_at, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'family_name', split_part(new.email, '@', 1)),
    'trial',
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    family_name = coalesce(excluded.family_name, family.user_profiles.family_name),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_family_profile on auth.users;
create trigger on_auth_user_created_family_profile
  after insert or update on auth.users
  for each row execute function family.sync_user_profile();

alter table family.user_profiles enable row level security;
alter table family.user_module_access enable row level security;

drop policy if exists user_profiles_self_select on family.user_profiles;
create policy user_profiles_self_select on family.user_profiles
  for select using (id = auth.uid() or family.is_admin());

drop policy if exists user_profiles_self_insert on family.user_profiles;
create policy user_profiles_self_insert on family.user_profiles
  for insert with check (id = auth.uid() or family.is_admin());

drop policy if exists user_profiles_self_update on family.user_profiles;
create policy user_profiles_self_update on family.user_profiles
  for update using (id = auth.uid() or family.is_admin())
  with check (id = auth.uid() or family.is_admin());

drop policy if exists user_module_access_self_select on family.user_module_access;
create policy user_module_access_self_select on family.user_module_access
  for select using (user_id = auth.uid() or family.is_admin());

drop policy if exists user_module_access_admin_manage on family.user_module_access;
create policy user_module_access_admin_manage on family.user_module_access
  for all using (family.is_admin())
  with check (family.is_admin());

create index if not exists idx_user_profiles_email on family.user_profiles(email);
create index if not exists idx_user_module_access_user_id on family.user_module_access(user_id);
