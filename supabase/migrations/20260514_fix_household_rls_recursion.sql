-- Fix uendelig rekursjon i family.household_members RLS.
-- Tidligere policy `members_select_household` sjekket om innlogget bruker
-- finnes som annet medlem ved å selecte fra family.household_members,
-- som re-evaluerer policy-en på seg selv. Postgres oppdager dette og
-- returnerer feil; via Supabase PostgREST blir det 500 til klienten.
--
-- Løsning: bruk SECURITY DEFINER-funksjoner som bypasser RLS internt
-- når vi sjekker medlemskap og eierskap fra andre policies.

create schema if not exists family;

-- Helper: er bruker medlem av en household?
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

-- Helper: er bruker eier av en household?
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

grant execute on function family.is_household_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function family.is_household_owner(uuid, uuid)  to anon, authenticated, service_role;

-- Skriv om policy som tidligere rekursivt selectet fra household_members.

drop policy if exists households_select_own on family.households;
create policy households_select_own on family.households
  for select using (
    owner_user_id = auth.uid()
    or family.is_household_member(id, auth.uid())
  );

drop policy if exists members_select_household on family.household_members;
create policy members_select_household on family.household_members
  for select using (
    user_id = auth.uid()
    or family.is_household_owner(household_id, auth.uid())
    or family.is_household_member(household_id, auth.uid())
  );

drop policy if exists documents_select_household on family.family_documents;
create policy documents_select_household on family.family_documents
  for select using (
    family.is_household_owner(household_id, auth.uid())
    or family.is_household_member(household_id, auth.uid())
  );

drop policy if exists documents_manage_adults on family.family_documents;
create policy documents_manage_adults on family.family_documents
  for all using (
    family.is_household_owner(household_id, auth.uid())
    or exists (
      select 1
      from family.household_members hm
      where hm.household_id = family_documents.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'adult')
    )
  ) with check (
    family.is_household_owner(household_id, auth.uid())
    or exists (
      select 1
      from family.household_members hm
      where hm.household_id = family_documents.household_id
        and hm.user_id = auth.uid()
        and hm.role in ('owner', 'adult')
    )
  );
