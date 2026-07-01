import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, Landmark, Coins, FileText, Users, TrendingUp, Bitcoin, Home, Droplet, Target, Receipt, ShoppingCart, CalendarDays } from 'lucide-react';
import { Transaction, BankAccount, Asset, Bill, FamilyMember, CalendarEvent } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  transactions: Transaction[];
  bankAccounts: BankAccount[];
  assets: Asset[];
  bills: Bill[];
  familyMembers: FamilyMember[];
  calendarEvents: CalendarEvent[];
}

interface SearchResult {
  key: string;
  category: string;
  label: string;
  subtitle: string;
  tab: string;
  icon: React.ReactNode;
}

export const GlobalSearch: React.FC<Props> = ({ open, onClose, onNavigate, transactions, bankAccounts, assets, bills, familyMembers, calendarEvents }) => {
  const [q, setQ] = useState('');

  // Escape lukker; Cmd+K/Ctrl+K åpner via forelder
  useEffect(() => {
    if (!open) { setQ(''); return; }
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const results = useMemo<SearchResult[]>(() => {
    const query = q.trim().toLowerCase();
    if (!query || query.length < 2) return [];
    const out: SearchResult[] = [];
    const matches = (text?: string) => text && text.toLowerCase().includes(query);

    // Transaksjoner (topp 5)
    transactions.filter(t => matches(t.description) || matches(t.category) || String(t.amount).includes(query)).slice(0, 5).forEach(t => {
      out.push({
        key: `tx-${t.id}`,
        category: 'Transaksjon',
        label: t.description,
        subtitle: `${t.date} · ${t.category} · ${new Intl.NumberFormat('nb-NO').format(t.amount)} ${t.currency}`,
        tab: 'transactions',
        icon: <Receipt className="h-4 w-4" />,
      });
    });

    // Bankkontoer
    bankAccounts.filter(a => matches(a.accountName) || matches(a.bankName) || matches(a.accountNumber) || matches(a.iban)).forEach(a => {
      out.push({
        key: `bank-${a.id}`,
        category: 'Bankkonto',
        label: a.accountName || a.bankName,
        subtitle: `${a.bankName || ''} · ${a.accountNumber || a.iban || ''} · ${a.currency}`,
        tab: 'bank',
        icon: <Landmark className="h-4 w-4" />,
      });
    });

    // Eiendeler
    assets.filter(a => matches(a.name) || matches(a.category)).forEach(a => {
      out.push({
        key: `asset-${a.id}`,
        category: 'Eiendel',
        label: a.name,
        subtitle: `${a.category} · ${new Intl.NumberFormat('nb-NO').format(a.value)} ${a.currency}`,
        tab: 'bank',
        icon: <Home className="h-4 w-4" />,
      });
    });

    // Regninger
    bills.filter(b => matches(b.name) || matches(b.category)).forEach(b => {
      out.push({
        key: `bill-${b.id}`,
        category: 'Regning',
        label: b.name,
        subtitle: `${b.category} · ${b.dueDay}. hver mnd · ${b.isPaid ? 'Betalt' : 'Åpen'}`,
        tab: 'trends',
        icon: <Coins className="h-4 w-4" />,
      });
    });

    // Familiemedlemmer
    familyMembers.filter(m => matches(m.name) || matches(m.email) || matches(m.spanishNie) || matches(m.norwegianFnr)).forEach(m => {
      out.push({
        key: `mem-${m.id}`,
        category: 'Familie',
        label: m.name,
        subtitle: `${m.email || m.phone || ''} ${m.spanishNie ? '· NIE ' + m.spanishNie : ''}`,
        tab: 'members',
        icon: <Users className="h-4 w-4" />,
      });
    });

    // Kalender
    calendarEvents.filter(e => matches(e.description) || matches(e.title) || matches(e.type)).slice(0, 5).forEach(e => {
      out.push({
        key: `cal-${e.id}`,
        category: 'Kalender',
        label: e.description || e.title || 'Hendelse',
        subtitle: `${e.date} · ${e.type}`,
        tab: 'familyplan',
        icon: <CalendarDays className="h-4 w-4" />,
      });
    });

    // Naviger-forslag (statiske)
    const tabs: Array<[string, string, React.ReactNode]> = [
      ['sparemål', 'goals', <Target className="h-4 w-4" />],
      ['crypto', 'crypto', <Bitcoin className="h-4 w-4" />],
      ['olivenolje', 'olive', <Droplet className="h-4 w-4" />],
      ['dokumenter', 'documents', <FileText className="h-4 w-4" />],
      ['handleliste', 'shopping', <ShoppingCart className="h-4 w-4" />],
      ['regninger', 'trends', <TrendingUp className="h-4 w-4" />],
    ];
    for (const [name, tab, icon] of tabs) {
      if (name.includes(query)) {
        out.push({ key: `nav-${tab}`, category: 'Åpne', label: name.charAt(0).toUpperCase() + name.slice(1), subtitle: 'Naviger til fane', tab, icon });
      }
    }

    return out.slice(0, 25);
  }, [q, transactions, bankAccounts, assets, bills, familyMembers, calendarEvents]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-24">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk transaksjoner, kontoer, eiendeler, regninger, familie, kalender..."
            className="flex-1 border-0 bg-transparent text-base focus:ring-0 focus:outline-none"
          />
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {q.length < 2 ? (
            <p className="p-8 text-center text-sm text-slate-500">Skriv 2 eller flere tegn for å søke</p>
          ) : results.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">Ingen treff for «{q}»</p>
          ) : (
            <div className="p-2">
              {results.map(r => (
                <button
                  key={r.key}
                  onClick={() => { onNavigate(r.tab); onClose(); }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">{r.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{r.label}</p>
                    <p className="text-xs text-slate-500 truncate">{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">{r.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 p-3 text-center text-xs text-slate-500">
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono">Esc</kbd> lukk · <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono">⌘K</kbd> åpne
        </div>
      </div>
    </div>
  );
};
