// Norges Bank Open Data API – styringsrente (key policy rate, KPRA).
// Endepunkt: https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R
// Vi spør om SDMX-JSON og henter siste observasjon.

const ENDPOINT =
  'https://data.norges-bank.no/api/data/IR/B.KPRA.SD.R?format=sdmx-json&lastNObservations=1';

const FALLBACK_RATE = 4.5;
const CACHE_KEY = 'norgesbank_policy_rate_cache';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

export interface PolicyRate {
  value: number;
  observedAt: string;
  source: 'norges-bank' | 'cache' | 'fallback';
}

interface CachedRate {
  rate: PolicyRate;
  fetchedAt: number;
}

function readCache(): CachedRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRate;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(rate: PolicyRate) {
  try {
    const payload: CachedRate = { rate, fetchedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

export async function fetchNorgesBankPolicyRate(): Promise<PolicyRate> {
  const cached = readCache();
  if (cached) {
    return { ...cached.rate, source: 'cache' };
  }

  try {
    const res = await fetch(ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Norges Bank API ${res.status}`);

    const data = await res.json();

    const series = data?.data?.dataSets?.[0]?.series;
    const seriesKey = series ? Object.keys(series)[0] : null;
    const observations = seriesKey ? series[seriesKey]?.observations : null;
    if (!observations) throw new Error('Manglende observations i Norges Bank-respons');

    const timeDim = data?.data?.structure?.dimensions?.observation?.find(
      (d: any) => d.id === 'TIME_PERIOD',
    );
    const timeValues: { id: string }[] = timeDim?.values ?? [];

    const obsKeys = Object.keys(observations);
    const lastKey = obsKeys[obsKeys.length - 1];
    const value = Number(observations[lastKey]?.[0] ?? FALLBACK_RATE);
    const observedAt = timeValues[Number(lastKey)]?.id ?? new Date().toISOString().slice(0, 10);

    const rate: PolicyRate = { value, observedAt, source: 'norges-bank' };
    writeCache(rate);
    return rate;
  } catch (err) {
    console.warn('[norgesBankService] kunne ikke hente styringsrente, bruker fallback', err);
    return {
      value: FALLBACK_RATE,
      observedAt: new Date().toISOString().slice(0, 10),
      source: 'fallback',
    };
  }
}
