create schema if not exists family;

create table if not exists family.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  currency text not null default 'EUR',
  description text not null default '',
  category text not null default 'Diverse',
  type text not null default 'EXPENSE',
  "paymentMethod" text,
  payment_method text,
  "isAccrual" boolean default false,
  "fromAccountId" text,
  "toAccountId" text,
  "isVerified" boolean default false,
  "verifiedAt" text,
  "verificationSource" text,
  "matchedReceiptId" text,
  "bankStatementRef" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family.members (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  "birthDate" text,
  "monthlySalary" numeric not null default 0,
  "monthlyBenefits" numeric not null default 0,
  "monthlyChildBenefit" numeric not null default 0,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table family.transactions enable row level security;
alter table family.members enable row level security;

create or replace function family.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on family.transactions;
create trigger transactions_set_updated_at
before update on family.transactions
for each row execute function family.set_updated_at();

drop trigger if exists members_set_updated_at on family.members;
create trigger members_set_updated_at
before update on family.members
for each row execute function family.set_updated_at();

-- Transactions: innlogget bruker eier egne rader.
drop policy if exists transactions_select_own on family.transactions;
create policy transactions_select_own on family.transactions
  for select using (auth.uid() = user_id);

drop policy if exists transactions_insert_own on family.transactions;
create policy transactions_insert_own on family.transactions
  for insert with check (auth.uid() = user_id);

drop policy if exists transactions_update_own on family.transactions;
create policy transactions_update_own on family.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists transactions_delete_own on family.transactions;
create policy transactions_delete_own on family.transactions
  for delete using (auth.uid() = user_id);

-- Members/beboere: innlogget bruker eier egne rader.
drop policy if exists members_select_own on family.members;
create policy members_select_own on family.members
  for select using (auth.uid() = user_id);

drop policy if exists members_insert_own on family.members;
create policy members_insert_own on family.members
  for insert with check (auth.uid() = user_id);

drop policy if exists members_update_own on family.members;
create policy members_update_own on family.members
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists members_delete_own on family.members;
create policy members_delete_own on family.members
  for delete using (auth.uid() = user_id);
