-- Datadeling: household-medlemmer får tilgang til data eid av household-eier.
-- Helper-funksjonen sjekker om target_user_id enten er auth.uid() (dine data)
-- eller er eier av et household der auth.uid() er registrert som medlem.

create or replace function public.is_data_accessible_to_member(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1
        from households h
        join household_members m on m.household_id = h.id
       where h.owner_user_id = target_user_id
         and m.user_id = auth.uid()
    );
$$;

grant execute on function public.is_data_accessible_to_member(uuid) to authenticated;

-- Generisk oppskrift for hver tabell:
-- 1. Slett gamle policyer som bare sjekker auth.uid() = user_id
-- 2. Lag nye med is_data_accessible_to_member()
-- Vi bruker en block-per-tabell fordi navnene på gamle policyer varierer

-- Helper som lager alle 4 policyer på en tabell (SELECT/INSERT/UPDATE/DELETE)
create or replace function public._create_household_policies(tbl text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists "hh %s read" on public.%I;', tbl, tbl);
  execute format('drop policy if exists "hh %s insert" on public.%I;', tbl, tbl);
  execute format('drop policy if exists "hh %s update" on public.%I;', tbl, tbl);
  execute format('drop policy if exists "hh %s delete" on public.%I;', tbl, tbl);

  execute format('create policy "hh %s read" on public.%I for select using (public.is_data_accessible_to_member(user_id));', tbl, tbl);
  execute format('create policy "hh %s insert" on public.%I for insert with check (public.is_data_accessible_to_member(user_id));', tbl, tbl);
  execute format('create policy "hh %s update" on public.%I for update using (public.is_data_accessible_to_member(user_id)) with check (public.is_data_accessible_to_member(user_id));', tbl, tbl);
  execute format('create policy "hh %s delete" on public.%I for delete using (public.is_data_accessible_to_member(user_id));', tbl, tbl);
end;
$$;

-- Apply på alle relevante tabeller (kun hvis de finnes)
do $$
declare
  t text;
  tables text[] := array[
    'transactions',
    'members',
    'bank_accounts',
    'assets',
    'bills',
    'financial_goals',
    'crypto_assets',
    'olive_inventory',
    'mondeo_loan_settings',
    'mondeo_loan_payments',
    'mondeo_additional_charges',
    'mondeo_kpi_adjustments'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      -- Sørg for at RLS er på
      execute format('alter table public.%I enable row level security;', t);
      perform public._create_household_policies(t);
    end if;
  end loop;
end $$;

-- family_documents er spesiell — bruker owner_user_id eller user_id? La me sjekke begge
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='family_documents' and column_name='user_id') then
    execute 'alter table public.family_documents enable row level security';
    execute 'drop policy if exists "hh family_documents read" on public.family_documents';
    execute 'drop policy if exists "hh family_documents insert" on public.family_documents';
    execute 'drop policy if exists "hh family_documents update" on public.family_documents';
    execute 'drop policy if exists "hh family_documents delete" on public.family_documents';
    execute 'create policy "hh family_documents read" on public.family_documents for select using (public.is_data_accessible_to_member(user_id))';
    execute 'create policy "hh family_documents insert" on public.family_documents for insert with check (public.is_data_accessible_to_member(user_id))';
    execute 'create policy "hh family_documents update" on public.family_documents for update using (public.is_data_accessible_to_member(user_id)) with check (public.is_data_accessible_to_member(user_id))';
    execute 'create policy "hh family_documents delete" on public.family_documents for delete using (public.is_data_accessible_to_member(user_id))';
  end if;
end $$;

-- Refresh cache
notify pgrst, 'reload schema';
