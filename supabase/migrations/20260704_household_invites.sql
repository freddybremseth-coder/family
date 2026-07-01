-- Utvid household_members med invitasjon-felter
alter table if exists public.household_members
  add column if not exists invited_email text,
  add column if not exists invited_at timestamptz,
  add column if not exists joined_at timestamptz;

-- Bytt user_id til nullable (siden invitasjon opprettes før konto)
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public'
               and table_name = 'household_members'
               and column_name = 'user_id'
               and is_nullable = 'NO') then
    alter table public.household_members alter column user_id drop not null;
  end if;
end $$;

create index if not exists household_members_invited_email_idx
  on public.household_members (invited_email)
  where invited_email is not null;

-- RLS: la eiere av household administrere medlemmer
drop policy if exists "Household eiere ser medlemmer" on public.household_members;
create policy "Household eiere ser medlemmer" on public.household_members
  for select using (
    exists (
      select 1 from public.households h
       where h.id = household_members.household_id
         and h.owner_user_id = auth.uid()
    )
    or auth.uid() = user_id
  );

drop policy if exists "Household eiere legger til medlemmer" on public.household_members;
create policy "Household eiere legger til medlemmer" on public.household_members
  for insert with check (
    exists (
      select 1 from public.households h
       where h.id = household_members.household_id
         and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Household eiere fjerner medlemmer" on public.household_members;
create policy "Household eiere fjerner medlemmer" on public.household_members
  for delete using (
    exists (
      select 1 from public.households h
       where h.id = household_members.household_id
         and h.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Invitasjoner kan claimes" on public.household_members;
create policy "Invitasjoner kan claimes" on public.household_members
  for update using (
    -- Eier kan alltid oppdatere
    exists (
      select 1 from public.households h
       where h.id = household_members.household_id
         and h.owner_user_id = auth.uid()
    )
    -- ELLER: brukerens e-post matcher invited_email (claim-flyt)
    or (
      invited_email is not null
      and invited_email = (select lower(email) from auth.users where id = auth.uid())
    )
  ) with check (true);
