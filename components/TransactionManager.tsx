
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Currency, BankAccount, RealEstateDeal, AfterSaleCommission, BusinessDomain, PaymentMethod } from '../types';
import { Plus, Search, FileText, Landmark, Calendar, XCircle, Filter, Edit3, Trash2, ShieldAlert, Save, X, Banknote, Link, Briefcase, Receipt, Wallet, ArrowRightLeft } from 'lucide-react';
import { CyberButton } from './CyberButton';
import { EXCHANGE_RATE_EUR_TO_NOK } from '../constants';

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
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const TransactionManager: React.FC<Props> = ({ 
  transactions, setTransactions, 
  bankAccounts, setBankAccounts,
  deals, setDeals,
  afterSales, setAfterSales,
  cashBalance, setCashBalance
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);

  const [newTx, setNewTx] = useState<Partial<Transaction>>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: 'EUR',
    description: '',
    category: 'Diverse',
    type: TransactionType.EXPENSE, // Standard til Utgift
    paymentMethod: 'Bank',
    fromAccountId: bankAccounts[0]?.id || '', // Standard frakonto
    toAccountId: bankAccounts[0]?.id || '',   // Standard tilkonto (for inntekt)
  });

  const [withdrawal, setWithdrawal] = useState({
    fromAccountId: bankAccounts[0]?.id || '',
    amount: 0,
    currency: 'EUR' as Currency
  });

  // Oppdater newTx.fromAccountId/toAccountId når bankAccounts endres
  useEffect(() => {
    if (bankAccounts.length > 0) {
      setNewTx(prev => ({
        ...prev,
        fromAccountId: prev.fromAccountId || bankAccounts[0].id,
        toAccountId: prev.toAccountId || bankAccounts[0].id,
      }));
      setWithdrawal(prev => ({
        ...prev,
        fromAccountId: prev.fromAccountId || bankAccounts[0].id,
      }));
    }
  }, [bankAccounts]);


  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm]);

  const handleWithdraw = () => {
    if (withdrawal.amount <= 0 || !withdrawal.fromAccountId) return;
    
    // Oppdater bankbalanse
    setBankAccounts(prev => prev.map(acc => 
      acc.id === withdrawal.fromAccountId ? { ...acc, balance: acc.balance - withdrawal.amount } : acc
    ));

    // Oppdater kontantbalanse
    setCashBalance(prev => prev + withdrawal.amount); 

    // Legg til transaksjon
    const tx: Transaction = {
      id: `tx-w-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      description: 'Bankuttak til kontanter',
      category: 'Overføring',
      type: TransactionType.TRANSFER, // Type overføring
      paymentMethod: 'Bank',
      isAccrual: false,
      fromAccountId: withdrawal.fromAccountId
    };

    setTransactions(prev => [tx, ...prev]);
    setShowWithdrawForm(false);
    setWithdrawal({ // Reset withdrawal form
      fromAccountId: bankAccounts[0]?.id || '',
      amount: 0,
      currency: 'EUR'
    });
  };

  const handleAddTx = () => {
    if (!newTx.description || !newTx.amount || newTx.amount <= 0) return;
    
    const transactionId = `tx-${Date.now()}`;

    // Oppdater balanser først
    if (newTx.paymentMethod === 'Kontant') {
      setCashBalance(prev => {
        if (newTx.type === TransactionType.INCOME) return prev + (newTx.amount || 0);
        if (newTx.type === TransactionType.EXPENSE) return prev - (newTx.amount || 0);
        return prev; 
      });
    } else if (newTx.paymentMethod === 'Bank') {
      setBankAccounts(prevAccounts => prevAccounts.map(account => {
        if (newTx.type === TransactionType.INCOME && account.id === newTx.toAccountId) {
          return { ...account, balance: account.balance + (newTx.amount || 0) };
        }
        if (newTx.type === TransactionType.EXPENSE && account.id === newTx.fromAccountId) {
          return { ...account, balance: account.balance - (newTx.amount || 0) };
        }
        return account;
      }));
    }

    // Opprett og legg til transaksjonsobjekt
    const tx: Transaction = {
      id: transactionId,
      date: newTx.date || new Date().toISOString().split('T')[0],
      amount: newTx.amount || 0,
      currency: newTx.currency as Currency || 'EUR',
      description: newTx.description || '',
      category: newTx.category || 'Diverse',
      type: newTx.type as TransactionType || TransactionType.EXPENSE,
      paymentMethod: newTx.paymentMethod as PaymentMethod || 'Bank',
      isAccrual: false,
      fromAccountId: newTx.type === TransactionType.EXPENSE && newTx.paymentMethod === 'Bank' ? newTx.fromAccountId : undefined,
      toAccountId: newTx.type === TransactionType.INCOME && newTx.paymentMethod === 'Bank' ? newTx.toAccountId : undefined,
    };

    setTransactions(prev => [tx, ...prev]);
    setShowAddForm(false);
    setNewTx({ // Reset form
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
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setDeletingTransactionId(null);
  };

  return (
    <div className="space-y-6 relative">
      {/* SLETTE-MODAL */}
      {deletingTransactionId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setDeletingTransactionId(null)} />
          <div className="glass-panel w-full max-w-sm p-6 border-2 border-rose-500 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white uppercase mb-2">Slett Post?</h3>
            <p className="text-slate-300 text-xs mb-6 uppercase tracking-wider">Denne handlingen kan ikke angres.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setDeletingTransactionId(null)} 
                className="flex-1 py-2 border border-white/10 text-slate-100 uppercase text-[10px] font-bold hover:bg-white/5 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => deleteTransaction(deletingTransactionId)} 
                className="flex-1 py-2 bg-rose-600 text-white uppercase text-[10px] font-bold shadow-[0_0_15px_rgba(225,29,72,0.4)]"
              >
                Slett Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & KONTROLLER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">Hovedbok-kontroll</h3>
            <div className="flex gap-2">
               <CyberButton onClick={() => setShowWithdrawForm(!showWithdrawForm)} variant="secondary" className="text-[9px] px-3 py-1.5">
                <ArrowRightLeft className="w-3 h-3 mr-1" /> Uttak (Bank til Kontant)
              </CyberButton>
              <CyberButton onClick={() => setShowAddForm(!showAddForm)} className="text-[9px] px-3 py-1.5">
                {showAddForm ? 'Lukk' : <><Plus className="w-3 h-3 mr-1" /> Ny Post</>}
              </CyberButton>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Søk i beskrivelse eller kategori..." className="w-full bg-black/40 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50" />
          </div>
        </div>

        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5 flex flex-col justify-center">
            <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Løpende Kontanter</p>
            <p className="text-2xl font-black text-white font-mono">{formatCurrency(cashBalance, 'NOK')}</p>
            <div className="flex items-center gap-1 mt-2 text-magenta-400">
               <Wallet className="w-3 h-3" />
               <span className="text-[8px] uppercase font-bold tracking-widest italic">Lommebokbeholdning</span>
            </div>
        </div>
      </div>

      {/* NY POST SKJEMA */}
      {showAddForm && (
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500 animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" /> Ny Transaksjon
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Dato</label>
                <input type="date" value={newTx.date} onChange={e => setNewTx({...newTx, date: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" />
             </div>
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Type</label>
                <select 
                    value={newTx.type} 
                    onChange={e => setNewTx({...newTx, type: e.target.value as TransactionType})} 
                    className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none"
                >
                    <option value={TransactionType.EXPENSE}>Utgift</option>
                    <option value={TransactionType.INCOME}>Inntekt</option>
                </select>
             </div>
             <div className="md:col-span-2 space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beskrivelse</label>
                <input value={newTx.description} onChange={e => setNewTx({...newTx, description: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" placeholder="Hva ble kjøpt/mottatt?" />
             </div>
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beløp</label>
                <div className="flex gap-1">
                   <input type="number" value={newTx.amount} onChange={e => setNewTx({...newTx, amount: Number(e.target.value)})} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs" />
                   <select value={newTx.currency} onChange={e => setNewTx({...newTx, currency: e.target.value as Currency})} className="bg-black border border-white/10 p-2 text-cyan-400 text-xs font-bold outline-none">
                      <option value="EUR">EUR</option>
                      <option value="NOK">NOK</option>
                   </select>
                </div>
             </div>
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Betalingsmetode</label>
                <select value={newTx.paymentMethod} onChange={e => setNewTx({...newTx, paymentMethod: e.target.value as PaymentMethod})} className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none">
                   <option value="Bank">Bankoverføring / Kort</option>
                   <option value="Kontant">Kontanter</option>
                </select>
             </div>
             {newTx.paymentMethod === 'Bank' && (
                <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">
                        {newTx.type === TransactionType.INCOME ? 'Til Konto' : 'Fra Konto'}
                    </label>
                    <select 
                        value={newTx.type === TransactionType.INCOME ? newTx.toAccountId : newTx.fromAccountId} 
                        onChange={e => newTx.type === TransactionType.INCOME ? setNewTx({...newTx, toAccountId: e.target.value}) : setNewTx({...newTx, fromAccountId: e.target.value})} 
                        className="w-full bg-black border border-white/10 p-2 text-white text-xs font-bold outline-none"
                    >
                       {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>)}
                    </select>
                </div>
             )}
          </div>
          <CyberButton onClick={handleAddTx} className="w-full">Lagre Transaksjon</CyberButton>
        </div>
      )}

      {/* UTTAK SKJEMA */}
      {showWithdrawForm && (
        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 animate-in slide-in-from-top-4 bg-magenta-500/5">
          <h3 className="text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-magenta-400" /> Bankuttak til Kontanter
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Fra Konto</label>
                <select value={withdrawal.fromAccountId} onChange={e => setWithdrawal({...withdrawal, fromAccountId: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs">
                   {bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, acc.currency)})</option>)}
                </select>
             </div>
             <div className="space-y-1">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Beløp å ta ut</label>
                <input type="number" value={withdrawal.amount} onChange={e => setWithdrawal({...withdrawal, amount: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" />
             </div>
             <div className="flex items-end">
                <CyberButton onClick={handleWithdraw} variant="secondary" className="w-full">Bekreft Uttak</CyberButton>
             </div>
          </div>
        </div>
      )}

      {/* TABELL */}
      <div className="glass-panel overflow-hidden border-l-4 border-l-cyan-500">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-white/5 uppercase text-[10px] font-bold border-b border-white/5">
              <tr>
                <th className="px-6 py-5">Dato</th>
                <th className="px-6 py-5">Beskrivelse</th>
                <th className="px-6 py-5">Metode</th>
                <th className="px-6 py-5 text-right">Verdi</th>
                <th className="px-6 py-5 text-center">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-cyan-500/5 group">
                  <td className="px-6 py-5 font-mono text-slate-400 text-xs">{t.date}</td>
                  <td className="px-6 py-5">
                    <div className="text-white font-medium">{t.description}</div>
                    <div className="text-[8px] uppercase text-slate-500 mt-1 font-black tracking-widest">{t.category}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${t.paymentMethod === 'Kontant' ? 'border-magenta-500 text-magenta-500 bg-magenta-500/5' : 'border-cyan-500 text-cyan-500 bg-cyan-500/5'}`}>
                      {t.paymentMethod}
                    </span>
                  </td>
                  <td className={`px-6 py-5 text-right font-mono font-bold ${t.type === TransactionType.EXPENSE ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatCurrency(t.amount, t.currency)}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button onClick={() => setDeletingTransactionId(t.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
