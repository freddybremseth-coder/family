-- Sparemål-tabell
create table if not exists public.financial_goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  deadline date,
  category text not null check (category in ('Savings', 'Investment', 'Purchase')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_goals_user_idx on public.financial_goals (user_id, deadline);

alter table public.financial_goals enable row level security;

create policy "Egne goals read"   on public.financial_goals for select using (auth.uid() = user_id);
create policy "Egne goals insert" on public.financial_goals for insert with check (auth.uid() = user_id);
create policy "Egne goals update" on public.financial_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Egne goals delete" on public.financial_goals for delete using (auth.uid() = user_id);
