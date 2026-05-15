import React, { useState } from 'react';
import { BankAccount, Transaction, Currency } from '../types';
import { Banknote, Plus, Wallet, TrendingUp, Trash2, X } from 'lucide-react';
import { deleteBankAccountFromSupabase, syncBankAccounts } from '../services/familyPersistenceService';

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

export const BankManager: React.FC<Props> = ({ bankAccounts, setBankAccounts, userId }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>('NOK');

  const totalNok = bankAccounts.reduce(
    (s, a) => s + (a.currency === 'NOK' ? Number(a.balance || 0) : Number(a.balance || 0) * 11.55),
    0,
  );

  const addAccount = async () => {
    const cleanName = name.trim();
    if (!cleanName) return;
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
    const nextAccounts = [...bankAccounts, account];
    setBankAccounts(nextAccounts);
    if (userId) await syncBankAccounts(userId, nextAccounts);
    setName('');
    setBalance('');
    setShowAdd(false);
  };

  const removeAccount = async (id: string) => {
    const nextAccounts = bankAccounts.filter((a) => a.id !== id);
    setBankAccounts(nextAccounts);
    if (userId) await deleteBankAccountFromSupabase(userId, id);
    if (userId && nextAccounts.length > 0) await syncBankAccounts(userId, nextAccounts);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="hero-gradient p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/80 text-xs font-semibold uppercase tracking-widest mb-2">
              Totalt på bankkonto
            </p>
            <h2 className="text-4xl font-extrabold tracking-tight">
              {formatCurrency(totalNok, 'NOK')}
            </h2>
            <p className="text-white/85 text-sm mt-2">
              Fordelt på {bankAccounts.length} {bankAccounts.length === 1 ? 'konto' : 'kontoer'}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <Wallet className="w-7 h-7 text-white" />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="section-title">
              <Banknote className="w-5 h-5 text-indigo-500" /> Mine bankkontoer
            </h3>
            <p className="section-subtitle">Overvåk saldo per konto</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-gradient text-sm">
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? 'Avbryt' : 'Ny konto'}
          </button>
        </div>

        {showAdd && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 mb-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-fade-in">
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Kontonavn</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. DNB Lønnskonto" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Saldo</label>
              <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" className="input-field" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Valuta</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="input-field">
                <option value="NOK">NOK</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="md:col-span-4 flex justify-end">
              <button onClick={addAccount} className="btn-gradient text-sm">
                <Plus className="w-4 h-4" /> Legg til
              </button>
            </div>
          </div>
        )}

        {bankAccounts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Banknote className="w-9 h-9" /></div>
            <p className="font-semibold text-slate-700">Ingen kontoer enda</p>
            <p className="text-sm mt-1">Legg til din første bankkonto for å se total saldo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankAccounts.map((account: any, idx) => (
              <div key={account.id} className="relative rounded-2xl p-5 text-white overflow-hidden shadow-lg group" style={{ background: accountGradients[idx % accountGradients.length] }}>
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-2xl pointer-events-none" style={{ background: 'rgba(255,255,255,0.20)' }} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-6">
                    <p className="text-[11px] uppercase tracking-widest font-bold text-white/85">{accountDisplayName(account)}</p>
                    <button onClick={() => removeAccount(account.id)} className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors opacity-0 group-hover:opacity-100" title="Slett">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(Number(account.balance || 0), account.currency)}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-[11px] text-white/80">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Sist oppdatert {account.lastReconciledDate || new Date().toISOString().slice(0, 10)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
