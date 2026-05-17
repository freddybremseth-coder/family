-- FamilyHub bills / recurring obligations persistence.

create table if not exists public.bills (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric not null default 0,
  currency text not null default 'EUR',
  due_date date,
  due_day integer,
  category text default 'Diverse',
  is_paid boolean default false,
  paid_date date,
  is_recurring boolean default false,
  frequency text,
  is_auto_pay boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists bills_user_due_date_idx on public.bills(user_id, due_date);
create index if not exists bills_user_paid_idx on public.bills(user_id, is_paid);

alter table public.bills enable row level security;

drop policy if exists bills_own on public.bills;
create policy bills_own on public.bills
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
