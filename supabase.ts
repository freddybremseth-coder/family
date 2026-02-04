
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Hent fra miljøvariabler (Vercel/System)
// I Vercel legges disse inn uten NEXT_PUBLIC_ hvis de injiseres under build
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return process.env.SUPABASE_URL && 
         process.env.SUPABASE_ANON_KEY && 
         process.env.SUPABASE_URL !== 'https://placeholder-project.supabase.co';
};
