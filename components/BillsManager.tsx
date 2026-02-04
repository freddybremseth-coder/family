import React, { useState, useMemo, useEffect } from 'react';
import { Bill, Currency } from '../types';
import { 
  Calendar, CheckCircle2, AlertTriangle, CreditCard, Activity, TrendingUp, TrendingDown, 
  ShieldAlert, Check, RotateCcw, Plus, Repeat, List, Clock, FileSearch, RefreshCw, 
  Sparkles, X, Wand2, AlertCircle, Zap, ShieldCheck, Filter, BrainCircuit, ChevronRight
} from 'lucide-react';
import { CyberButton } from './CyberButton';
import { getBillsSmartAdvice } from '../services/geminiService';

interface Props {
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

type BillStatus = 'paid' | 'overdue' | 'pending';

export const BillsManager: React.FC<Props> = ({ bills, setBills }) => {
  const [filterMode, setFilterMode] = useState<'alle' | 'ubetalte' | 'faste'>('ubetalte');
  const [confirmingBillId, setConfirmingBillId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<{insight: string, action: string, severity: string}[]>([]);
  
  const [newBill, setNewBill] = useState<Partial<Bill>>({
    name: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    isPaid: false,
    category: 'Fast',
    isRecurring: false,
    frequency: 'monthly'
  });

  const getBillStatus = (bill: Bill): BillStatus => {
    if (bill.isPaid) return 'paid';
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(bill.dueDate);
    return dueDate < today ? 'overdue' : 'pending';
  };

  const togglePaidStatus = (id: string) => {
    setBills(prev => prev.map(bill => 
      bill.id === id ? { ...bill, isPaid: !bill.isPaid } : bill
    ));
    setConfirmingBillId(null);
  };

  const handleAddBill = () => {
    if (!newBill.name || !newBill.amount) return;
    const bill: Bill = {
      id: `bill-${Date.now()}`,
      name: newBill.name || '',
      amount: newBill.amount || 0,
      dueDate: newBill.dueDate || '',
      currency: newBill.currency as Currency || 'EUR',
      isPaid: false,
      category: newBill.category || 'Diverse',
      isRecurring: newBill.isRecurring || false,
      frequency: newBill.isRecurring ? (newBill.frequency as 'monthly' | 'yearly') : undefined
    };
    setBills(prev => [bill, ...prev]);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setNewBill({ 
      name: '', 
      amount: 0, 
      dueDate: new Date().toISOString().split('T')[0], 
      currency: 'EUR', 
      isPaid: false, 
      category: 'Fast', 
      isRecurring: false 
    });
  };

  const generateAdvice = async () => {
    if (bills.length === 0) return;
    setLoadingAdvice(true);
    try {
      const advice = await getBillsSmartAdvice(bills);
      setAiAdvice(advice || []);
    } catch (err) {
      console.error("Failed to generate AI advice", err);
    } finally {
      setLoadingAdvice(false);
    }
  };

  // Kjør analyse automatisk ved første oppstart hvis det er data
  useEffect(() => {
    if (bills.length > 0 && aiAdvice.length === 0) {
      generateAdvice();
    }
  }, [bills.length]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const paid = bills.filter(b => b.isPaid);
    const pending = bills.filter(b => !b.isPaid);
    const overdue = pending.filter(b => new Date(b.dueDate) < today);
    const overdueSum = overdue.reduce((acc, b) => acc + b.amount, 0);
    const paidSum = paid.reduce((acc, b) => acc + b.amount, 0);
    const pendingSum = pending.reduce((acc, b) => acc + b.amount, 0);
    const progress = bills.length > 0 ? (paid.length / bills.length) * 100 : 0;
    
    return { 
      paidSum, 
      pendingSum, 
      overdueSum,
      overdueCount: overdue.length,
      progress, 
      paidCount: paid.length, 
      totalCount: bills.length 
    };
  }, [bills]);

  const filteredBills = useMemo(() => {
    const sorted = [...bills].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    switch (filterMode) {
      case 'ubetalte': return sorted.filter(bill => !bill.isPaid);
      case 'faste': return sorted.filter(bill => bill.isRecurring);
      default: return sorted;
    }
  }, [bills, filterMode]);

  const confirmingBill = bills.find(b => b.id === confirmingBillId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 relative">
      {/* BEKREFTELSESMODAL */}
      {confirmingBillId && confirmingBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setConfirmingBillId(null)} />
          <div className="glass-panel w-full max-w-md p-8 border-2 border-magenta-500 shadow-[0_0_50px_rgba(255,0,255,0.4)] animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-magenta-500 shadow-[0_0_15px_#ff00ff]"></div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-sm bg-magenta-500/20 flex items-center justify-center border border-magenta-500/50">
                <ShieldAlert className="text-magenta-400 w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Bekreft Betaling</h3>
                <p className="text-[10px] text-magenta-400 uppercase tracking-widest font-mono">Autorisasjon kreves</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-8 leading-relaxed">
              Marker <span className="text-white font-bold underline decoration-magenta-500/50 uppercase">{confirmingBill.name}</span> som betalt? 
              Beløp: <span className="text-emerald-400 font-bold">{formatCurrency(confirmingBill.amount, confirmingBill.currency)}</span>.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmingBillId(null)} 
                className="flex-1 py-3 border border-white/20 text-slate-100 uppercase text-[10px] font-black tracking-[0.2em] hover:bg-white/10 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => togglePaidStatus(confirmingBillId)} 
                className="flex-1 py-3 bg-magenta-500 text-black uppercase text-[10px] font-black tracking-[0.2em] hover:shadow-[0_0_25px_#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.5)] transition-all"
              >
                Bekreft
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:col-span-2 space-y-6">
        {/* Statusbar */}
        <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
           <div className="flex justify-between items-end mb-4">
              <div>
                 <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
                    <Zap className="text-cyan-400 w-5 h-5" /> Likviditetsstatus
                 </h2>
                 <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono">{stats.paidCount} av {stats.totalCount} regninger håndtert</p>
              </div>
              <div className="text-right">
                 <span className="text-2xl font-black text-cyan-400 font-mono">{Math.round(stats.progress)}%</span>
              </div>
           </div>
           <div className="w-full h-3 bg-black/40 border border-white/10 p-0.5 rounded-full overflow-hidden">
              <div 
                 className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_15px_#00f3ff] transition-all duration-1000 ease-out" 
                 style={{ width: `${stats.progress}%` }}
              ></div>
           </div>
        </div>

        {/* Filter og Liste */}
        <div className="glass-panel p-6 border-l-4 border-l-magenta-500 flex flex-col h-full overflow-hidden min-h-[500px]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-white">
                <List className="text-magenta-400" /> Aktive Forpliktelser
              </h2>
              <div className="flex gap-1 p-1 bg-black/40 border border-white/10 w-fit">
                {[
                  { id: 'alle', label: 'Alle' },
                  { id: 'ubetalte', label: 'Ubetalte' },
                  { id: 'faste', label: 'Faste', icon: <Repeat className="w-3 h-3" /> }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterMode(f.id as any)}
                    className={`px-3 py-1.5 text-[9px] uppercase font-black tracking-tighter transition-all flex items-center gap-1.5 ${
                      filterMode === f.id 
                        ? 'bg-magenta-500 text-black shadow-[0_0_10px_#ff00ff]' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {f.icon}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <CyberButton onClick={() => setShowAddForm(!showAddForm)} variant="secondary" className="text-[10px] py-1.5 px-4">
                 {showAddForm ? <X className="w-3 h-3 mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                 {showAddForm ? 'Lukk' : 'Ny regning'}
              </CyberButton>
            </div>
          </div>

          {showAddForm && (
            <div className="glass-panel p-6 border border-magenta-500/30 mb-8 bg-magenta-500/5 animate-in slide-in-from-top-4">
              <h3 className="text-xs font-black uppercase text-magenta-400 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Legg til ny regning
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-slate-500">Navn / Leverandør</label>
                  <input value={newBill.name} onChange={e => setNewBill({...newBill, name: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-magenta-500" placeholder="F.eks Iberdrola" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-slate-500">Beløp</label>
                  <div className="flex gap-1">
                    <input type="number" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: Number(e.target.value)})} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-magenta-500" />
                    <select value={newBill.currency} onChange={e => setNewBill({...newBill, currency: e.target.value as Currency})} className="bg-black border border-white/10 p-2 text-magenta-400 text-xs font-bold outline-none">
                      <option value="EUR">EUR</option>
                      <option value="NOK">NOK</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-black text-slate-500">Forfallsdato</label>
                  <input type="date" value={newBill.dueDate} onChange={e => setNewBill({...newBill, dueDate: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-magenta-500" />
                </div>
              </div>
              <div className="flex items-center gap-6 mb-6">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" checked={newBill.isRecurring} onChange={e => setNewBill({...newBill, isRecurring: e.target.checked})} className="hidden" />
                  <div className={`w-4 h-4 border flex items-center justify-center transition-all ${newBill.isRecurring ? 'border-magenta-500 bg-magenta-500 shadow-[0_0_8px_#ff00ff]' : 'border-white/20'}`}>
                    {newBill.isRecurring && <Check className="w-3 h-3 text-black" />}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white transition-colors">Fast utgift</span>
                </label>
              </div>
              <div className="flex gap-4">
                <CyberButton onClick={resetForm} variant="ghost" className="flex-1">Nullstill</CyberButton>
                <CyberButton onClick={handleAddBill} variant="secondary" className="flex-1">Lagre</CyberButton>
              </div>
            </div>
          )}

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
            {filteredBills.length === 0 ? (
              <div className="py-20 text-center opacity-20 border-2 border-dashed border-white/5 flex flex-col items-center">
                <ShieldCheck className="w-12 h-12 mb-4" />
                <p className="uppercase tracking-[0.3em] text-[10px] font-black">Ingen regninger funnet</p>
              </div>
            ) : (
              filteredBills.map(bill => {
                  const status = getBillStatus(bill);
                  const isOverdue = status === 'overdue';
                  const isPaid = status === 'paid';
                  return (
                    <div key={bill.id} className={`p-4 border transition-all ${isPaid ? 'bg-black/50 border-white/5 opacity-50' : isOverdue ? 'bg-rose-500/10 border-rose-500 animate-pulse' : 'bg-white/5 border-white/10 hover:border-magenta-500/30'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <button onClick={() => isPaid ? togglePaidStatus(bill.id) : setConfirmingBillId(bill.id)} className={`w-10 h-10 border flex items-center justify-center transition-all ${isPaid ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5' : 'border-magenta-500 text-magenta-500 hover:bg-magenta-500/10'}`}>
                             {isPaid ? <RotateCcw className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-white uppercase tracking-tight">{bill.name}</h4>
                              {bill.isRecurring && <Repeat className="w-3 h-3 text-cyan-400" />}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono italic">{bill.dueDate}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono font-black text-white">{formatCurrency(bill.amount, bill.currency)}</p>
                          <div className="flex gap-2 justify-end mt-1">
                            {isOverdue && <span className="text-[7px] bg-rose-500 text-white px-1 font-black uppercase tracking-tighter">Forfalt</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
              })
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Oppsummering */}
        <div className="glass-panel p-6 border-l-4 border-l-yellow-500 bg-yellow-500/5">
          <h2 className="text-xs font-black mb-4 text-yellow-500 uppercase tracking-widest flex items-center gap-2">
            <Clock className="w-4 h-4" /> Økonomisk Prognose
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Totalt utestående</p>
              <p className="text-2xl font-black text-white font-mono">{formatCurrency(stats.pendingSum, 'EUR')}</p>
            </div>
            {stats.overdueCount > 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20">
                <p className="text-[9px] uppercase text-rose-500 font-black mb-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Kritisk Forfall
                </p>
                <p className="text-lg font-black text-rose-400 font-mono">{formatCurrency(stats.overdueSum, 'EUR')}</p>
              </div>
            )}
            <div className="pt-4 border-t border-white/5">
              <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Totalt betalt perioden</p>
              <p className="text-lg font-black text-emerald-400 font-mono">{formatCurrency(stats.paidSum, 'EUR')}</p>
            </div>
          </div>
        </div>

        {/* AI Budsjett-assistent */}
        <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5 relative overflow-hidden group">
           <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <BrainCircuit className="w-24 h-24 text-emerald-400" />
           </div>
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <BrainCircuit className="w-4 h-4" /> AI Budsjett-Rådgiver
              </h2>
              <button 
                onClick={generateAdvice} 
                disabled={loadingAdvice || bills.length === 0}
                className="p-2 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-black transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${loadingAdvice ? 'animate-spin' : ''}`} />
              </button>
           </div>
           
           <div className="space-y-4 relative z-10">
              {loadingAdvice ? (
                <div className="py-12 flex flex-col items-center">
                   <div className="w-full h-1 bg-white/5 overflow-hidden mb-4 rounded-full">
                      <div className="h-full bg-emerald-500 animate-[scan_2s_linear_infinite]"></div>
                   </div>
                   <p className="text-[9px] text-emerald-500 uppercase font-black animate-pulse tracking-widest">Neural analyse pågår...</p>
                </div>
              ) : aiAdvice.length > 0 ? (
                aiAdvice.map((item, idx) => (
                  <div key={idx} className="p-4 bg-black/40 border border-white/5 relative group hover:border-emerald-500/30 transition-all">
                     <div className={`absolute top-0 right-0 p-1.5 text-[7px] font-black uppercase border-b border-l ${
                       item.severity === 'High' ? 'text-rose-500 border-rose-500/30 bg-rose-500/5' : 
                       item.severity === 'Medium' ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' : 
                       'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'
                     }`}>
                        {item.severity} Risk
                     </div>
                     <p className="text-[11px] text-white font-bold leading-tight mb-2 uppercase tracking-tight pr-10">
                        {item.insight}
                     </p>
                     <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-[10px] text-slate-400 italic font-mono flex items-center gap-2">
                           <ChevronRight className="w-3 h-3 text-emerald-500" />
                           <span className="text-white font-bold">Action:</span> {item.action}
                        </p>
                     </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                   <p className="text-[11px] text-slate-400 italic leading-relaxed font-mono px-4">
                     Analyser dine aktive forpliktelser for å avdekke sparemuligheter og optimere familiens likviditet.
                   </p>
                   <CyberButton 
                    onClick={generateAdvice} 
                    disabled={bills.length === 0} 
                    variant="ghost" 
                    className="mt-6 text-[10px] py-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                   >
                     Generer Strategisk Innsikt
                   </CyberButton>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};