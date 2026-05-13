import React, { useState } from 'react';
import { FileScan, Loader2 } from 'lucide-react';
import { analyzeFamilyDocument, fileToBase64, isAiAvailable } from '../services/geminiService';
import { DocumentCategory } from '../services/documentService';

const categories: DocumentCategory[] = ['Forsikring', 'Bolig', 'Bil', 'Helse', 'Barn', 'Kontrakt', 'Garanti', 'Annet'];

type ScanResult = {
  title?: string;
  category?: DocumentCategory;
  owner?: string;
  expiryDate?: string;
  note?: string;
  summary?: string;
};

export function DocumentScanHelper({ file, onResult, onError }: { file: File | null; onResult: (result: ScanResult) => void; onError: (message: string) => void }) {
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    if (!file) return onError('Velg en fil først.');
    if (!isAiAvailable()) return onError('AI er ikke konfigurert. Legg inn Gemini API-nøkkel under Innstillinger → AI.');
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') return onError('Skanning støtter foreløpig bilder og PDF.');

    setScanning(true);
    try {
      const b64 = await fileToBase64(file);
      const raw = await analyzeFamilyDocument(b64, file.type || 'image/jpeg');
      const result: ScanResult = {
        title: raw.title || file.name.replace(/\.[^.]+$/, ''),
        category: categories.includes(raw.category) ? raw.category : 'Annet',
        owner: raw.owner || 'Familien',
        expiryDate: raw.expiryDate || '',
        note: raw.note || raw.summary || '',
        summary: raw.summary || 'Dokumentet er skannet og feltene er foreslått.',
      };
      onResult(result);
    } catch (err: any) {
      onError(err?.message || 'Klarte ikke å skanne dokumentet.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <button type="button" onClick={scan} disabled={!file || scanning} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
      {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileScan className="h-4 w-4" />}
      Scan dokument
    </button>
  );
}
