import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;

const familySupabaseUrl = env.VITE_SUPABASE_URL || '';
const familySupabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

// RealtyFlow Pro er hubben for eiendomssalg/provisjoner.
const realtyflowSupabaseUrl =
  env.VITE_REALTYFLOW_SUPABASE_URL ||
  familySupabaseUrl ||
  'https://ereapsfcsqtdmzosgnnn.supabase.co';

const realtyflowSupabaseAnonKey =
  env.VITE_REALTYFLOW_SUPABASE_ANON_KEY ||
  env.VITE_REALTYFLOW_ANON_KEY ||
  familySupabaseAnonKey ||
  '';

// Dona Anna / Olivia ligger i eget Supabase-prosjekt.
const donaAnnaSupabaseUrl =
  env.VITE_DONAANNA_SUPABASE_URL ||
  env.VITE_DONA_ANNA_SUPABASE_URL ||
  env.VITE_OLIVIA_SUPABASE_URL ||
  'https://jvcdkclfcaccogmvvkrs.supabase.co';

const donaAnnaKeyCandidates: Record<string, string | undefined> = {
  VITE_DONAANNA_SUPABASE_ANON_KEY: env.VITE_DONAANNA_SUPABASE_ANON_KEY,
  VITE_DONA_ANNA_SUPABASE_ANON_KEY: env.VITE_DONA_ANNA_SUPABASE_ANON_KEY,
  VITE_DONAANNA_ANON_KEY: env.VITE_DONAANNA_ANON_KEY,
  VITE_DONA_ANNA_ANON_KEY: env.VITE_DONA_ANNA_ANON_KEY,
  VITE_OLIVIA_SUPABASE_ANON_KEY: env.VITE_OLIVIA_SUPABASE_ANON_KEY,
  VITE_OLIVIA_ANON_KEY: env.VITE_OLIVIA_ANON_KEY,
  VITE_OLIVIA_SUPABASE_KEY: env.VITE_OLIVIA_SUPABASE_KEY,
};

const donaAnnaSupabaseAnonKey = Object.values(donaAnnaKeyCandidates).find(Boolean) || '';
const donaAnnaResolvedKeyName = Object.entries(donaAnnaKeyCandidates).find(([, value]) => !!value)?.[0] || '';

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
  donaAnnaSupabaseUrl || 'https://placeholder.supabase.co',
  donaAnnaSupabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = () =>
  !!familySupabaseUrl && !!familySupabaseAnonKey && familySupabaseUrl !== '';

export const isRealtyflowSupabaseConfigured = () =>
  !!realtyflowSupabaseUrl && !!realtyflowSupabaseAnonKey && realtyflowSupabaseUrl !== '';

export const isDonaAnnaSupabaseConfigured = () =>
  !!donaAnnaSupabaseUrl && !!donaAnnaSupabaseAnonKey && donaAnnaSupabaseUrl !== '';

export const SUPABASE_REFS = {
  family: familySupabaseUrl,
  realtyflow: realtyflowSupabaseUrl,
  donaAnna: donaAnnaSupabaseUrl,
};

export const SUPABASE_STATUS = {
  familyUrlConfigured: !!familySupabaseUrl,
  familyKeyConfigured: !!familySupabaseAnonKey,
  realtyflowUrlConfigured: !!realtyflowSupabaseUrl,
  realtyflowKeyConfigured: !!realtyflowSupabaseAnonKey,
  donaAnnaUrlConfigured: !!donaAnnaSupabaseUrl,
  donaAnnaKeyConfigured: !!donaAnnaSupabaseAnonKey,
  donaAnnaResolvedKeyName,
  donaAnnaKeyLength: donaAnnaSupabaseAnonKey.length,
  donaAnnaAcceptedKeyNames: Object.keys(donaAnnaKeyCandidates),
};
