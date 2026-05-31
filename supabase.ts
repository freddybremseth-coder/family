import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';
const LEGACY_SUPABASE_REF = 'jvcdkclfcaccogmvvkrs';
const REQUIRED_SUPABASE_REF = 'ereapsfcsqtdmzosgnnn';

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
function hasProjectRef(url: string, ref: string): boolean { return Boolean(url && url.includes(ref)); }
function usableUrl(value: string, legacyDetected: boolean): string { return legacyDetected ? PLACEHOLDER_URL : safeSupabaseUrl(value); }
function usableKey(value: string, urlUsable: boolean): string { return urlUsable ? safeSupabaseKey(value) : PLACEHOLDER_KEY; }

const familySupabaseUrl = firstClean([env.VITE_SUPABASE_URL, env.VITE_FAMILY_SUPABASE_URL, env.VITE_FAMILYHUB_SUPABASE_URL]);
const familySupabaseAnonKey = firstClean([env.VITE_SUPABASE_ANON_KEY, env.VITE_FAMILY_SUPABASE_ANON_KEY, env.VITE_FAMILYHUB_SUPABASE_ANON_KEY, env.VITE_FAMILY_ANON_KEY]);
const familyResolvedKeyName = cleanEnv(env.VITE_SUPABASE_ANON_KEY) ? 'VITE_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILY_SUPABASE_ANON_KEY) ? 'VITE_FAMILY_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILYHUB_SUPABASE_ANON_KEY) ? 'VITE_FAMILYHUB_SUPABASE_ANON_KEY' : cleanEnv(env.VITE_FAMILY_ANON_KEY) ? 'VITE_FAMILY_ANON_KEY' : '';
const familySchema = firstClean([env.VITE_FAMILY_SUPABASE_SCHEMA, env.VITE_FAMILYHUB_SUPABASE_SCHEMA]) || 'family';

const realtyflowSupabaseUrl = firstClean([env.VITE_REALTYFLOW_SUPABASE_URL, env.VITE_REALTYFLOW_URL, familySupabaseUrl, 'https://ereapsfcsqtdmzosgnnn.supabase.co']);
const realtyflowKeyCandidates: Record<string, string> = { VITE_REALTYFLOW_SUPABASE_ANON_KEY: cleanEnv(env.VITE_REALTYFLOW_SUPABASE_ANON_KEY), VITE_REALTYFLOW_ANON_KEY: cleanEnv(env.VITE_REALTYFLOW_ANON_KEY), VITE_REALTYFLOW_SUPABASE_KEY: cleanEnv(env.VITE_REALTYFLOW_SUPABASE_KEY), VITE_REALTYFLOW_KEY: cleanEnv(env.VITE_REALTYFLOW_KEY) };
const realtyflowSupabaseAnonKey = Object.values(realtyflowKeyCandidates).find(Boolean) || familySupabaseAnonKey || '';
const realtyflowResolvedKeyName = Object.entries(realtyflowKeyCandidates).find(([, value]) => !!value)?.[0] || (familySupabaseAnonKey ? 'FamilyHub key fallback' : '');

const oliviaSupabaseUrl = firstClean([env.VITE_OLIVIA_SUPABASE_URL, env.VITE_DONAANNA_SUPABASE_URL, env.VITE_DONA_ANNA_SUPABASE_URL, realtyflowSupabaseUrl, familySupabaseUrl]);
const oliviaKeyCandidates: Record<string, string> = { VITE_OLIVIA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_OLIVIA_SUPABASE_ANON_KEY), VITE_OLIVIA_ANON_KEY: cleanEnv(env.VITE_OLIVIA_ANON_KEY), VITE_OLIVIA_SUPABASE_KEY: cleanEnv(env.VITE_OLIVIA_SUPABASE_KEY), VITE_DONAANNA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_DONAANNA_SUPABASE_ANON_KEY), VITE_DONA_ANNA_SUPABASE_ANON_KEY: cleanEnv(env.VITE_DONA_ANNA_SUPABASE_ANON_KEY), VITE_DONAANNA_ANON_KEY: cleanEnv(env.VITE_DONAANNA_ANON_KEY), VITE_DONA_ANNA_ANON_KEY: cleanEnv(env.VITE_DONA_ANNA_ANON_KEY) };
const oliviaSupabaseAnonKey = Object.values(oliviaKeyCandidates).find(Boolean) || realtyflowSupabaseAnonKey || familySupabaseAnonKey || '';
const oliviaResolvedKeyName = Object.entries(oliviaKeyCandidates).find(([, value]) => !!value)?.[0] || (realtyflowSupabaseAnonKey ? 'RealtyFlow key fallback' : familySupabaseAnonKey ? 'FamilyHub key fallback' : '');
const oliviaSchema = firstClean([env.VITE_OLIVIA_SUPABASE_SCHEMA, env.VITE_DONAANNA_SUPABASE_SCHEMA, env.VITE_DONA_ANNA_SUPABASE_SCHEMA]) || 'olivia';

const familyLegacyProjectDetected = hasProjectRef(familySupabaseUrl, LEGACY_SUPABASE_REF);
const realtyflowLegacyProjectDetected = hasProjectRef(realtyflowSupabaseUrl, LEGACY_SUPABASE_REF);
const oliviaLegacyProjectDetected = hasProjectRef(oliviaSupabaseUrl, LEGACY_SUPABASE_REF);
const legacyProjectDetected = familyLegacyProjectDetected || realtyflowLegacyProjectDetected || oliviaLegacyProjectDetected;
const familyUrlUsable = isValidHttpUrl(familySupabaseUrl) && !familyLegacyProjectDetected;
const realtyflowUrlUsable = isValidHttpUrl(realtyflowSupabaseUrl) && !realtyflowLegacyProjectDetected;
const oliviaUrlUsable = isValidHttpUrl(oliviaSupabaseUrl) && !oliviaLegacyProjectDetected;

export const supabase = createClient(usableUrl(familySupabaseUrl, familyLegacyProjectDetected), usableKey(familySupabaseAnonKey, familyUrlUsable), { db: { schema: familySchema } });

// FamilyHub economy data lives in public schema. Use this client for transactions,
// members, assets and bank_accounts so queries don't accidentally hit family.*.
export const supabaseFamilyData = createClient(usableUrl(familySupabaseUrl, familyLegacyProjectDetected), usableKey(familySupabaseAnonKey, familyUrlUsable), { db: { schema: 'public' } });

export const supabasePublic = createClient(usableUrl(realtyflowSupabaseUrl, realtyflowLegacyProjectDetected), usableKey(realtyflowSupabaseAnonKey, realtyflowUrlUsable));
export const supabaseDonaAnna = createClient(usableUrl(oliviaSupabaseUrl, oliviaLegacyProjectDetected), usableKey(oliviaSupabaseAnonKey, oliviaUrlUsable), { db: { schema: oliviaSchema } });

export const isSupabaseConfigured = () => familyUrlUsable && !!familySupabaseAnonKey;
export const isRealtyflowSupabaseConfigured = () => realtyflowUrlUsable && !!realtyflowSupabaseAnonKey;
export const isDonaAnnaSupabaseConfigured = () => oliviaUrlUsable && !!oliviaSupabaseAnonKey;

export const SUPABASE_REFS = { family: familySupabaseUrl, realtyflow: realtyflowSupabaseUrl, donaAnna: oliviaSupabaseUrl };
export const SUPABASE_STATUS = {
  expectedProjectRef: REQUIRED_SUPABASE_REF,
  legacyProjectRef: LEGACY_SUPABASE_REF,
  legacyProjectDetected,
  expectedProjectDetected: [familySupabaseUrl, realtyflowSupabaseUrl, oliviaSupabaseUrl].some((url) => hasProjectRef(url, REQUIRED_SUPABASE_REF)),
  familyUrlConfigured: familyUrlUsable,
  familyUrlRawPresent: !!familySupabaseUrl,
  familyLegacyProjectDetected,
  familySchema,
  familyKeyConfigured: !!familySupabaseAnonKey,
  familyResolvedKeyName,
  familyKeyLength: familySupabaseAnonKey.length,
  familyAcceptedKeyNames: ['VITE_SUPABASE_ANON_KEY', 'VITE_FAMILY_SUPABASE_ANON_KEY', 'VITE_FAMILYHUB_SUPABASE_ANON_KEY', 'VITE_FAMILY_ANON_KEY'],
  realtyflowUrlConfigured: realtyflowUrlUsable,
  realtyflowUrlRawPresent: !!realtyflowSupabaseUrl,
  realtyflowLegacyProjectDetected,
  realtyflowKeyConfigured: !!realtyflowSupabaseAnonKey,
  realtyflowResolvedKeyName,
  realtyflowKeyLength: realtyflowSupabaseAnonKey.length,
  realtyflowAcceptedKeyNames: Object.keys(realtyflowKeyCandidates),
  donaAnnaUrlConfigured: oliviaUrlUsable,
  donaAnnaUrlRawPresent: !!oliviaSupabaseUrl,
  donaAnnaLegacyProjectDetected: oliviaLegacyProjectDetected,
  donaAnnaKeyConfigured: !!oliviaSupabaseAnonKey,
  donaAnnaResolvedKeyName: oliviaResolvedKeyName,
  donaAnnaKeyLength: oliviaSupabaseAnonKey.length,
  donaAnnaSchema: oliviaSchema,
  donaAnnaAcceptedKeyNames: Object.keys(oliviaKeyCandidates),
};
