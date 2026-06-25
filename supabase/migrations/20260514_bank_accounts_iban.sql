-- Legg til IBAN-kolonne i public.bank_accounts (FamilyHub).
-- Kontonummer (account_number) finnes allerede; vi legger til IBAN
-- som separat felt for internasjonal kontoinformasjon.

alter table if exists public.bank_accounts
  add column if not exists iban text;

-- Hvis bank_accounts ligger i en annen schema, gjør samme for family:
alter table if exists family.bank_accounts
  add column if not exists iban text;
