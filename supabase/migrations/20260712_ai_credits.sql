-- AI-credit-balance: engangs-tilleggspakker som brukeren kjøper
-- utover månedskvoten i abonnementet. Trekkes først når månedskvote er brukt.

create table if not exists public.ai_credit_balance (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  credits       integer not null default 0,
  updated_at    timestamptz not null default now()
);

-- Historikk over kjøpte pakker (audit + support)
create table if not exists public.ai_credit_purchases (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  pack_id               text not null,             -- ai_pack_small|medium|large
  credits               integer not null,
  price_paid_cents      integer not null,
  currency              text not null default 'EUR',
  stripe_session_id     text,
  stripe_payment_intent text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_ai_credit_purchases_user
  on public.ai_credit_purchases (user_id, created_at desc);

-- RLS
alter table public.ai_credit_balance enable row level security;
alter table public.ai_credit_purchases enable row level security;

drop policy if exists ai_credits_owner_read on public.ai_credit_balance;
create policy ai_credits_owner_read on public.ai_credit_balance
  for select using (auth.uid() = user_id);

drop policy if exists ai_credit_purchases_owner_read on public.ai_credit_purchases;
create policy ai_credit_purchases_owner_read on public.ai_credit_purchases
  for select using (auth.uid() = user_id);

grant select on public.ai_credit_balance to authenticated;
grant select on public.ai_credit_purchases to authenticated;

-- Atomic helper: trekk 1 kreditt fra balanse (used by ai-proxy edge function)
create or replace function public.consume_ai_credit(p_user_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  remaining integer;
begin
  update public.ai_credit_balance
    set credits = credits - 1, updated_at = now()
    where user_id = p_user_id and credits > 0
    returning credits into remaining;
  return remaining is not null;
end;
$$;
