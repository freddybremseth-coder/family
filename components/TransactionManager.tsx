
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Currency, BankAccount, RealEstateDeal, AfterSaleCommission, PaymentMethod, ScannedReceipt } from '../types';
import { Plus, Search, Trash2, Save, X, ArrowRightLeft, ShieldCheck, Edit3, Tags } from 'lucide-react';
import { CyberButton } from './CyberButton';
import { BankStatementImporter } from './BankStatementImporter';
import { FAMILY_CATEGORIES, normalizeFamilyCategory } from '../services/categoryService';

interface Props {
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  deals: RealEstateDeal[];
  setDeals: React.Dispatch<React.SetStateAction<RealEstateDeal[]>>;
  afterSales: AfterSaleCommission[];
  setAfterSales: React.Dispatch<React.SetStateAction<AfterSaleCommission[]>>;
  cashBalance: number;
  setCashBalance: React.Dispatch<React.SetStateAction<number>>;
  receipts?: ScannedReceipt[];
}

const CUSTOM_CATEGORIES_KEY = 'familyhub_custom_transaction_categories';

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

function loadCustomCategories(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCustomCategories(categories: string[]) {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean))).sort()));
}

function accountLabel(acc: BankAccount) {
  return `${acc.accountName || acc.bankName || acc.id} (${formatCurrency(acc.balance, acc.currency)})`;
}

function normalizeEditableTx(tx: Partial<Transaction>): Transaction {
  return {
    id: tx.id || `tx-${Date.now()}`,
    date: tx.date || new Date().toISOString().slice(0, 10),
    amount: Math.abs(Number(tx.amount || 0)),
    currency: (tx.currency as Currency) || 'EUR',
    description: tx.description || '',
    category: tx.category || 'Diverse',
    type: (tx.type as TransactionType) || TransactionType.EXPENSE,
    paymentMethod: (tx.paymentMethod as PaymentMethod) || 'Bank',
    isAccrual: !!tx.isAccrual,
    fromAccountId: tx.fromAccountId,
    toAccountId: tx.toAccountId,
    isVerified: tx.isVerified,
    verifiedAt: tx.verifiedAt,
    verificationSource: tx.verificationSource,
    matchedReceiptId: tx.matchedReceiptId,
    bankStatementRef: tx.bankStatementRef,
  };
}

export const TransactionManager: React.FC<Props> = ({
  transactions, setTransactions,
  bankAccounts, setBankAccounts,
  cashBalance, setCashBalance,
  receipts = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [customCategories, setCustomCategories] = useState<string[]>(loadCustomCategories);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [newTx, setNewTx] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: 'EUR',
    description: '',
    category: 'Diverse',
    type: TransactionType.EXPENSE,
    paymentMethod: 'Bank',
    fromAccountId: bankAccounts[0]?.id || '',
    toAccountId: bankAccounts[0]?.id || '',
  });

  const [withdrawal, setWithdrawal] = useState({ fromAccountId: bankAccounts[0]?.id || '', amount: 0, currency: 'EUR' as Currency });

  useEffect(() => {
    if (bankAccounts.length > 0) {
      setNewTx(prev => ({ ...prev, fromAccountId: prev.fromAccountId || bankAccounts[0].id, toAccountId: prev.toAccountId || bankAccounts[0].id }));
      setWithdrawal(prev => ({ ...prev, fromAccountId: prev.fromAccountId || bankAccounts[0].id }));
    }
  }, [bankAccounts]);

  const categoryOptions = useMemo(() => {
    const fromTransactions = transactions.map((t) => t.category).filter(Boolean);
    return Array.from(new Set([...FAMILY_CATEGORIES, ...customCategories, ...fromTransactions, 'Diverse'].map(String).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'nb-NO'));
  }, [customCategories, transactions]);

  const addCustomCategory = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const next = Array.from(new Set([...customCategories, clean])).sort((a, b) => a.localeCompare(b, 'nb-NO'));
    setCustomCategories(next);
    saveCustomCategories(next);
    setNewCategoryName('');
    setNewTx((prev) => ({ ...prev, category: clean }));
    setEditingTransaction((prev) => prev ? { ...prev, category: clean } : prev);
  };

  const verifiedCount = useMemo(() => transactions.filter((t) => t.isVerified).length, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) || (t.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm]);

  const handleWithdraw = () => {
    if (withdrawal.amount <= 0 || !withdrawal.fromAccountId) return;
    setBankAccounts(prev => prev.map(acc => acc.id === withdrawal.fromAccountId ? { ...acc, balance: acc.balance - withdrawal.amount } : acc));
    setCashBalance(prev => prev + withdrawal.amount);
    const tx: Transaction = { id: `tx-w-${Date.now()}`, date: new Date().toISOString().split('T')[0], amount: withdrawal.amount, currency: withdrawal.currency, description: 'Bankuttak til kontanter', category: 'Overføring', type: TransactionType.TRANSFER, paymentMethod: 'Bank', isAccrual: false, fromAccountId: withdrawal.fromAccountId };
    setTransactions(prev => [tx, ...prev]);
    setShowWithdrawForm(false);
    setWithdrawal({ fromAccountId: bankAccounts[0]?.id || '', amount: 0, currency: 'EUR' });
  };

  const handleAddTx = () => {
    const tx = normalizeEditableTx(newTx);
    if (!tx.description || !tx.amount || tx.amount <= 0) return;
    tx.id = `tx-${Date.now()}`;
    tx.category = tx.category || normalizeFamilyCategory(tx.description);

    if (tx.paymentMethod === 'Kontant') {
      setCashBalance(prev => tx.type === TransactionType.INCOME ? prev + tx.amount : tx.type === TransactionType.EXPENSE ? prev - tx.amount : prev);
    } else if (tx.paymentMethod === 'Bank') {
      setBankAccounts(prevAccounts => prevAccounts.map(account => {
        if (tx.type === TransactionType.INCOME && account.id === tx.toAccountId) return { ...account, balance: account.balance + tx.amount };
        if (tx.type === TransactionType.EXPENSE && account.id === tx.fromAccountId) return { ...account, balance: account.balance - tx.amount };
        return account;
      }));
    }
    setTransactions(prev => [tx, ...prev]);
    setShowAddForm(false);
    setNewTx({ date: new Date().toISOString().split('T')[0], amount: 0, currency: 'EUR', description: '', category: 'Diverse', type: TransactionType.EXPENSE, paymentMethod: 'Bank', fromAccountId: bankAccounts[0]?.id || '', toAccountId: bankAccounts[0]?.id || '' });
  };

  const openEditTransaction = (tx: Transaction) => {
    setShowAddForm(false);
    setShowWithdrawForm(false);
    setEditingTransaction({ ...tx });
  };

  const saveEditedTransaction = () => {
    if (!editingTransaction) return;
    const normalized = normalizeEditableTx(editingTransaction);
    if (!normalized.description || normalized.amount <= 0) return;
    setTransactions(prev => prev.map(t => t.id === normalized.id ? { ...t, ...normalized } : t));
    setEditingTransaction(null);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeletingTransactionId(null);
  };

  const renderCategoryEditor = (value: string | undefined, onChange: (category: string) => void) => (
    <div className="space-y-2">
      <select value={value || 'Diverse'} onChange={e => onChange(e.target.value)} className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none">
        {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
      </select>
      <div className="flex gap-2">
        <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(newCategoryName); } }} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs" placeholder="Ny kategori…" />
        <button type="button" onClick={() => addCustomCategory(newCategoryName)} className="px-3 py-2 border border-cyan-500/50 text-cyan-300 text-[10px] font-black uppercase hover:bg-cyan-500/10">Legg til</button>
      </div>
    </div>
  );

  const renderTransactionForm = ({ tx, setTx, onSave, title, modal = false }: { tx: Partial<Transaction>; setTx: React.Dispatch<React.SetStateAction<any>>; onSave: () => void; title: string; modal?: boolean }) => (
    <div className={`${modal ? 'bg-slate-950/95 border-2 border-cyan-500/40 shadow-2xl' : 'glass-panel border-l-4 border-l-cyan-500'} p-6 animate-in slide-in-from-top-4`}>
      <h3 className="text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-2 text-white"><Edit3 className="w-5 h-5 text-cyan-400" /> {title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Dato</label><input type="date" value={tx.date || ''} onChange={e => setTx((prev: any) => ({...prev, date: e.target.value}))} className="w-full bg-black border border-white/10 p-2 text-white text-xs" /></div>
        <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Type</label><select value={tx.type || TransactionType.EXPENSE} onChange={e => setTx((prev: any) => ({...prev, type: e.target.value as TransactionType}))} className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none"><option value={TransactionType.EXPENSE}>Utgift</option><option value={TransactionType.INCOME}>Inntekt</option><option value={TransactionType.TRANSFER}>Overføring</option></select></div>
        <div className="md:col-span-2 space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beskrivelse</label><input value={tx.description || ''} onChange={e => setTx((prev: any) => ({...prev, description: e.target.value}))} className="w-full bg-black border border-white/10 p-2 text-white text-xs" placeholder="Hva ble kjøpt/mottatt?" /></div>
        <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beløp</label><div className="flex gap-1"><input type="number" value={tx.amount || 0} onChange={e => setTx((prev: any) => ({...prev, amount: Number(e.target.value)}))} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs" /><select value={tx.currency || 'EUR'} onChange={e => setTx((prev: any) => ({...prev, currency: e.target.value as Currency}))} className="bg-black border border-white/10 p-2 text-cyan-400 text-xs font-bold outline-none"><option value="EUR">EUR</option><option value="NOK">NOK</option></select></div></div>
        <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Kategori</label>{renderCategoryEditor(tx.category, (category) => setTx((prev: any) => ({...prev, category})))}</div>
        <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Betalingsmetode</label><select value={tx.paymentMethod || 'Bank'} onChange={e => setTx((prev: any) => ({...prev, paymentMethod: e.target.value as PaymentMethod}))} className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none"><option value="Bank">Bankoverføring / Kort</option><option value="Kontant">Kontanter</option><option value="On-Chain">On-Chain</option></select></div>
        {tx.paymentMethod === 'Bank' && <div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">{tx.type === TransactionType.INCOME ? 'Til Konto' : 'Fra Konto'}</label><select value={tx.type === TransactionType.INCOME ? tx.toAccountId || '' : tx.fromAccountId || ''} onChange={e => tx.type === TransactionType.INCOME ? setTx((prev: any) => ({...prev, toAccountId: e.target.value})) : setTx((prev: any) => ({...prev, fromAccountId: e.target.value}))} className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none"><option value="">Ikke valgt</option>{bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{accountLabel(acc)}</option>)}</select></div>}
      </div>
      <div className="flex gap-3"><CyberButton onClick={onSave} className="flex-1"><Save className="w-4 h-4 mr-2" /> Lagre</CyberButton><button type="button" onClick={() => { setShowAddForm(false); setEditingTransaction(null); }} className="px-5 border border-white/10 text-slate-300 text-[10px] font-black uppercase hover:bg-white/5"><X className="w-4 h-4" /></button></div>
    </div>
  );

  return (
    <div className="space-y-6 relative">
      {deletingTransactionId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setDeletingTransactionId(null)} />
          <div className="glass-panel w-full max-w-sm p-6 border-2 border-rose-500 animate-in zoom-in-95 duration-200 relative z-10">
            <h3 className="text-lg font-bold text-white uppercase mb-2">Slett Post?</h3>
            <p className="text-slate-300 text-xs mb-6 uppercase tracking-wider">Denne handlingen kan ikke angres.</p>
            <div className="flex gap-4"><button onClick={() => setDeletingTransactionId(null)} className="flex-1 py-2 border border-white/10 text-slate-100 uppercase text-[10px] font-bold hover:bg-white/5 transition-all">Avbryt</button><button onClick={() => deleteTransaction(deletingTransactionId)} className="flex-1 py-2 bg-rose-600 text-white uppercase text-[10px] font-bold shadow-[0_0_15px_rgba(225,29,72,0.4)]">Slett Post</button></div>
          </div>
        </div>
      )}

      {editingTransaction && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setEditingTransaction(null)} />
          <div className="relative z-10 w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl">
            {renderTransactionForm({ tx: editingTransaction, setTx: setEditingTransaction as any, onSave: saveEditedTransaction, title: 'Rediger transaksjon', modal: true })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Hovedbok-kontroll</h3>
            <div className="flex gap-2">
              <CyberButton onClick={() => setShowWithdrawForm(!showWithdrawForm)} variant="secondary" className="text-[9px] px-3 py-1.5"><ArrowRightLeft className="w-3 h-3 mr-1" /> Uttak</CyberButton>
              <CyberButton onClick={() => { setShowAddForm(!showAddForm); setEditingTransaction(null); }} className="text-[9px] px-3 py-1.5">{showAddForm ? 'Lukk' : <><Plus className="w-3 h-3 mr-1" /> Ny Post</>}</CyberButton>
            </div>
          </div>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Søk i beskrivelse eller kategori..." className="w-full bg-black/40 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50" /></div>
        </div>
        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5 flex flex-col justify-center"><p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Verifiserte poster</p><p className="text-2xl font-black text-white font-mono">{verifiedCount} / {transactions.length}</p><div className="flex items-center gap-1 mt-2 text-emerald-400"><ShieldCheck className="w-3 h-3" /><span className="text-[8px] uppercase font-bold tracking-widest italic">Mot kvittering/kontoutskrift</span></div></div>
      </div>

      <BankStatementImporter transactions={transactions} setTransactions={setTransactions} receipts={receipts} />

      {showAddForm && renderTransactionForm({ tx: newTx, setTx: setNewTx as any, onSave: handleAddTx, title: 'Ny transaksjon' })}

      {showWithdrawForm && (
        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 animate-in slide-in-from-top-4 bg-magenta-500/5">
          <h3 className="text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-2"><ArrowRightLeft className="w-5 h-5 text-magenta-400" /> Bankuttak til Kontanter</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"><div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Fra Konto</label><select value={withdrawal.fromAccountId} onChange={e => setWithdrawal({...withdrawal, fromAccountId: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs">{bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{accountLabel(acc)}</option>)}</select></div><div className="space-y-1"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beløp å ta ut</label><input type="number" value={withdrawal.amount} onChange={e => setWithdrawal({...withdrawal, amount: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" /></div><div className="flex items-end"><CyberButton onClick={handleWithdraw} variant="secondary" className="w-full">Bekreft Uttak</CyberButton></div></div>
        </div>
      )}

      <div className="glass-panel overflow-hidden border-l-4 border-l-cyan-500">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-white/5 uppercase text-[10px] font-bold border-b border-white/5"><tr><th className="px-6 py-5">Dato</th><th className="px-6 py-5">Beskrivelse</th><th className="px-6 py-5">Metode</th><th className="px-6 py-5">Status</th><th className="px-6 py-5 text-right">Verdi</th><th className="px-6 py-5 text-center">Handlinger</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-cyan-500/5 group">
                  <td className="px-6 py-5 font-mono text-slate-400 text-xs">{t.date}</td>
                  <td className="px-6 py-5"><div className="text-white font-medium">{t.description}</div><div className="text-[8px] uppercase text-slate-500 mt-1 font-black tracking-widest flex items-center gap-1"><Tags className="w-3 h-3" />{t.category}</div></td>
                  <td className="px-6 py-5"><span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${t.paymentMethod === 'Kontant' ? 'border-magenta-500 text-magenta-500 bg-magenta-500/5' : 'border-cyan-500 text-cyan-500 bg-cyan-500/5'}`}>{t.paymentMethod}</span></td>
                  <td className="px-6 py-5">{t.isVerified ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase text-emerald-300"><ShieldCheck className="h-3 w-3" /> Verifisert</span> : <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[8px] font-black uppercase text-amber-300">Ikke verifisert</span>}</td>
                  <td className={`px-6 py-5 text-right font-mono font-bold ${t.type === TransactionType.EXPENSE ? 'text-rose-400' : t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-cyan-400'}`}>{t.type === TransactionType.EXPENSE ? '-' : t.type === TransactionType.INCOME ? '+' : '↔'}{formatCurrency(t.amount, t.currency)}</td>
                  <td className="px-6 py-5 text-center"><div className="flex justify-center gap-2 opacity-100 transition-all"><button type="button" aria-label="Rediger transaksjon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditTransaction(t); }} className="p-2 rounded-lg text-cyan-400 hover:bg-cyan-500/10 focus:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"><Edit3 className="w-4 h-4" /></button><button type="button" aria-label="Slett transaksjon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeletingTransactionId(t.id); }} className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 focus:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500/50"><Trash2 className="w-4 h-4" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
