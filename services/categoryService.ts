export const FAMILY_CATEGORIES = [
  'Dagligvarer', 'Restaurant', 'Transport', 'Bolig', 'Bil', 'Barn', 'Helse', 'Klær', 'Reise', 'Business', 'Abonnement', 'Forsikring', 'Strøm', 'Telekom', 'Bankgebyr', 'Lønn', 'Overføring', 'Sparing', 'Diverse'
] as const;

export type FamilyCategory = typeof FAMILY_CATEGORIES[number];

const CATEGORY_MEMORY_KEY = 'familyhub_category_memory_v1';

type CategoryMemory = Record<string, string>;

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

function merchantKey(value: unknown) {
  const text = normalize(value);
  if (!text) return '';
  const stopWords = new Set(['as', 'asa', 'ab', 'sa', 'sl', 'ltd', 'limited', 'butikk', 'store', 'betaling', 'kortkjop', 'kortkjøp', 'visa', 'mastercard', 'terminal', 'pos']);
  const words = text.split(' ').filter((w) => w.length > 1 && !stopWords.has(w));
  return words.slice(0, 3).join(' ');
}

function readMemory(): CategoryMemory {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORY_MEMORY_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMemory(memory: CategoryMemory) {
  try {
    localStorage.setItem(CATEGORY_MEMORY_KEY, JSON.stringify(memory));
  } catch {}
}

export function rememberTransactionCategory(input: { description?: string; vendor?: string; category?: string }) {
  const category = String(input.category || '').trim();
  if (!category || category === 'Diverse' || category === 'Annet') return;
  const keys = Array.from(new Set([merchantKey(input.vendor), merchantKey(input.description)].filter(Boolean)));
  if (keys.length === 0) return;
  const memory = readMemory();
  keys.forEach((key) => { memory[key] = category; });
  writeMemory(memory);
}

export function getRememberedTransactionCategory(input: { description?: string; vendor?: string }): string | null {
  const memory = readMemory();
  const text = normalize([input.vendor, input.description].filter(Boolean).join(' '));
  if (!text) return null;
  const directKeys = [merchantKey(input.vendor), merchantKey(input.description)].filter(Boolean);
  for (const key of directKeys) if (memory[key]) return memory[key];
  const best = Object.entries(memory)
    .filter(([key]) => key && (text.includes(key) || key.includes(text)))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return best?.[1] || null;
}

const rules: { category: FamilyCategory; patterns: RegExp[]; weight?: number }[] = [
  { category: 'Dagligvarer', patterns: [/\bkiwi\b/, /\brema\b/, /rema 1000/, /\bmeny\b/, /\bcoop\b/, /extra\b/, /obs\b/, /spar\b/, /joker\b/, /bunnpris/, /oda\b/, /kolonial/, /mercadona/, /carrefour/, /consum\b/, /masymas/, /aldi\b/, /lidl\b/, /supermercado/, /grocery/, /matbutikk/], weight: 5 },
  { category: 'Restaurant', patterns: [/restaurant/, /cafe/, /kafe/, /bar\b/, /pub\b/, /pizza/, /burger/, /kebab/, /sushi/, /takeaway/, /wolt/, /foodora/, /glovo/, /mcdonald/, /burger king/, /starbucks/, /espresso house/, /bakeri/, /panaderia/], weight: 5 },
  { category: 'Transport', patterns: [/taxi/, /uber/, /bolt/, /buss/, /train/, /tog/, /metro/, /tram/, /ryanair/, /norwegian air/, /sas\b/, /vueling/, /iberia/, /parking/, /parkering/, /apcoa/, /easypark/, /bomring/, /autopass/, /toll/], weight: 4 },
  { category: 'Bil', patterns: [/bensin/, /diesel/, /fuel/, /gasolina/, /plenoil/, /circle k/, /shell/, /esso/, /uno x/, /yx\b/, /repsol/, /cepsa/, /bp\b/, /verksted/, /taller/, /dekk/, /neumatic/, /eu kontroll/, /service bil/, /carwash/, /lavado/], weight: 6 },
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

export function inferTransactionCategory(input: { description?: string; vendor?: string; category?: string; type?: string; amount?: number; items?: any[] }): FamilyCategory | string {
  const existing = String(input.category || '').trim();
  if (existing && existing !== 'Annet' && existing !== 'Diverse') return existing;

  const remembered = getRememberedTransactionCategory({ vendor: input.vendor, description: input.description });
  if (remembered) return remembered;

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

export function normalizeFamilyCategory(value: unknown): FamilyCategory | string {
  const raw = String(value || '').trim();
  if ((FAMILY_CATEGORIES as readonly string[]).includes(raw)) return raw as FamilyCategory;
  return inferTransactionCategory({ description: raw, category: raw });
}
