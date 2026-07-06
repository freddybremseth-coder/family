-- Fikser dokumenter-forsvinning:
-- family.family_documents referer family.households, men klienten bruker
-- public.households. Vi speiler tabellen i public og migrerer eksisterende
-- data ved å matche via owner_user_id.

create table if not exists public.family_documents (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  category     text default 'Annet',
  owner        text,
  expiry_date  date,
  notes        text,
  storage_path text,
  file_name    text,
  mime_type    text,
  file_size    bigint,
  ocr_summary  text,
  ai_metadata  jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_public_family_documents_household on public.family_documents(household_id);

-- Migrér data fra family.family_documents (én gang, idempotent via on conflict)
insert into public.family_documents (
  id, household_id, created_by, title, category, owner, expiry_date, notes,
  storage_path, file_name, mime_type, file_size, ocr_summary, ai_metadata,
  created_at, updated_at
)
select
  fd.id,
  ph.id as household_id,
  fd.created_by, fd.title, fd.category, fd.owner, fd.expiry_date, fd.notes,
  fd.storage_path, fd.file_name, fd.mime_type, fd.file_size, fd.ocr_summary, fd.ai_metadata,
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
