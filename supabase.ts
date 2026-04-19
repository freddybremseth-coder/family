
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Use placeholders when env vars are missing so module evaluation doesn't crash.
// Callers must check isSupabaseConfigured() before issuing requests.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
);

export const isSupabaseConfigured = () =>
  !!supabaseUrl && !!supabaseAnonKey && supabaseUrl !== '';
