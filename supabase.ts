
import { createClient } from '@supabase/supabase-js';

// Hent fra miljøvariabler (Vercel/System)
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return !!process.env.SUPABASE_URL && 
         !!process.env.SUPABASE_ANON_KEY && 
         process.env.SUPABASE_URL !== 'https://placeholder-project.supabase.co';
};
