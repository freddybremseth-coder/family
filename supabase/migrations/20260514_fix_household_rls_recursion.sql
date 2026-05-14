-- Fix uendelig rekursjon i family.household_members RLS.
-- Tidligere policyer kunne sjekke household-medlemskap ved å selecte fra
-- family.household_members inne i en policy på samme tabell. Det re-evaluerer
-- policyen rekursivt og gir Postgres/Supabase 500.
--
-- Løsning: SECURITY DEFINER helpers leser membership/ownership internt og
-- bypasser RLS for selve sjekken.

create schema if not exists family;

create or replace function family.is_household_member(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = family, public, pg_catalog
as $$
  select exists (
    select 1
    from family.household_members
    where household_id = p_household_id
      and user_id = p_user_id
  );
$$;

create or replace function family.is_household_owner(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = family, public, pg_catalog
as $$
  select exists (
    select 1
    from family.households
    where id = p_household_id
      and owner_user_id = p_user_id
  );
$$;

create or replace function family.is_household_adult_or_owner(p_household_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = family, public, pg_catalog
as $$
  select family.is_household_owner(p_household_id, p_user_id)
    or exists (
      select 1
      from family.household_members
      where household_id = p_household_id
        and user_id = p_user_id
        and role in ('owner', 'adult')
    );
$$;

grant execute on function family.is_household_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function family.is_household_owner(uuid, uuid) to anon, authenticated, service_role;
grant execute on function family.is_household_adult_or_owner(uuid, uuid) to anon, authenticated, service_role;

-- Households kan leses av eier og medlemmer uten rekursiv policy.
drop policy if exists households_select_own on family.households;
create policy households_select_own on family.households
  for select using (
    owner_user_id = auth.uid()
    or family.is_household_member(id, auth.uid())
  );

-- Household members kan leses av seg selv, household-eier eller medlem.
drop policy if exists members_select_household on family.household_members;
create policy members_select_household on family.household_members
  for select using (
    user_id = auth.uid()
    or family.is_household_owner(household_id, auth.uid())
    or family.is_household_member(household_id, auth.uid())
  );

-- Dokumenter kan leses av household-eier eller household-medlemmer.
drop policy if exists documents_select_household on family.family_documents;
create policy documents_select_household on family.family_documents
  for select using (
    family.is_household_owner(household_id, auth.uid())
    or family.is_household_member(household_id, auth.uid())
  );

-- Dokumenter kan administreres av eier/adult. Bruk helper for å unngå ny rekursjon.
drop policy if exists documents_manage_adults on family.family_documents;
create policy documents_manage_adults on family.family_documents
  for all using (
    family.is_household_adult_or_owner(household_id, auth.uid())
  ) with check (
    family.is_household_adult_or_owner(household_id, auth.uid())
  );
