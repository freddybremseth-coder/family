const FALLBACK_EUR_NOK = 11.55;
const CACHE_KEY = 'familyhub_fx_eur_nok';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

type CachedFx = {
  rate: number;
  source: string;
  fetchedAt: number;
};

function readCache(): CachedFx | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedFx;
    if (!parsed?.rate || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rate: number, source: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, source, fetchedAt: Date.now() }));
  } catch {}
}

async function fetchWithTimeout(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function tryRate(url: string, source: string, extractor: (data: any) => number) {
  const data = await fetchWithTimeout(url);
  const rate = Number(extractor(data) || 0);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('mangler NOK-rate');
  writeCache(rate, source);
  return { rate, source, diagnostics: [`EUR/NOK hentet fra ${source}: ${rate}`] };
}

export async function getEurToNokRate(): Promise<{ rate: number; source: string; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const cached = readCache();
  if (cached) return { rate: cached.rate, source: cached.source, diagnostics: [`EUR/NOK fra cache: ${cached.rate}`] };

  // Frankfurter sin gamle api.frankfurter.app host svarer nå ofte med 301, som browseren
  // blokkerer med CORS. Bruk den nye hosten først, og behold andre fallbacker.
  const providers: Array<{ url: string; source: string; extractor: (data: any) => number }> = [
    { url: 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=NOK', source: 'Frankfurter/ECB', extractor: (data) => data?.rates?.NOK },
    { url: 'https://open.er-api.com/v6/latest/EUR', source: 'open.er-api.com', extractor: (data) => data?.rates?.NOK },
    { url: 'https://api.exchangerate.host/latest?base=EUR&symbols=NOK', source: 'exchangerate.host', extractor: (data) => data?.rates?.NOK },
  ];

  for (const provider of providers) {
    try {
      return await tryRate(provider.url, provider.source, provider.extractor);
    } catch (err: any) {
      diagnostics.push(`${provider.source} EUR/NOK feilet: ${err?.message || 'ukjent feil'}`);
    }
  }

  return { rate: FALLBACK_EUR_NOK, source: 'fallback', diagnostics: [...diagnostics, `Bruker midlertidig fallback EUR/NOK: ${FALLBACK_EUR_NOK}`] };
}
