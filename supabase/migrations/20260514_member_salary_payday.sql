alter table if exists family.members
  add column if not exists salary_day integer,
  add column if not exists salary_account_id text;

alter table if exists family.members
  add constraint members_salary_day_valid
  check (salary_day is null or (salary_day >= 1 and salary_day <= 31))
  not valid;

alter table if exists family.members
  validate constraint members_salary_day_valid;
