-- Handlelister – tidligere lå handleliste-items kun i komponent-state og
-- forsvant ved reload. Denne migrasjonen oppretter:
--   family.grocery_lists  – en navngitt liste med dato (f.eks. "Victoria bursdag" 2026-06-12)
--   family.grocery_items  – items knyttet til en liste

create schema if not exists family;

create table if not exists family.grocery_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Handleliste',
  list_date   date,                            -- når lista gjelder (null = uten dato)
  occasion    text,                            -- f.eks. 'bursdag', 'middag', 'ukehandling'
  is_default  boolean not null default false,  -- markert som standard 'Familiens handleliste'
  is_archived boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_grocery_lists_user_id on family.grocery_lists(user_id);
create index if not exists idx_grocery_lists_user_date on family.grocery_lists(user_id, list_date desc);

create table if not exists family.grocery_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references family.grocery_lists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  quantity    numeric not null default 1,
  unit        text not null default 'stk',
  store       text default 'Andre',
  category    text,
  notes       text,
  is_bought   boolean not null default false,
  bought_at   timestamptz,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_grocery_items_list_id on family.grocery_items(list_id);
create index if not exists idx_grocery_items_user_id on family.grocery_items(user_id);

-- Trigger til å oppdatere updated_at automatisk
create or replace function family.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_grocery_lists_touch on family.grocery_lists;
create trigger trg_grocery_lists_touch
  before update on family.grocery_lists
  for each row execute function family.touch_updated_at();

drop trigger if exists trg_grocery_items_touch on family.grocery_items;
create trigger trg_grocery_items_touch
  before update on family.grocery_items
  for each row execute function family.touch_updated_at();

-- RLS – brukere ser bare egne lister og items
alter table family.grocery_lists enable row level security;
alter table family.grocery_items enable row level security;

drop policy if exists grocery_lists_owner_all on family.grocery_lists;
create policy grocery_lists_owner_all on family.grocery_lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists grocery_items_owner_all on family.grocery_items;
create policy grocery_items_owner_all on family.grocery_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Gi tilgang så PostgREST kan lese/skrive
grant usage on schema family to anon, authenticated;
grant all on family.grocery_lists to authenticated;
grant all on family.grocery_items to authenticated;
