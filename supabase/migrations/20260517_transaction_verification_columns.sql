-- Keep bank statement / receipt verification status after refresh.
-- Run this in the FamilyHub Supabase project.
-- Safe for databases where verified_at was previously created as text.

alter table if exists public.transactions
  add column if not exists is_verified boolean default false,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_source text,
  add column if not exists matched_receipt_id text,
  add column if not exists bank_statement_ref text,
  add column if not exists from_account_id text,
  add column if not exists to_account_id text,
  add column if not exists is_accrual boolean default false,
  add column if not exists payment_method text;

-- If verified_at already existed as text, convert it to timestamptz where possible.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'verified_at'
      and data_type = 'text'
  ) then
    alter table public.transactions
      alter column verified_at type timestamptz
      using nullif(verified_at, '')::timestamptz;
  end if;
end $$;

create index if not exists transactions_user_verified_idx
  on public.transactions(user_id, is_verified);

create index if not exists transactions_bank_statement_ref_idx
  on public.transactions(bank_statement_ref)
  where bank_statement_ref is not null;

create index if not exists transactions_matched_receipt_idx
  on public.transactions(matched_receipt_id)
  where matched_receipt_id is not null;

-- If older rows have a bank statement or receipt reference, treat them as verified.
update public.transactions
set is_verified = true,
    verified_at = coalesce(verified_at, now()),
    verification_source = coalesce(verification_source, case when bank_statement_ref is not null then 'bank_statement' else 'receipt' end)
where coalesce(is_verified, false) = false
  and (bank_statement_ref is not null or matched_receipt_id is not null);
