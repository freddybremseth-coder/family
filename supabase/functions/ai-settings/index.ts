import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function encryptionKey() {
  const secret = requiredEnv('AI_SETTINGS_ENCRYPTION_SECRET');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encrypt(value?: string | null) {
  const plain = String(value || '').trim();
  if (!plain) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey();
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plain)));
  return `${toBase64(iv)}:${toBase64(cipher)}`;
}

async function decrypt(value?: string | null) {
  if (!value) return '';
  const [ivB64, cipherB64] = value.split(':');
  if (!ivB64 || !cipherB64) return '';
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivB64) }, key, fromBase64(cipherB64));
  return decoder.decode(plain);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, db: { schema: 'family' } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(supabaseUrl, serviceRole, { db: { schema: 'family' } });
    const userId = userData.user.id;

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('user_ai_settings')
        .select('gemini_ciphertext, openai_ciphertext, claude_ciphertext')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({
        gemini: await decrypt(data?.gemini_ciphertext),
        openai: await decrypt(data?.openai_ciphertext),
        claude: await decrypt(data?.claude_ciphertext),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const payload = {
        user_id: userId,
        gemini_ciphertext: await encrypt(body.gemini),
        openai_ciphertext: await encrypt(body.openai),
        claude_ciphertext: await encrypt(body.claude),
        encryption_version: 1,
        updated_at: new Date().toISOString(),
      };
      const { error } = await admin.from('user_ai_settings').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
