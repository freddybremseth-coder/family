-- Fikser dokumenter-forsvinning:
-- family.family_documents referer family.households, men klienten bruker
-- public.households. Vi speiler tabellen i public og migrerer eksisterende
-- data ved å matche via owner_user_id.

create table if not exists public.family_documents (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  category     text not null default 'Annet',
  owner_label  text not null default 'Familien',
  expiry_date  date,
  note         text,
  file_name    text,
  storage_path text,
  mime_type    text,
  file_size    bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_public_family_documents_household on public.family_documents(household_id);

-- Migrér data fra family.family_documents (én gang, idempotent via on conflict).
-- Vi matcher household mellom family og public via owner_user_id.
insert into public.family_documents (
  id, household_id, created_by, title, category, owner_label, expiry_date, note,
  file_name, storage_path, mime_type, file_size, created_at, updated_at
)
select
  fd.id,
  ph.id as household_id,
  fd.created_by, fd.title, fd.category, fd.owner_label, fd.expiry_date, fd.note,
  fd.file_name, fd.storage_path, fd.mime_type, fd.file_size,
  fd.created_at, fd.updated_at
from family.family_documents fd
join family.households fh on fh.id = fd.household_id
join public.households ph on ph.owner_user_id = fh.owner_user_id
on conflict (id) do nothing;

-- RLS: bruker samme helper som andre public.household-tabeller
alter table public.family_documents enable row level security;

drop policy if exists documents_select_household on public.family_documents;
create policy documents_select_household on public.family_documents
  for select using (public.is_household_owner_or_member(household_id));

drop policy if exists documents_manage_household on public.family_documents;
create policy documents_manage_household on public.family_documents
  for all using (public.is_household_owner_or_member(household_id))
  with check (public.is_household_owner_or_member(household_id));

grant select, insert, update, delete on public.family_documents to authenticated;

-- Refresh PostgREST-schema-cache
notify pgrst, 'reload schema';
