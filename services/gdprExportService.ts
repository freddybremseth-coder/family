// Eksporter all brukerdata som JSON — GDPR-vennlig portabilitet.
// Hentes fra Supabase for innlogget bruker, med localStorage-fallback.

import { supabase, isSupabaseConfigured } from '../supabase';

const TABLES = [
  'members', 'transactions', 'assets', 'bank_accounts', 'bills',
  'user_profiles', 'user_module_access',
  'household_members', 'households',
  'family_documents', 'family_holidays', 'calendar_events', 'tasks',
  'mondeo_loan_settings', 'mondeo_loan_payments', 'mondeo_additional_charges', 'mondeo_kpi_adjustments',
  'financial_goals', 'crypto_assets', 'olive_inventory',
];

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {
    _meta: {
      exportedAt: new Date().toISOString(),
      userId,
      source: isSupabaseConfigured() ? 'supabase' : 'localStorage',
      version: 1,
    },
  };

  if (isSupabaseConfigured() && userId) {
    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
        if (error) {
          console.warn(`[GDPR] ${table} skipped:`, error.message);
          continue;
        }
        if (data && data.length > 0) result[table] = data;
      } catch (e) {
        // Tabellen finnes kanskje ikke — logg og hopp over
        console.warn(`[GDPR] ${table} error:`, e);
      }
    }
    // Household-data der user_id ikke er egen kolonne
    try {
      const { data: hh } = await supabase.from('households').select('*').eq('owner_user_id', userId);
      if (hh && hh.length > 0) result.households_owned = hh;
    } catch {}
  }

  // localStorage-fallback: alt som starter med familyhub_ eller er kjente nøkler
  try {
    const localData: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('familyhub_') || key.startsWith('financial_goals_') || key.startsWith('crypto_assets_') || key.startsWith('olive_inventory_') || key.startsWith('mondeo_charges_')) {
        try {
          const val = localStorage.getItem(key);
          localData[key] = val ? JSON.parse(val) : null;
        } catch {
          localData[key] = localStorage.getItem(key);
        }
      }
    }
    if (Object.keys(localData).length > 0) result._local = localData;
  } catch {}

  return result;
}

export function downloadAsJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
