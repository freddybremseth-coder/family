import React, { useMemo, useState } from 'react';
import { FileText, Plus, Search, ShieldCheck, Trash2, Upload } from 'lucide-react';

type DocumentCategory = 'Forsikring' | 'Bolig' | 'Bil' | 'Helse' | 'Barn' | 'Kontrakt' | 'Garanti' | 'Annet';

type FamilyDocument = {
  id: string;
  title: string;
  category: DocumentCategory;
  owner: string;
  expiryDate?: string;
  note?: string;
  fileName?: string;
};

const categories: DocumentCategory[] = ['Forsikring', 'Bolig', 'Bil', 'Helse', 'Barn', 'Kontrakt', 'Garanti', 'Annet'];
const today = () => new Date().toISOString().slice(0, 10);
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm"><FileText className="h-6 w-6" /></div>
      <p className="mt-4 font-bold text-slate-900">Ingen dokumenter lagt inn ennå</p>
      <p className="mt-1 text-sm text-slate-500">Start med pass, forsikringer, bilpapirer, boligpapirer, garantier eller kontrakter.</p>
    </div>
  );
}

export const DocumentsManager: React.FC = () => {
  const [documents, setDocuments] = useState<FamilyDocument[]>([]);
  const [query, setQuery] = useState('');
  const [newDoc, setNewDoc] = useState({ title: '', category: 'Annet' as DocumentCategory, owner: '', expiryDate: '', note: '', fileName: '' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => `${doc.title} ${doc.category} ${doc.owner} ${doc.note || ''}`.toLowerCase().includes(q));
  }, [documents, query]);

  const expiringSoon = useMemo(() => {
    const now = new Date(today()).getTime();
    const days90 = 1000 * 60 * 60 * 24 * 90;
    return documents.filter((doc) => doc.expiryDate && new Date(doc.expiryDate).getTime() - now <= days90 && new Date(doc.expiryDate).getTime() >= now).length;
  }, [documents]);

  const addDocument = () => {
    if (!newDoc.title.trim()) return;
    setDocuments((prev) => [{ id: createId(), ...newDoc, title: newDoc.title.trim(), owner: newDoc.owner.trim() || 'Familien' }, ...prev]);
    setNewDoc({ title: '', category: 'Annet', owner: '', expiryDate: '', note: '', fileName: '' });
  };

  const removeDocument = (id: string) => setDocuments((prev) => prev.filter((doc) => doc.id !== id));

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><FileText className="h-5 w-5" /></div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Dokumentarkiv</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">Viktige dokumenter</h1>
          <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Samle familiens forsikringer, pass, bilpapirer, boligpapirer, garantier og kontrakter på ett trygt sted.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-slate-500">Dokumenter</p><p className="mt-1 text-2xl font-bold text-slate-900">{documents.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Utløper innen 90 dager</p><p className="mt-1 text-2xl font-bold text-slate-900">{expiringSoon}</p></Card>
        <Card className="p-5"><p className="text-sm text-slate-500">Kategorier</p><p className="mt-1 text-2xl font-bold text-slate-900">{new Set(documents.map((doc) => doc.category)).size}</p></Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <div className="space-y-4 p-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Legg til dokument</h2>
              <p className="mt-1 text-sm text-slate-500">Første versjon lagrer metadata lokalt i appen. Filopplasting kobles til Supabase Storage senere.</p>
            </div>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Tittel</span><input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="F.eks. Bilforsikring Mondeo" /></label>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Kategori</span><select value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as DocumentCategory })}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Gjelder</span><input value={newDoc.owner} onChange={(e) => setNewDoc({ ...newDoc, owner: e.target.value })} placeholder="Familien, Freddy, Anna, barn, bil, bolig..." /></label>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Utløpsdato, valgfritt</span><input type="date" value={newDoc.expiryDate} onChange={(e) => setNewDoc({ ...newDoc, expiryDate: e.target.value })} /></label>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Filnavn / referanse</span><input value={newDoc.fileName} onChange={(e) => setNewDoc({ ...newDoc, fileName: e.target.value })} placeholder="Valgfritt" /></label>
            <label className="block space-y-2"><span className="text-sm font-medium text-slate-700">Notat</span><textarea value={newDoc.note} onChange={(e) => setNewDoc({ ...newDoc, note: e.target.value })} placeholder="Hvor ligger originalen, hva må huskes?" rows={3} /></label>
            <button onClick={addDocument} className="btn-primary w-full"><Plus className="h-4 w-4" /> Legg til dokument</button>
          </div>
        </Card>

        <Card className="xl:col-span-2">
          <div className="p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Dokumentoversikt</h2>
                <p className="mt-1 text-sm text-slate-500">Søk, filtrer og finn det familien trenger raskt.</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk dokumenter" />
              </div>
            </div>
            {filtered.length === 0 ? <EmptyState /> : <div className="space-y-3">{filtered.map((doc) => <div key={doc.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><ShieldCheck className="h-5 w-5" /></div><div><p className="font-bold text-slate-900">{doc.title}</p><p className="mt-1 text-sm text-slate-500">{doc.category} · {doc.owner}</p>{doc.expiryDate && <p className="mt-1 text-sm text-slate-500">Utløper: {doc.expiryDate}</p>}{doc.fileName && <p className="mt-1 text-sm text-slate-500">Fil/referanse: {doc.fileName}</p>}{doc.note && <p className="mt-2 text-sm text-slate-600">{doc.note}</p>}</div></div><button onClick={() => removeDocument(doc.id)} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600"><Upload className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Neste steg: sikker filopplasting</h2>
            <p className="mt-1 text-sm text-slate-500">Når datamodellen er klar, kobles denne modulen til Supabase Storage med family_id, tilgangsstyring og sikker nedlasting.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
