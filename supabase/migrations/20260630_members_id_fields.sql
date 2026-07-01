-- Legg til ID-felter og kontaktinfo på familiemedlemmer
alter table if exists public.members
  add column if not exists norwegian_fnr text,
  add column if not exists spanish_nie text,
  add column if not exists spanish_dni text,
  add column if not exists passport_number text,
  add column if not exists passport_expiry date,
  add column if not exists phone text,
  add column if not exists email text;
