import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, Info, Loader2, ShieldCheck } from 'lucide-react';
import { BankStatementImportResult, applyBankStatementImport, importBankStatementFile } from '../services/bankStatementService';
import { ScannedReceipt, Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  receipts: ScannedReceipt[];
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: currency === 'NOK' ? 'NOK' : 'EUR' }).format(Number(amount || 0));
}

function mobileFriendlyError(message: string) {
  const raw = String(message || 'Klarte ikke å lese kontoutskriften.');
  const aiAccessError = raw.includes('AI-provideren avviste nøkkelen') || raw.includes('AI-nøkkelen') || raw.includes('Gemini') || raw.includes('Claude') || raw.includes('OpenAI');
  if (!aiAccessError) return raw;
  return `${raw}\n\nDette betyr vanligvis at PDF-en ikke kunne leses lokalt på denne enheten og at appen derfor forsøkte AI. AI-nøkler som er lagt inn i nettleseren på desktop følger ikke automatisk med til mobil. På mobil: gå til Innstillinger → AI og legg inn nøklene der også, eller last opp CSV/TXT fra banken. Hvis PDF-en er skannet bilde uten tekstlag, må den enten lastes opp som bilde med fungerende AI-nøkkel eller eksporteres som CSV.`;
}

export const BankStatementImporter: React.FC<Props> = ({ transactions, setTransactions, receipts }) => {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BankStatementImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const next = await importBankStatementFile(file, transactions, receipts);
      setResult(next);
    } catch (err: any) {
      setError(mobileFriendlyError(err?.message || 'Klarte ikke å lese kontoutskriften.'));
    } finally {
      setLoading(false);
    }
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
          <p className="mt-1 text-xs text-slate-400 uppercase tracking-wider">Last opp kontoutskrift som CSV/TXT/PDF/bilde. CSV/TXT og tekstbaserte PDF-er leses uten AI. Skannede PDF-er/bilder trenger fungerende AI-nøkkel på enheten du bruker.</p>
        </div>
        <label className="btn-secondary cursor-pointer justify-center">
          <FileUp className="h-4 w-4" /> Velg fil
          <input className="hidden" type="file" accept="image/*,.pdf,.csv,.txt,.tsv,text/csv,text/plain" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 text-xs text-cyan-100 flex gap-2 whitespace-pre-line">
        <Info className="h-4 w-4 shrink-0" />
        <span>Mobil og desktop har hver sin lokale AI-innstilling. Nøkler lagt inn på desktop ligger ikke automatisk på mobil. Mest stabil import er CSV fra banken.</span>
      </div>

      {file && <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300"><span className="font-bold text-white">Valgt:</span> {file.name} {file.type ? `· ${file.type}` : '· ukjent filtype'}</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex gap-2 whitespace-pre-line"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {applied && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200 flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Kontoutskriften er bokført og eksisterende treff er markert som verifisert.</div>}

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
