# FamilieHub SaaS Roadmap

Denne branchen bygger en trygg produktversjon av FamilieHub uten å slette privat funksjonalitet.

## Produktprinsipp

FamilieHub skal være familiens private kontrollpanel for:

- kalender
- økonomi
- eiendeler
- regninger
- kvitteringer
- dokumenter
- familiemedlemmer
- oppgaver

Private Freddy-/Business-moduler beholdes, men skal kunne skjules i SaaS-modus.

## Moduser

### Personal

Brukes av Freddy/familien.

Inkluderer:

- standard familiemoduler
- Business
- RealtyFlow
- Dona Anna / Olivia
- Mondeo Eiendom AS
- Aftersale

### SaaS

Brukes for salgbart produkt.

Standardmoduler:

- Oversikt
- Kalender
- Handleliste
- Økonomi
- Eiendeler
- Regninger
- Kvitteringer
- Familie
- Innstillinger

Business er skjult som standard.

## Miljøvariabler

```env
VITE_APP_MODE=personal
```

eller

```env
VITE_APP_MODE=saas
```

Valgfritt:

```env
VITE_ENABLED_MODULES=dashboard,familyplan,shopping,transactions,bank,trends,receipts,members,settings
VITE_DISABLED_MODULES=business
```

## Viktige forbedringer i denne branchen

1. Skille privat app fra SaaS-produkt via feature flags.
2. Rydde menystruktur.
3. Skjule Business for SaaS uten å slette kode.
4. Flytte teknisk diagnose til Innstillinger senere.
5. Fjerne dummydata fra vanlige brukerflater.
6. Standardisere design i retning lys, rolig, profesjonell app.
7. Bygge modul for dokumenter.
8. Klargjøre multi-tenant modell med family_id/household_id.

## Neste steg

- Lage Documents-modul.
- Lage Integrasjoner-side under Innstillinger.
- Flytte Supabase/RealtyFlow/DonaAnna diagnose ut av Business.
- Rydde Dashboard til SaaS-standard.
- Lage onboarding for ny familie.
- Gjøre Business til add-on modul.
