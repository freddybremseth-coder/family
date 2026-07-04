/**
 * Klient for FamilyHubs sentrale AI-proxy (supabase functions/ai-proxy).
 *
 * Bruker sentrale FamilyHub-nøkler i stedet for bring-your-own-key.
 * Rate-limitet pr plan (free: 5/dag, family: 100, business: 1000).
 * Krever påslått «Bruk innebygd AI»-feature-flag.
 */

import { supabase, isSupabaseConfigured } from '../supabase';

export type Provider = 'gemini' | 'openai' | 'claude';

export interface ProxyRequest {
  provider: Provider;
  task: string;
  prompt: string;
  image?: string;      // base64, uten data:-prefix
  mimeType?: string;   // 'image/jpeg' etc.
  model?: string;      // gemini: 'gemini-2.5-flash' | 'gemini-2.5-pro'
}

export interface ProxyResponse {
  text: string;
  usage: { used: number; limit: number; plan: string };
}

export class AiProxyQuotaError extends Error {
  used: number;
  limit: number;
  plan: string;
  constructor(msg: string, used: number, limit: number, plan: string) {
    super(msg);
    this.name = 'AiProxyQuotaError';
    this.used = used;
    this.limit = limit;
    this.plan = plan;
  }
}

const FLAG_KEY = 'familyhub_use_builtin_ai';

export function isBuiltinAiEnabled(): boolean {
  try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}

export function setBuiltinAiEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(FLAG_KEY, '1');
    else localStorage.removeItem(FLAG_KEY);
    window.dispatchEvent(new CustomEvent('familyhub-ai-mode-changed'));
  } catch {}
}

export async function callAiProxy(req: ProxyRequest): Promise<ProxyResponse> {
  if (!isSupabaseConfigured()) throw new Error('Supabase ikke konfigurert');
  const { data, error } = await supabase.functions.invoke('ai-proxy', { method: 'POST', body: req });
  if (error) {
    // Sjekk om det er rate limit
    const anyErr = error as any;
    if (anyErr?.status === 429 || anyErr?.context?.status === 429) {
      // Hent detaljer fra response body
      throw new AiProxyQuotaError(
        'Daglig AI-kvote nådd — oppgrader plan for høyere grense',
        anyErr?.context?.used ?? 0,
        anyErr?.context?.limit ?? 0,
        anyErr?.context?.plan ?? 'unknown',
      );
    }
    throw new Error(error.message || 'ai-proxy feilet');
  }
  return data as ProxyResponse;
}
