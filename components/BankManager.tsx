import React, { useRef, useState } from 'react';
import { BankAccount, Transaction, Currency } from '../types';
import { Banknote, Plus, Wallet, TrendingUp, Trash2, X, AlertCircle, CheckCircle2, Upload, FileText, Loader2 } from 'lucide-react';
import { deleteBankAccountFromSupabase, syncBankAccounts } from '../services/familyPersistenceService';
import { supabaseFamilyData, isSupabaseConfigured } from '../supabase';
import { extractClosingBalance, PdfBalanceResult } from '../services/bankBalanceFromPdf';

interface Props {
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  userId?: string;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

function accountDisplayName(account: any) {
  return account.accountName || account.name || account.bankName || 'Bankkonto';
}

const accountGradients = [
  'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #0EA5E9 100%)',
  'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
];

async function resolveUserId(propUserId?: string) {
  if (propUserId) return propUserId;
  if (!isSupabaseConfigured()) return undefined;
  const { data, error } = await supabaseFamilyData.auth.getUser();
  if (error) console.error('[BankManager] auth.getUser failed', error);
  return data?.user?.id;
}

async function upsertBankAccountDirect(userId: string, account: BankAccount & any) {
  const row = {
    id: account.id,
    user_id: userId,
    bank_name: account.bankName || account.name || account.accountName || 'Bank',
    account_name: account.accountName || account.name || account.bankName || 'Konto',
    account_number: account.accountNumber || null,
    balance: Number(account.balance || 0),
    currency: account.currency || 'NOK',
    type: account.type || 'CHECKING',
    interest_rate: account.interestRate ?? null,
    credit_limit: account.creditLimit ?? null,
  };

  const { error } = await supabaseFamilyData.from('bank_accounts').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[BankManager] Direct bank_accounts upsert failed', { error, row });
    throw error;
  }

  const { data: verify, error: verifyError } = await supabaseFamilyData
    .from('bank_accounts')
    .select('id,user_id,account_name,balance,currency')
    .eq('id', account.id)
    .eq('user_id', userId)
    .maybeSingle();

  if (verifyError) {
    console.error('[BankManager] Direct bank_accounts verify failed', verifyError);
    throw verifyError;
  }
  if (!verify) {
    const error = new Error('Bankkonto ble sendt til Supabase, men kunne ikke leses tilbake. Sjekk RLS/user_id.');
    console.error('[BankManager] Direct bank_accounts verify returned no row', { row });
    throw error;
  }

  console.info('[BankManager] Bank account saved and verified', verify);
  return verify;
}

export const BankManager: React.FC<Props> = ({ bankAccounts, setBankAccounts, userId }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>('NOK');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const [pdfTargetAccountId, setPdfTargetAccountId] = useState<string | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<{ accountId: string; result: PdfBalanceResult; oldBalance: number } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestPdfUpload = (accountId: string) => {
    setPdfTargetAccountId(accountId);
    setPdfError(null);
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handlePdfSelected = async (file: File | undefined) => {
    if (!file || !pdfTargetAccountId) return;
    setPdfParsing(true);
    setPdfError(null);
    try {
      const result = await extractClosingBalance(file);
      if (!result) {
        setPdfError('Fant ikke sluttsaldo i PDF-en. Sjekk at det er en kontoutskrift med "Utgående balanse" eller "Closing balance".');
        return;
      }
      const account = bankAccounts.find(a => a.id === pdfTargetAccountId);
      setPdfPreview({
        accountId: pdfTargetAccountId,
        result,
        oldBalance: Number(account?.balance || 0),
      });
    } catch (err: any) {
      setPdfError(err?.message || 'Klarte ikke å lese PDF-en.');
    } finally {
      setPdfParsing(false);
      setPdfTargetAccountId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyPdfBalance = async () => {
    if (!pdfPreview) return;
    const acc = bankAccounts.find(a => a.id === pdfPreview.accountId) as any;
    if (!acc) return;
    const updated: BankAccount & any = {
      ...acc,
      balance: pdfPreview.result.amount,
      currency: pdfPreview.result.currency,
      lastReconciledDate: new Date().toISOString().slice(0, 10),
    };
    const uid = await resolveUserId(userId);
    if (uid) {
      try {
        await upsertBankAccountDirect(uid, updated);
        const next = bankAccounts.map(a => a.id === updated.id ? updated : a);
        setBankAccounts(next);
        await syncBankAccounts(uid, next);
        setSaveStatus({ type: 'ok', message: `Saldo oppdatert fra PDF: ${updated.balance} ${updated.currency}` });
      } catch (err: any) {
        setSaveStatus({ type: 'error', message: err?.message || 'Klarte ikke å lagre ny saldo.' });
      }
    } else {
      setBankAccounts(bankAccounts.map(a => a.id === updated.id ? updated : a));
    }
    setPdfPreview(null);
  };

  const totalNok = bankAccounts.reduce(
    (s, a) => s + (a.currency === 'NOK' ? Number(a.balance || 0) : Number(a.balance || 0) * 11.55),
    0,
  );

  const addAccount = async () => {
    const cleanName = name.trim();
    if (!cleanName || saving) return;
    const uid = await resolveUserId(userId);
    if (!uid) {
      setSaveStatus({ type: 'error', message: 'Fant ikke innlogget bruker. Logg ut og inn igjen.' });
      console.error('[BankManager] Missing userId when saving bank account', { userId });
      return;
    }

    const account: BankAccount & any = {
      id: `acc-${Date.now()}`,
      name: cleanName,
      bankName: cleanName,
      accountName: cleanName,
      balance: Number(balance) || 0,
      currency,
      type: 'CHECKING',
      lastReconciledDate: new Date().toISOString().slice(0, 10),
    };

    setSaving(true);
    setSaveStatus(null);
    try {
      await upsertBankAccountDirect(uid, account);
      const nextAccounts = [...bankAccounts.filter((a) => a.id !== account.id), account];
      setBankAccounts(nextAccounts);
      await syncBankAccounts(uid, nextAccounts);
      setSaveStatus({ type: 'ok', message: 'Bankkonto lagret i Supabase.' });
      setName('');
      setBalance('');
      setShowAdd(false);
    } catch (err: any) {
      setSaveStatus({ type: 'error', message: `Bankkonto ble ikke lagret: ${err?.message || 'ukjent feil'}` });
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (id: string) => {
    const uid = await resolveUserId(userId);
    const nextAccounts = bankAccounts.filter((a) => a.id !== id);
    setBankAccounts(nextAccounts);
    if (uid) await deleteBankAccountFromSupabase(uid, id);
    if (uid && nextAccounts.length > 0) await syncBankAccounts(uid, nextAccounts);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="hero-gradient p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">Totalt på bankkonto</p>
            <h2 className="text-4xl font-extrabold tracking-tight">{formatCurrency(totalNok, 'NOK')}</h2>
            <p className="text-white/85 text-sm mt-2">Fordelt på {bankAccounts.length} {bankAccounts.length === 1 ? 'konto' : 'kontoer'}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0"><Wallet className="w-7 h-7 text-white" /></div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="section-title"><Banknote className="w-5 h-5 text-indigo-500" /> Mine bankkontoer</h3>
            <p className="section-subtitle">Overvåk saldo per konto</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-gradient text-sm" disabled={saving}>{showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{showAdd ? 'Avbryt' : 'Ny konto'}</button>
        </div>

        {saveStatus && (
          <div className={`mb-4 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${saveStatus.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {saveStatus.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {saveStatus.message}
          </div>
        )}

        {showAdd && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-fade-in">
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-600 mb-1 block">Kontonavn</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. DNB Lønnskonto" className="input-field" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Saldo</label><input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="input-field" /></div>
            <div><label className="text-xs font-semibold text-slate-600 mb-1 block">Valuta</label><select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input-field"><option value="NOK">NOK</option><option value="EUR">EUR</option></select></div>
            <div className="md:col-span-4 flex justify-end"><button onClick={addAccount} className="btn-gradient text-sm" disabled={saving}>{saving ? 'Lagrer…' : <><Plus className="w-4 h-4" /> Legg til</>}</button></div>
          </div>
        )}

        {/* Skjult filinput for PDF-upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handlePdfSelected(e.target.files?.[0])}
        />

        {pdfParsing && (
          <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Leser PDF og søker etter sluttsaldo…
          </div>
        )}

        {pdfError && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">PDF-feil</p>
              <p>{pdfError}</p>
            </div>
          </div>
        )}

        {pdfPreview && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPdfPreview(null)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
              <button onClick={() => setPdfPreview(null)} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2"><FileText className="w-5 h-5 text-indigo-500" /> Sluttsaldo fra PDF</h3>
              <p className="text-xs text-slate-500 mb-4">Fant en sluttsaldo i kontoutskriften. Bekreft for å oppdatere kontoen.</p>
              <div className="space-y-3 mb-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Nåværende saldo</p>
                  <p className="text-lg font-bold text-slate-900">{formatCurrency(pdfPreview.oldBalance, currency)}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-700 font-bold">Ny saldo fra PDF</p>
                  <p className="text-2xl font-extrabold text-emerald-900">{formatCurrency(pdfPreview.result.amount, pdfPreview.result.currency)}</p>
                  <p className="text-[10px] text-emerald-700 mt-1 italic">Kilde: {pdfPreview.result.source.replace(/_/g, ' ')} · «{pdfPreview.result.rawMatch}»</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setPdfPreview(null)} className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg">Avbryt</button>
                <button onClick={applyPdfBalance} className="btn-gradient text-sm"><CheckCircle2 className="w-4 h-4" /> Oppdater saldo</button>
              </div>
            </div>
          </div>
        )}

        {bankAccounts.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><Banknote className="w-9 h-9" /></div><p className="font-semibold text-slate-700">Ingen kontoer enda</p><p className="text-sm mt-1">Legg til din første bankkonto for å se total saldo.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankAccounts.map((account: any, idx) => (
              <div key={account.id} className="relative rounded-2xl p-5 text-white overflow-hidden shadow-lg group" style={{ background: accountGradients[idx % accountGradients.length] }}>
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(255,255,255,0.20)' }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-6">
                    <p className="text-[11px] uppercase tracking-widest font-bold text-white/85">{accountDisplayName(account)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => requestPdfUpload(account.id)} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors" title="Last opp kontoutskrift">
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeAccount(account.id)} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors" title="Slett">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(Number(account.balance || 0), account.currency)}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/80"><TrendingUp className="w-3.5 h-3.5" /><span>Sist oppdatert {account.lastReconciledDate || new Date().toISOString().slice(0, 10)}</span></div>
                  <button onClick={() => requestPdfUpload(account.id)} className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/90 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                    <FileText className="w-3 h-3" /> Last opp kontoutskrift
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
