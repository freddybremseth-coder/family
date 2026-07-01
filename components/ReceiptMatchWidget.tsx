import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Receipt, ChevronRight, Store } from 'lucide-react';
import { Transaction } from '../types';
import { matchReceiptsToTransactions, ReceiptMatchRow } from '../services/receiptBankMatchService';

interface Props {
  userId?: string;
  transactions: Transaction[];
  onNavigate?: (tab: string) => void;
}

const formatMoney = (v: number, cur: string) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: 2 }).format(v);

export const ReceiptMatchWidget: React.FC<Props> = ({ userId, transactions, onNavigate }) => {
  const [rows, setRows] = useState<ReceiptMatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    matchReceiptsToTransactions(userId, transactions).then(setRows).finally(() => setLoading(false));
  }, [userId, transactions.length]);

  if (loading) return <div className="card p-5 text-sm text-slate-500">Analyserer transaksjoner...</div>;
  if (rows.length === 0) return null;

  const withReceipt = rows.filter(r => r.hasReceipt);
  const withoutReceipt = rows.filter(r => !r.hasReceipt);
  const coveragePct = Math.round((withReceipt.length / rows.length) * 100);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 shrink-0"><Receipt className="h-5 w-5" /></div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">Kvittering-dekning</h2>
            <p className="text-xs text-slate-500">Hvor mange bank-transaksjoner har skannet kvittering?</p>
            <div className="mt-3 flex items-baseline gap-4">
              <span className="text-3xl font-black text-slate-900">{coveragePct} %</span>
              <span className="text-xs text-slate-500">
                <span className="text-emerald-700 font-bold">{withReceipt.length}</span> med /
                <span className="text-rose-700 font-bold ml-1">{withoutReceipt.length}</span> uten
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-emerald-500" style={{ width: `${coveragePct}%` }} />
            </div>
          </div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="rounded-xl p-1.5 hover:bg-slate-100 text-slate-500">
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          {withoutReceipt.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-black text-rose-700 tracking-wide mb-2">Mangler kvittering ({withoutReceipt.length})</p>
              <div className="space-y-1.5">
                {withoutReceipt.slice(0, 10).map(row => (
                  <div key={row.transactionId} className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/40 p-2.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{row.transactionDescription}</p>
                        <p className="text-[10px] text-slate-500">{row.transactionDate}</p>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-bold text-slate-900 shrink-0">{formatMoney(row.transactionAmount, row.transactionCurrency)}</span>
                  </div>
                ))}
                {withoutReceipt.length > 10 && <p className="text-[10px] text-slate-500 text-center">+ {withoutReceipt.length - 10} andre</p>}
              </div>
              <p className="mt-2 text-xs text-slate-500">💡 Skann disse kvitteringene for full sporbarhet av utgifter</p>
            </div>
          )}

          {withReceipt.length > 0 && (
            <div>
              <p className="text-[10px] uppercase font-black text-emerald-700 tracking-wide mb-2">Verifisert med kvittering ({withReceipt.length})</p>
              <div className="space-y-1.5">
                {withReceipt.slice(0, 10).map(row => {
                  const isExpanded = expandedRow === row.transactionId;
                  return (
                    <div key={row.transactionId} className="rounded-xl border border-emerald-200 bg-emerald-50/40">
                      <button
                        onClick={() => setExpandedRow(isExpanded ? null : row.transactionId)}
                        className="w-full flex items-center justify-between gap-3 p-2.5 text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {row.transactionDescription}
                              {row.matchConfidence === 'exact' ? ' ✓' : ' ≈'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              <Store className="inline h-2.5 w-2.5" /> {row.receiptVendor} · {row.transactionDate}
                              {row.daysDiff !== undefined && row.daysDiff > 0 && ` (±${row.daysDiff}d)`}
                              {' · '}{row.receiptItems?.length || 0} varer
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-bold text-slate-900 shrink-0">{formatMoney(row.transactionAmount, row.transactionCurrency)}</span>
                      </button>
                      {isExpanded && row.receiptItems && (
                        <div className="border-t border-emerald-200 p-2.5 bg-white text-xs">
                          <ul className="space-y-1">
                            {row.receiptItems.map((it, i) => (
                              <li key={i} className="flex justify-between gap-3">
                                <span className="text-slate-700 truncate">{it.name}</span>
                                <span className="font-mono text-slate-600 shrink-0">{formatMoney(it.total_price, row.transactionCurrency)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
                {withReceipt.length > 10 && <p className="text-[10px] text-slate-500 text-center">+ {withReceipt.length - 10} andre</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
