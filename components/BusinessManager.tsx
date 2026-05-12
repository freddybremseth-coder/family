
import React, { useState, useMemo, useEffect } from 'react';
import { fetchRealtyflowCommissions, RealtyflowSummary } from '../services/realtyflowService';
import { 
  RealEstateDeal, AfterSaleCommission, FarmOperation, Developer, 
  Currency, Transaction, TransactionType, DealStatus, CommissionPayoutStatus, 
  FarmCategory, FarmProfile, FarmTask, TreeBatch, InventoryItem, BusinessDomain
} from '../types';
import { 
  Sprout, Home, Receipt, RefreshCw, Plus, Zap, Percent, Info, FlaskConical, 
  TrendingUp, TrendingDown, BrainCircuit, Trash2, Check, AlertCircle, 
  Settings2, Droplets, Leaf, BarChart3, Truck, Package, BadgeEuro, 
  Scale, Briefcase, Users, FileText, ChevronRight, Landmark, DollarSign,
  Calendar, ListChecks, Activity, MapPin, Target, Droplet, ShieldAlert, ShieldCheck,
  Telescope, Boxes, ArrowRight, Calculator, TrendingUp as ProfitIcon, Globe,
  X, Save, ShoppingCart, UtensilsCrossed, Sparkles, Building2, Handshake,
  AlertTriangle, Lightbulb, LineChart, HelpCircle, Coins, Megaphone,
  BookOpen, Rocket, Wand2, Quote, FileSignature, Loader2, Flag,
  Trophy, ArrowRightLeft, Thermometer
} from 'lucide-react';
import { CyberButton } from './CyberButton';
import { MondeoLoanTracker } from './MondeoLoanTracker';
import {
  getFarmStrategicAdvice,
  getFarmYieldForecast,
} from '../services/geminiService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, BarChart, Bar, Cell } from 'recharts';
import { EXCHANGE_RATE_EUR_TO_NOK, FARM_CATEGORIES_ARRAY } from '../constants';

interface Props {
  deals: RealEstateDeal[];
  setDeals: React.Dispatch<React.SetStateAction<RealEstateDeal[]>>;
  afterSales: AfterSaleCommission[];
  setAfterSales: React.Dispatch<React.SetStateAction<AfterSaleCommission[]>>;
  farmOps: FarmOperation[];
  setFarmOps: React.Dispatch<React.SetStateAction<FarmOperation[]>>;
  developers: Developer[];
  setDevelopers: React.Dispatch<React.SetStateAction<Developer[]>>;
  afterSalePartners: any[];
  setAfterSalePartners: any;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  bankAccounts: any[];
  userId?: string;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const BusinessManager: React.FC<Props> = ({
  deals, setDeals,
  afterSales, setAfterSales,
  farmOps, setFarmOps,
  developers, setDevelopers,
  transactions,
  setTransactions,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'realestate' | 'aftersale' | 'farm' | 'oil_venture'>('farm');
  const [farmSubTab, setFarmSubTab] = useState<'ops' | 'inventory' | 'profile' | 'forecast' | 'advisor' | 'simulator'>('ops');
  const [reSubTab, setReSubTab] = useState<'deals' | 'developers' | 'mondeo'>('deals');
  
  // -- AI DATA STATES --
  const [aiForecast, setAiForecast] = useState<any>(null);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // -- REALTYFLOW BRAND COMMISSIONS --
  const [realtyflow, setRealtyflow] = useState<RealtyflowSummary | null>(null);
  useEffect(() => {
    fetchRealtyflowCommissions().then(setRealtyflow).catch(() => setRealtyflow(null));
  }, []);

  // -- SIMULATOR STATE --
  const [simConfig, setSimConfig] = useState({
    quantityKilos: 500,
    tableOlivePrice: 15,
    oilYieldPct: 18,
    oilMarketPrice: 9,
    processingCostPerKilo: 4.50, // Krydder, hvitløk, glass, olje til lake
    laborCostPerKilo: 2.00
  });

  const simResults = useMemo(() => {
    // Scenario A: Bordoliven
    const totalCostTable = (simConfig.processingCostPerKilo + simConfig.laborCostPerKilo) * simConfig.quantityKilos;
    const totalRevenueTable = simConfig.tableOlivePrice * simConfig.quantityKilos;
    const profitTable = totalRevenueTable - totalCostTable;

    // Scenario B: Olje
    const totalLiters = simConfig.quantityKilos * (simConfig.oilYieldPct / 100);
    const totalRevenueOil = totalLiters * simConfig.oilMarketPrice;
    const millingCost = simConfig.quantityKilos * 0.30; // Typisk 0.30 EUR per kilo for pressing
    const profitOil = totalRevenueOil - millingCost;

    return {
      table: { revenue: totalRevenueTable, cost: totalCostTable, profit: profitTable },
      oil: { revenue: totalRevenueOil, cost: millingCost, profit: profitOil, liters: totalLiters },
      difference: profitTable - profitOil,
      winner: profitTable > profitOil ? 'Bordoliven' : 'Olje'
    };
  }, [simConfig]);

  // -- FARM PROFILE STATE --
  const [currentFarmProfile, setCurrentFarmProfile] = useState<FarmProfile>({
    totalTrees: 1500,
    batches: [
      { variety: 'Gordal (Bordoliven)', count: 250, age: 7, irrigated: true },
      { variety: 'Genovesa (Olje)', count: 250, age: 7, irrigated: true },
      { variety: 'Heritage Antikke', count: 20, age: 150, irrigated: false },
      { variety: 'Mixed Arbequina/Hojiblanca', count: 980, age: 15, irrigated: false },
    ],
    irrigationSource: 'Pozo (Brønn) + Dryppvanning',
    location: 'Biar, Alicante',
    country: 'Spania',
    yieldHistory: [
      { year: 2022, liters: 1400 },
      { year: 2023, liters: 1700 }, 
      { year: 2024, liters: 3000 },
      { year: 2025, liters: 1370 },
    ]
  });

  // -- FORMS --
  const [showAddDealForm, setShowAddDealForm] = useState(false);
  const [newDeal, setNewDeal] = useState<Partial<RealEstateDeal>>({
    customerName: '',
    developerId: developers[0]?.id || '',
    totalSaleValue: 0,
    commissionPct: 5,
    status: DealStatus.RESERVED,
    currency: 'EUR',
    businessUnit: 'Soleada',
    saleDate: new Date().toISOString().split('T')[0]
  });

  const handleGenerateForecast = async () => {
    setLoadingAI(true);
    try {
      const data = await getFarmYieldForecast(currentFarmProfile);
      setAiForecast(data);
    } catch (e) { console.error(e); } finally { setLoadingAI(false); }
  };

  const handleGenerateAdvice = async () => {
    setLoadingAI(true);
    try {
      const data = await getFarmStrategicAdvice(farmOps, currentFarmProfile, []);
      setAiAdvice(data);
    } catch (e) { console.error(e); } finally { setLoadingAI(false); }
  };

  const handleAddDeal = () => {
    if (!newDeal.customerName || !newDeal.totalSaleValue) return;
    const grossComm = (newDeal.totalSaleValue * (newDeal.commissionPct || 0)) / 100;
    const deal: RealEstateDeal = {
      id: `deal-${Date.now()}`,
      developerId: newDeal.developerId || '',
      customerName: newDeal.customerName || '',
      leadSource: 'Direkte',
      totalSaleValue: Number(newDeal.totalSaleValue),
      grossCommissionBase: Number(newDeal.totalSaleValue),
      commissionPct: Number(newDeal.commissionPct),
      ourGrossCommission: grossComm,
      ourNetCommission: grossComm * 0.7, 
      status: newDeal.status as DealStatus,
      currency: newDeal.currency as Currency,
      businessUnit: newDeal.businessUnit as BusinessDomain,
      saleDate: newDeal.saleDate || '',
      commissionPayouts: [],
      customerPayments: []
    };
    setDeals([deal, ...deals]);
    setShowAddDealForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'farm', label: 'Dona Anna (Gård)', icon: <Sprout className="w-4 h-4" />, color: 'text-yellow-400' },
          { id: 'realestate', label: 'Eiendom (Salg)', icon: <Building2 className="w-4 h-4" />, color: 'text-cyan-400' },
          { id: 'aftersale', label: 'AfterSale (Service)', icon: <Handshake className="w-4 h-4" />, color: 'text-magenta-400' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.id 
                ? `${tab.color} border-b-2 border-current bg-white/5` 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-500">
        
        {activeTab === 'farm' && (
          <div className="space-y-8">
            <div className="flex gap-6 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
               {[
                 {id: 'ops', label: 'Operasjoner'},
                 {id: 'inventory', label: 'Lagerstyring'},
                 {id: 'profile', label: 'Gårdsprofil'},
                 {id: 'simulator', label: 'Venture Simulator'},
                 {id: 'forecast', label: 'AI Prognose'},
                 {id: 'advisor', label: 'AI Rådgiver'}
               ].map(st => (
                 <button key={st.id} onClick={() => setFarmSubTab(st.id as any)} className={`text-[10px] font-black uppercase tracking-widest transition-all shrink-0 pb-2 ${farmSubTab === st.id ? 'text-yellow-400 border-b border-yellow-400' : 'text-slate-400'}`}>
                    {st.label}
                 </button>
               ))}
            </div>

            {farmSubTab === 'ops' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="glass-panel p-6 border-l-4 border-l-yellow-500">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xs font-black uppercase text-white flex items-center gap-2">
                          <Activity className="w-4 h-4 text-yellow-500" /> Siste Hendelser
                        </h3>
                     </div>
                     <div className="space-y-3">
                        {farmOps.map(op => (
                          <div key={op.id} className="p-4 bg-black/40 border border-white/5 flex justify-between items-center group">
                            <div>
                              <p className="text-sm font-bold text-white uppercase">{op.description}</p>
                              <span className="text-[9px] text-slate-500 font-mono italic">{op.date} // {op.category}</span>
                            </div>
                            <p className={`text-sm font-black font-mono ${op.type === 'Income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {op.type === 'Income' ? '+' : '-'}{formatCurrency(op.amount, op.currency)}
                            </p>
                          </div>
                        ))}
                        {farmOps.length === 0 && <p className="text-xs text-slate-500 italic py-10 text-center">Ingen registrerte operasjoner.</p>}
                     </div>
                  </div>
                </div>
                <div className="lg:col-span-4 glass-panel p-6 border-l-4 border-l-orange-500 bg-orange-500/5">
                   <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Gårds-stats</h4>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                         <span className="text-xs text-slate-400 uppercase">Aktive Trær</span>
                         <span className="text-lg font-black text-white font-mono">{currentFarmProfile.totalTrees}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                         <span className="text-xs text-slate-400 uppercase">Siste Avling</span>
                         <span className="text-lg font-black text-white font-mono">1 370 L</span>
                      </div>
                      <div className="flex flex-col gap-1 pt-2">
                         <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                            <MapPin className="w-3 h-3 text-orange-500" /> {currentFarmProfile.location}
                         </div>
                         <div className="flex items-center gap-2 text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                            <Flag className="w-3 h-3 text-orange-500" /> {currentFarmProfile.country}
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {farmSubTab === 'simulator' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4">
                <div className="glass-panel p-8 border-l-4 border-l-yellow-500 bg-yellow-500/5">
                   <div className="mb-10">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <Calculator className="text-yellow-400" /> Dona Anna Venture Simulator
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono italic">Sammenlign profittmarginer for Bordoliven vs. Oljeproduksjon</p>
                   </div>

                   <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                      {/* INPUT FIELDS */}
                      <div className="lg:col-span-4 space-y-6">
                         <div className="space-y-2">
                            <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Kvanta Oliven (KG)</label>
                            <input 
                               type="number"
                               value={simConfig.quantityKilos} 
                               onChange={e => setSimConfig({...simConfig, quantityKilos: Number(e.target.value)})}
                               className="w-full bg-black border border-white/10 p-3 text-white text-sm outline-none focus:border-yellow-500 transition-all font-mono"
                            />
                         </div>

                         <div className="p-4 bg-black/40 border border-white/5 space-y-6">
                            <h4 className="text-[10px] font-black uppercase text-yellow-500 border-b border-white/10 pb-2">Bordoliven Parametere</h4>
                            <div className="space-y-4">
                               <div className="space-y-1">
                                  <label className="text-[8px] uppercase font-black text-slate-600">Salgspris pr KG (€)</label>
                                  <input 
                                     type="number"
                                     value={simConfig.tableOlivePrice} 
                                     onChange={e => setSimConfig({...simConfig, tableOlivePrice: Number(e.target.value)})}
                                     className="w-full bg-black border border-white/5 p-2 text-white text-xs outline-none focus:border-yellow-500"
                                  />
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[8px] uppercase font-black text-slate-600">Prosessering / Glass pr KG (€)</label>
                                  <input 
                                     type="number"
                                     value={simConfig.processingCostPerKilo} 
                                     onChange={e => setSimConfig({...simConfig, processingCostPerKilo: Number(e.target.value)})}
                                     className="w-full bg-black border border-white/5 p-2 text-white text-xs outline-none focus:border-yellow-500"
                                  />
                               </div>
                            </div>
                         </div>

                         <div className="p-4 bg-black/40 border border-white/5 space-y-6">
                            <h4 className="text-[10px] font-black uppercase text-cyan-400 border-b border-white/10 pb-2">Olje Parametere</h4>
                            <div className="space-y-4">
                               <div className="space-y-1">
                                  <label className="text-[8px] uppercase font-black text-slate-600">Oljeutbytte (%)</label>
                                  <input 
                                     type="number"
                                     value={simConfig.oilYieldPct} 
                                     onChange={e => setSimConfig({...simConfig, oilYieldPct: Number(e.target.value)})}
                                     className="w-full bg-black border border-white/5 p-2 text-white text-xs outline-none focus:border-cyan-500"
                                  />
                               </div>
                               <div className="space-y-1">
                                  <label className="text-[8px] uppercase font-black text-slate-600">Markedspris Olje pr L (€)</label>
                                  <input 
                                     type="number"
                                     value={simConfig.oilMarketPrice} 
                                     onChange={e => setSimConfig({...simConfig, oilMarketPrice: Number(e.target.value)})}
                                     className="w-full bg-black border border-white/5 p-2 text-white text-xs outline-none focus:border-cyan-500"
                                  />
                               </div>
                            </div>
                         </div>
                      </div>

                      {/* RESULTS */}
                      <div className="lg:col-span-8 space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* TABLE OLIVES CARD */}
                            <div className={`p-8 border-2 transition-all ${simResults.winner === 'Bordoliven' ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_30px_rgba(234,179,8,0.2)]' : 'border-white/10 bg-black'}`}>
                               <div className="flex justify-between items-start mb-6">
                                  <h4 className="text-lg font-black text-white uppercase">Bordoliven</h4>
                                  <ShoppingCart className={`${simResults.winner === 'Bordoliven' ? 'text-yellow-400' : 'text-slate-700'}`} />
                               </div>
                               <div className="space-y-4 mb-8">
                                  <div className="flex justify-between font-mono text-xs">
                                     <span className="text-slate-500">Omsetning</span>
                                     <span className="text-white font-bold">{formatCurrency(simResults.table.revenue, 'EUR')}</span>
                                  </div>
                                  <div className="flex justify-between font-mono text-xs">
                                     <span className="text-slate-500">Direkte Kostnader</span>
                                     <span className="text-rose-500">{formatCurrency(simResults.table.cost, 'EUR')}</span>
                                  </div>
                               </div>
                               <div className="pt-4 border-t border-white/10 text-center">
                                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Estimert Profitt</p>
                                  <p className="text-3xl font-black text-yellow-400 font-mono">{formatCurrency(simResults.table.profit, 'EUR')}</p>
                               </div>
                            </div>

                            {/* OIL CARD */}
                            <div className={`p-8 border-2 transition-all ${simResults.winner === 'Olje' ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_30px_rgba(0,243,255,0.2)]' : 'border-white/10 bg-black'}`}>
                               <div className="flex justify-between items-start mb-6">
                                  <h4 className="text-lg font-black text-white uppercase">Oljeutvinning</h4>
                                  <Droplets className={`${simResults.winner === 'Olje' ? 'text-cyan-400' : 'text-slate-700'}`} />
                               </div>
                               <div className="space-y-4 mb-8">
                                  <div className="flex justify-between font-mono text-xs">
                                     <span className="text-slate-500">Omsetning ({simResults.oil.liters.toFixed(1)} L)</span>
                                     <span className="text-white font-bold">{formatCurrency(simResults.oil.revenue, 'EUR')}</span>
                                  </div>
                                  <div className="flex justify-between font-mono text-xs">
                                     <span className="text-slate-500">Møllekostnad</span>
                                     <span className="text-rose-500">{formatCurrency(simResults.oil.cost, 'EUR')}</span>
                                  </div>
                               </div>
                               <div className="pt-4 border-t border-white/10 text-center">
                                  <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1">Estimert Profitt</p>
                                  <p className="text-3xl font-black text-cyan-400 font-mono">{formatCurrency(simResults.oil.profit, 'EUR')}</p>
                               </div>
                            </div>
                         </div>

                         {/* SUMMARY ANALYSIS */}
                         <div className="p-8 glass-panel border-l-4 border-l-emerald-500 bg-emerald-500/5 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                               <Trophy className="w-24 h-24 text-emerald-400" />
                            </div>
                            <div>
                               <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] mb-2">Simulerings-Resultat</p>
                               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                                 Strategisk Valg: <span className="text-emerald-400 italic underline">{simResults.winner}</span>
                               </h3>
                               <p className="text-xs text-slate-400 italic mt-2 max-w-lg">
                                 Ved å velge <span className="text-white font-bold">{simResults.winner}</span> øker du profitten med <span className="text-emerald-400 font-bold">{formatCurrency(Math.abs(simResults.difference), 'EUR')}</span> på dette partiet sammenlignet med det andre alternativet.
                               </p>
                            </div>
                            <div className="text-center p-6 bg-black border border-emerald-500/20 min-w-[200px]">
                               <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">ROI Differanse</p>
                               <p className="text-2xl font-black text-emerald-400 font-mono">+{formatCurrency(Math.abs(simResults.difference), 'EUR')}</p>
                            </div>
                         </div>
                         
                         {/* PRO-TIP */}
                         <div className="p-6 bg-black border border-white/10 flex items-start gap-4">
                            <Lightbulb className="text-yellow-400 w-8 h-8 shrink-0 mt-1" />
                            <div>
                               <p className="text-[10px] font-black uppercase text-white tracking-widest mb-1">Venture Innsikt:</p>
                               <p className="text-[11px] text-slate-400 italic leading-relaxed">
                                 Bordoliven krever mer manuelt arbeid (håndplukking vs. risting), noe som øker labor costs. Simulator-tallene bør justeres for å inkludere tid brukt på marinering og pakking i glass for å få et 100% nøyaktig bilde.
                               </p>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {farmSubTab === 'profile' && (
              <div className="glass-panel p-8 border-l-4 border-l-yellow-500 bg-yellow-500/5 animate-in slide-in-from-top-4">
                <div className="flex justify-between items-start mb-10">
                   <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Settings2 className="text-yellow-400" /> Gårdskonfigurasjon (Dona Anna)
                      </h3>
                      <p className="text-[10px] text-slate-500 uppercase mt-1">Administrer grunnleggende gårdsdata og lokasjon</p>
                   </div>
                   <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
                      <Save className="w-5 h-5" />
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-yellow-500" /> Lokasjon / By
                         </label>
                         <input 
                            value={currentFarmProfile.location} 
                            onChange={e => setCurrentFarmProfile({...currentFarmProfile, location: e.target.value})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-xs focus:border-yellow-500 outline-none transition-all font-mono"
                            placeholder="F.eks. Biar, Alicante"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                            <Flag className="w-3 h-3 text-yellow-500" /> Land
                         </label>
                         <input 
                            value={currentFarmProfile.country} 
                            onChange={e => setCurrentFarmProfile({...currentFarmProfile, country: e.target.value})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-xs focus:border-yellow-500 outline-none transition-all font-mono"
                            placeholder="F.eks. Spania"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                            <Droplet className="w-3 h-3 text-cyan-400" /> Vanningskilde
                         </label>
                         <input 
                            value={currentFarmProfile.irrigationSource} 
                            onChange={e => setCurrentFarmProfile({...currentFarmProfile, irrigationSource: e.target.value})}
                            className="w-full bg-black border border-white/10 p-3 text-white text-xs focus:border-cyan-500 outline-none transition-all font-mono"
                         />
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="p-6 bg-black/40 border border-white/5 space-y-4">
                         <h4 className="text-[10px] font-black uppercase text-yellow-500 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Oversikt
                         </h4>
                         <div className="flex justify-between items-center border-b border-white/5 pb-2">
                            <span className="text-[10px] text-slate-400 uppercase">Totalt Antall Trær</span>
                            <span className="text-lg font-black text-white font-mono">{currentFarmProfile.totalTrees}</span>
                         </div>
                         <p className="text-[9px] text-slate-500 italic leading-relaxed">
                            Dataene lagres lokalt i denne sesjonen. For permanent lagring, vennligst koble til din sentrale database via Super Admin-panelet.
                         </p>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {farmSubTab === 'inventory' && (
               <div className="glass-panel p-20 text-center border-2 border-dashed border-white/5 opacity-30 animate-in fade-in">
                  <Boxes className="w-16 h-16 mx-auto mb-6" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Lagersystem for olje og utstyr kommer snart</p>
               </div>
            )}

            {farmSubTab === 'forecast' && (
               <div className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 animate-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-start mb-8">
                     <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                           <LineChart className="text-cyan-400" /> AI AVLINGSPROGNOSE 2026
                        </h3>
                        <p className="text-[9px] text-slate-500 uppercase mt-1">Beregnet via Gemini-3 Search Engine</p>
                     </div>
                     <CyberButton onClick={handleGenerateForecast} disabled={loadingAI} className="text-[10px]">
                        {loadingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Generer Prognose'}
                     </CyberButton>
                  </div>

                  {aiForecast ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="p-6 bg-black/40 border border-white/5">
                           <p className="text-[9px] text-slate-500 uppercase font-black mb-2">Estimert Avkastning</p>
                           <p className="text-3xl font-black text-white font-mono">{aiForecast.forecastLiters} L</p>
                        </div>
                        <div className="p-6 bg-black/40 border border-white/5">
                           <p className="text-[9px] text-slate-500 uppercase font-black mb-2">Konfidensintervall</p>
                           <p className="text-lg font-black text-cyan-400 font-mono">{aiForecast.confidenceInterval}</p>
                        </div>
                        <div className="md:col-span-2 p-6 bg-black/40 border border-white/5">
                           <p className="text-[9px] text-slate-500 uppercase font-black mb-2">Klimatisk Kontekst</p>
                           <p className="text-xs text-slate-300 italic leading-relaxed">{aiForecast.climaticContext}</p>
                        </div>
                     </div>
                  ) : (
                     <div className="py-20 text-center opacity-30">
                        <Telescope className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Klar for analyse av avlingsdata</p>
                     </div>
                  )}
               </div>
            )}

            {farmSubTab === 'advisor' && (
               <div className="space-y-8 animate-in slide-in-from-right-4">
                  <div className="glass-panel p-8 border-l-4 border-l-emerald-500 bg-emerald-500/5">
                    <div className="flex justify-between items-start mb-10">
                       <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <BrainCircuit className="text-emerald-400" /> STRATEGISK GÅRDSRÅDGIVER
                       </h3>
                       <CyberButton onClick={handleGenerateAdvice} variant="secondary" disabled={loadingAI} className="text-[10px]">
                          {loadingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Start Strategisk Analyse'}
                       </CyberButton>
                    </div>

                    {aiAdvice ? (
                       <div className="space-y-10">
                          <div className="p-6 bg-emerald-500/10 border border-emerald-500/30 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Activity className="w-12 h-12 text-emerald-400" />
                             </div>
                             <h4 className="text-[10px] font-black uppercase text-emerald-400 mb-3 flex items-center gap-2">
                                <Lightbulb className="w-3 h-3" /> Strategisk Oppsummering
                             </h4>
                             <p className="text-sm text-white italic leading-relaxed pr-10">{aiAdvice.strategicSummary}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-yellow-500 flex items-center gap-2">
                                   <Coins className="w-3 h-3" /> Lønnsomhetsanalyse
                                </h4>
                                <div className="p-4 bg-white/5 border border-white/10 text-xs text-slate-300 italic leading-relaxed">
                                  {aiAdvice.profitabilityAnalysis}
                                </div>
                             </div>
                             <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-2">
                                   <ShieldAlert className="w-3 h-3" /> Kritiske Advarsler
                                </h4>
                                {aiAdvice.criticalAlerts.map((alert: string, i: number) => (
                                   <div key={i} className="p-3 bg-rose-500/5 border border-rose-500/20 text-xs text-rose-400 uppercase font-bold flex items-center gap-3">
                                      <AlertTriangle className="w-4 h-4 shrink-0" /> {alert}
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                             <div className="p-6 bg-cyan-500/5 border border-cyan-500/20">
                                <h4 className="text-[10px] font-black uppercase text-cyan-400 mb-4 flex items-center gap-2">
                                   <Target className="w-3 h-3" /> Investering
                                </h4>
                                <ul className="space-y-3">
                                   {aiAdvice.investmentSuggestions.map((item: string, i: number) => (
                                      <li key={i} className="text-[11px] text-white font-bold leading-tight flex items-start gap-2">
                                         <ChevronRight className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" /> {item}
                                      </li>
                                   ))}
                                </ul>
                             </div>

                             <div className="p-6 bg-yellow-500/5 border border-yellow-500/20">
                                <h4 className="text-[10px] font-black uppercase text-yellow-500 mb-4 flex items-center gap-2">
                                   <Scale className="w-3 h-3" /> Kostnadskontroll
                                </h4>
                                <ul className="space-y-3">
                                   {aiAdvice.costSavingTips.map((item: string, i: number) => (
                                      <li key={i} className="text-[11px] text-white font-bold leading-tight flex items-start gap-2">
                                         <ChevronRight className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" /> {item}
                                      </li>
                                   ))}
                                </ul>
                             </div>

                             <div className="p-6 bg-magenta-500/5 border border-magenta-500/20">
                                <h4 className="text-[10px] font-black uppercase text-magenta-400 mb-4 flex items-center gap-2">
                                   <Megaphone className="w-3 h-3" /> Markedsføring
                                </h4>
                                <ul className="space-y-3">
                                   {aiAdvice.marketingIdeas.map((item: string, i: number) => (
                                      <li key={i} className="text-[11px] text-white font-bold leading-tight flex items-start gap-2">
                                         <ChevronRight className="w-3 h-3 text-magenta-400 shrink-0 mt-0.5" /> {item}
                                      </li>
                                   ))}
                                </ul>
                             </div>
                          </div>
                       </div>
                    ) : (
                       <div className="py-20 text-center opacity-30">
                          <BrainCircuit className="w-16 h-16 mx-auto mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Engine klar for driftsevaluering</p>
                       </div>
                    )}
                  </div>
               </div>
            )}
          </div>
        )}

        {activeTab === 'realestate' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="flex gap-2 border-b border-white/5 pb-3 overflow-x-auto no-scrollbar">
                <button onClick={() => setReSubTab('deals')} className={`px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 shrink-0 ${reSubTab === 'deals' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white border border-transparent'}`}>
                  <Building2 className="w-4 h-4" /> Salgsoversikt
                </button>
                <button onClick={() => setReSubTab('developers')} className={`px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 shrink-0 ${reSubTab === 'developers' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white border border-transparent'}`}>
                  <Users className="w-4 h-4" /> Utbyggere
                </button>
                <button onClick={() => setReSubTab('mondeo')} className={`px-5 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wide transition-all flex items-center gap-2 shrink-0 ${reSubTab === 'mondeo' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10' : 'text-slate-400 hover:text-amber-300 border border-transparent ring-1 ring-amber-500/20'}`}>
                  <Calculator className="w-4 h-4" /> Mondeo Lån
                  <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-amber-500 text-black rounded">NY</span>
                </button>
             </div>

             {reSubTab === 'mondeo' && (
                <MondeoLoanTracker
                  userId={userId}
                  transactions={transactions}
                  setTransactions={setTransactions}
                />
             )}

             {reSubTab === 'deals' && (
                <>
                   {/* RealtyFlow Pro – live brand-commissions */}
                   {realtyflow && realtyflow.brands.length > 0 && (
                     <div className="glass-panel p-6 border-l-4 border-l-cyan-500">
                       <div className="flex items-center justify-between mb-5">
                         <div>
                           <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                             <Building2 className="w-4 h-4 text-cyan-400" /> RealtyFlow Pro · Provisjoner per brand
                           </h3>
                           <p className="text-[11px] text-slate-400 italic mt-1">
                             Live data fra business_financial_events. FX EUR→NOK: {realtyflow.fxRate.toFixed(2)}
                           </p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] uppercase tracking-widest text-slate-400">Total</p>
                           <p className="text-2xl font-black text-cyan-300 font-mono">{formatCurrency(realtyflow.totalEur, 'EUR')}</p>
                           <p className="text-[11px] text-slate-500 font-mono">≈ {Math.round(realtyflow.totalNok).toLocaleString('nb-NO')} kr</p>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {realtyflow.brands.map((b) => {
                           const colorByBrand: Record<string, { ring: string; text: string; bar: string }> = {
                             Soleada: { ring: 'border-amber-500/40', text: 'text-amber-300', bar: 'bg-amber-500' },
                             ZenEcoHomes: { ring: 'border-emerald-500/40', text: 'text-emerald-300', bar: 'bg-emerald-500' },
                           };
                           const c = colorByBrand[b.brand] ?? { ring: 'border-cyan-500/40', text: 'text-cyan-300', bar: 'bg-cyan-500' };
                           const sharePct = realtyflow.totalEur > 0 ? (b.totalEur / realtyflow.totalEur) * 100 : 0;
                           return (
                             <div key={b.brand} className={`rounded-lg border ${c.ring} bg-black/40 p-5`}>
                               <div className="flex items-start justify-between mb-3">
                                 <div>
                                   <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{b.brand}</p>
                                   <p className={`text-2xl font-black font-mono ${c.text}`}>{formatCurrency(b.totalEur, 'EUR')}</p>
                                   <p className="text-[11px] text-slate-500 font-mono mt-0.5">≈ {Math.round(b.totalNok).toLocaleString('nb-NO')} kr · {b.count} provisjoner</p>
                                 </div>
                                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{sharePct.toFixed(0)}%</span>
                               </div>
                               <div className="h-2 bg-white/5 rounded overflow-hidden">
                                 <div className={`h-full ${c.bar}`} style={{ width: `${sharePct}%` }} />
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Lokale notater · Salgsvolum</p>
                         <p className="text-2xl font-black text-white font-mono">{formatCurrency(deals.reduce((acc, d) => acc + d.totalSaleValue, 0), 'EUR')}</p>
                      </div>
                      <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Lokale notater · Netto Provisjon</p>
                         <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(deals.reduce((acc, d) => acc + d.ourNetCommission, 0), 'EUR')}</p>
                      </div>
                      <div className="flex items-center justify-end">
                         <CyberButton onClick={() => setShowAddDealForm(!showAddDealForm)} className="text-[10px] py-4 px-8">
                            {showAddDealForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {showAddDealForm ? 'Lukk Skjema' : 'Registrer Ny Deal'}
                         </CyberButton>
                      </div>
                   </div>

                   {showAddDealForm && (
                      <div className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 animate-in slide-in-from-top-4">
                         <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Ny Eiendomstransaksjon</h3>
                         <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <div className="space-y-1">
                               <label className="text-[9px] uppercase font-black text-slate-500">Kunde</label>
                               <input value={newDeal.customerName} onChange={e => setNewDeal({...newDeal, customerName: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" placeholder="Navn på kjøper" />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] uppercase font-black text-slate-500">Utbygger</label>
                               <select value={newDeal.developerId} onChange={e => setNewDeal({...newDeal, developerId: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs">
                                  {developers.map(dev => <option key={dev.id} value={dev.id}>{dev.name}</option>)}
                               </select>
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] uppercase font-black text-slate-500">Salgssum (€)</label>
                               <input type="number" value={newDeal.totalSaleValue} onChange={e => setNewDeal({...newDeal, totalSaleValue: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" />
                            </div>
                            <div className="space-y-1">
                               <label className="text-[9px] uppercase font-black text-slate-500">Provisjon %</label>
                               <input type="number" value={newDeal.commissionPct} onChange={e => setNewDeal({...newDeal, commissionPct: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs" />
                            </div>
                         </div>
                         <CyberButton onClick={handleAddDeal} className="w-full">Aktiver Deal i Hovedbok</CyberButton>
                      </div>
                   )}

                   <div className="glass-panel overflow-hidden border-l-4 border-l-cyan-500">
                      <div className="overflow-x-auto">
                         <table className="w-full text-left text-sm min-w-[900px]">
                            <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest border-b border-white/5">
                               <tr>
                                  <th className="px-6 py-5">Kunde / Utvikler</th>
                                  <th className="px-6 py-5">Status</th>
                                  <th className="px-6 py-5 text-right">Salgssum</th>
                                  <th className="px-6 py-5 text-right">Vår Netto</th>
                                  <th className="px-6 py-5 text-center">Dato</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                               {deals.map(deal => (
                                  <tr key={deal.id} className="hover:bg-cyan-500/5 transition-all group">
                                     <td className="px-6 py-5">
                                        <p className="text-white font-black uppercase tracking-tight">{deal.customerName}</p>
                                        <p className="text-[8px] text-slate-500 font-mono mt-0.5">{developers.find(d => d.id === deal.developerId)?.name}</p>
                                     </td>
                                     <td className="px-6 py-5">
                                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${
                                          deal.status === DealStatus.COMPLETED ? 'border-emerald-500 text-emerald-500' :
                                          deal.status === DealStatus.RESERVED ? 'border-yellow-500 text-yellow-500' :
                                          'border-cyan-500 text-cyan-400'
                                        }`}>
                                           {deal.status}
                                        </span>
                                     </td>
                                     <td className="px-6 py-5 text-right font-mono font-bold text-white">{formatCurrency(deal.totalSaleValue, deal.currency)}</td>
                                     <td className="px-6 py-5 text-right font-mono font-black text-emerald-400">{formatCurrency(deal.ourNetCommission, deal.currency)}</td>
                                     <td className="px-6 py-5 text-center font-mono text-[10px] text-slate-500">{deal.saleDate}</td>
                                  </tr>
                               ))}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
