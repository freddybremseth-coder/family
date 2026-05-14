// Supabase Edge Function: analyze-bank-statement
// Tar imot en PDF (eller bilde) og returnerer parsede transaksjonslinjer
// ved å kalle Anthropic Claude eller OpenAI server-side. Dette omgår
// nettleser-CORS/timeout-problemene som rammer direkte browser-kall for
// store PDF-filer.
//
// Forventet body:
//   { file_base64: string, mime_type?: string, filename?: string,
//     provider?: 'claude' | 'openai' }
//
// Returnerer:
//   { provider, transactions: [...], balance?: number, currency?: string,
//     attempts: [{ provider, status, message? }] }
//
// Hemmeligheter i Supabase Edge Functions (Project → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY       (anbefalt – Claude støtter PDF direkte)
//   OPENAI_API_KEY          (valgfri – kreves for bilde-fallback)
//   ANTHROPIC_MODEL         (valgfri, default claude-3-5-sonnet-20241022)
//   OPENAI_VISION_MODEL     (valgfri, default gpt-4o-mini)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BANK_STATEMENT_INSTRUCTIONS = `
Du er en bankavstemming-assistent. Les kontoutskriften/kontooversikten og returner alle synlige transaksjonslinjer.
Ta med kortkjøp, overføringer, gebyrer, innbetalinger og uttak. Ikke ta med tekstlinjer uten beløp.
Bruk type EXPENSE for trekk/utgifter og INCOME for innbetalinger. Beløp skal returneres som positivt tall i amount, type bestemmer retning.
Hvis dato mangler år, bruk mest sannsynlig år fra dokumentet. Valuta må være NOK eller EUR.
Returner kun gyldig JSON:
{
  "balance": number,
  "currency": "NOK" | "EUR",
  "transactions": [{ "date": "YYYY-MM-DD", "description": string, "amount": number, "currency": "NOK" | "EUR", "type": "INCOME" | "EXPENSE" | "TRANSFER", "confidence": number }]
}`;

interface Attempt {
  provider: 'claude' | 'openai';
  status: 'success' | 'no-rows' | 'error' | 'skipped';
  message?: string;
}

function parseJsonText(text: string) {
  const trimmed = String(text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('AI returnerte ikke gyldig JSON.');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function callClaude(b64: string, mimeType: string, model: string, apiKey: string) {
  const isPdf = mimeType.toLowerCase().includes('pdf');
  const filePart = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: b64 } };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: BANK_STATEMENT_INSTRUCTIONS }, filePart],
      }],
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const merged = Array.isArray(data?.content)
    ? data.content.map((part: any) => part.text || '').join('\n')
    : '';
  return parseJsonText(merged || '{}');
}

async function callOpenAIImage(b64: string, mimeType: string, model: string, apiKey: string) {
  if (mimeType.toLowerCase().includes('pdf')) {
    throw new Error('OpenAI server-side: bruk Claude for PDF i denne implementasjonen.');
  }
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${b64}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: BANK_STATEMENT_INSTRUCTIONS },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  return parseJsonText(data?.choices?.[0]?.message?.content || '{}');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const b64 = String(body?.file_base64 || '');
  const mimeType = String(body?.mime_type || 'application/pdf');
  const preferredProvider = body?.provider as 'claude' | 'openai' | undefined;

  if (!b64) return jsonResponse({ error: 'file_base64 is required' }, 400);

  const claudeKey = Deno.env.get('ANTHROPIC_API_KEY') || '';
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const claudeModel = Deno.env.get('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
  const openaiModel = Deno.env.get('OPENAI_VISION_MODEL') || 'gpt-4o-mini';

  const isPdf = mimeType.toLowerCase().includes('pdf');
  const providers: Array<'claude' | 'openai'> = preferredProvider
    ? [preferredProvider]
    : isPdf
    ? ['claude']
    : ['claude', 'openai'];

  const attempts: Attempt[] = [];
  for (const provider of providers) {
    try {
      if (provider === 'claude') {
        if (!claudeKey) { attempts.push({ provider, status: 'skipped', message: 'ANTHROPIC_API_KEY ikke satt på serveren' }); continue; }
        const result = await callClaude(b64, mimeType, claudeModel, claudeKey);
        const rows = Array.isArray(result?.transactions) ? result.transactions : [];
        if (rows.length === 0) { attempts.push({ provider, status: 'no-rows', message: 'Ingen transaksjoner i svaret' }); continue; }
        attempts.push({ provider, status: 'success' });
        return jsonResponse({ provider, ...result, attempts });
      }
      if (provider === 'openai') {
        if (!openaiKey) { attempts.push({ provider, status: 'skipped', message: 'OPENAI_API_KEY ikke satt på serveren' }); continue; }
        const result = await callOpenAIImage(b64, mimeType, openaiModel, openaiKey);
        const rows = Array.isArray(result?.transactions) ? result.transactions : [];
        if (rows.length === 0) { attempts.push({ provider, status: 'no-rows', message: 'Ingen transaksjoner i svaret' }); continue; }
        attempts.push({ provider, status: 'success' });
        return jsonResponse({ provider, ...result, attempts });
      }
    } catch (err: any) {
      attempts.push({ provider, status: 'error', message: err?.message || String(err) });
    }
  }

  return jsonResponse({
    error: 'Klarte ikke å analysere filen via server-side AI.',
    attempts,
  }, 502);
});
