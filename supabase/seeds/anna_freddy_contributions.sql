-- Sett ekstra bidrag for Anna og Freddy
-- ANNA: Depositum 200 000 + Kjøp av Dona Anna 1 100 000 (begge engangs)
-- FREDDY: Mondeo renteinntekt + provisjoner fra eiendomssalg (årlig)

-- 1. Sørg for at kolonnen finnes (idempotent)
alter table if exists public.members
  add column if not exists extra_contributions jsonb;
alter table if exists family.members
  add column if not exists extra_contributions jsonb;

-- 2. Beregn Freddys faktiske provisjons-inntekt siste 12 mnd
--    fra business_financial_events (paid eller recognized)
do $$
declare
  anna_id text;
  freddy_id text;
  fx_rate numeric;
  mondeo_principal numeric;
  mondeo_rate numeric;
  mondeo_annual numeric;
  commission_paid_12m_eur numeric;
  commission_annual_nok numeric;
begin
  -- Finn medlems-ID
  select id::text into anna_id   from public.members where lower(name) like '%anna%'  order by created_at limit 1;
  select id::text into freddy_id from public.members where lower(name) like '%freddy%' order by created_at limit 1;

  if anna_id is null then
    raise notice 'Anna ikke funnet i public.members – sett extra_contributions manuelt';
  end if;
  if freddy_id is null then
    raise notice 'Freddy ikke funnet i public.members – sett extra_contributions manuelt';
  end if;

  -- Hent FX-kurs (EUR→NOK)
  select rate into fx_rate from public.fx_rates where pair = 'EUR_NOK' limit 1;
  if fx_rate is null then fx_rate := 11.55; end if;

  -- Mondeo: hent fra mondeo_loan_settings hvis det finnes
  select initial_principal,
         case when use_fixed_rate then fixed_annual_rate_pct else (norges_bank_rate_pct + margin_pct) end
    into mondeo_principal, mondeo_rate
    from public.mondeo_loan_settings
    limit 1;
  if mondeo_principal is null then mondeo_principal := 4800000; end if;
  if mondeo_rate is null then mondeo_rate := 9; end if;
  mondeo_annual := round(mondeo_principal * mondeo_rate / 100);

  -- Provisjoner: alle EUR-beløp siste 12 mnd, omregnet til NOK
  select coalesce(sum(amount), 0) into commission_paid_12m_eur
    from public.business_financial_events
   where stream = 'commission'
     and direction = 'income'
     and status in ('paid', 'recognized')
     and event_date >= current_date - interval '12 months';
  commission_annual_nok := round(commission_paid_12m_eur * fx_rate);

  raise notice 'Beregnet Mondeo årlig rente: % NOK', mondeo_annual;
  raise notice 'Beregnet commission siste 12mnd (recognized + paid): % NOK (% EUR × % FX)', commission_annual_nok, commission_paid_12m_eur, fx_rate;

  -- ANNA: oppdater ekstra bidrag
  if anna_id is not null then
    update public.members
       set extra_contributions = jsonb_build_array(
         jsonb_build_object('id', 'c-depositum',    'label', 'Depositum',          'amount', 200000,  'frequency', 'oneoff', 'note', 'Innskudd i fellesøkonomi'),
         jsonb_build_object('id', 'c-donaanna',     'label', 'Kjøp av Dona Anna',  'amount', 1100000, 'frequency', 'oneoff', 'note', 'Annas andel av Dona Anna olivenfarm')
       )
     where id = anna_id;
    raise notice 'Anna oppdatert med depositum + Dona Anna kjøp';
  end if;

  -- FREDDY: oppdater ekstra bidrag
  if freddy_id is not null then
    update public.members
       set extra_contributions = jsonb_build_array(
         jsonb_build_object('id', 'c-mondeo-rente',  'label', 'Mondeo Eiendom AS renteinntekt', 'amount', mondeo_annual,         'frequency', 'annual', 'note', mondeo_rate || ' % av selgerkreditt'),
         jsonb_build_object('id', 'c-provisjoner',   'label', 'Provisjoner eiendomssalg',       'amount', commission_annual_nok, 'frequency', 'annual', 'note', 'Soleada + ZenEcoHomes – siste 12 mnd recognized/paid')
       )
     where id = freddy_id;
    raise notice 'Freddy oppdatert med Mondeo % + Provisjoner %', mondeo_annual, commission_annual_nok;
  end if;

end $$;

-- 3. Verifiser
select id, name, extra_contributions
  from public.members
 where lower(name) like '%anna%' or lower(name) like '%freddy%';
