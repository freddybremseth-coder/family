import { createClient } from '@supabase/supabase-js';

const familySupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const familySupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// RealtyFlow Pro er hubben for salg, provisjoner, Soleada, ZenEcoHomes
// og Dona Anna/Olivia-data. FamilyHub kan lese fra dette prosjektet uten
// å være master for schemaet.
const realtyflowSupabaseUrl =
  import.meta.env.VITE_REALTYFLOW_SUPABASE_URL ||
  familySupabaseUrl ||
  'https://ereapsfcsqtdmzosgnnn.supabase.co';

const realtyflowSupabaseAnonKey =
  import.meta.env.VITE_REALTYFLOW_SUPABASE_ANON_KEY ||
  familySupabaseAnonKey ||
  '';

export const supabase = createClient(
  familySupabaseUrl || 'https://placeholder.supabase.co',
  familySupabaseAnonKey || 'placeholder-anon-key',
  {
    db: { schema: 'family' },
  },
);

export const supabasePublic = createClient(
  realtyflowSupabaseUrl || 'https://placeholder.supabase.co',
  realtyflowSupabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = () =>
  !!familySupabaseUrl && !!familySupabaseAnonKey && familySupabaseUrl !== '';

export const isRealtyflowSupabaseConfigured = () =>
  !!realtyflowSupabaseUrl && !!realtyflowSupabaseAnonKey && realtyflowSupabaseUrl !== '';

export const SUPABASE_REFS = {
  family: familySupabaseUrl,
  realtyflow: realtyflowSupabaseUrl,
};
