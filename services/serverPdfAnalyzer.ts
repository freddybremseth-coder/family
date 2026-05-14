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
  const { data, error } = await supabase.functions.invoke('analyze-bank-statement', {
    body: { file_base64: fileBase64, mime_type: mimeType, filename: filename || '' },
  });

  if (error) {
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
