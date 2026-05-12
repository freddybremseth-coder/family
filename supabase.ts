import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// FamilieHub deler Supabase med RealtyFlow Pro og Dona Anna (olivia).
// Egne tabeller lever i schema `family.*` for å unngå navnekollisjoner
// med RealtyFlows tabeller i `public.*`.
//
// Husk: Supabase-prosjektet må eksponere schemaet `family` via
// Project Settings → API → Exposed schemas.

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    db: { schema: 'family' },
  },
);

// Klient som leser fra RealtyFlows public-schema (business_financial_events,
// harvest_records, farm_expenses osv.). Brukes for cross-app aggregering.
export const supabasePublic = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = () =>
  !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== '';
