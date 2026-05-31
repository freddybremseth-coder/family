# FamilyHub RLS audit

Dato: 2026-05-31

## Fasiten

FamilyHub skal bruke Supabase project ref:

```txt
ereapsfcsqtdmzosgnnn
```

Primært Family schema:

```txt
family
```

Olivia/Doña Anna-lesing skal bruke:

```txt
olivia
```

Den gamle gratis-refen `jvcdkclfcaccogmvvkrs` er blokkert i klienten.

## Funn

1. Family-migrasjonene er i hovedsak eier-/household-baserte:
   `auth.uid() = user_id`, household membership og voksne/admin-roller brukes
   flere steder. Dette er riktig retning for Family.

2. `supabase-setup.sql` gir brede grants:

```txt
grant all on all tables in schema family to anon, authenticated, service_role
```

RLS begrenser rader, men `anon` bør ikke ha brede DML-grants på family-tabeller.
Bruk heller eksplisitte grants til `authenticated`, og gi `anon` kun det som er
helt nødvendig for public read.

3. Flere `security definer`-funksjoner ligger i `family` schema. Siden `family`
er et eksponert Data API-schema, bør privileged helper-funksjoner flyttes til et
privat schema som `private` eller `internal`, med fast `search_path`.

4. `raw_user_meta_data` brukes til bootstrap/display (`family_name`). Det må ikke
brukes for RLS eller autorisering. Bruk `app_metadata`, database-roller eller
egne medlemskapstabeller for autorisasjon.

5. Family appen leser økonomidata fra `public` for enkelte tabeller
(`transactions`, `members`, `assets`, `bank_accounts`). Disse migrasjonene har
owner-baserte policies, men bør dokumenteres som bevisst source-of-truth slik at
`family` og `public` ikke drifter fra hverandre.

## Utført i appen

- Family-klienten kan nå settes med `VITE_FAMILY_SUPABASE_SCHEMA=family`.
- Olivia-klienten bruker `VITE_OLIVIA_SUPABASE_SCHEMA=olivia`.
- Hvis noen av Family/RealtyFlow/Olivia-URL-ene peker til gammel free Supabase,
  bruker appen placeholder-klient og viser blokkert status i Integrasjoner.
- `.env.example` er lagt til med riktig project-ref og schema-variabler.
- `npm audit fix` er kjørt og låsefila er oppdatert til 0 kjente npm-audit-funn.

## Anbefalt policy-modell

- `family.user_profiles`: bruker kan lese/oppdatere egen profil. Admin/service
  role kan administrere.
- `family.households` og `family.household_members`: medlem kan lese egen
  household. Kun owner/adult/admin kan administrere medlemmer.
- `family.family_documents` og storage bucket: household-medlemmer kan lese,
  voksne/admin kan skrive/slette. Storage upsert krever select + insert + update.
- `public.transactions`, `public.members`, `public.assets`, `public.bank_accounts`:
  owner-only per `auth.uid() = user_id`.
- `family.user_module_access`: bruker kan lese egen tilgang, admin kan skrive.

## Kontrollspørringer

```sql
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('family', 'public', 'storage')
order by schemaname, tablename, policyname;
```

```sql
select routine_schema, routine_name, security_type
from information_schema.routines
where routine_schema in ('family', 'public')
  and security_type = 'DEFINER'
order by routine_schema, routine_name;
```

```sql
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'family'
  and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;
```

## Neste databasegrep

1. Flytt `security definer` helper-funksjoner til `private`.
2. Stram grants i `family` schema, spesielt for `anon`.
3. Bekreft at ingen policies bruker `raw_user_meta_data`.
4. Kjør Supabase Security Advisor etter migrasjon.
