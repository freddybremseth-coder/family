-- Audit-log-tabell for sensitive operasjoner
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,          -- 'user.delete', 'module.toggle', 'mondeo.adjust', 'household.remove_member' osv.
  target_type text,              -- 'user', 'module', 'mondeo_loan_settings', 'household_member' osv.
  target_id text,
  details jsonb,                 -- fritt-felt payload (før-etter, notat osv.)
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_user_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);
create index if not exists audit_log_target_idx on public.audit_log (target_type, target_id);

alter table public.audit_log enable row level security;

-- Alle innloggede brukere kan skrive sin egen aktivitet
drop policy if exists "Egen aktivitet insert" on public.audit_log;
create policy "Egen aktivitet insert" on public.audit_log
  for insert with check (auth.uid() = actor_user_id);

-- Kun admin (og eier) kan lese
drop policy if exists "Admin ser alt" on public.audit_log;
create policy "Admin ser alt" on public.audit_log
  for select using (
    auth.uid() = actor_user_id
    or exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.subscription_status ilike 'lifetime%')
  );
