import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Building2, Car, Home, Landmark, MinusCircle, Plus, Wallet } from 'lucide-react';
import { Asset, BankAccount, RealEstateDeal } from '../types';
import { isSupabaseConfigured, supabase } from '../supabase';

interface Props {
  bankAccounts: BankAccount[];
  assets: Asset[];
  realEstateDeals: RealEstateDeal[];
  userId?: string;
}

type Debt = { id: string; name: string; amount: number; note?: string };

const formatNOK = (value: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(value || 0));

const eurToNok = 11.55;

const toNok = (amount: number, currency?: string) => currency === 'EUR' ? Number(amount || 0) * eurToNok : Number(amount || 0);

const assetIcon = (type?: string) => {
  if (type === 'Vehicle') return <Car className="h-5 w-5" />;
  if (type === 'Property') return <Home className="h-5 w-5" />;
  if (type === 'Land') return <Building2 className="h-5 w-5" />;
  return <Wallet className="h-5 w-5" />;
};

function StatCard({ title, value, symbol }: { title: string; value: string; symbol: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-600">{symbol}</div>
      </div>
    </div>
  );
}

export const NetWorthOverview: React.FC<Props> = ({ bankAccounts, assets, realEstateDeals, userId }) => {
  const [mondeoBalance, setMondeoBalance] = useState<number>(4800000);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtName, setDebtName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('familyhub_manual_debts');
    if (saved) setDebts(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('familyhub_manual_debts', JSON.stringify(debts));
  }, [debts]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;
    (async () => {
      const { data: settings } = await supabase.from('mondeo_loan_settings').select('*').eq('user_id', userId).maybeSingle();
      const initialPrincipal = Number(settings?.initial_principal ?? 4800000);
      const startRate = Number(settings?.norges_bank_rate_pct ?? 4.5) + Number(settings?.margin_pct ?? 6);
      const monthlyRate = startRate / 100 / 12;
      const { data: payments } = await supabase.from('mondeo_loan_payments').select('*').eq('user_id', userId).order('date', { ascending: true });
      let balance = initialPrincipal;
      (payments || []).forEach((payment: any) => {
        const interest = balance * monthlyRate;
        balance = balance + interest - Number(payment.amount || 0);
      });
      setMondeoBalance(balance);
    })();
  }, [userId]);

  const summary = useMemo(() => {
    const bankValue = bankAccounts.reduce((sum, account) => sum + toNok(account.balance, account.currency), 0);
    const assetValue = assets.reduce((sum, asset) => sum + toNok(asset.currentValue, asset.currency), 0);
    const expectedCommission = realEstateDeals.reduce((sum, deal) => sum + toNok(deal.ourNetCommission || deal.ourGrossCommission || 0, deal.currency), 0);
    const debtValue = debts.reduce((sum, debt) => sum + Number(debt.amount || 0), 0);
    const grossAssets = bankValue + assetValue + mondeoBalance + expectedCommission;
    return { bankValue, assetValue, expectedCommission, debtValue, grossAssets, netWorth: grossAssets - debtValue };
  }, [bankAccounts, assets, realEstateDeals, debts, mondeoBalance]);

  const addDebt = () => {
    const amount = Number(debtAmount || 0);
    if (!debtName.trim() || amount <= 0) return;
    setDebts(prev => [...prev, { id: `${Date.now()}`, name: debtName.trim(), amount }]);
    setDebtName('');
    setDebtAmount('');
  };

  return (
    <div className="space-y-6">
      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white"><Wallet className="h-5 w-5" /></div>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Eiendeler og nettoformue</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Hva eier vi?</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">Samlet oversikt over bankkontoer, biler, hus, tomter, utestående Mondeo-verdi, forventede provisjoner og gjeld.</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Nettoformue" value={formatNOK(summary.netWorth)} symbol="kr" />
        <StatCard title="Brutto eiendeler" value={formatNOK(summary.grossAssets)} symbol="+" />
        <StatCard title="Gjeld" value={formatNOK(summary.debtValue)} symbol="−" />
        <StatCard title="Mondeo utestående" value={formatNOK(mondeoBalance)} symbol="M" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <h2 className="text-xl font-bold">Fordeling av verdier</h2>
          <p className="mt-1 text-sm text-slate-500">Mondeo Eiendom AS føres som utestående lånesaldo. Når kjøper betaler ned, reduseres verdien hos dere.</p>
          <div className="mt-5 space-y-3">
            {[
              ['Bankkontoer', summary.bankValue],
              ['Registrerte eiendeler', summary.assetValue],
              ['Mondeo Eiendom AS, utestående', mondeoBalance],
              ['Forventede eiendomsprovisjoner', summary.expectedCommission],
            ].map(([label, value]: any) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-semibold text-slate-700">{label}</p>
                  <p className="font-bold text-slate-900">{formatNOK(value)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-xl font-bold">Legg inn gjeld</h2>
          <p className="mt-1 text-sm text-slate-500">Gjeld trekkes fra nettoformuen.</p>
          <div className="mt-5 space-y-3">
            <input value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="F.eks. billån, privatlån, boliglån" />
            <input type="number" value={debtAmount} onChange={e => setDebtAmount(e.target.value)} placeholder="Beløp i NOK" />
            <button onClick={addDebt} className="btn-primary w-full"><Plus className="h-4 w-4" /> Legg til gjeld</button>
          </div>
          <div className="mt-5 space-y-2">
            {debts.length === 0 ? <p className="text-sm text-slate-500">Ingen gjeld lagt inn ennå.</p> : debts.map(debt => (
              <div key={debt.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div><p className="font-semibold text-slate-800">{debt.name}</p><p className="text-sm text-slate-500">{formatNOK(debt.amount)}</p></div>
                <button onClick={() => setDebts(prev => prev.filter(item => item.id !== debt.id))} className="rounded-xl p-2 text-red-600 hover:bg-red-50"><MinusCircle className="h-5 w-5" /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-xl font-bold">Bankkontoer</h2>
          <div className="mt-4 space-y-2">
            {bankAccounts.length === 0 ? <p className="text-sm text-slate-500">Ingen bankkontoer registrert ennå.</p> : bankAccounts.map(account => (
              <div key={account.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100"><Landmark className="h-5 w-5" /></div><div><p className="font-bold text-slate-900">{account.name}</p><p className="text-sm text-slate-500">{account.currency}</p></div></div><p className="font-bold">{formatNOK(toNok(account.balance, account.currency))}</p></div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="text-xl font-bold">Eiendeler</h2>
          <div className="mt-4 space-y-2">
            {assets.length === 0 ? <p className="text-sm text-slate-500">Ingen biler, hus, tomter eller andre eiendeler registrert ennå.</p> : assets.map(asset => (
              <div key={asset.id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">{assetIcon(asset.type)}</div><div><p className="font-bold text-slate-900">{asset.name}</p><p className="text-sm text-slate-500">{asset.type} · {asset.location}</p></div></div><p className="font-bold">{formatNOK(toNok(asset.currentValue, asset.currency))}</p></div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
