type ProviderName = 'gemini' | 'openai' | 'claude';

const RECEIPT_SCHEMA_HINT = `Returner kun gyldig JSON med feltene:
{
  "vendor": string,
  "date": "YYYY-MM-DD",
  "totalAmount": number,
  "currency": "NOK" | "EUR",
  "category": "Dagligvarer" | "Restaurant" | "Transport" | "Bolig" | "Bil" | "Barn" | "Helse" | "Klær" | "Reise" | "Business" | "Annet",
  "paymentMethod": string,
  "confidence": number,
  "note": string,
  "items": [{ "name": string, "amount": number, "category": string }]
}`;

function cleanEnv(value: unknown): string {
  let cleaned = String(value || '').trim().replace(/^['"]|['"]$/g, '').trim();
  const equalsIndex = cleaned.indexOf('=');
  if (equalsIndex > -1 && cleaned.slice(0, equalsIndex).trim().startsWith('VITE_')) {
    cleaned = cleaned.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '').trim();
  }
  return cleaned;
}

function env() {
  return typeof import.meta !== 'undefined' ? import.meta.env : {};
}

export function getOpenAIKey() {
  return cleanEnv(localStorage.getItem('user_openai_api_key')) || cleanEnv(env().VITE_OPENAI_API_KEY) || cleanEnv(env().OPENAI_API_KEY);
}

export function getClaudeKey() {
  return cleanEnv(localStorage.getItem('user_claude_api_key')) || cleanEnv(env().VITE_ANTHROPIC_API_KEY) || cleanEnv(env().VITE_CLAUDE_API_KEY) || cleanEnv(env().ANTHROPIC_API_KEY);
}

export function hasOpenAI() { return !!getOpenAIKey(); }
export function hasClaude() { return !!getClaudeKey(); }

export function friendlyProviderError(err: any) {
  const raw = typeof err === 'string' ? err : JSON.stringify(err?.error || err?.message || err || {});
  if (raw.includes('PERMISSION_DENIED') || raw.includes('denied access') || raw.includes('403')) return 'AI-provideren avviste nøkkelen eller prosjektet har ikke tilgang.';
  if (raw.toLowerCase().includes('invalid') || raw.includes('401')) return 'AI-nøkkelen er ugyldig eller mangler tilgang.';
  if (raw.toLowerCase().includes('quota') || raw.includes('429')) return 'AI-kvoten er brukt opp eller rate limit er nådd.';
  return raw.slice(0, 300) || 'Ukjent AI-feil.';
}

async function postJson(url: string, headers: Record<string, string>, body: any) {
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(JSON.stringify(data || { status: res.status }));
  return data;
}

function parseJsonText(text: string) {
  const trimmed = String(text || '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error('AI returnerte ikke gyldig JSON.');
}

export async function analyzeReceiptWithOpenAI(b64: string, mimeType = 'image/jpeg') {
  const key = getOpenAIKey();
  if (!key) throw new Error('OpenAI API-nøkkel mangler.');
  const dataUrl = `data:${mimeType};base64,${b64}`;
  const data = await postJson('https://api.openai.com/v1/chat/completions', {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  }, {
    model: cleanEnv(env().VITE_OPENAI_VISION_MODEL) || 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Analyser kvitteringen for FamilieHub. Finn butikk, dato, totalbeløp, valuta, kategori og linjer. ${RECEIPT_SCHEMA_HINT}` },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  });
  return parseJsonText(data?.choices?.[0]?.message?.content || '{}');
}

export async function analyzeReceiptWithClaude(b64: string, mimeType = 'image/jpeg') {
  const key = getClaudeKey();
  if (!key) throw new Error('Claude/Anthropic API-nøkkel mangler.');
  const data = await postJson('https://api.anthropic.com/v1/messages', {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }, {
    model: cleanEnv(env().VITE_CLAUDE_VISION_MODEL) || 'claude-3-5-haiku-latest',
    max_tokens: 1200,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Analyser kvitteringen for FamilieHub. Finn butikk, dato, totalbeløp, valuta, kategori og linjer. ${RECEIPT_SCHEMA_HINT}` },
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64 } },
      ],
    }],
  });
  const text = Array.isArray(data?.content) ? data.content.map((part: any) => part.text || '').join('\n') : '';
  return parseJsonText(text || '{}');
}

export async function runReceiptFallback(b64: string, mimeType: string, geminiFn: () => Promise<any>) {
  const errors: string[] = [];
  const providers: ProviderName[] = ['gemini', 'openai', 'claude'];

  for (const provider of providers) {
    try {
      if (provider === 'gemini') return { provider, result: await geminiFn() };
      if (provider === 'openai' && hasOpenAI()) return { provider, result: await analyzeReceiptWithOpenAI(b64, mimeType) };
      if (provider === 'claude' && hasClaude()) return { provider, result: await analyzeReceiptWithClaude(b64, mimeType) };
    } catch (err) {
      errors.push(`${provider}: ${friendlyProviderError(err)}`);
    }
  }

  throw new Error(`Alle AI-providerne feilet. ${errors.join(' | ') || 'Legg inn Gemini, OpenAI eller Claude API-nøkkel.'}`);
}
