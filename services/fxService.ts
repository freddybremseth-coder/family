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
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getEurToNokRate(): Promise<{ rate: number; source: string; diagnostics: string[] }> {
  const diagnostics: string[] = [];
  const cached = readCache();
  if (cached) return { rate: cached.rate, source: cached.source, diagnostics: [`EUR/NOK fra cache: ${cached.rate}`] };

  try {
    const data = await fetchWithTimeout('https://api.frankfurter.app/latest?from=EUR&to=NOK');
    const rate = Number(data?.rates?.NOK || 0);
    if (rate > 0) {
      writeCache(rate, 'Frankfurter/ECB');
      return { rate, source: 'Frankfurter/ECB', diagnostics: [`EUR/NOK hentet fra API: ${rate}`] };
    }
  } catch (err: any) {
    diagnostics.push(`Frankfurter EUR/NOK feilet: ${err?.message || 'ukjent feil'}`);
  }

  try {
    const data = await fetchWithTimeout('https://open.er-api.com/v6/latest/EUR');
    const rate = Number(data?.rates?.NOK || 0);
    if (rate > 0) {
      writeCache(rate, 'open.er-api.com');
      return { rate, source: 'open.er-api.com', diagnostics: [`EUR/NOK hentet fra fallback API: ${rate}`] };
    }
  } catch (err: any) {
    diagnostics.push(`Fallback EUR/NOK API feilet: ${err?.message || 'ukjent feil'}`);
  }

  return { rate: FALLBACK_EUR_NOK, source: 'fallback', diagnostics: [...diagnostics, `Bruker midlertidig fallback EUR/NOK: ${FALLBACK_EUR_NOK}`] };
}
