-- Tabell for tillegg til Mondeo Eiendom AS-gjelden
-- (strøm, kommunalt, forsikring etc. som Extrade har dekket på vegne av Odin Jacobsen)
create table if not exists public.mondeo_additional_charges (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  amount numeric not null,
  type text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists mondeo_charges_user_date_idx
  on public.mondeo_additional_charges (user_id, date);

alter table public.mondeo_additional_charges enable row level security;

create policy "Egne charges read" on public.mondeo_additional_charges
  for select using (auth.uid() = user_id);

create policy "Egne charges insert" on public.mondeo_additional_charges
  for insert with check (auth.uid() = user_id);

create policy "Egne charges update" on public.mondeo_additional_charges
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Egne charges delete" on public.mondeo_additional_charges
  for delete using (auth.uid() = user_id);
