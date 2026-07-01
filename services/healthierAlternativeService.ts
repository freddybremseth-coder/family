// Finn sunnere alternativer basert på Nutri-Score fra Open Food Facts.
// For hver ofte-kjøpt vare med lav Nutri-Score (D/E), søk etter samme
// kategori med bedre score.

import { searchByName, ProductInfo } from './openFoodFactsService';

export interface HealthierAlternative {
  original: {
    name: string;
    nutriScore: string;
    imageUrl?: string;
  };
  alternatives: Array<{
    name: string;
    brand?: string;
    nutriScore: string;
    imageUrl?: string;
    ecoScore?: string;
  }>;
}

/**
 * Slår opp originalen i OFF for å finne kategori, søker deretter etter
 * produkter i samme kategori med bedre Nutri-Score.
 */
export async function findHealthierAlternatives(itemName: string): Promise<HealthierAlternative | null> {
  const originalResults = await searchByName(itemName, 3);
  if (originalResults.length === 0) return null;

  const original = originalResults[0];
  if (!original.nutriScore || ['a', 'b'].includes(original.nutriScore.toLowerCase())) {
    return null; // Allerede sunt
  }

  // Bruk første kategori som søkeord
  const categoryQuery = original.categories && original.categories[0]
    ? original.categories[0]
    : itemName;

  const candidates = await searchByName(categoryQuery, 15);
  const originalGrade = original.nutriScore.toLowerCase();
  const gradeRank = (g?: string | null) => ({ a: 5, b: 4, c: 3, d: 2, e: 1 } as any)[String(g || '').toLowerCase()] || 0;

  const better = candidates
    .filter(c => c.code !== original.code)
    .filter(c => gradeRank(c.nutriScore) > gradeRank(originalGrade))
    .sort((a, b) => gradeRank(b.nutriScore) - gradeRank(a.nutriScore))
    .slice(0, 5);

  if (better.length === 0) return null;

  return {
    original: {
      name: original.name,
      nutriScore: original.nutriScore,
      imageUrl: original.imageSmallUrl || original.imageUrl,
    },
    alternatives: better.map(b => ({
      name: b.name,
      brand: b.brand,
      nutriScore: b.nutriScore || '',
      imageUrl: b.imageSmallUrl || b.imageUrl,
      ecoScore: b.ecoScore || undefined,
    })),
  };
}
