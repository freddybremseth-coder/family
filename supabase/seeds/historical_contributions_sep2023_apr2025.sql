-- Historiske bidrag for perioden 01.09.2023 – 01.04.2025
-- FX-kurs: 1 EUR = 11,55 NOK (snitt brukt)
--
-- FREDDY (4 bidrag):
--   1. Event-inntekt 2400 EUR/mnd × 19 mnd (sep 2023–apr 2025) = 45 600 EUR = 526 680 NOK
--   2. Utbetalt provisjon i perioden                          = 15 000 EUR = 173 250 NOK
--   3. Utestående provisjon fra perioden                      = 20 000 EUR = 231 000 NOK
--   4. Salg av tomt                                           = 1 400 000 NOK
--
-- ANNA (2 bidrag):
--   1. Lønn 32 000 NOK/mnd × 4 mnd (01.09.2023–06.01.2024)    = 128 000 NOK
--   2. Lønn 25 600 NOK/mnd × 10 mnd (06.01.2024–06.11.2024)   = 256 000 NOK
--      (= 80 % av 32 000)

-- FREDDY (fm-1778796463017)
update public.members
   set extra_contributions = coalesce(extra_contributions, '[]'::jsonb) || jsonb_build_array(
     jsonb_build_object(
       'id',          'c-event-inntekt-2023-2025',
       'label',       'Event-inntekt (2400 EUR/mnd)',
       'amount',      526680,
       'frequency',   'oneoff',
       'periodStart', '2023-09-01',
       'periodEnd',   '2025-04-01',
       'note',        '2400 EUR × 19 mnd × 11,55 NOK = 526 680 NOK'
     ),
     jsonb_build_object(
       'id',          'c-kommisjon-paid-2023-2025',
       'label',       'Utbetalt provisjon i periode',
       'amount',      173250,
       'frequency',   'oneoff',
       'periodStart', '2023-09-01',
       'periodEnd',   '2025-04-01',
       'note',        '15 000 EUR × 11,55 NOK = 173 250 NOK'
     ),
     jsonb_build_object(
       'id',          'c-kommisjon-utestaaende-2023-2025',
       'label',       'Utestående provisjon fra periode',
       'amount',      231000,
       'frequency',   'oneoff',
       'periodStart', '2023-09-01',
       'periodEnd',   '2025-04-01',
       'note',        '20 000 EUR × 11,55 NOK = 231 000 NOK – ikke utbetalt enda'
     ),
     jsonb_build_object(
       'id',          'c-tomt-salg-2024',
       'label',       'Salg av tomt',
       'amount',      1400000,
       'frequency',   'oneoff',
       'periodStart', '2023-09-01',
       'periodEnd',   '2025-04-01',
       'note',        'Tomtesalg i perioden – 1,4 mill NOK'
     )
   )
 where id = 'fm-1778796463017';

-- ANNA (fm-1778796409205)
update public.members
   set extra_contributions = coalesce(extra_contributions, '[]'::jsonb) || jsonb_build_array(
     jsonb_build_object(
       'id',          'c-anna-loenn-100pct-2023',
       'label',       'Høyere lønn (100 % – 32 000/mnd)',
       'amount',      128000,
       'frequency',   'oneoff',
       'periodStart', '2023-09-01',
       'periodEnd',   '2024-01-06',
       'note',        '32 000 NOK × 4 mnd = 128 000 NOK'
     ),
     jsonb_build_object(
       'id',          'c-anna-loenn-80pct-2024',
       'label',       'Redusert lønn (80 % – 25 600/mnd)',
       'amount',      256000,
       'frequency',   'oneoff',
       'periodStart', '2024-01-06',
       'periodEnd',   '2024-11-06',
       'note',        '25 600 NOK × 10 mnd = 256 000 NOK – før dagens 24 000/mnd'
     )
   )
 where id = 'fm-1778796409205';

-- Verifiser
select id, name, jsonb_pretty(extra_contributions) as bidrag
  from public.members
 where id in ('fm-1778796463017', 'fm-1778796409205');
