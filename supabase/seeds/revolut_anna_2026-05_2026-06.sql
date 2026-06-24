-- ===================================================================
-- Import av Annas Revolut-konto (kontoutskrift 1. mai – 24. juni 2026)
-- Alle bevegelser i transaksjons-loggen til FamilyHub.
-- "For å putte EUR Sparing fra EUR i lommen" og "Vekslet til EUR" er
-- interne overføringer og hoppes over.
-- Idempotent: ON CONFLICT (id) DO NOTHING.
-- ===================================================================

-- Tips: Kjør først for å se hvilke brukere som finnes:
--   select id, email from auth.users order by created_at;
--
-- Sett deretter user_id under (hentet fra konsoll: 0fe68471-6c3e-4745-b8cc-25fdc4d5a8ee)
-- eller bruk e-post-oppslag.

do $$
declare
  uid uuid;
begin
  -- Variant A (anbefalt): direkte user_id fra konsoll
  uid := '0fe68471-6c3e-4745-b8cc-25fdc4d5a8ee'::uuid;

  -- Variant B (bytt ut over og bruk denne): finn etter e-post
  -- select id into uid from auth.users where email = 'din@epost.no' limit 1;

  if uid is null then
    raise exception 'user_id er null – sett ID manuelt eller bruk e-post-oppslag (Variant B).';
  end if;

  -- Verifiser at brukeren finnes
  if not exists (select 1 from auth.users where id = uid) then
    raise exception 'Bruker med id % finnes ikke i auth.users. Kjør: select id, email from auth.users; for å finne riktig ID.', uid;
  end if;

  insert into family.transactions
    (id, user_id, date, amount, currency, description, category, type, payment_method, is_accrual)
  values
    -- ── Mai 2026 ────────────────────────────────────────────────────
    ('revolut-20260430-galp',          uid, '2026-04-30',  30.00,  'EUR', 'Galp – Pedreguer (drivstoff)',                'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260501-agrodisa',      uid, '2026-05-01', 776.49,  'EUR', 'AGRODISA DEL VINALOPO SL – overføring',       'Næring',       'EXPENSE', 'Bank', false),
    ('revolut-20260501-terra-natura',  uid, '2026-05-01', 180.00,  'EUR', 'Terra Natura Benidorm – billetter',           'Underholdning','EXPENSE', 'Bank', false),
    ('revolut-20260502-mercadona',     uid, '2026-05-02',  83.23,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260505-iberdrola',     uid, '2026-05-05',  78.93,  'EUR', 'Iberdrola strøm – Presidente Adolfo Suárez 14','Bolig',        'EXPENSE', 'Bank', false),
    ('revolut-20260505-digi',          uid, '2026-05-05',  10.00,  'EUR', 'DIGI mobil',                                  'Telefon',      'EXPENSE', 'Bank', false),
    ('revolut-20260505-digi-refund',   uid, '2026-05-05',  10.05,  'EUR', 'DIGI mobil – tilbakebetalt',                  'Refusjon',     'INCOME',  'Bank', false),
    ('revolut-20260506-teika',         uid, '2026-05-06',   0.75,  'EUR', 'Teika M Vending',                             'Diverse',      'EXPENSE', 'Bank', false),
    ('revolut-20260506-lidl-1',        uid, '2026-05-06',  26.18,  'EUR', 'Lidl Finestrat',                              'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260506-don-dino',      uid, '2026-05-06',  30.83,  'EUR', 'Don Dino Finestrat',                          'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260506-plenergy-1',    uid, '2026-05-06',  50.00,  'EUR', 'Plenergy Finestrat (drivstoff)',              'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260506-amazon',        uid, '2026-05-06', 424.99,  'EUR', 'Amazon',                                      'Shopping',     'EXPENSE', 'Bank', false),
    ('revolut-20260507-tienda-1',      uid, '2026-05-07',  42.86,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260507-mercadona',     uid, '2026-05-07',  57.89,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260507-baltica-1',     uid, '2026-05-07',  11.85,  'EUR', 'Supermercado Báltica Villajoyosa',            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260507-lidl-2',        uid, '2026-05-07',  41.56,  'EUR', 'Lidl Finestrat',                              'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260509-carrefour-1',   uid, '2026-05-09', 225.16,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260513-farmacia-1',    uid, '2026-05-13',  38.75,  'EUR', 'Farmacia Poniente Benidorm',                  'Helse',        'EXPENSE', 'Bank', false),
    ('revolut-20260513-mercadona-2',   uid, '2026-05-13',  65.83,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260513-ryanair',       uid, '2026-05-13', 180.92,  'EUR', 'Ryanair – flybillett',                        'Reise',        'EXPENSE', 'Bank', false),
    ('revolut-20260514-plus-fee-1',    uid, '2026-05-14',   3.99,  'EUR', 'Revolut Plus-abonnement',                     'Gebyr',        'EXPENSE', 'Bank', false),
    ('revolut-20260516-tienda-2',      uid, '2026-05-16',  60.69,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260516-mercadona-3',   uid, '2026-05-16',  33.46,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260518-gasexpress',    uid, '2026-05-18',  50.00,  'EUR', 'Gasexpress Valencia (drivstoff)',             'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260519-nodo-1',        uid, '2026-05-19',  19.90,  'EUR', 'Nodo Networks – internett Eagle Tower apt 48','Internett',    'EXPENSE', 'Bank', false),
    ('revolut-20260519-mercadona-4',   uid, '2026-05-19',  69.41,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260520-frutas',        uid, '2026-05-20',  13.40,  'EUR', 'Frutas Juanete Mutxamel',                     'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260521-hidraqua',      uid, '2026-05-21', 104.50,  'EUR', 'Hidraqua – vann (kontrakt 11859352)',         'Bolig',        'EXPENSE', 'Bank', false),
    ('revolut-20260522-maria-1',       uid, '2026-05-22',1550.00,  'EUR', 'Maria Safrina Bialon – overføring',           'Lønn',         'EXPENSE', 'Bank', false),
    ('revolut-20260522-amazon-prime',  uid, '2026-05-22',   1.99,  'EUR', 'Amazon Prime Video ad-free',                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260523-carrefour-2',   uid, '2026-05-23', 220.60,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260525-daniel-gl',     uid, '2026-05-25',2971.50,  'EUR', 'Daniel Gallardo Lopez – Faktura 15, Mondeo Eiendom AS', 'Mondeo', 'EXPENSE', 'Bank', false),
    ('revolut-20260526-action',        uid, '2026-05-26',  14.20,  'EUR', 'Action Alicante',                             'Shopping',     'EXPENSE', 'Bank', false),
    ('revolut-20260526-mercadona-5',   uid, '2026-05-26',  40.81,  'EUR', 'Mercadona Finestrat La Marina',               'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260526-carrefour-3',   uid, '2026-05-26',  22.83,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260526-youtube',       uid, '2026-05-26',  13.99,  'EUR', 'YouTube Premium',                             'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260527-iberdrola-2',   uid, '2026-05-27',  59.14,  'EUR', 'Iberdrola strøm',                             'Bolig',        'EXPENSE', 'Bank', false),
    ('revolut-20260529-newyork-1',     uid, '2026-05-29',  11.80,  'EUR', 'New York II Finestrat',                       'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260529-quality-cash',  uid, '2026-05-29',  52.97,  'EUR', 'Quality Cash La Vila',                        'Shopping',     'EXPENSE', 'Bank', false),
    ('revolut-20260530-consum',        uid, '2026-05-30',  87.17,  'EUR', 'Consum La Vilajoiosa',                        'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260530-con-brassa',    uid, '2026-05-30',  67.50,  'EUR', 'Con Brassa Benidorm',                         'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260531-google-one',    uid, '2026-05-31',  21.99,  'EUR', 'Google One',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260531-openai-sub',    uid, '2026-05-31',  20.95,  'EUR', 'OpenAI ChatGPT-abonnement',                   'Subscription', 'EXPENSE', 'Bank', false),

    -- ── Juni 2026 ───────────────────────────────────────────────────
    ('revolut-20260601-plenergy-2',    uid, '2026-06-01',  60.00,  'EUR', 'Plenergy Finestrat (drivstoff)',              'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260601-openai-1',      uid, '2026-06-01',   5.32,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260602-masymas',       uid, '2026-06-02',  27.77,  'EUR', 'Supermercados Masymas Denia',                 'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260603-hortalizas',    uid, '2026-06-03',   5.00,  'EUR', 'Hortalizas La Gordica',                       'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260603-ferrandiz',     uid, '2026-06-03',  12.00,  'EUR', 'Santiago Ferrandiz Ram',                      'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260604-farmacia-2',    uid, '2026-06-04',  15.32,  'EUR', 'Farmacia Poniente Benidorm',                  'Helse',        'EXPENSE', 'Bank', false),
    ('revolut-20260604-nodo-2',        uid, '2026-06-04',  19.90,  'EUR', 'Nodo Networks – internett',                   'Internett',    'EXPENSE', 'Bank', false),
    ('revolut-20260605-chino',         uid, '2026-06-05',  23.18,  'EUR', 'Comercio Chino Cuatro Finestrat',             'Shopping',     'EXPENSE', 'Bank', false),
    ('revolut-20260605-ca',            uid, '2026-06-05',  47.97,  'EUR', 'C&A Modas Benidorm',                          'Klær',         'EXPENSE', 'Bank', false),
    ('revolut-20260605-cafe-aq',       uid, '2026-06-05',  13.00,  'EUR', 'Cafetería Restaurante Aq Benidorm',           'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260606-leroy',         uid, '2026-06-06', 491.98,  'EUR', 'Leroy Merlin Finestrat',                      'Hjem',         'EXPENSE', 'Bank', false),
    ('revolut-20260606-tienda-3',      uid, '2026-06-06',  88.42,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260606-baltica-2',     uid, '2026-06-06',  13.80,  'EUR', 'Supermercado Báltica Villajoyosa',            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260606-mercadona-6',   uid, '2026-06-06',  71.13,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260606-openai',        uid, '2026-06-06',   5.35,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260607-itv-1',         uid, '2026-06-07',  41.47,  'EUR', 'Societat Valenciana ITV',                     'Bil',          'EXPENSE', 'Bank', false),
    ('revolut-20260607-itv-2',         uid, '2026-06-07',  41.47,  'EUR', 'Societat Valenciana ITV',                     'Bil',          'EXPENSE', 'Bank', false),
    ('revolut-20260607-itv-3',         uid, '2026-06-07',  41.47,  'EUR', 'Societat Valenciana ITV',                     'Bil',          'EXPENSE', 'Bank', false),
    ('revolut-20260607-dgt',           uid, '2026-06-07', 100.00,  'EUR', 'Dirección General de Tráfico – bot',          'Bil',          'EXPENSE', 'Bank', false),
    ('revolut-20260607-openai-sum',    uid, '2026-06-07',  26.95,  'EUR', 'OpenAI API – 5 kall',                         'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260608-openai-1',      uid, '2026-06-08',   5.37,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260608-carrefour-4',   uid, '2026-06-08',  15.08,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260608-itv-refund-1',  uid, '2026-06-08',  41.47,  'EUR', 'Societat Valenciana ITV – refusjon',          'Refusjon',     'INCOME',  'Bank', false),
    ('revolut-20260608-itv-refund-2',  uid, '2026-06-08',  41.47,  'EUR', 'Societat Valenciana ITV – refusjon',          'Refusjon',     'INCOME',  'Bank', false),
    ('revolut-20260608-openai-sum',    uid, '2026-06-08',  10.68,  'EUR', 'OpenAI API – 2 kall',                         'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260609-hkh-commission',uid, '2026-06-09',4400.00,  'EUR', 'HKH AFTERMARKET AND SALES SL – INV162 commission HOPE', 'Provisjon', 'INCOME', 'Bank', false),
    ('revolut-20260609-tienda-4',      uid, '2026-06-09',  97.77,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260609-openai-sum',    uid, '2026-06-09',  16.03,  'EUR', 'OpenAI API – 3 kall',                         'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260610-flores',        uid, '2026-06-10',  12.00,  'EUR', 'Flores Isidro',                               'Diverse',      'EXPENSE', 'Bank', false),
    ('revolut-20260610-frutas-garcia', uid, '2026-06-10',  14.64,  'EUR', 'Frutas Garcia Cox',                           'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260610-confiteria',    uid, '2026-06-10',   7.50,  'EUR', 'Confitería M. Manresa',                       'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260610-pomes',         uid, '2026-06-10',  11.00,  'EUR', 'Pomes De La Sarga',                           'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260611-mercadona-7',   uid, '2026-06-11',  11.39,  'EUR', 'Mercadona Benidorm',                          'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260612-openai',        uid, '2026-06-12',   5.30,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260613-carrefour-5',   uid, '2026-06-13',  87.16,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260613-farmacia-3',    uid, '2026-06-13',  38.75,  'EUR', 'Farmacia Poniente Benidorm',                  'Helse',        'EXPENSE', 'Bank', false),
    ('revolut-20260613-mercadona-8',   uid, '2026-06-13',  25.26,  'EUR', 'Mercadona Benidorm',                          'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260614-plus-fee-2',    uid, '2026-06-14',   3.99,  'EUR', 'Revolut Plus-abonnement',                     'Gebyr',        'EXPENSE', 'Bank', false),
    ('revolut-20260614-plenergy-3',    uid, '2026-06-14',  50.00,  'EUR', 'Plenergy Finestrat (drivstoff)',              'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260614-openai',        uid, '2026-06-14',   5.43,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260615-tienda-5',      uid, '2026-06-15',  54.93,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260615-carrefour-6',   uid, '2026-06-15',   3.64,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260616-mercadona-9',   uid, '2026-06-16',  30.48,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260617-newyork-2',     uid, '2026-06-17',  21.80,  'EUR', 'New York II Finestrat',                       'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260618-decathlon',     uid, '2026-06-18',  15.99,  'EUR', 'Decathlon Finestrat',                         'Sport',        'EXPENSE', 'Bank', false),
    ('revolut-20260618-plenergy-4',    uid, '2026-06-18',  60.00,  'EUR', 'Plenergy Finestrat (drivstoff)',              'Drivstoff',    'EXPENSE', 'Bank', false),
    ('revolut-20260618-carrefour-7',   uid, '2026-06-18', 161.51,  'EUR', 'Carrefour Finestrat',                         'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260618-openai-sum',    uid, '2026-06-18',  10.74,  'EUR', 'OpenAI API – 2 kall',                         'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260619-maria-2',       uid, '2026-06-19',1550.00,  'EUR', 'Maria Safrina Bialon – overføring',           'Lønn',         'EXPENSE', 'Bank', false),
    ('revolut-20260619-mercadona-10',  uid, '2026-06-19',  52.61,  'EUR', 'Mercadona Cala Finestrat',                    'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260619-openai',        uid, '2026-06-19',   6.28,  'EUR', 'OpenAI API',                                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260620-mercadona-11',  uid, '2026-06-20',  29.38,  'EUR', 'Mercadona Benidorm',                          'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260620-openai-sum',    uid, '2026-06-20',  21.68,  'EUR', 'OpenAI API – 4 kall',                         'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260621-supabase',      uid, '2026-06-21',  44.15,  'EUR', 'Supabase – plattform',                        'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260621-openai-sum',    uid, '2026-06-21',  75.11,  'EUR', 'OpenAI API – mange kall (intensiv bruk)',     'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260622-amazon-prime',  uid, '2026-06-22',   1.99,  'EUR', 'Amazon Prime Video ad-free',                  'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260622-openai-sum',    uid, '2026-06-22', 114.66,  'EUR', 'OpenAI API – mange kall (intensiv bruk)',     'Subscription', 'EXPENSE', 'Bank', false),
    ('revolut-20260623-tienda-6',      uid, '2026-06-23',  66.96,  'EUR', 'Tienda Finestrat',                            'Mat',          'EXPENSE', 'Bank', false),
    ('revolut-20260623-kfc',           uid, '2026-06-23',  21.88,  'EUR', 'KFC Finestrat',                               'Restaurant',   'EXPENSE', 'Bank', false),
    ('revolut-20260623-mercadona-12',  uid, '2026-06-23',  44.39,  'EUR', 'Mercadona Finestrat La Marina',               'Mat',          'EXPENSE', 'Bank', false)
  on conflict (id) do nothing;

  raise notice 'Import ferdig — % transaksjoner forsøkt insertet.', 99;
end $$;
