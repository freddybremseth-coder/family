-- Handlelister – navngitte handlelister med dato.
-- Idempotent: trygt å re-kjøre. Hvis grocery_items finnes fra før (uten
-- list_id), legger vi til manglende kolonner istedenfor å feile.

create schema if not exists family;

-- 1. grocery_lists – navngitt liste med dato (f.eks. "Victoria bursdag")
create table if not exists family.grocery_lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Handleliste',
  list_date   date,
  occasion    text,
  is_default  boolean not null default false,
  is_archived boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_grocery_lists_user_id on family.grocery_lists(user_id);
create index if not exists idx_grocery_lists_user_date on family.grocery_lists(user_id, list_date desc);

-- 2. grocery_items – hvis tabellen finnes fra før (eldre versjon), legg til
--    manglende kolonner. Hvis ikke, lag den fra bunnen av.
create table if not exists family.grocery_items (
  id          uuid primary key default gen_random_uuid(),
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

-- Idempotent kolonne-tillegg for eksisterende tabell
alter table family.grocery_items add column if not exists list_id     uuid;
alter table family.grocery_items add column if not exists user_id     uuid;
alter table family.grocery_items add column if not exists name        text;
alter table family.grocery_items add column if not exists quantity    numeric default 1;
alter table family.grocery_items add column if not exists unit        text default 'stk';
alter table family.grocery_items add column if not exists store       text default 'Andre';
alter table family.grocery_items add column if not exists category    text;
alter table family.grocery_items add column if not exists notes       text;
alter table family.grocery_items add column if not exists is_bought   boolean default false;
alter table family.grocery_items add column if not exists bought_at   timestamptz;
alter table family.grocery_items add column if not exists position    integer default 0;
alter table family.grocery_items add column if not exists created_at  timestamptz default now();
alter table family.grocery_items add column if not exists updated_at  timestamptz default now();

-- 3. Hvis det allerede finnes items uten list_id, lag en default-liste
--    pr bruker og koble eksisterende items til den.
do $$
declare
  rec record;
  new_list_id uuid;
begin
  -- For hver bruker med items uten list_id
  for rec in
    select distinct user_id
    from family.grocery_items
    where list_id is null and user_id is not null
  loop
    -- Bruk eksisterende default-liste, eller lag en ny
    select id into new_list_id
    from family.grocery_lists
    where user_id = rec.user_id and is_default = true
    limit 1;

    if new_list_id is null then
      insert into family.grocery_lists (user_id, name, list_date, is_default)
      values (rec.user_id, 'Familiens handleliste', current_date, true)
      returning id into new_list_id;
    end if;

    update family.grocery_items
    set list_id = new_list_id
    where user_id = rec.user_id and list_id is null;
  end loop;
end $$;

-- 4. Sett FK + not-null constraints på list_id nå som data er migrert
alter table family.grocery_items
  drop constraint if exists grocery_items_list_id_fkey;
alter table family.grocery_items
  add constraint grocery_items_list_id_fkey foreign key (list_id) references family.grocery_lists(id) on delete cascade;

-- Bare gjør list_id NOT NULL hvis alle rader nå har verdi
do $$
declare
  missing int;
begin
  select count(*) into missing from family.grocery_items where list_id is null;
  if missing = 0 then
    alter table family.grocery_items alter column list_id set not null;
  end if;
end $$;

create index if not exists idx_grocery_items_list_id on family.grocery_items(list_id);
create index if not exists idx_grocery_items_user_id on family.grocery_items(user_id);

-- 5. Touch-trigger på updated_at
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

-- 6. RLS – brukere ser bare egne lister og items
alter table family.grocery_lists enable row level security;
alter table family.grocery_items enable row level security;

drop policy if exists grocery_lists_owner_all on family.grocery_lists;
create policy grocery_lists_owner_all on family.grocery_lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists grocery_items_owner_all on family.grocery_items;
create policy grocery_items_owner_all on family.grocery_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. Grants
grant usage on schema family to anon, authenticated;
grant all on family.grocery_lists to authenticated;
grant all on family.grocery_items to authenticated;
