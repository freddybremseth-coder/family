-- FamilieHub calendar and task persistence
-- Run after household foundation migration.

create table if not exists family.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to_member_id uuid references family.household_members(id) on delete set null,
  date date not null,
  start_time time,
  end_time time,
  description text not null,
  event_type text not null default 'Social',
  location text,
  reminder_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists family.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references family.households(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  assigned_to_member_id uuid references family.household_members(id) on delete set null,
  date date not null,
  description text not null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_household_date on family.calendar_events(household_id, date);
create index if not exists idx_tasks_household_date on family.tasks(household_id, date);

alter table family.calendar_events enable row level security;
alter table family.tasks enable row level security;

drop policy if exists calendar_events_select_household on family.calendar_events;
create policy calendar_events_select_household on family.calendar_events
  for select using (family.can_access_household(household_id));

drop policy if exists calendar_events_manage_household on family.calendar_events;
create policy calendar_events_manage_household on family.calendar_events
  for all using (family.can_manage_household_documents(household_id))
  with check (family.can_manage_household_documents(household_id));

drop policy if exists tasks_select_household on family.tasks;
create policy tasks_select_household on family.tasks
  for select using (family.can_access_household(household_id));

drop policy if exists tasks_manage_household on family.tasks;
create policy tasks_manage_household on family.tasks
  for all using (family.can_manage_household_documents(household_id))
  with check (family.can_manage_household_documents(household_id));
