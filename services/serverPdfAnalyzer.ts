// Kaller Supabase Edge Function `analyze-bank-statement` for server-side
// PDF/bilde-analyse. Brukes som siste fallback når browser-AI feiler eller
// PDF-en er for stor for direkte browser→OpenAI/Claude-kall.

import { supabase, isSupabaseConfigured } from '../supabase';
import type { ProviderAttempt } from './aiProviderService';

export interface ServerAnalysisResult {
  provider: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    currency: 'NOK' | 'EUR';
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    confidence?: number;
  }>;
  balance?: number;
  currency?: string;
  attempts: ProviderAttempt[];
}

export class ServerAnalyzerError extends Error {
  attempts: ProviderAttempt[];
  constructor(message: string, attempts: ProviderAttempt[] = []) {
    super(message);
    this.attempts = attempts;
  }
}

function isLikelyMissingFunction(err: any) {
  const text = String(err?.message || err || '').toLowerCase();
  return text.includes('failed to fetch')
    || text.includes('cors')
    || text.includes('preflight')
    || text.includes('not found')
    || text.includes('404')
    || text.includes('err_failed');
}

export async function analyzeBankStatementServerSide(
  fileBase64: string,
  mimeType: string,
  filename?: string,
): Promise<ServerAnalysisResult> {
  if (!isSupabaseConfigured()) {
    throw new ServerAnalyzerError('Supabase er ikke konfigurert. Server-side analyse er ikke tilgjengelig.');
  }
  // functions.invoke er prosjekt-globalt (ikke schema-spesifikt) men vi bruker
  // hovedklienten siden den har innlogget bruker-sesjon i Authorization-headeren.
  let invokeResponse;
  try {
    invokeResponse = await supabase.functions.invoke('analyze-bank-statement', {
      body: { file_base64: fileBase64, mime_type: mimeType, filename: filename || '' },
    });
  } catch (networkErr: any) {
    if (isLikelyMissingFunction(networkErr)) {
      throw new ServerAnalyzerError(
        'Edge Function analyze-bank-statement er ikke deployet enda. Kjør: supabase functions deploy analyze-bank-statement --project-ref ereapsfcsqtdmzosgnnn (eller deploy via GitHub Action). Husk også ANTHROPIC_API_KEY i Project → Edge Functions → Secrets.',
      );
    }
    throw new ServerAnalyzerError(networkErr?.message || 'Server-side analyse feilet.');
  }

  const { data, error } = invokeResponse;
  if (error) {
    if (isLikelyMissingFunction(error)) {
      throw new ServerAnalyzerError(
        'Edge Function analyze-bank-statement er ikke deployet enda. Kjør: supabase functions deploy analyze-bank-statement --project-ref ereapsfcsqtdmzosgnnn',
        ((data && (data as any).attempts) || []) as ProviderAttempt[],
      );
    }
    const message = error.message || 'Server-side analyse feilet.';
    const attempts = (data && (data as any).attempts) || [];
    throw new ServerAnalyzerError(message, attempts);
  }
  if (!data || !Array.isArray((data as any).transactions)) {
    throw new ServerAnalyzerError(
      'Server-side analyse returnerte ingen transaksjoner.',
      ((data && (data as any).attempts) || []) as ProviderAttempt[],
    );
  }
  return data as ServerAnalysisResult;
}
