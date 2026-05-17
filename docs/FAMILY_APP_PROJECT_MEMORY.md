# FamilyHub prosjektminne

Dette dokumentet er laget som et lett tilgjengelig minne for nye ChatGPT/Codex-samtaler. Start en ny chat med: `Les docs/FAMILY_APP_PROJECT_MEMORY.md i freddybremseth-coder/family og fortsett derfra.`

## Eier / admin

- Eier/admin: `freddy.bremseth@gmail.com`.
- Admin skal vises som **Livstidsabonnement**, ikke demo- eller prøvebruker.
- Admin har full tilgang, inkludert Business/RealtyFlow.

## Viktige prinsipper

- Nye SaaS-brukere skal aldri se Freddy sine data eller andre kunders data.
- Nye familier må få egen `family_id` / household-id.
- Bruker bestemmer ved registrering om de vil starte med:
  - tomt dashboard uten demo-tall
  - ufarlig random demo-data som ikke kommer fra ekte brukere
- SaaS-kunder skal ikke bruke Freddy sin Supabase, RealtyFlow eller AI-nøkler.
- SaaS-kunder skal instrueres om å sette opp egen Supabase og egne AI-nøkler, eller kjøpe en managed pakke som lagrer dette kryptert per household.

## Feil som er fikset

### FamilyHub persistens

- Bankkontoer, eiendeler, medlemmer og transaksjoner forsvant ved refresh.
- Årsaker var schema/cache/prod mismatch og feil tabell-/kolonnenavn.
- Public-schema støtte og direkte bankkonto-lagring ble fikset.

### RealtyFlow / Business

- FamilyHub importerte først feil antall salg/provisjoner fra RealtyFlow.
- Problemet var blanding av `contacts` og `business_financial_events` samt deduplisering.
- `contacts` er nå master for vunnet salg.
- `business_financial_events` brukes kun for beløpsutfylling, ikke for å redusere antall salg.
- `contacts` med `pipeline_status=WON` og `type=buyer` skal regnes som salg.
- RealtyFlow CRM lagret først ikke 7. kunde ved refresh fordi API kunne skrive `sentiment=100`. Dette ble endret til `sentiment=hot`, mens score settes til `100`.

### Likviditet

- Mondeo Eiendom AS: 35 000 kr inn hver 1. i måneden.
- Lån til Frank: 8 900 kr ut hver 1. i måneden.
- Husleie: 1 550 EUR fast utgift.
- Strøm: maks 110 EUR per måned. Ikke bruk absurd historisk snitt som 15 000+ kr.
- Vann: 30 EUR per måned.
- Likviditet skal kunne vise flere måneder fremover, søk, kalenderliste og graf.

### AI/kategorisering

- AI skal forstå bedre om transaksjon er inntekt, utgift eller overføring.
- Kontoutskrift har ofte egne kolonner for penger inn, penger ut og saldo. PDF-import må ikke gjøre alle beløp positive.
- Når bruker endrer kategori manuelt, skal systemet lære regel, f.eks. `Plenoil -> Drivstoff`.
- Bruker skal kunne redigere alle tall, datoer og kategorier etter import.

## SaaS/produktmodell

- Planer:
  - Basic: kalender, oppgaver, handleliste, familie, dokumenter og enkel økonomi.
  - Avansert: Basic + bank, eiendeler, likviditet, kvitteringer, kontoutskrift og regninger.
  - Livstid: full tilgang for eier/admin.
- Modulbutikk/add-ons:
  - Business / RealtyFlow
  - Kvittering og kontoutskrift AI
  - Dokumentlager
  - Bank og eiendeler
  - Kalender Pro

## Kalender-/familieapp moduler som bør bygges

- Gjentakelser og regler: ukentlig, annenhver uke, månedlig, skolefri, ferier, egendefinerte regler.
- Påminnelser: push/e-post/SMS, flere varsler per hendelse.
- Delt ansvar: hvem henter, kjører, betaler, bekrefter.
- Familie-/skolekalender: skolerute, nasjonale helligdager, lokale bank holidays, lokale fiestaer.
- Offisielle helligdager basert på bosted: land, region/fylke/provins og kommune/by hvis mulig.
- Dokumentkobling: koble hendelser til forsikring, kontrakt, pass, legepapir, garanti eller kvittering.
- Ressurser: bil, bolig, rom, utstyr, nøkler, kjæledyr, lånte ting.
- Likviditet fra kalender: regninger, lønn, provisjon og forventede utgifter fremover.
- AI-forslag: foreslå kategori, oppgave, varsling, dokumentkobling og hvem hendelsen gjelder.
- Modulbutikk: kjøp/aktiver add-ons.

## Supabase som må utvides

Lag/utvid tabeller for:

- `user_profiles`: `family_id`, `family_name`, `location`, `address`, `country_code`, `region_code`, `municipality`, `timezone`, `plan`, `subscription_status`, `demo_data_mode`.
- `households` / `household_members`: egen family/household-modell med RLS.
- `family_holidays`: cache for offisielle helligdager per family_id, land/region/kommune og år.
- `holiday_sources`: kilde/leverandør per land/region.
- `module_catalog`: moduler, prisnivå, plan, beskrivelse.
- `user_module_access`: hvilke moduler bruker/family har aktivert.
- `family_onboarding`: steg, status, supabase/AI-oppsett, demo-valg.

## Helligdager/bosted

Når bruker velger bosted:

- Lagre land, region/fylke/provins, kommune/by og timezone.
- Hent offisielle nasjonale helligdager og bank holidays for landet.
- Hent regionale/lokale helligdager hvis mulig.
- Vis dem i kalenderen med egen type, f.eks. `Holiday`, `Bank Holiday`, `School Holiday`, `Local Fiesta`.
- La bruker skjule eller aktivere typer.
- Cache per år i Supabase slik at kalender ikke er avhengig av ekstern API hver gang.

## Viktige commits fra arbeidet

- `139e63ec39f23edbb5af01fd2f032414c0b4d3f6` i `realtyflow-pro`: fikset CRM won contact persistence.
- `27008035cb31b308279820488848035362b0ad90` i `family`: contacts som master for RealtyFlow-salg.
- `8b591774b29f9730a248c41ebdbb0773f307e267` i `family`: WON buyer contacts teller som salg.
- `3d4a18bed23b2a0c00ad56fd8ac273eadc867236`: Freddy som livstid/admin og SaaS-planer.
- `08cdc613e7c24fc918931210aab4186a3407faa3`: Admin abonnement/moduler.
- `92e08e688a3b3c96b0b81ab7edfc93eb2a9ed59c`: tenant-safe signup.
- `7513387524409fbebfdcebccd279b2cfe7316503`: SaaS-oppsett i innstillinger.

## Neste prioritet

1. Kjør Supabase-migration for `family_id`, plan, demo-valg og holidays.
2. Sikre at alle tabeller filtrerer på `user_id` og/eller `family_id` med RLS.
3. Implementer holiday-fetch/cache basert på bosted.
4. Bygg UI for onboarding: familie, bosted, demo/tom start, Supabase/AI-instruksjoner.
5. Bygg modulbutikk og planstyring.
