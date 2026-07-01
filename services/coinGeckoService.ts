// Live-priser for kryptovaluta fra CoinGecko (gratis API, ingen nøkkel)
// Cacher priser i 60 sekunder for å unngå rate-limiting.

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; priceUSD: number; priceEUR: number; priceNOK: number }>();

// Map symbol → CoinGecko id
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  ADA: 'cardano',
  DOT: 'polkadot',
  XRP: 'ripple',
  LINK: 'chainlink',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  USDT: 'tether',
  USDC: 'usd-coin',
};

export const SUPPORTED_SYMBOLS = Object.keys(SYMBOL_TO_ID);

export async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, { usd: number; eur: number; nok: number }>> {
  const now = Date.now();
  const uniqueSyms = Array.from(new Set(symbols.map(s => s.toUpperCase()).filter(s => SYMBOL_TO_ID[s])));
  if (uniqueSyms.length === 0) return {};

  // Kun hent de som ikke er cacheble
  const toFetch: string[] = [];
  const result: Record<string, { usd: number; eur: number; nok: number }> = {};

  for (const sym of uniqueSyms) {
    const c = cache.get(sym);
    if (c && (now - c.at) < CACHE_TTL_MS) {
      result[sym] = { usd: c.priceUSD, eur: c.priceEUR, nok: c.priceNOK };
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length === 0) return result;

  const ids = toFetch.map(s => SYMBOL_TO_ID[s]).join(',');
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur,nok`);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    for (const sym of toFetch) {
      const id = SYMBOL_TO_ID[sym];
      const p = data[id];
      if (!p) continue;
      const priceUSD = Number(p.usd || 0);
      const priceEUR = Number(p.eur || 0);
      const priceNOK = Number(p.nok || 0);
      cache.set(sym, { at: now, priceUSD, priceEUR, priceNOK });
      result[sym] = { usd: priceUSD, eur: priceEUR, nok: priceNOK };
    }
  } catch (e) {
    console.warn('[CoinGecko] price fetch failed:', e);
  }
  return result;
}
