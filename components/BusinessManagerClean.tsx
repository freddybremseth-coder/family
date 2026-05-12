import React, { useEffect, useMemo, useState } from 'react';
import { Sprout, Home, Handshake, Building2, Plus, TrendingUp, TrendingDown, Trees, Receipt, RefreshCw } from 'lucide-react';
import { DealStatus } from '../types';
import { MondeoLoanTracker } from './MondeoLoanTracker';
import { fetchRealtyflowCommissions, RealtyflowSummary } from '../services/realtyflowService';
import { fetchDonaAnnaSummary, DonaAnnaSummary } from '../services/donaAnnaService';

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
  const [realtyflow, setRealtyflow] = useState<RealtyflowSummary | null>(null);
  const [donaAnna, setDonaAnna] = useState<DonaAnnaSummary | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);

  const loadHubData = async () => {
    setLoadingHub(true);
    try {
      const [realtyflowData, donaAnnaData] = await Promise.all([
        fetchRealtyflowCommissions(),
        fetchDonaAnnaSummary(),
      ]);
      setRealtyflow(realtyflowData);
      setDonaAnna(donaAnnaData);
    } finally {
      setLoadingHub(false);
    }
  };

  useEffect(() => {
    loadHubData();
  }, []);

  const localFarmFallback = useMemo(() => {
    const income = farmOps.filter((x: any) => x.type === 'Income').reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const expenses = farmOps.filter((x: any) => x.type === 'Expense').reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    return { income, expenses, net: income - expenses, operations: farmOps };
  }, [farmOps]);

  const farm = useMemo(() => {
    if (donaAnna) {
      return {
        income: donaAnna.incomeEur,
        expenses: donaAnna.expensesEur,
        net: donaAnna.netEur,
        operations: donaAnna.operations,
        harvestLiters: donaAnna.harvestLiters,
        trees: donaAnna.trees,
        source: donaAnna.source,
      };
    }
    return { ...localFarmFallback, harvestLiters: 1370, trees: 1500, source: 'fallback' };
  }, [donaAnna, localFarmFallback]);

  const sales = useMemo(() => {
    if (realtyflow && realtyflow.brands.length > 0) {
      const targetBrands = realtyflow.brands.filter(b => ['Soleada', 'ZenEcoHomes'].includes(b.brand));
      const selected = targetBrands.length > 0 ? targetBrands : realtyflow.brands;
      return {
        value: 0,
        gross: selected.reduce((s, b) => s + b.totalEur, 0),
        net: selected.reduce((s, b) => s + b.totalEur, 0),
        active: selected.reduce((s, b) => s + b.count, 0),
        brands: selected,
        source: 'RealtyFlow Pro / Supabase',
        fxRate: realtyflow.fxRate,
      };
    }

    const value = deals.reduce((s: number, x: any) => s + Number(x.totalSaleValue || 0), 0);
    const gross = deals.reduce((s: number, x: any) => s + Number(x.ourGrossCommission || 0), 0);
    const net = deals.reduce((s: number, x: any) => s + Number(x.ourNetCommission || 0), 0);
    const active = deals.filter((x: any) => x.status !== DealStatus.CANCELLED && x.status !== DealStatus.COMPLETED).length;
    return { value, gross, net, active, brands: [], source: 'Lokal fallback', fxRate: 11.55 };
  }, [deals, realtyflow]);

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
    { id: 'realestate', label: 'Salg av eiendom', text: 'Soleada og ZenEcoHomes', icon: <Home className="h-5 w-5" /> },
    { id: 'mondeo', label: 'Mondeo Eiendom AS', text: 'Lån og rente', icon: <Building2 className="h-5 w-5" /> },
    { id: 'aftersale', label: 'Aftersale', text: 'Service og ettermarked', icon: <Handshake className="h-5 w-5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      <section className="card p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">B</div>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">RealtyFlow Pro hub</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Business dashboard</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-600 md:text-lg">FamilyHub viser data fra RealtyFlow Pro/Supabase. RealtyFlow Pro er master for schema, salg, provisjoner og Dona Anna/Olivia-data.</p>
          </div>
          <button onClick={loadHubData} className="btn-secondary w-full md:w-auto" disabled={loadingHub}>
            <RefreshCw className={`h-4 w-4 ${loadingHub ? 'animate-spin' : ''}`} /> Oppdater fra Supabase
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as TabId)} className={`rounded-2xl border p-4 text-left transition ${activeTab === tab.id ? 'border-slate-900 bg-white shadow-sm ring-2 ring-slate-200' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>{tab.icon}</div>
              <div><p className="font-black text-slate-950">{tab.label}</p><p className="mt-1 text-sm text-slate-500">{tab.text}</p></div>
            </div>
          </button>
        ))}
      </section>

      {activeTab === 'donaanna' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Netto resultat" value={money(farm.net)} hint={farm.source === 'supabase' ? 'Fra Supabase / Olivia' : 'Fallback'} icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="Inntekter" value={money(farm.income)} hint="Salg og inntekter" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Kostnader" value={money(farm.expenses)} hint="Drift og vedlikehold" icon={<TrendingDown className="h-5 w-5" />} /><StatCard label="Olivenfarm" value={`${number(farm.trees)} trær`} hint={`${number(farm.harvestLiters)} L siste avling`} icon={<Trees className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="section-title">Dona Anna / Olivia</h2><p className="section-subtitle">Data hentes fra Supabase via RealtyFlow Pro sitt public-schema.</p><div className="mt-5">{farm.operations.length === 0 ? <EmptyState title="Ingen Dona Anna-data funnet" text="Når Olivia/Dona Anna sender data til RealtyFlow Pro-hubben, vises operasjonene her." /> : <div className="divide-y divide-slate-100">{farm.operations.slice(0, 12).map((op: any) => <div key={op.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold text-slate-900">{op.description}</p><p className="text-sm text-slate-500">{op.date} · {op.category}</p></div><p className={`font-black ${op.type === 'Income' ? 'text-emerald-700' : 'text-red-700'}`}>{op.type === 'Income' ? '+' : '−'}{money(op.amount, op.currency)}</p></div>)}</div>}</div></div></section>}

      {activeTab === 'realestate' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Provisjonsposter" value={number(sales.active)} hint={sales.source} icon={<Home className="h-5 w-5" />} /><StatCard label="Brutto provisjon" value={money(sales.gross)} hint="Soleada + ZenEcoHomes" icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="NOK-estimat" value={money(sales.gross * sales.fxRate, 'NOK')} hint={`EUR/NOK ${sales.fxRate}`} icon={<Receipt className="h-5 w-5" />} /><StatCard label="Pipeline salg" value={sales.value > 0 ? money(sales.value) : 'Fra hub'} hint="RealtyFlow eier detaljene" icon={<TrendingDown className="h-5 w-5" />} /></div><div className="card p-5"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="section-title">Salg av eiendom</h2><p className="section-subtitle">Henter provisjoner fra RealtyFlow Pro / Supabase for Soleada og ZenEcoHomes. Utbyggere-fanen er fjernet.</p></div><button onClick={() => setShowDealForm(!showDealForm)} className="btn-primary w-full md:w-auto"><Plus className="h-4 w-4" /> Manuell fallback</button></div>{sales.brands.length > 0 ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{sales.brands.map((brand: any) => <div key={brand.brand} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-950">{brand.brand}</p><p className="mt-1 text-sm text-slate-500">{brand.count} provisjonsposter</p></div><div className="text-right"><p className="font-black text-slate-950">{money(brand.totalEur)}</p><p className="text-sm text-slate-500">{money(brand.totalNok, 'NOK')}</p></div></div></div>)}</div> : <EmptyState title="Ingen provisjoner funnet i RealtyFlow" text="Sjekk at business_financial_events har stream='commission' og brand_id for soleada eller zenecohomes." />}{showDealForm && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="mb-3 text-sm font-semibold text-slate-700">Manuell fallback dersom hub-data mangler</p><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5"><input value={newDeal.customerName} onChange={e => setNewDeal({ ...newDeal, customerName: e.target.value })} placeholder="Kunde" /><input type="number" value={newDeal.totalSaleValue} onChange={e => setNewDeal({ ...newDeal, totalSaleValue: e.target.value })} placeholder="Salgsverdi" /><input type="number" value={newDeal.commissionPct} onChange={e => setNewDeal({ ...newDeal, commissionPct: e.target.value })} placeholder="Provisjon %" /><select value={newDeal.businessUnit} onChange={e => setNewDeal({ ...newDeal, businessUnit: e.target.value })}><option value="Soleada">Soleada</option><option value="ZenEcoHomes">ZenEcoHomes</option></select><button onClick={addDeal} className="btn-primary">Lagre</button></div></div>}</div></section>}

      {activeTab === 'mondeo' && <section className="space-y-6"><MondeoLoanTracker /></section>}

      {activeTab === 'aftersale' && <section className="space-y-6"><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"><StatCard label="Saker" value={number(service.count)} hint="Registrerte oppdrag" icon={<Handshake className="h-5 w-5" />} /><StatCard label="Total provisjon" value={money(service.total)} hint="Ettermarked" icon={<Receipt className="h-5 w-5" />} /><StatCard label="Utbetalt" value={money(service.paid)} hint="Betalt" icon={<TrendingUp className="h-5 w-5" />} /><StatCard label="Utestående" value={money(service.pending)} hint="Ikke betalt" icon={<TrendingDown className="h-5 w-5" />} /></div><div className="card p-5"><h2 className="section-title">Aftersale</h2><p className="section-subtitle">Service, partnere og provisjoner etter salg.</p><div className="mt-5">{afterSales.length === 0 ? <EmptyState title="Ingen aftersale-oppdrag registrert" text="Når service- eller partnerprovisjoner legges inn, vises de her." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200 text-left"><th className="py-3 pr-4">Kunde</th><th className="py-3 pr-4">Produkt</th><th className="py-3 pr-4">Leverandør</th><th className="py-3 pr-4 text-right">Provisjon</th><th className="py-3 pr-4">Status</th></tr></thead><tbody>{afterSales.map((item: any) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 pr-4 font-bold text-slate-900">{item.customer}</td><td className="py-3 pr-4 text-slate-600">{item.product}</td><td className="py-3 pr-4 text-slate-600">{item.vendor}</td><td className="py-3 pr-4 text-right font-semibold">{money(item.ourCommissionAmount, item.currency)}</td><td className="py-3 pr-4"><span className="badge">{item.isPaid ? 'Betalt' : 'Utestående'}</span></td></tr>)}</tbody></table></div>}</div></div></section>}
    </div>
  );
};
