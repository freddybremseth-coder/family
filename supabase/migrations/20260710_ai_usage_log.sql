-- AI-brukslogg for sentral proxy (ai-proxy edge function)
-- Sporer forbruk pr bruker for rate-limiting og fremtidig faktura-basert billing.

create table if not exists public.ai_usage_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  provider     text not null,           -- 'gemini' | 'claude' | 'openai'
  task         text not null,           -- 'analyzeReceipt' | 'analyzeFridge' | ...
  ok           boolean not null default true,
  error        text,
  tokens       integer,                 -- fylles inn av provider senere
  cost_cents   integer,                 -- estimert kostnad i øre
  created_at   timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_date
  on public.ai_usage_log (user_id, created_at desc);

alter table public.ai_usage_log enable row level security;

-- Kun eier og admin kan lese egne logs. Service role brukes fra edge function.
drop policy if exists ai_usage_owner_read on public.ai_usage_log;
create policy ai_usage_owner_read on public.ai_usage_log
  for select using (auth.uid() = user_id);

-- Ingen client-side insert; kun edge function (service role) skriver
drop policy if exists ai_usage_service_write on public.ai_usage_log;
create policy ai_usage_service_write on public.ai_usage_log
  for insert with check (false);

grant select on public.ai_usage_log to authenticated;
