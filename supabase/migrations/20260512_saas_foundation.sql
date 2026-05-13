-- FamilieHub SaaS foundation
-- Multi-tenant schema for households, members and documents.
-- Safe to apply after review in Supabase SQL editor.

create schema if not exists family;

create table if not exists family.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'family' check (plan in ('free', 'family', 'family_pro', 'business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text,
  role text not null default 'adult' check (role in ('owner', 'adult', 'child', 'viewer')),
  birth_date date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family.family_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  category text not null default 'Annet',
  owner_label text not null default 'Familien',
  expiry_date date,
  note text,
  file_name text,
  storage_path text,
  mime_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family.integration_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references family.households(id) on delete cascade,
  provider text not null,
  status text not null default 'not_configured' check (status in ('connected', 'not_configured', 'error')),
  display_name text,
  last_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, provider)
);

create index if not exists idx_household_members_household_id on family.household_members(household_id);
create index if not exists idx_household_members_user_id on family.household_members(user_id);
create index if not exists idx_family_documents_household_id on family.family_documents(household_id);
create index if not exists idx_family_documents_expiry_date on family.family_documents(expiry_date);
create index if not exists idx_integration_connections_household_id on family.integration_connections(household_id);

alter table family.households enable row level security;
alter table family.household_members enable row level security;
alter table family.family_documents enable row level security;
alter table family.integration_connections enable row level security;

-- Helper policies. A user can access a household if they are owner or member.

drop policy if exists households_select_own on family.households;
create policy households_select_own on family.households
  for select using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from family.household_members hm
      where hm.household_id = id and hm.user_id = auth.uid()
    )
  );

drop policy if exists households_insert_owner on family.households;
create policy households_insert_owner on family.households
  for insert with check (owner_user_id = auth.uid());

drop policy if exists households_update_owner on family.households;
create policy households_update_owner on family.households
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists members_select_household on family.household_members;
create policy members_select_household on family.household_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from family.household_members hm
      where hm.household_id = household_id and hm.user_id = auth.uid()
    )
  );

drop policy if exists members_manage_owner on family.household_members;
create policy members_manage_owner on family.household_members
  for all using (
    exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists documents_select_household on family.family_documents;
create policy documents_select_household on family.family_documents
  for select using (
    exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from family.household_members hm
      where hm.household_id = household_id and hm.user_id = auth.uid()
    )
  );

drop policy if exists documents_manage_adults on family.family_documents;
create policy documents_manage_adults on family.family_documents
  for all using (
    exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from family.household_members hm
      where hm.household_id = household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'adult')
    )
  ) with check (
    exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from family.household_members hm
      where hm.household_id = household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'adult')
    )
  );

drop policy if exists integrations_select_owner on family.integration_connections;
create policy integrations_select_owner on family.integration_connections
  for select using (
    household_id is null
    or exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists integrations_manage_owner on family.integration_connections;
create policy integrations_manage_owner on family.integration_connections
  for all using (
    household_id is null
    or exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
  ) with check (
    household_id is null
    or exists (
      select 1 from family.households h
      where h.id = household_id and h.owner_user_id = auth.uid()
    )
  );

-- Storage bucket recommendation:
-- insert into storage.buckets (id, name, public)
-- values ('family-documents', 'family-documents', false)
-- on conflict (id) do nothing;
