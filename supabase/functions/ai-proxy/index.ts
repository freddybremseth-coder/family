// Sentral AI-proxy for FamilyHub SaaS.
// Klient sender autentiserte requests med { provider, task, payload }.
// Serveren bruker FamilyHubs egne API-nøkler (fra env-vars) og logger forbruk.
// Rate-limit per bruker basert på subscription_status.
//
// Deploy: supabase functions deploy ai-proxy
// Kreves env-vars i Supabase: FAMILYHUB_GEMINI_API_KEY, FAMILYHUB_OPENAI_API_KEY,
// FAMILYHUB_CLAUDE_API_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Plan = 'free' | 'trial' | 'family' | 'business' | 'advisor' | 'lifetime';
type Provider = 'gemini' | 'openai' | 'claude';

const DAILY_LIMITS: Record<Plan, number> = {
  free: 5,
  trial: 50,
  family: 100,
  business: 1000,
  advisor: 5000,
  lifetime: 10000,
};

function requiredEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function optionalEnv(name: string) {
  return Deno.env.get(name) || '';
}

async function checkRateLimit(admin: any, userId: string, plan: Plan): Promise<{ ok: boolean; used: number; limit: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', `${today}T00:00:00Z`);
  const used = (data as any)?.count ?? 0;
  const limit = DAILY_LIMITS[plan] ?? 50;
  return { ok: used < limit, used, limit };
}

async function logUsage(admin: any, userId: string, provider: Provider, task: string, ok: boolean, error?: string) {
  await admin.from('ai_usage_log').insert({
    user_id: userId,
    provider,
    task,
    ok,
    error: error ?? null,
  }).then(() => {}).catch(() => {});
}

async function callGemini(model: string, prompt: string, imageB64?: string, mimeType?: string): Promise<string> {
  const key = requiredEnv('FAMILYHUB_GEMINI_API_KEY');
  const parts: any[] = [{ text: prompt }];
  if (imageB64) parts.push({ inline_data: { mime_type: mimeType || 'image/jpeg', data: imageB64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callClaude(prompt: string, imageB64?: string, mimeType?: string): Promise<string> {
  const key = requiredEnv('FAMILYHUB_CLAUDE_API_KEY');
  const content: any[] = [{ type: 'text', text: prompt }];
  if (imageB64) content.push({ type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageB64 } });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? '';
}

async function callOpenAI(prompt: string, imageB64?: string, mimeType?: string): Promise<string> {
  const key = requiredEnv('FAMILYHUB_OPENAI_API_KEY');
  const content: any[] = [{ type: 'text', text: prompt }];
  if (imageB64) content.push({ type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageB64}` } });
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content }],
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const anonKey = requiredEnv('SUPABASE_ANON_KEY');
    const serviceRole = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const authHeader = req.headers.get('Authorization') || '';

    // Autentiser bruker
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;

    // Hent plan
    const admin = createClient(supabaseUrl, serviceRole);
    const { data: profile } = await admin.from('user_profiles').select('subscription_status').eq('id', userId).maybeSingle();
    const plan = (profile?.subscription_status ?? 'free') as Plan;

    // Rate limit
    const rl = await checkRateLimit(admin, userId, plan);
    if (!rl.ok) {
      return new Response(JSON.stringify({
        error: 'Daglig AI-kvote nådd',
        used: rl.used,
        limit: rl.limit,
        plan,
        upgradeHint: 'Oppgrader plan for høyere kvote',
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Body
    const body = await req.json().catch(() => ({}));
    const provider: Provider = body.provider || 'gemini';
    const task: string = String(body.task || 'unknown');
    const prompt: string = String(body.prompt || '');
    const imageB64: string | undefined = body.image;
    const mimeType: string | undefined = body.mimeType;
    const model: string = body.model || 'gemini-2.5-flash';

    if (!prompt) throw new Error('prompt is required');

    // Kall provider
    let result: string;
    try {
      if (provider === 'gemini') result = await callGemini(model, prompt, imageB64, mimeType);
      else if (provider === 'claude') result = await callClaude(prompt, imageB64, mimeType);
      else if (provider === 'openai') result = await callOpenAI(prompt, imageB64, mimeType);
      else throw new Error(`Ukjent provider: ${provider}`);
    } catch (e: any) {
      await logUsage(admin, userId, provider, task, false, e?.message);
      throw e;
    }

    await logUsage(admin, userId, provider, task, true);
    return new Response(JSON.stringify({ text: result, usage: { used: rl.used + 1, limit: rl.limit, plan } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
