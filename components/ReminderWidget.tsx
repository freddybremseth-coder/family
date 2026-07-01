import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, CalendarClock, ChevronRight, Coins, FileText } from 'lucide-react';
import { Bill } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

interface Props {
  bills?: Bill[];
  userId?: string;
  onNavigate?: (tab: string) => void;
}

type ReminderItem = {
  id: string;
  title: string;
  subtitle: string;
  daysUntil: number;         // negativ = forfalt
  category: 'bill' | 'document' | 'mondeo';
  amount?: number;
  targetTab: string;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(amount || 0));

function daysBetween(from: Date, to: Date): number {
  const ms = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
           - new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function nextBillDueDate(bill: Bill, today: Date): Date {
  const dueDay = Math.min(Math.max(1, bill.dueDay || 1), 28);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (thisMonth < today && !bill.isPaid) {
    // Forfalt denne måneden hvis ikke betalt
    return thisMonth;
  }
  if (thisMonth >= today) return thisMonth;
  // Neste måned
  return new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
}

export const ReminderWidget: React.FC<Props> = ({ bills = [], userId, onNavigate }) => {
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; category: string; owner: string; expiryDate?: string }>>([]);
  const [mondeoStatus, setMondeoStatus] = useState<{ paidThisMonth: number; minMonthly: number; monthKey: string } | null>(null);

  // Last dokumenter med utløpsdato
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('family_documents')
          .select('id, title, category, owner_label, expiry_date')
          .not('expiry_date', 'is', null)
          .eq('user_id', userId)
          .order('expiry_date', { ascending: true });
        if (data) {
          setDocuments(data.map((d: any) => ({
            id: d.id, title: d.title, category: d.category, owner: d.owner_label || 'Familien', expiryDate: d.expiry_date,
          })));
        }
      } catch (e) { console.warn('[Reminder] dokument-fetch feil:', e); }
    })();
  }, [userId]);

  // Last Mondeo min-status for inneværende måned
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      try {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthStart = `${monthKey}-01`;
        const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const nextMonthKey = nextMonthDate.toISOString().slice(0, 10);
        const [{ data: settings }, { data: payments }] = await Promise.all([
          supabase.from('mondeo_loan_settings').select('min_monthly_payment').eq('user_id', userId).maybeSingle(),
          supabase.from('mondeo_loan_payments').select('amount').eq('user_id', userId).gte('date', monthStart).lt('date', nextMonthKey),
        ]);
        const min = Number(settings?.min_monthly_payment || 33000);
        const paid = (payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        setMondeoStatus({ paidThisMonth: paid, minMonthly: min, monthKey });
      } catch (e) { console.warn('[Reminder] Mondeo-fetch feil:', e); }
    })();
  }, [userId]);

  const reminders: ReminderItem[] = useMemo(() => {
    const today = new Date();
    const items: ReminderItem[] = [];

    // 1. Regninger som forfaller innen 14 dager (eller er forfalt)
    for (const bill of bills) {
      if (bill.isPaid) continue;
      const dueDate = nextBillDueDate(bill, today);
      const days = daysBetween(today, dueDate);
      if (days <= 14) {
        items.push({
          id: `bill-${bill.id}`,
          title: bill.name,
          subtitle: `${bill.category} · Forfaller ${dueDate.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`,
          daysUntil: days,
          category: 'bill',
          amount: bill.amount,
          targetTab: 'trends',
        });
      }
    }

    // 2. Dokumenter som utløper innen 60 dager
    for (const doc of documents) {
      if (!doc.expiryDate) continue;
      const exp = new Date(doc.expiryDate);
      if (Number.isNaN(exp.getTime())) continue;
      const days = daysBetween(today, exp);
      if (days <= 60) {
        items.push({
          id: `doc-${doc.id}`,
          title: doc.title,
          subtitle: `${doc.category} · ${doc.owner} · Utløper ${exp.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })}`,
          daysUntil: days,
          category: 'document',
          targetTab: 'documents',
        });
      }
    }

    // 3. Mondeo min-betaling ubetalt for inneværende måned
    if (mondeoStatus && mondeoStatus.paidThisMonth < mondeoStatus.minMonthly) {
      const missing = mondeoStatus.minMonthly - mondeoStatus.paidThisMonth;
      items.push({
        id: 'mondeo-min',
        title: 'Mondeo: minimum ubetalt',
        subtitle: `${mondeoStatus.monthKey} · Mangler ${formatMoney(missing)} — hovedstolen vokser hvis ikke betalt`,
        daysUntil: 0, // Ansett som "haster nå"
        category: 'mondeo',
        amount: missing,
        targetTab: 'business',
      });
    }

    return items.sort((a, b) => a.daysUntil - b.daysUntil);
  }, [bills, documents, mondeoStatus]);

  const overdueCount = reminders.filter(r => r.daysUntil < 0).length;
  const urgentCount = reminders.filter(r => r.daysUntil >= 0 && r.daysUntil <= 7).length;

  if (reminders.length === 0) {
    return (
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Bell className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Påminnelser</h2>
            <p className="text-xs text-slate-500">Alt er i rute</p>
          </div>
        </div>
        <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-center text-sm text-emerald-700">
          Ingen forfalle regninger, dokument-utløp eller Mondeo-mangler i nærmeste framtid.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${overdueCount > 0 ? 'bg-rose-100 text-rose-700' : urgentCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Påminnelser</h2>
            <p className="text-xs text-slate-500">
              {overdueCount > 0 && <span className="text-rose-700 font-semibold">{overdueCount} forfalt</span>}
              {overdueCount > 0 && (urgentCount > 0 || reminders.length > overdueCount) && ' · '}
              {urgentCount > 0 && <span className="text-amber-700 font-semibold">{urgentCount} i uken</span>}
              {urgentCount > 0 && reminders.length > overdueCount + urgentCount && ' · '}
              {reminders.length > overdueCount + urgentCount && <span>{reminders.length - overdueCount - urgentCount} senere</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {reminders.slice(0, 8).map((item) => {
          const isOverdue = item.daysUntil < 0;
          const isUrgent = item.daysUntil >= 0 && item.daysUntil <= 7;
          const tone = isOverdue
            ? 'border-rose-200 bg-rose-50 hover:border-rose-300'
            : isUrgent
              ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
              : 'border-slate-200 bg-white hover:border-slate-300';
          const iconTone = isOverdue ? 'bg-rose-100 text-rose-700' : isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
          const Icon = item.category === 'bill' ? Coins : item.category === 'document' ? FileText : AlertCircle;
          const daysLabel = isOverdue
            ? `${Math.abs(item.daysUntil)} d forsinket`
            : item.daysUntil === 0
              ? 'I dag'
              : item.daysUntil === 1
                ? 'I morgen'
                : `Om ${item.daysUntil} dager`;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate?.(item.targetTab)}
              className={`w-full rounded-2xl border p-3 text-left transition ${tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTone}`}><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-600 truncate">{item.subtitle}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isOverdue ? 'bg-rose-200 text-rose-800' : isUrgent ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                        <CalendarClock className="h-3 w-3" /> {daysLabel}
                      </span>
                      {item.amount && item.amount > 0 && <span className="text-xs font-mono font-bold text-slate-700">{formatMoney(item.amount)}</span>}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 mt-1" />
              </div>
            </button>
          );
        })}
      </div>

      {reminders.length > 8 && (
        <p className="mt-3 text-center text-xs text-slate-500">+ {reminders.length - 8} andre. Klikk et element for å se detaljer.</p>
      )}
    </div>
  );
};
