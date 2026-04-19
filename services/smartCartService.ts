/**
 * Smart shopping cart engine.
 * Tracks each completed purchase locally (and optionally in Supabase),
 * computes per-item frequency, and surfaces suggestions when an item is
 * statistically due based on past purchase intervals.
 */

import { supabase, isSupabaseConfigured } from '../supabase';
import type { PurchaseHistoryEntry, SmartSuggestion } from '../types';

const HISTORY_KEY = 'familiehub:purchase_history:v1';
const HISTORY_LIMIT = 500;

const STAPLE_ITEMS = [
  'Melk', 'Brød', 'Egg', 'Smør', 'Ost', 'Skinke', 'Bananer', 'Epler',
  'Kaffe', 'Te', 'Sukker', 'Salt', 'Toalettpapir', 'Tannkrem',
];

export const normalizeName = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\d+(?:[.,]\d+)?\s*(?:stk|kg|g|l|ml|dl|pk|stykker)?/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const loadHistory = (): PurchaseHistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (entries: PurchaseHistoryEntry[]) => {
  try {
    const trimmed = entries.slice(0, HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage unavailable — silent
  }
};

export const recordPurchase = async (
  itemName: string,
  opts: { quantity?: number; unit?: string; store?: string; userId?: string } = {}
): Promise<PurchaseHistoryEntry> => {
  const entry: PurchaseHistoryEntry = {
    id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemName,
    normalizedName: normalizeName(itemName),
    purchasedAt: new Date().toISOString(),
    quantity: opts.quantity ?? 1,
    unit: opts.unit ?? 'stk',
    store: opts.store,
  };

  const next = [entry, ...loadHistory()];
  saveHistory(next);

  if (opts.userId && isSupabaseConfigured()) {
    try {
      await supabase.from('purchase_history').insert({
        id: entry.id,
        user_id: opts.userId,
        item_name: entry.itemName,
        normalized_name: entry.normalizedName,
        purchased_at: entry.purchasedAt,
        quantity: entry.quantity,
        unit: entry.unit,
        store: entry.store ?? null,
      });
    } catch {
      // ignore — local copy still works
    }
  }

  return entry;
};

export const hydrateHistoryFromSupabase = async (userId: string): Promise<PurchaseHistoryEntry[]> => {
  if (!isSupabaseConfigured()) return loadHistory();
  try {
    const { data } = await supabase
      .from('purchase_history')
      .select('*')
      .eq('user_id', userId)
      .order('purchased_at', { ascending: false })
      .limit(HISTORY_LIMIT);

    if (!data) return loadHistory();

    const entries: PurchaseHistoryEntry[] = data.map((row: any) => ({
      id: row.id,
      itemName: row.item_name,
      normalizedName: row.normalized_name,
      purchasedAt: row.purchased_at,
      quantity: Number(row.quantity ?? 1),
      unit: row.unit ?? 'stk',
      store: row.store ?? undefined,
    }));
    saveHistory(entries);
    return entries;
  } catch {
    return loadHistory();
  }
};

interface ItemStats {
  name: string;
  normalized: string;
  totalPurchases: number;
  lastPurchasedAt: string;
  daysSinceLast: number;
  averageIntervalDays: number | null;
}

const computeStats = (history: PurchaseHistoryEntry[]): ItemStats[] => {
  const groups = new Map<string, PurchaseHistoryEntry[]>();
  for (const entry of history) {
    const key = entry.normalizedName;
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  const stats: ItemStats[] = [];
  const now = Date.now();
  groups.forEach((entries, key) => {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
    );
    const last = sorted[0];
    const daysSinceLast = Math.floor((now - new Date(last.purchasedAt).getTime()) / (1000 * 60 * 60 * 24));

    let avg: number | null = null;
    if (sorted.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const diff =
          (new Date(sorted[i].purchasedAt).getTime() - new Date(sorted[i + 1].purchasedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff > 0) intervals.push(diff);
      }
      if (intervals.length > 0) {
        avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      }
    }

    stats.push({
      name: last.itemName,
      normalized: key,
      totalPurchases: sorted.length,
      lastPurchasedAt: last.purchasedAt,
      daysSinceLast,
      averageIntervalDays: avg,
    });
  });

  return stats;
};

interface BuildOpts {
  history: PurchaseHistoryEntry[];
  currentItems: string[];
  limit?: number;
  language?: string;
}

const reasonText = (lang: string, key: string, days?: number) => {
  const map: Record<string, Record<string, string>> = {
    no: {
      likely_running_out: 'Sannsynligvis tomt',
      bought_recently: 'Du kjøper dette ofte',
      average_every: `ca. hver ${days}. dag`,
      days_since: `${days} dager siden kjøp`,
      staple: 'Vanlig dagligvare',
    },
    en: {
      likely_running_out: 'Likely running out',
      bought_recently: 'You buy this often',
      average_every: `about every ${days} days`,
      days_since: `${days} days since purchase`,
      staple: 'Common staple',
    },
    es: {
      likely_running_out: 'Probablemente se acaba',
      bought_recently: 'Lo compras a menudo',
      average_every: `aprox. cada ${days} días`,
      days_since: `Hace ${days} días`,
      staple: 'Producto habitual',
    },
    de: {
      likely_running_out: 'Wahrscheinlich aufgebraucht',
      bought_recently: 'Sie kaufen das oft',
      average_every: `ca. alle ${days} Tage`,
      days_since: `${days} Tage seit Kauf`,
      staple: 'Häufiger Artikel',
    },
    fr: {
      likely_running_out: 'Probablement épuisé',
      bought_recently: 'Vous l\'achetez souvent',
      average_every: `environ tous les ${days} jours`,
      days_since: `${days} jours depuis l'achat`,
      staple: 'Produit courant',
    },
    ru: {
      likely_running_out: 'Вероятно, заканчивается',
      bought_recently: 'Вы покупаете это часто',
      average_every: `в среднем каждые ${days} дн.`,
      days_since: `${days} дн. с покупки`,
      staple: 'Частый товар',
    },
  };
  return map[lang]?.[key] ?? map.en[key] ?? '';
};

export const buildSuggestions = ({
  history,
  currentItems,
  limit = 8,
  language = 'no',
}: BuildOpts): SmartSuggestion[] => {
  const inListNormalized = new Set(currentItems.map(normalizeName));
  const stats = computeStats(history);

  const suggestions: SmartSuggestion[] = [];

  for (const s of stats) {
    if (inListNormalized.has(s.normalized)) continue;
    if (s.totalPurchases < 1) continue;

    if (s.averageIntervalDays && s.daysSinceLast >= s.averageIntervalDays * 0.85) {
      const ratio = s.daysSinceLast / s.averageIntervalDays;
      const confidence = Math.min(0.95, 0.5 + ratio * 0.3);
      const avgDays = Math.round(s.averageIntervalDays);
      suggestions.push({
        name: s.name,
        reason: `${reasonText(language, 'likely_running_out')} · ${reasonText(language, 'average_every', avgDays)}`,
        source: 'frequency',
        confidence,
        daysSinceLast: s.daysSinceLast,
        averageInterval: avgDays,
      });
    } else if (s.totalPurchases >= 3 && s.daysSinceLast > 14) {
      suggestions.push({
        name: s.name,
        reason: `${reasonText(language, 'bought_recently')} · ${reasonText(language, 'days_since', s.daysSinceLast)}`,
        source: 'recent',
        confidence: 0.55,
        daysSinceLast: s.daysSinceLast,
      });
    }
  }

  if (suggestions.length < limit) {
    for (const staple of STAPLE_ITEMS) {
      if (suggestions.length >= limit) break;
      if (inListNormalized.has(normalizeName(staple))) continue;
      if (stats.some((s) => s.normalized === normalizeName(staple))) continue;
      suggestions.push({
        name: staple,
        reason: reasonText(language, 'staple'),
        source: 'staple',
        confidence: 0.3,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
};

export const getFrequentItems = (history: PurchaseHistoryEntry[], topN = 12): string[] => {
  return computeStats(history)
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, topN)
    .map((s) => s.name);
};
