// Open Food Facts — gratis produktdatabase (world.openfoodfacts.org)
// Ingen API-nøkkel nødvendig. Cacher 24t i localStorage for å redusere kall.
//
// Bruksområder:
// - Slå opp produktbilde + næringsinnhold fra barcode (skanning)
// - Berike kvittering-linjer (etter OCR) med produktinfo hvis funnet
// - Foreslå sunnere alternativer (Nutri-Score)

const CACHE_KEY = 'openfoodfacts_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface ProductInfo {
  code: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  imageSmallUrl?: string;
  nutriScore?: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  ecoScore?: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  novaGroup?: number;      // 1-4 (1=uprosessert, 4=ultraprosessert)
  categories?: string[];
  ingredientsText?: string;
  allergens?: string[];
  quantity?: string;
  labels?: string[];
  countries?: string[];
}

function loadCache(): Record<string, { at: number; product: ProductInfo | null }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCache(cache: Record<string, { at: number; product: ProductInfo | null }>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

function mapProduct(raw: any, code: string): ProductInfo | null {
  if (!raw || raw.status === 0 || !raw.product) return null;
  const p = raw.product;
  return {
    code,
    name: p.product_name || p.generic_name || 'Ukjent produkt',
    brand: p.brands || undefined,
    imageUrl: p.image_url || p.image_front_url || undefined,
    imageSmallUrl: p.image_small_url || p.image_front_small_url || undefined,
    nutriScore: (p.nutriscore_grade || null) as ProductInfo['nutriScore'],
    ecoScore: (p.ecoscore_grade || null) as ProductInfo['ecoScore'],
    novaGroup: Number(p.nova_group) || undefined,
    categories: (p.categories || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    ingredientsText: p.ingredients_text_es || p.ingredients_text_en || p.ingredients_text || undefined,
    allergens: (p.allergens || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    quantity: p.quantity || undefined,
    labels: (p.labels || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    countries: (p.countries || '').split(',').map((s: string) => s.trim()).filter(Boolean),
  };
}

/**
 * Slår opp et produkt basert på strekkode (EAN/UPC).
 * Cacher resultater 24t. Returnerer null hvis ikke funnet.
 */
export async function lookupByBarcode(barcode: string): Promise<ProductInfo | null> {
  const code = String(barcode || '').replace(/\D/g, '');
  if (code.length < 8) return null;

  const cache = loadCache();
  const cached = cache[code];
  if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
    return cached.product;
  }

  try {
    // Foretrekker spansk lokal for etiketter, men OFF returnerer flere språk
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?lc=es,en`);
    if (!res.ok) throw new Error(`OFF ${res.status}`);
    const data = await res.json();
    const product = mapProduct(data, code);
    cache[code] = { at: Date.now(), product };
    saveCache(cache);
    return product;
  } catch (e) {
    console.warn('[OpenFoodFacts] lookup failed', e);
    return null;
  }
}

/**
 * Søker etter produkter basert på fritekst-navn.
 * Bruker OFF search API. Best for ingredient-navn (ikke butikk-varenavn).
 */
export async function searchByName(query: string, limit = 5): Promise<ProductInfo[]> {
  const q = String(query || '').trim();
  if (q.length < 3) return [];
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${limit}&countries_tags=es`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OFF search ${res.status}`);
    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];
    return products.map((p: any) => mapProduct({ status: 1, product: p }, p.code || '')).filter(Boolean) as ProductInfo[];
  } catch (e) {
    console.warn('[OpenFoodFacts] search failed', e);
    return [];
  }
}

/**
 * Nutri-Score/Eco-Score fargekode for UI.
 */
export function scoreColor(grade: string | null | undefined): string {
  switch ((grade || '').toLowerCase()) {
    case 'a': return '#038141';
    case 'b': return '#85BB2F';
    case 'c': return '#FECB02';
    case 'd': return '#EE8100';
    case 'e': return '#E63E11';
    default: return '#94a3b8';
  }
}
