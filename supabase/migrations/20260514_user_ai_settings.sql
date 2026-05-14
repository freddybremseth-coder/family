create schema if not exists family;

create table if not exists family.user_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_ciphertext text,
  openai_ciphertext text,
  claude_ciphertext text,
  encryption_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table family.user_ai_settings enable row level security;

drop policy if exists "Users can read own AI settings" on family.user_ai_settings;
create policy "Users can read own AI settings"
  on family.user_ai_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own AI settings" on family.user_ai_settings;
create policy "Users can insert own AI settings"
  on family.user_ai_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own AI settings" on family.user_ai_settings;
create policy "Users can update own AI settings"
  on family.user_ai_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own AI settings" on family.user_ai_settings;
create policy "Users can delete own AI settings"
  on family.user_ai_settings
  for delete
  using (auth.uid() = user_id);

create or replace function family.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_ai_settings_set_updated_at on family.user_ai_settings;
create trigger user_ai_settings_set_updated_at
before update on family.user_ai_settings
for each row execute function family.set_updated_at();
