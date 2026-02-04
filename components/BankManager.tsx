
import React, { useState, useRef, useMemo } from 'react';
import { BankAccount, Transaction, TransactionType, Currency } from '../types';
import { CyberButton } from './CyberButton';
import { Banknote, Plus, Trash2, Edit3, Save, X, RefreshCw, CheckCircle2, AlertCircle, UploadCloud, ListChecks, Info, ShieldAlert } from 'lucide-react';
import { analyzeBankStatement } from '../services/geminiService';
import { EXCHANGE_RATE_EUR_TO_NOK } from '../constants';

interface Props {
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const BankManager: React.FC<Props> = ({ bankAccounts, setBankAccounts, transactions, setTransactions }) => {
  const [selectedReconciliationAccountId, setSelectedReconciliationAccountId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [aiAnalysisResults, setAiAnalysisResults] = useState<any>(null);

  return (
    <div className="space-y-8">
      {/* BEKREFTELSESMODAL - FIKSET KONTRAST */}
      {showConfirmModal && aiAnalysisResults && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
          <div className="glass-panel w-full max-w-md p-8 border-2 border-magenta-500 shadow-[0_0_40px_#ff00ff] animate-in zoom-in-95 duration-200 relative">
            <div className="flex items-center gap-4 mb-6">
              <ShieldAlert className="text-magenta-400 w-6 h-6 animate-pulse" />
              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Bekreft Avstemming</h3>
            </div>
            <p className="text-slate-300 text-sm mb-8">Oppdaterer kontobalanse permanent.</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className="flex-1 py-3 border border-white/10 text-slate-100 uppercase text-[10px] font-bold tracking-widest hover:bg-white/10 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => setShowConfirmModal(false)} 
                className="flex-1 py-3 bg-magenta-500 text-black uppercase text-[10px] font-bold tracking-widest"
              >
                Bekreft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTERENDE BANK-KODE */}
      <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
        <h3 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter mb-6">
          <Banknote className="text-cyan-400" /> Mine Bankkontoer
        </h3>
        <div className="space-y-4">
          {bankAccounts.map(account => (
            <div key={account.id} className="p-4 bg-white/5 border border-white/10 flex justify-between items-center">
              <h4 className="font-bold text-white">{account.name}</h4>
              <p className="text-xl font-black font-mono text-white">{formatCurrency(account.balance, account.currency)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
