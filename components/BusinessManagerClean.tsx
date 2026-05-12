import React, { useMemo, useState } from 'react';
import { Sprout, Home, Handshake, Building2, Plus, TrendingUp, TrendingDown, Trees, Receipt } from 'lucide-react';
import { DealStatus } from '../types';
import { MondeoLoanTracker } from './MondeoLoanTracker';

const money = (amount: number, currency = 'EUR') =>
  new Intl.NumberFormat(currency === 'NOK' ? 'nb-NO' : 'de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const number = (value: number) => new Intl.NumberFormat('nb-NO').format(Number(value || 0));
const today = () => new Date().toISOString().split('T')[0];

type TabId = 'donaanna' | 'realestate' | 'mondeo' | 'aftersale';

function StatCard({ label, value, hint, icon }: any) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
      </div>
    </div>
  );
}

function EmptyState({ title, text }: any) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <p className="font-bold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export const BusinessManagerClean = ({ deals, setDeals, afterSales, farmOps }: any) => {
  const [activeTab, setActiveTab] = useState<TabId>('donaanna');
  const [showDealForm, setShowDealForm] = useState(false);
  const [newDeal, setNewDeal] = useState<any>({ customerName: '', totalSaleValue: '', commissionPct: 5, businessUnit: 'Soleada' });

  const farm = useMemo(() => {
    const income = farmOps.filter((x: any) => x.type === 'Income').reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const expenses = farmOps.filter((x: any) => x.type === 'Expense').reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    return { income, expenses, net: income - expenses };
  }, [farmOps]);

  const sales = useMemo(() => {
    const value = deals.reduce((s: number, x: any) => s + Number(x.totalSaleValue || 0), 0);
    const gross = deals.reduce((s: number, x: any) => s + Number(x.ourGrossCommission || 0), 0);
    const net = deals.reduce((s: number, x: any) => s + Number(x.ourNetCommission || 0), 0);
    const active = deals.filter((x: any) => x.status !== DealStatus.CANCELLED && x.status !== DealStatus.COMPLETED).length;
    return { value, gross, net, active };
  }, [deals]);

  const service = useMemo(() => {
    const total = afterSales.reduce((s: number, x: any) => s + Number(x.ourCommissionAmount || 0), 0);
    const paid = afterSales.filter((x: any) => x.isPaid).reduce((s: number, x: any) => s + Number(x.ourCommissionAmount || 0), 0);
    return { total, paid, pending: total - paid, count: afterSales.length };
  }, [afterSales]);

  const addDeal = () => {
    if (!newDeal.customerName || !newDeal.totalSaleValue) return;
    const value = Number(newDeal.totalSaleValue || 0);
    const pct = Number(newDeal.commissionPct || 0);
    const gross = value * pct / 100;
    setDeals((prev: any[]) => [{
      id: `deal-${Date.now()}`,
      developerId: '',
      customerName: newDeal.customerName,
      leadSource: 'Direkte',
      totalSaleValue: value,
      grossCommissionBase: value,
      commissionPct: pct,
      ourGrossCommission: gross,
      ourNetCommission: gross * 0.7,
      status: DealStatus.RESERVED,
      currency: 'EUR',
      businessUnit: newDeal.businessUnit,
      saleDate: today(),
      commissionPayouts: [],
      customerPayments: [],
    }, ...prev]);
    setNewDeal({ customerName: '', totalSaleValue: '', commissionPct: 5, businessUnit: 'Soleada' });
    setShowDealForm(false);
  };

  const tabs = [
    { id: 'donaanna', label: 'Dona Anna', text: 'Gård, olje og drift', icon: <Sprout className="h-5 w-5" /> },
    { id: 'realestate', label: 'Salg av eiendom', text: 'Salg og provisjon', icon: <Home className="h-5 w-5" /> },
    { id: 'mondeo', label: 'Mondeo Eiendom AS', text: 'Lån og rente', icon: <Building2 className="h-5 w-5" /> },
    { id: 'aftersale', label: 'Aftersale', text: 'Service og ettermarked', icon: <Handshake className="h-5 w-5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="card p-5 md:p-6">
        <p className="text-sm font-bold text-blue-700">Business</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">Business dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">Samlet oversikt for Dona Anna, salg av eiendom, Mondeo Eiendom AS og Aftersale.</p>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)} className={`rounded-2xl border p-4 text-left transition ${activeTab === tab.id ? 'border-blue-300 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{tab.icon}</div>
              <div><p className="font-black text-slate-950">{tab.label}</p><p className="mt-1 text-sm text-slate-500">{tab.text}</p></div>
            </div>
          </button>
        ))}
      </section>

      {activeTab === 'donaanna' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Netto resultat" value={money(farm.net)} hint="Registrert drift" icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="Inntekter" value={money(farm.income)} hint="Salg og inntekter" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Kostnader" value={money(farm.expenses)} hint="Drift og vedlikehold" icon={<TrendingDown className="h-5 w-5" />} /><StatCard label="Olivenfarm" value="1 500 trær" hint="1 370 L siste avling" icon={<Trees className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="section-title">Siste operasjoner</h2><p className="section-subtitle">Drift, inntekter og kostnader fra Dona Anna.</p><div className="mt-5">{farmOps.length === 0 ? <EmptyState title="Ingen gårdsoperasjoner registrert" text="Når Olivia/Dona Anna sender data, vises operasjonene her." /> : <div className="divide-y divide-slate-100">{farmOps.slice(0, 12).map((op: any) => <div key={op.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold text-slate-900">{op.description}</p><p className="text-sm text-slate-500">{op.date} · {op.category}</p></div><p className={`font-black ${op.type === 'Income' ? 'text-emerald-700' : 'text-red-700'}`}>{op.type === 'Income' ? '+' : '−'}{money(op.amount, op.currency)}</p></div>)}</div>}</div></div></section>}

      {activeTab === 'realestate' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Aktive salg" value={number(sales.active)} hint="Pågående pipeline" icon={<Home className="h-5 w-5" />} /><StatCard label="Salgsverdi" value={money(sales.value)} hint="Total pipeline" icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="Brutto provisjon" value={money(sales.gross)} hint="Beregnet" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Netto provisjon" value={money(sales.net)} hint="Etter splitt/kost" icon={<TrendingDown className="h-5 w-5" />} /></div><div className="card p-5"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="section-title">Salg og provisjoner</h2><p className="section-subtitle">Utbyggere-fanen er fjernet. Fokus er nå salg og resultat.</p></div><button onClick={() => setShowDealForm(!showDealForm)} className="btn-primary w-full md:w-auto"><Plus className="h-4 w-4" /> Nytt salg</button></div>{showDealForm && <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={newDeal.customerName} onChange={e => setNewDeal({ ...newDeal, customerName: e.target.value })} placeholder="Kunde" /><input type="number" value={newDeal.totalSaleValue} onChange={e => setNewDeal({ ...newDeal, totalSaleValue: e.target.value })} placeholder="Salgsverdi" /><input type="number" value={newDeal.commissionPct} onChange={e => setNewDeal({ ...newDeal, commissionPct: e.target.value })} placeholder="Provisjon %" /><select value={newDeal.businessUnit} onChange={e => setNewDeal({ ...newDeal, businessUnit: e.target.value })}><option value="Soleada">Soleada</option><option value="Pinosoecolife">Pinoso EcoLife</option><option value="ZenEcoHomes">ZenEcoHomes</option></select><button onClick={addDeal} className="btn-primary">Lagre</button></div></div>}{deals.length === 0 ? <EmptyState title="Ingen eiendomssalg registrert" text="Legg inn salg manuelt eller hent data fra RealtyFlow." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left"><th className="py-3 pr-4">Kunde</th><th className="py-3 pr-4">Brand</th><th className="py-3 pr-4 text-right">Salgsverdi</th><th className="py-3 pr-4 text-right">Provisjon</th><th className="py-3 pr-4">Status</th></tr></thead><tbody>{deals.map((deal: any) => <tr key={deal.id} className="border-b border-slate-100"><td className="py-3 pr-4 font-bold text-slate-900">{deal.customerName}</td><td className="py-3 pr-4 text-slate-600">{deal.businessUnit}</td><td className="py-3 pr-4 text-right font-semibold">{money(deal.totalSaleValue, deal.currency)}</td><td className="py-3 pr-4 text-right font-semibold">{money(deal.ourGrossCommission, deal.currency)}</td><td className="py-3 pr-4"><span className="badge">{deal.status}</span></td></tr>)}</tbody></table></div>}</div></section>}

      {activeTab === 'mondeo' && <section className="space-y-6"><MondeoLoanTracker /></section>}

      {activeTab === 'aftersale' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Saker" value={number(service.count)} hint="Registrerte oppdrag" icon={<Handshake className="h-5 w-5" />} /><StatCard label="Total provisjon" value={money(service.total)} hint="Ettermarked" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Utbetalt" value={money(service.paid)} hint="Betalt" icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="Utestående" value={money(service.pending)} hint="Ikke betalt" icon={<TrendingDown className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="section-title">Aftersale</h2><p className="section-subtitle">Service, partnere og provisjoner etter salg.</p><div className="mt-5">{afterSales.length === 0 ? <EmptyState title="Ingen aftersale-oppdrag registrert" text="Når service- eller partnerprovisjoner legges inn, vises de her." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left"><th className="py-3 pr-4">Kunde</th><th className="py-3 pr-4">Produkt</th><th className="py-3 pr-4">Leverandør</th><th className="py-3 pr-4 text-right">Provisjon</th><th className="py-3 pr-4">Status</th></tr></thead><tbody>{afterSales.map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 pr-4 font-bold text-slate-900">{item.customer}</td><td className="py-3 pr-4 text-slate-600">{item.product}</td><td className="py-3 pr-4 text-slate-600">{item.vendor}</td><td className="py-3 pr-4 text-right font-semibold">{money(item.ourCommissionAmount, item.currency)}</td><td className="py-3 pr-4"><span className="badge">{item.isPaid ? 'Betalt' : 'Utestående'}</span></td></tr>)}</tbody></table></div>}</div></div></section>}
    </div>
  );
};
