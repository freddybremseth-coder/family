import { createClient } from '@supabase/supabase-js';

const familySupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const familySupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// RealtyFlow Pro er hubben for eiendomssalg/provisjoner.
const realtyflowSupabaseUrl =
  import.meta.env.VITE_REALTYFLOW_SUPABASE_URL ||
  familySupabaseUrl ||
  'https://ereapsfcsqtdmzosgnnn.supabase.co';

const realtyflowSupabaseAnonKey =
  import.meta.env.VITE_REALTYFLOW_SUPABASE_ANON_KEY ||
  familySupabaseAnonKey ||
  '';

// Dona Anna / Olivia ligger i eget Supabase-prosjekt.
// Viktig: bruk egen anon key. Ikke fall tilbake til RealtyFlow-key,
// fordi det kan gi 0 rader eller feil prosjekt uten tydelig feilmelding.
const donaAnnaSupabaseUrl =
  import.meta.env.VITE_DONAANNA_SUPABASE_URL ||
  import.meta.env.VITE_OLIVIA_SUPABASE_URL ||
  'https://jvcdkclfcaccogmvvkrs.supabase.co';

const donaAnnaSupabaseAnonKey =
  import.meta.env.VITE_DONAANNA_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_OLIVIA_SUPABASE_ANON_KEY ||
  '';

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
