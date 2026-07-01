-- Fikser 42P17 infinite recursion i households ↔ household_members RLS-policyer
-- Bruker SECURITY DEFINER helper som bypasser RLS internt

drop policy if exists "Eiere ser sitt household" on public.households;
drop policy if exists "Household eiere ser medlemmer" on public.household_members;

create or replace function public.is_household_owner_or_member(hh_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from households where id = hh_id and owner_user_id = auth.uid()
  ) or exists (
    select 1 from household_members where household_id = hh_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_household_owner_or_member(uuid) to authenticated;

create policy "Eier eller medlem ser household" on public.households
  for select using (public.is_household_owner_or_member(id));

create policy "Eier eller medlem ser medlemmer" on public.household_members
  for select using (
    public.is_household_owner_or_member(household_id)
    or auth.uid() = user_id
  );

notify pgrst, 'reload schema';
