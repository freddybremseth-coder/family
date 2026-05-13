import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;

const familySupabaseUrl =
  env.VITE_SUPABASE_URL ||
  env.VITE_FAMILY_SUPABASE_URL ||
  env.VITE_FAMILYHUB_SUPABASE_URL ||
  '';

const familySupabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  env.VITE_FAMILY_SUPABASE_ANON_KEY ||
  env.VITE_FAMILYHUB_SUPABASE_ANON_KEY ||
  env.VITE_FAMILY_ANON_KEY ||
  '';

const familyResolvedKeyName =
  env.VITE_SUPABASE_ANON_KEY ? 'VITE_SUPABASE_ANON_KEY' :
  env.VITE_FAMILY_SUPABASE_ANON_KEY ? 'VITE_FAMILY_SUPABASE_ANON_KEY' :
  env.VITE_FAMILYHUB_SUPABASE_ANON_KEY ? 'VITE_FAMILYHUB_SUPABASE_ANON_KEY' :
  env.VITE_FAMILY_ANON_KEY ? 'VITE_FAMILY_ANON_KEY' : '';

// RealtyFlow Pro er hubben for eiendomssalg/provisjoner.
const realtyflowSupabaseUrl =
  env.VITE_REALTYFLOW_SUPABASE_URL ||
  env.VITE_REALTYFLOW_URL ||
  familySupabaseUrl ||
  'https://ereapsfcsqtdmzosgnnn.supabase.co';

const realtyflowKeyCandidates: Record<string, string | undefined> = {
  VITE_REALTYFLOW_SUPABASE_ANON_KEY: env.VITE_REALTYFLOW_SUPABASE_ANON_KEY,
  VITE_REALTYFLOW_ANON_KEY: env.VITE_REALTYFLOW_ANON_KEY,
  VITE_REALTYFLOW_SUPABASE_KEY: env.VITE_REALTYFLOW_SUPABASE_KEY,
  VITE_REALTYFLOW_KEY: env.VITE_REALTYFLOW_KEY,
};

const realtyflowSupabaseAnonKey =
  Object.values(realtyflowKeyCandidates).find(Boolean) ||
  familySupabaseAnonKey ||
  '';
const realtyflowResolvedKeyName = Object.entries(realtyflowKeyCandidates).find(([, value]) => !!value)?.[0] || (familySupabaseAnonKey ? 'FamilyHub key fallback' : '');

// Olivia er riktig kilde for Dona Anna/Olivia-data. Dona Anna-navn beholdes som fallback for bakoverkompatibilitet.
const oliviaSupabaseUrl =
  env.VITE_OLIVIA_SUPABASE_URL ||
  env.VITE_DONAANNA_SUPABASE_URL ||
  env.VITE_DONA_ANNA_SUPABASE_URL ||
  'https://jvcdkclfcaccogmvvkrs.supabase.co';

const oliviaKeyCandidates: Record<string, string | undefined> = {
  VITE_OLIVIA_SUPABASE_ANON_KEY: env.VITE_OLIVIA_SUPABASE_ANON_KEY,
  VITE_OLIVIA_ANON_KEY: env.VITE_OLIVIA_ANON_KEY,
  VITE_OLIVIA_SUPABASE_KEY: env.VITE_OLIVIA_SUPABASE_KEY,
  VITE_DONAANNA_SUPABASE_ANON_KEY: env.VITE_DONAANNA_SUPABASE_ANON_KEY,
  VITE_DONA_ANNA_SUPABASE_ANON_KEY: env.VITE_DONA_ANNA_SUPABASE_ANON_KEY,
  VITE_DONAANNA_ANON_KEY: env.VITE_DONAANNA_ANON_KEY,
  VITE_DONA_ANNA_ANON_KEY: env.VITE_DONA_ANNA_ANON_KEY,
};

const oliviaSupabaseAnonKey = Object.values(oliviaKeyCandidates).find(Boolean) || '';
const oliviaResolvedKeyName = Object.entries(oliviaKeyCandidates).find(([, value]) => !!value)?.[0] || '';

export const supabase = createClient(
  familySupabaseUrl || 'https://placeholder.supabase.co',
  familySupabaseAnonKey || 'placeholder-anon-key',
  { db: { schema: 'family' } },
);

export const supabasePublic = createClient(
  realtyflowSupabaseUrl || 'https://placeholder.supabase.co',
  realtyflowSupabaseAnonKey || 'placeholder-anon-key',
);

export const supabaseDonaAnna = createClient(
  oliviaSupabaseUrl || 'https://placeholder.supabase.co',
  oliviaSupabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = () =>
  !!familySupabaseUrl && !!familySupabaseAnonKey && familySupabaseUrl !== '';

export const isRealtyflowSupabaseConfigured = () =>
  !!realtyflowSupabaseUrl && !!realtyflowSupabaseAnonKey && realtyflowSupabaseUrl !== '';

export const isDonaAnnaSupabaseConfigured = () =>
  !!oliviaSupabaseUrl && !!oliviaSupabaseAnonKey && oliviaSupabaseUrl !== '';

export const SUPABASE_REFS = {
  family: familySupabaseUrl,
  realtyflow: realtyflowSupabaseUrl,
  donaAnna: oliviaSupabaseUrl,
};

export const SUPABASE_STATUS = {
  familyUrlConfigured: !!familySupabaseUrl,
  familyKeyConfigured: !!familySupabaseAnonKey,
  familyResolvedKeyName,
  familyKeyLength: familySupabaseAnonKey.length,
  familyAcceptedKeyNames: ['VITE_SUPABASE_ANON_KEY', 'VITE_FAMILY_SUPABASE_ANON_KEY', 'VITE_FAMILYHUB_SUPABASE_ANON_KEY', 'VITE_FAMILY_ANON_KEY'],
  realtyflowUrlConfigured: !!realtyflowSupabaseUrl,
  realtyflowKeyConfigured: !!realtyflowSupabaseAnonKey,
  realtyflowResolvedKeyName,
  realtyflowKeyLength: realtyflowSupabaseAnonKey.length,
  realtyflowAcceptedKeyNames: Object.keys(realtyflowKeyCandidates),
  donaAnnaUrlConfigured: !!oliviaSupabaseUrl,
  donaAnnaKeyConfigured: !!oliviaSupabaseAnonKey,
  donaAnnaResolvedKeyName: oliviaResolvedKeyName,
  donaAnnaKeyLength: oliviaSupabaseAnonKey.length,
  donaAnnaAcceptedKeyNames: Object.keys(oliviaKeyCandidates),
};
