-- FamilieHub document storage bucket and RLS policies
-- Run after 20260512_saas_foundation.sql has been applied.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-documents',
  'family-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object paths should start with household_id, for example:
-- <household_id>/<document_id>/<filename>

create or replace function family.can_access_household(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = family, public
as $$
  select exists (
    select 1 from family.households h
    where h.id = target_household_id
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from family.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

create or replace function family.can_manage_household_documents(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = family, public
as $$
  select exists (
    select 1 from family.households h
    where h.id = target_household_id
      and h.owner_user_id = auth.uid()
  )
  or exists (
    select 1 from family.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
      and hm.role in ('owner', 'adult')
  );
$$;

drop policy if exists family_documents_storage_select on storage.objects;
create policy family_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'family-documents'
    and family.can_access_household((storage.foldername(name))[1]::uuid)
  );

drop policy if exists family_documents_storage_insert on storage.objects;
create policy family_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'family-documents'
    and family.can_manage_household_documents((storage.foldername(name))[1]::uuid)
  );

drop policy if exists family_documents_storage_update on storage.objects;
create policy family_documents_storage_update on storage.objects
  for update using (
    bucket_id = 'family-documents'
    and family.can_manage_household_documents((storage.foldername(name))[1]::uuid)
  ) with check (
    bucket_id = 'family-documents'
    and family.can_manage_household_documents((storage.foldername(name))[1]::uuid)
  );

drop policy if exists family_documents_storage_delete on storage.objects;
create policy family_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'family-documents'
    and family.can_manage_household_documents((storage.foldername(name))[1]::uuid)
  );
