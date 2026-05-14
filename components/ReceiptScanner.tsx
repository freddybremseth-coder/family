import React, { useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, FileImage, Loader2, ScanLine, Upload } from 'lucide-react';
import { analyzeReceipt, fileToBase64, isAiAvailable } from '../services/geminiService';
import { runReceiptFallback } from '../services/aiProviderService';
import { Currency, ScannedReceipt } from '../types';

interface Props {
  receipts: ScannedReceipt[];
  onScan: (data: any, imageUrl: string) => void;
}

const CATEGORIES = ['Dagligvarer', 'Restaurant', 'Transport', 'Bolig', 'Bil', 'Barn', 'Helse', 'Klær', 'Reise', 'Business', 'Annet'];

const formatCurrency = (amount: number, currency: Currency = 'NOK') => {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount || 0));
};

function fallbackCategory(vendor = '', items: any[] = []) {
  const text = `${vendor} ${items.map((i) => `${i.name || ''} ${i.category || ''}`).join(' ')}`.toLowerCase();
  if (/rema|kiwi|meny|coop|spar|mercadona|carrefour|aldi|lidl|supermercado|grocery|mat/.test(text)) return 'Dagligvarer';
  if (/restaurant|cafe|bar|pizza|burger|takeaway|kebab|sushi/.test(text)) return 'Restaurant';
  if (/fuel|diesel|gasolina|bensin|parking|parkering|taxi|uber|bolt|transport/.test(text)) return 'Transport';
  if (/pharmacy|apotek|farmacia|lege|doctor|health|helse/.test(text)) return 'Helse';
  if (/zara|hm|h&m|clothes|klær|sko|shoes/.test(text)) return 'Klær';
  if (/ikea|leroy|brico|bygg|home|bolig/.test(text)) return 'Bolig';
  if (/car|bil|taller|verksted|service|dekk/.test(text)) return 'Bil';
  return 'Annet';
}

function normalizeReceiptResult(result: any) {
  const vendor = result?.vendor || result?.merchant || 'Ukjent butikk';
  const items = Array.isArray(result?.items) ? result.items : [];
  const category = CATEGORIES.includes(result?.category) ? result.category : fallbackCategory(vendor, items);
  return {
    vendor,
    date: result?.date || new Date().toISOString().slice(0, 10),
    totalAmount: Number(result?.totalAmount || result?.amount || 0),
    currency: result?.currency === 'EUR' ? 'EUR' : 'NOK',
    category,
    paymentMethod: result?.paymentMethod || '',
    confidence: Number(result?.confidence || 0.75),
    providerUsed: result?.providerUsed || result?.provider || '',
    items,
    note: result?.note || result?.summary || `Kvittering kategorisert som ${category}`,
  };
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export const ReceiptScanner: React.FC<Props> = ({ receipts, onScan }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any | null>(null);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Last opp et bilde av kvitteringen, for eksempel JPG, PNG eller HEIC fra mobilen.');
      return;
    }
    setSelectedFile(file);
    setImageUrl(URL.createObjectURL(file));
    setError(null);
    setSuccess(null);
    setLastResult(null);
  };

  const analyzeSelected = async () => {
    if (!selectedFile) {
      setError('Velg eller ta bilde av en kvittering først.');
      return;
    }
    if (!isAiAvailable()) {
      setError('AI er ikke konfigurert. Legg inn Gemini, OpenAI eller Claude API-nøkkel under Innstillinger → AI.');
      return;
    }
    setScanning(true);
    setError(null);
    setSuccess(null);
    try {
      const mimeType = selectedFile.type || 'image/jpeg';
      const b64 = await fileToBase64(selectedFile);
      const fallback = await runReceiptFallback(b64, mimeType, () => analyzeReceipt(b64, mimeType));
      const receipt = normalizeReceiptResult({ ...fallback.result, providerUsed: fallback.provider });
      if (!receipt.totalAmount || receipt.totalAmount <= 0) {
        setError('Jeg klarte ikke å lese totalbeløpet. Prøv et skarpere bilde eller beskjær kvitteringen.');
        return;
      }
      setLastResult(receipt);
      onScan(receipt, imageUrl || '');
      setSuccess(`Transaksjon opprettet med ${receipt.providerUsed}: ${receipt.vendor} · ${formatCurrency(receipt.totalAmount, receipt.currency)} · ${receipt.category}`);
    } catch (err: any) {
      setError(err?.message || 'AI-analyse feilet. Prøv et tydeligere bilde eller last opp fra galleri.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><ScanLine className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Kvitteringer</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Scan eller last opp kvittering</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">AI leser butikk, dato, beløp og kategori. Transaksjonen legges inn med riktig kategori for analyse av utgiftene.</p>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><div className="flex gap-2"><AlertCircle className="h-5 w-5 shrink-0" /><p>{error}</p></div></div>}
      {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><div className="flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0" /><p>{success}</p></div></div>}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="space-y-4 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Ny kvittering</h2>
              <p className="mt-1 text-sm text-slate-500">Ta bilde på mobil eller last opp bilde fra galleri/filer.</p>
            </div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button onClick={() => cameraRef.current?.click()} className="btn-primary justify-center"><Camera className="h-4 w-4" /> Scan med kamera</button>
              <button onClick={() => fileRef.current?.click()} className="btn-secondary justify-center"><Upload className="h-4 w-4" /> Last opp bilde</button>
            </div>

            {imageUrl ? <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={imageUrl} alt="Valgt kvittering" className="max-h-[420px] w-full object-contain" /></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500"><FileImage className="mx-auto mb-3 h-10 w-10 text-slate-400" />Ingen kvittering valgt.</div>}

            <button onClick={analyzeSelected} disabled={!selectedFile || scanning} className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              Analyser og opprett transaksjon
            </button>

            {lastResult && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-bold text-slate-900">Siste analyse</p><div className="mt-2 space-y-1 text-slate-600"><p>AI: {lastResult.providerUsed || 'ukjent'}</p><p>Butikk: {lastResult.vendor}</p><p>Beløp: {formatCurrency(lastResult.totalAmount, lastResult.currency)}</p><p>Kategori: {lastResult.category}</p><p>Dato: {lastResult.date}</p></div></div>}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Kvitteringsarkiv</h2><p className="mt-1 text-sm text-slate-500">Skannede kvitteringer og kategorier.</p></div><span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{receipts.length} stk</span></div>
            {receipts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">Ingen kvitteringer skannet ennå.</div> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{receipts.map((receipt) => <div key={receipt.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex gap-4">{receipt.imageUrl && <img src={receipt.imageUrl} alt={receipt.vendor} className="h-20 w-20 rounded-2xl object-cover" />}<div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">{receipt.vendor}</p><p className="mt-1 text-xs text-slate-500">{receipt.date}</p></div><p className="font-bold text-slate-900">{formatCurrency(receipt.amount, receipt.currency)}</p></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{receipt.category}</span><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Transaksjon opprettet</span></div></div></div></div>)}</div>}
          </div>
        </Card>
      </section>
    </div>
  );
};
