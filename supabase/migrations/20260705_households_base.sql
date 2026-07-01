-- Base-tabellene for multi-bruker households
-- Kjør denne FØR 20260704_household_invites.sql (den bygger på disse)

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'family' check (plan in ('free', 'family', 'family_pro', 'business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists households_owner_idx on public.households (owner_user_id);

alter table public.households enable row level security;

drop policy if exists "Eiere ser sitt household" on public.households;
create policy "Eiere ser sitt household" on public.households
  for select using (
    auth.uid() = owner_user_id
    or exists (select 1 from public.household_members m where m.household_id = households.id and m.user_id = auth.uid())
  );

drop policy if exists "Eiere lager household" on public.households;
create policy "Eiere lager household" on public.households
  for insert with check (auth.uid() = owner_user_id);

drop policy if exists "Eiere oppdaterer household" on public.households;
create policy "Eiere oppdaterer household" on public.households
  for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

drop policy if exists "Eiere sletter household" on public.households;
create policy "Eiere sletter household" on public.households
  for delete using (auth.uid() = owner_user_id);

-- household_members (baseline før invitasjon-utvidelsen)
create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'child')),
  invited_email text,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists household_members_household_idx on public.household_members (household_id);
create index if not exists household_members_user_idx on public.household_members (user_id) where user_id is not null;
create index if not exists household_members_invited_email_idx on public.household_members (invited_email) where invited_email is not null;

alter table public.household_members enable row level security;

drop policy if exists "Household eiere ser medlemmer" on public.household_members;
create policy "Household eiere ser medlemmer" on public.household_members
  for select using (
    exists (select 1 from public.households h where h.id = household_members.household_id and h.owner_user_id = auth.uid())
    or auth.uid() = user_id
  );

drop policy if exists "Household eiere legger til medlemmer" on public.household_members;
create policy "Household eiere legger til medlemmer" on public.household_members
  for insert with check (
    exists (select 1 from public.households h where h.id = household_members.household_id and h.owner_user_id = auth.uid())
  );

drop policy if exists "Household eiere fjerner medlemmer" on public.household_members;
create policy "Household eiere fjerner medlemmer" on public.household_members
  for delete using (
    exists (select 1 from public.households h where h.id = household_members.household_id and h.owner_user_id = auth.uid())
  );

drop policy if exists "Invitasjoner kan claimes" on public.household_members;
create policy "Invitasjoner kan claimes" on public.household_members
  for update using (
    exists (select 1 from public.households h where h.id = household_members.household_id and h.owner_user_id = auth.uid())
    or (invited_email is not null and invited_email = (select lower(email) from auth.users where id = auth.uid()))
  ) with check (true);
