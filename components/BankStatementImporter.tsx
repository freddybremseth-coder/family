import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Info, Loader2, ShieldCheck, Sparkles, FileText } from 'lucide-react';
import { BankStatementImportResult, applyBankStatementImport, importBankStatementFile } from '../services/bankStatementService';
import { ProviderAttempt } from '../services/aiProviderService';
import { ScannedReceipt, Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  receipts: ScannedReceipt[];
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: currency === 'NOK' ? 'NOK' : 'EUR' }).format(Number(amount || 0));
}

function friendlyImportError(message: string) {
  const raw = String(message || 'Klarte ikke å lese kontoutskriften.');
  const aiAccessError = raw.includes('AI-provideren avviste nøkkelen') || raw.includes('AI-nøkkelen') || raw.includes('Gemini') || raw.includes('Claude') || raw.includes('OpenAI');
  if (!aiAccessError) return raw;
  return `${raw}\n\nPDF-en ble ikke tolket sikkert nok lokalt, og appen forsøkte derfor AI-fallback. Feilen over betyr at AI-providerne som er konfigurert ikke har fungerende tilgang for denne filen. Prøv CSV/TXT fra banken for import uten AI, eller sjekk at minst én AI-provider har gyldig nøkkel, kvote og tilgang. Hvis du bruker en ny enhet, må synkroniserte AI-nøkler være aktivert/deployet, eller nøklene må legges inn på enheten.`;
}

export const BankStatementImporter: React.FC<Props> = ({ transactions, setTransactions, receipts }) => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BankStatementImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAttempts, setErrorAttempts] = useState<ProviderAttempt[] | null>(null);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setErrorAttempts(null);
    setResult(null);
    setApplied(false);
    try {
      const next = await importBankStatementFile(file, transactions, receipts);
      setResult(next);
    } catch (err: any) {
      const attempts = err?.attempts as ProviderAttempt[] | undefined;
      if (attempts && Array.isArray(attempts)) setErrorAttempts(attempts);
      setError(friendlyImportError(err?.message || 'Klarte ikke å lese kontoutskriften.'));
    } finally {
      setLoading(false);
    }
  };

  const providerLabel = (p: string) =>
    p === 'gemini' ? 'Gemini (Google)' : p === 'openai' ? 'OpenAI' : p === 'claude' ? 'Claude (Anthropic)' : p;

  const providerStatusStyle = (status: string) => {
    if (status === 'success') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (status === 'no-rows') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'skipped') return 'bg-slate-50 text-slate-600 border-slate-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const apply = () => {
    if (!result) return;
    setTransactions((prev) => applyBankStatementImport(result, prev));
    setApplied(true);
  };

  return (
    <div className="glass-panel p-6 border-l-4 border-l-emerald-500 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-bold uppercase tracking-tighter flex items-center gap-2 text-white"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Kontoutskrift og verifisering</h3>
          <p className="mt-1 text-xs text-slate-400 uppercase tracking-wider">Last opp kontoutskrift som CSV/TXT/PDF/bilde. CSV/TXT og tekstbaserte PDF-er leses uten AI. Skannede PDF-er/bilder trenger fungerende AI-nøkkel.</p>
        </div>
        <label className="btn-secondary cursor-pointer justify-center">
          <FileUp className="h-4 w-4" /> Velg fil
          <input className="hidden" type="file" accept="image/*,.pdf,.csv,.txt,.tsv,text/csv,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100 flex gap-2 whitespace-pre-line">
        <Info className="h-4 w-4 shrink-0" />
        <span>Mest stabil import er CSV/TXT fra banken. PDF forsøkes først lokalt; hvis PDF-en ikke har lesbart tekstlag eller formatet ikke gjenkjennes, brukes AI-fallback.</span>
      </div>

      {file && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"><span className="font-bold text-slate-900">Valgt:</span> {file.name} {file.type ? `· ${file.type}` : '· ukjent filtype'} · {(file.size / 1024).toFixed(0)} KB</div>}

      {error && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex gap-2 whitespace-pre-line">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
          {errorAttempts && errorAttempts.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                AI-providere som ble forsøkt
              </p>
              {errorAttempts.map((a, i) => (
                <div
                  key={`${a.provider}-${i}`}
                  className={`rounded-xl border p-3 text-xs flex gap-2 items-start ${providerStatusStyle(a.status)}`}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">
                      {providerLabel(a.provider)} —{' '}
                      {a.status === 'success'
                        ? 'OK'
                        : a.status === 'no-rows'
                        ? 'Ingen transaksjonslinjer'
                        : a.status === 'skipped'
                        ? 'Hoppet over'
                        : 'Feilet'}
                    </p>
                    {a.message && <p className="mt-0.5 break-words">{a.message}</p>}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 pt-1">
                Tips: Konfigurer minst én AI-nøkkel under Innstillinger → AI.
                For Claude bruk en nøkkel som starter med <code>sk-ant-</code>. Ved nettverksfeil
                kan PDF-er sendes via vår server-side analyser (kommer).
              </p>
            </div>
          )}
        </div>
      )}

      {applied && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Kontoutskriften er bokført og eksisterende treff er markert som verifisert.</div>}

      <div className="flex flex-col gap-2 md:flex-row">
        <button onClick={analyze} disabled={!file || loading} className="btn-primary justify-center disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Les og match kontoutskrift
        </button>
        <button onClick={apply} disabled={!result || applied} className="btn-secondary justify-center disabled:opacity-50 disabled:cursor-not-allowed">
          <ShieldCheck className="h-4 w-4" /> Bokfør / merk verifisert
        </button>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tolkning fra:
              <span className="font-bold">
                {result.source === 'csv' && 'CSV/TXT (lokalt)'}
                {result.source === 'pdf-text' && 'PDF-tekstlag (lokalt)'}
                {result.source === 'ai' && `AI – ${providerLabel(result.aiProvider || 'gemini')}`}
                {result.source === 'server-ai' && `Server-side AI – ${providerLabel(result.aiProvider || 'claude')}`}
              </span>
            </span>
            {result.source === 'ai' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                <FileText className="h-3.5 w-3.5" /> Trent på {result.lines.length} linjer
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[9px] uppercase text-slate-500 font-black">Matchet</p><p className="text-xl font-black text-emerald-300">{result.matchedCount}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[9px] uppercase text-slate-500 font-black">Nye poster</p><p className="text-xl font-black text-cyan-300">{result.createdCount}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[9px] uppercase text-slate-500 font-black">Umatchet</p><p className="text-xl font-black text-amber-300">{result.unmatchedCount}</p></div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-white/5 uppercase text-[9px] text-slate-400">
                <tr><th className="px-4 py-3">Dato</th><th className="px-4 py-3">Tekst</th><th className="px-4 py-3 text-right">Beløp</th><th className="px-4 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {result.lines.slice(0, 100).map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3 text-slate-400 font-mono">{line.date}</td>
                    <td className="px-4 py-3 text-white">{line.description}</td>
                    <td className={`px-4 py-3 text-right font-mono ${line.type === 'EXPENSE' ? 'text-rose-300' : 'text-emerald-300'}`}>{line.type === 'EXPENSE' ? '-' : '+'}{formatAmount(line.amount, line.currency)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${line.status === 'matched' ? 'bg-emerald-500/10 text-emerald-300' : line.status === 'created' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-amber-500/10 text-amber-300'}`}>{line.status === 'matched' ? 'Verifiserer eksisterende' : line.status === 'created' ? 'Oppretter ny' : 'Umatchet'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
