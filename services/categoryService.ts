export const FAMILY_CATEGORIES = [
  'Dagligvarer', 'Restaurant', 'Transport', 'Bolig', 'Bil', 'Barn', 'Helse', 'Klær', 'Reise', 'Business', 'Abonnement', 'Forsikring', 'Strøm', 'Telekom', 'Bankgebyr', 'Lønn', 'Overføring', 'Sparing', 'Diverse'
] as const;

export type FamilyCategory = typeof FAMILY_CATEGORIES[number];

function normalize(value: unknown) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const rules: { category: FamilyCategory; patterns: RegExp[]; weight?: number }[] = [
  { category: 'Dagligvarer', patterns: [/\bkiwi\b/, /\brema\b/, /rema 1000/, /\bmeny\b/, /\bcoop\b/, /extra\b/, /obs\b/, /spar\b/, /joker\b/, /bunnpris/, /oda\b/, /kolonial/, /mercadona/, /carrefour/, /consum\b/, /masymas/, /aldi\b/, /lidl\b/, /supermercado/, /grocery/, /matbutikk/], weight: 5 },
  { category: 'Restaurant', patterns: [/restaurant/, /cafe/, /kafe/, /bar\b/, /pub\b/, /pizza/, /burger/, /kebab/, /sushi/, /takeaway/, /wolt/, /foodora/, /glovo/, /mcdonald/, /burger king/, /starbucks/, /espresso house/, /bakeri/, /panaderia/], weight: 5 },
  { category: 'Transport', patterns: [/taxi/, /uber/, /bolt/, /buss/, /train/, /tog/, /metro/, /tram/, /ryanair/, /norwegian air/, /sas\b/, /vueling/, /iberia/, /parking/, /parkering/, /apcoa/, /easypark/, /bomring/, /autopass/, /toll/], weight: 4 },
  { category: 'Bil', patterns: [/bensin/, /diesel/, /fuel/, /gasolina/, /circle k/, /shell/, /esso/, /uno x/, /yx\b/, /repsol/, /cepsa/, /bp\b/, /verksted/, /taller/, /dekk/, /neumatic/, /eu kontroll/, /service bil/, /carwash/, /lavado/], weight: 6 },
  { category: 'Bolig', patterns: [/ikea/, /jysk/, /clas ohlson/, /byggmax/, /maxbo/, /obs bygg/, /leroy merlin/, /brico/, /ferreteria/, /home/, /bolig/, /husleie/, /rent/, /community fee/, /comunidad/, /felleskost/, /renhold/, /vaskeri/], weight: 4 },
  { category: 'Strøm', patterns: [/strom/, /kraft/, /electric/, /electricidad/, /iberdrola/, /endesa/, /naturgy/, /fortum/, /tibber/, /fjordkraft/, /elvia/, /nettleleie/, /nett leie/], weight: 7 },
  { category: 'Telekom', patterns: [/telenor/, /telia/, /ice\b/, /onecall/, /talkmore/, /altibox/, /nextgentel/, /allente/, /netflix/, /spotify/, /hbo/, /max\b/, /disney/, /viaplay/, /prime video/, /telefon/, /internet/, /fibra/, /movistar/, /orange/, /vodafone/, /simyo/, /masmovil/], weight: 5 },
  { category: 'Helse', patterns: [/apotek/, /pharmacy/, /farmacia/, /lege/, /doctor/, /clinic/, /klinikk/, /tannlege/, /dentist/, /helse/, /hospital/, /medisin/, /medico/, /psykolog/, /optiker/], weight: 5 },
  { category: 'Barn', patterns: [/barnehage/, /skole/, /sfo/, /lekebutikk/, /toys/, /baby/, /barn/, /kids/, /lekia/, /barnas hus/, /babyshop/, /jollyroom/, /school/, /colegio/], weight: 5 },
  { category: 'Klær', patterns: [/zara/, /hm\b/, /h m\b/, /lindex/, /cubus/, /dressmann/, /zalando/, /boozt/, /nike/, /adidas/, /sport outlet/, /xxl\b/, /intersport/, /decathlon/, /clothes/, /klaer/, /sko/, /shoes/], weight: 5 },
  { category: 'Reise', patterns: [/hotel/, /booking com/, /airbnb/, /expedia/, /rental car/, /leiebil/, /avis\b/, /hertz/, /sixt/, /flybillet/, /reise/, /travel/, /resort/, /hostal/, /apartamentos/], weight: 5 },
  { category: 'Forsikring', patterns: [/forsikring/, /insurance/, /gjensidige/, /if skade/, /tryg/, /fremtind/, /frende/, /mapfre/, /linea directa/, /axa\b/], weight: 6 },
  { category: 'Abonnement', patterns: [/subscription/, /abonnement/, /apple com bill/, /google storage/, /icloud/, /microsoft/, /adobe/, /canva/, /chatgpt/, /openai/, /anthropic/, /github/, /vercel/, /supabase/], weight: 4 },
  { category: 'Bankgebyr', patterns: [/gebyr/, /fee\b/, /bank fee/, /rente/, /interest/, /overdraft/, /visa annual/, /card fee/, /omkostning/], weight: 6 },
  { category: 'Lønn', patterns: [/lonn/, /salary/, /payroll/, /arbeidsgiver/, /nav\b/, /pensjon/, /benefit/, /ytelse/], weight: 6 },
  { category: 'Overføring', patterns: [/overforing/, /transfer/, /straksbetaling/, /vipps til/, /fra konto/, /til konto/, /internal transfer/, /egen konto/], weight: 4 },
  { category: 'Sparing', patterns: [/sparing/, /fond/, /aksje/, /nordnet/, /kron\b/, /pareto/, /invest/, /crypto/, /coinbase/, /binance/], weight: 5 },
  { category: 'Business', patterns: [/realtyflow/, /zeneco/, /soleada/, /business/, /firma/, /invoice/, /faktura/, /stripe/, /paypal/, /ads\b/, /meta ads/, /google ads/, /domain/, /hosting/, /regnskap/, /accounting/], weight: 5 },
];

export function inferTransactionCategory(input: { description?: string; vendor?: string; category?: string; type?: string; amount?: number; items?: any[] }): FamilyCategory {
  const existing = String(input.category || '').trim();
  if (existing && existing !== 'Annet' && existing !== 'Diverse' && (FAMILY_CATEGORIES as readonly string[]).includes(existing)) return existing as FamilyCategory;

  const text = normalize([
    input.vendor,
    input.description,
    input.category,
    ...(Array.isArray(input.items) ? input.items.map((item) => `${item?.name || ''} ${item?.category || ''}`) : []),
  ].filter(Boolean).join(' '));

  if (!text) return 'Diverse';

  let best: { category: FamilyCategory; score: number } = { category: 'Diverse', score: 0 };
  for (const rule of rules) {
    const score = rule.patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? (rule.weight || 1) : 0), 0);
    if (score > best.score) best = { category: rule.category, score };
  }

  if (best.score > 0) return best.category;
  return input.type === 'INCOME' ? 'Lønn' : 'Diverse';
}

export function normalizeFamilyCategory(value: unknown): FamilyCategory {
  const raw = String(value || '').trim();
  if ((FAMILY_CATEGORIES as readonly string[]).includes(raw)) return raw as FamilyCategory;
  return inferTransactionCategory({ description: raw, category: raw });
}
