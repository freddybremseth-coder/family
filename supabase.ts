import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

function cleanEnv(value: unknown): string {
  let cleaned = String(value || '').trim().replace(/^[']|[']$/g, '').replace(/^["]|["]$/g, '').trim();
  const equalsIndex = cleaned.indexOf('=');
  if (equalsIndex > -1 && cleaned.slice(0, equalsIndex).trim().startsWith('VITE_')) {
    cleaned = cleaned.slice(equalsIndex + 1).trim().replace(/^[']|[']$/g, '').replace(/^["]|["]$/g, '').trim();
  }
  return cleaned;
}

function isValidHttpUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
}
function firstClean(values: unknown[]): string { return values.map(cleanEnv).find(Boolean) || ''; }
function safeSupabaseUrl(value: string): string { return isValidHttpUrl(value) ? value : PLACEHOLDER_URL; }
function safeSupabaseKey(value: string): string { return cleanEnv(value) || PLACEHOLDER_KEY; }

const familySupabaseUrl = firstClean([env.VITE_SUPABASE_URL, env.VITE_FAMILY_SUPABASE_URL, env.VITE_FAMILYHUB_SUPABASE_URL]);
const familySupabaseAnonKey = firstClean([env.VITE_SUPABASE_ANON_KEY, env.VITE_FAMILY_SUPABASE_ANON_KEY, env.VITE_FAMILYHUB_SUPABASE_ANON_KEY, env.VITE_FAMILY_ANON_KEY]);
const familyResolvedKeyName = cleanEnv(env.VITE_SUPABASE_ANON_KEY) ? 'VITE_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILY_SUPABASE_ANON_KEY) ? 'VITE_FAMILY_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILYHUB_SUPABASE_ANON_KEY) ? 'VITE_FAMILYHUB_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILY_ANON_KEY) ? 'VITE_FAMILY_ANON_KEY' : '';

const realtyflowSupabaseUrl = firstClean([env.VITE_REALTYFLOW_SUPABASE_URL, env.VITE_REALTYFLOW_URL, familySupabaseUrl, 'https://ereapsfcsqtdmzosgnnn.supabase.co']);
const realtyflowKeyCandidates: Record<string, string> = { VITE_REALTYFLOW_SUPABASE_ANON_KEY: cleanEnv(env.VITE_REALTYFLOW_SUPABASE_ANON_KEY), VITE_REALTYFLOW_ANON_KEY: cleanEnv(env.VITE_REALTYFLOW_ANON_KEY), VITE_REALTYFLOW_SUPABASE_KEY: cleanEnv(env.VITE_REALTYFLOW_SUPABASE_KEY), VITE_REALTYFLOW_KEY: cleanEnv(env.VITE_REALTYFLOW_KEY) };
const realtyflowSupabaseAnonKey = Object.values(realtyflowKeyCandidates).find(Boolean) || familySupabaseAnonKey || '';
const realtyflowResolvedKeyName = Object.entries(realtyflowKeyCandidates).find(([, value]) => !!value)?.[0] || (familySupabaseAnonKey ? 'FamilyHub key fallback' : '');

const oliviaSupabaseUrl = firstClean([env.VITE_OLIVIA_SUPABASE_URL, env.VITE_DONAANNA_SUPABASE_URL, env.VITE_DONA_ANNA_SUPABASE_URL, 'https://jvcdkclfcaccogmvvkrs.supabase.co']);
const oliviaKeyCandidates: Record<string, string> = { VITE_OLIVIA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_OLIVIA_SUPABASE_ANON_KEY), VITE_OLIVIA_ANON_KEY: cleanEnv(env.VITE_OLIVIA_ANON_KEY), VITE_OLIVIA_SUPABASE_KEY: cleanEnv(env.VITE_OLIVIA_SUPABASE_KEY), VITE_DONAANNA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_DONAANNA_SUPABASE_ANON_KEY), VITE_DONA_ANNA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_DONA_ANNA_SUPABASE_ANON_KEY), VITE_DONAANNA_ANON_KEY: cleanEnv(env.VITE_DONAANNA_ANON_KEY), VITE_DONA_ANNA_ANON_KEY: cleanEnv(env.VITE_DONA_ANNA_ANON_KEY) };
const oliviaSupabaseAnonKey = Object.values(oliviaKeyCandidates).find(Boolean) || '';
const oliviaResolvedKeyName = Object.entries(oliviaKeyCandidates).find(([, value]) => !!value)?.[0] || '';

export const supabase = createClient(safeSupabaseUrl(familySupabaseUrl), safeSupabaseKey(familySupabaseAnonKey), { db: { schema: 'family' } });

// FamilyHub economy data lives in public schema. Use this client for transactions,
// members, assets and bank_accounts so queries don't accidentally hit family.*.
export const supabaseFamilyData = createClient(safeSupabaseUrl(familySupabaseUrl), safeSupabaseKey(familySupabaseAnonKey), { db: { schema: 'public' } });

export const supabasePublic = createClient(safeSupabaseUrl(realtyflowSupabaseUrl), safeSupabaseKey(realtyflowSupabaseAnonKey));
export const supabaseDonaAnna = createClient(safeSupabaseUrl(oliviaSupabaseUrl), safeSupabaseKey(oliviaSupabaseAnonKey));

export const isSupabaseConfigured = () => isValidHttpUrl(familySupabaseUrl) && !!familySupabaseAnonKey;
export const isRealtyflowSupabaseConfigured = () => isValidHttpUrl(realtyflowSupabaseUrl) && !!realtyflowSupabaseAnonKey;
export const isDonaAnnaSupabaseConfigured = () => isValidHttpUrl(oliviaSupabaseUrl) && !!oliviaSupabaseAnonKey;

export const SUPABASE_REFS = { family: familySupabaseUrl, realtyflow: realtyflowSupabaseUrl, donaAnna: oliviaSupabaseUrl };
export const SUPABASE_STATUS = { familyUrlConfigured: isValidHttpUrl(familySupabaseUrl), familyUrlRawPresent: !!familySupabaseUrl, familyKeyConfigured: !!familySupabaseAnonKey, familyResolvedKeyName, familyKeyLength: familySupabaseAnonKey.length, familyAcceptedKeyNames: ['VITE_SUPABASE_ANON_KEY', 'VITE_FAMILY_SUPABASE_ANON_KEY', 'VITE_FAMILYHUB_SUPABASE_ANON_KEY', 'VITE_FAMILY_ANON_KEY'], realtyflowUrlConfigured: isValidHttpUrl(realtyflowSupabaseUrl), realtyflowUrlRawPresent: !!realtyflowSupabaseUrl, realtyflowKeyConfigured: !!realtyflowSupabaseAnonKey, realtyflowResolvedKeyName, realtyflowKeyLength: realtyflowSupabaseAnonKey.length, realtyflowAcceptedKeyNames: Object.keys(realtyflowKeyCandidates), donaAnnaUrlConfigured: isValidHttpUrl(oliviaSupabaseUrl), donaAnnaUrlRawPresent: !!oliviaSupabaseUrl, donaAnnaKeyConfigured: !!oliviaSupabaseAnonKey, donaAnnaResolvedKeyName: oliviaResolvedKeyName, donaAnnaKeyLength: oliviaSupabaseAnonKey.length, donaAnnaAcceptedKeyNames: Object.keys(oliviaKeyCandidates) };
