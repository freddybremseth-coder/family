
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Hent fra miljøvariabler (Vercel/System)
// Vi legger til fallbacks for å unngå "supabaseUrl is required" krasj ved oppstart hvis variablene ikke er satt enda.
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Eksporterer klienten. Hvis variablene er "placeholder", vil API-kall feile kontrollert i stedet for å krasje hele appen.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Hjelpefunksjon for å sjekke om vi faktisk er koblet til en ekte instans
export const isSupabaseConfigured = () => {
  return process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && 
         process.env.SUPABASE_URL !== 'https://placeholder-project.supabase.co';
};
