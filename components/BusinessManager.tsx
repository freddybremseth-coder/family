
import React, { useState, useMemo } from 'react';
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
  AlertTriangle, Lightbulb, LineChart
} from 'lucide-react';
import { CyberButton } from './CyberButton';
import { 
  getFarmStrategicAdvice, 
  getFarmYieldForecast
} from '../services/geminiService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, BarChart, Bar } from 'recharts';
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
  transactions
}) => {
  const [activeTab, setActiveTab] = useState<'realestate' | 'aftersale' | 'farm' | 'oil_venture'>('farm');
  const [farmSubTab, setFarmSubTab] = useState<'ops' | 'inventory' | 'profile' | 'forecast' | 'advisor'>('ops');
  const [labSubTab, setLabSubTab] = useState<'calculator' | 'market'>('calculator');
  const [reSubTab, setReSubTab] = useState<'deals' | 'developers'>('deals');
  
  // -- AI DATA STATES --
  const [aiForecast, setAiForecast] = useState<any>(null);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

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

  // -- DATA PLACEHOLDERS (FARM) --
  const farmProfile: FarmProfile = {
    totalTrees: 1500,
    batches: [
      { variety: 'Gordal (Bordoliven)', count: 250, age: 7, irrigated: true },
      { variety: 'Genovesa (Olje)', count: 250, age: 7, irrigated: true },
      { variety: 'Heritage Antikke', count: 20, age: 150, irrigated: false },
      { variety: 'Mixed Arbequina/Hojiblanca', count: 980, age: 15, irrigated: false },
    ],
    irrigationSource: 'Pozo (Brønn) + Dryppvanning',
    location: 'Biar, Alicante',
    yieldHistory: [
      { year: 2022, liters: 1400 },
      { year: 2023, liters: 1700 }, 
      { year: 2024, liters: 3000 },
      { year: 2025, liters: 1370 },
    ]
  };

  const inventory: InventoryItem[] = [
    { id: '1', productName: 'Premium Gordal EVOO', quantity: 450, unit: 'Liters', location: 'Spain', lastUpdated: '2024-07-10' },
    { id: '2', productName: 'Heritage Blend (150yr)', quantity: 45, unit: 'Liters', location: 'Spain', lastUpdated: '2024-07-10' },
    { id: '3', productName: 'EVO Lab 500ml Flasker', quantity: 240, unit: 'Bottles', location: 'Norway', lastUpdated: '2024-07-15' },
  ];

  // -- CALCULATORS --
  const [marketSim, setMarketSim] = useState({
    oliveWeightKg: 100, pricePerKg: 15, garlicCostKg: 1.2, spicesCostKg: 0.8, oilAddCostKg: 0.5, oilYieldPct: 20, oilPriceEur: 12, 
  });

  const [simConfig, setSimConfig] = useState({
    pressMachineCost: 15000, productionVolumeLiters: 2500, bottleSize: 0.5, bottleCost: 1.40, labelCost: 0.35, analysisCost: 600, transportToNorwayCost: 1200, norwayPriceNok: 495, norwayCommissionPct: 30, spainBulkPriceEur: 7.20,  
  });

  const marketResults = useMemo(() => {
    const totalRevenue = marketSim.oliveWeightKg * marketSim.pricePerKg;
    const totalCosts = marketSim.oliveWeightKg * (marketSim.garlicCostKg + marketSim.spicesCostKg + marketSim.oilAddCostKg);
    const netProfit = totalRevenue - totalCosts;
    const oilRevenue = (marketSim.oliveWeightKg * (marketSim.oilYieldPct / 100)) * marketSim.oilPriceEur;
    return { totalRevenue, totalCosts, netProfit, oilRevenue, diff: netProfit - oilRevenue };
  }, [marketSim]);

  const simResults = useMemo(() => {
    const numBottles = simConfig.productionVolumeLiters / simConfig.bottleSize;
    const pricePerBottleNorwayEur = (simConfig.norwayPriceNok / EXCHANGE_RATE_EUR_TO_NOK);
    const totalVariableCostPerBottle = simConfig.bottleCost + simConfig.labelCost + (simConfig.transportToNorwayCost / numBottles) + ((simConfig.norwayCommissionPct / 100) * pricePerBottleNorwayEur);
    const profitNorwayYear1 = (pricePerBottleNorwayEur - totalVariableCostPerBottle) * numBottles - (simConfig.pressMachineCost + simConfig.analysisCost);
    return { profitNorwayYear1, numBottles };
  }, [simConfig]);

  // -- ACTIONS --
  const handleGenerateForecast = async () => {
    setLoadingAI(true);
    try {
      const data = await getFarmYieldForecast(farmProfile);
      setAiForecast(data);
    } catch (e) { console.error(e); } finally { setLoadingAI(false); }
  };

  const handleGenerateAdvice = async () => {
    setLoadingAI(true);
    try {
      const data = await getFarmStrategicAdvice(farmOps, farmProfile, []);
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
      ourNetCommission: grossComm * 0.7, // Eksempel: 70% netto etter kostnader
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
      {/* MODULE NAVIGATION */}
      <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'farm', label: 'Dona Anna (Gård)', icon: <Sprout className="w-4 h-4" />, color: 'text-yellow-400' },
          { id: 'oil_venture', label: 'EVO Lab (Venture)', icon: <FlaskConical className="w-4 h-4" />, color: 'text-emerald-400' },
          { id: 'realestate', label: 'Eiendom (Salg)', icon: <Building2 className="w-4 h-4" />, color: 'text-cyan-400' },
          { id: 'aftersale', label: 'AfterSale (Service)', icon: <Handshake className="w-4 h-4" />, color: 'text-magenta-400' },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 ${
              activeTab === tab.id 
                ? `${tab.color} border-b-2 border-current bg-white/5` 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-500">
        
        {/* DONA ANNA (FARM) SECTION */}
        {activeTab === 'farm' && (
          <div className="space-y-8">
            <div className="flex gap-6 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
               {[
                 {id: 'ops', label: 'Operasjoner'},
                 {id: 'inventory', label: 'Lagerstyring'},
                 {id: 'profile', label: 'Gårdsprofil'},
                 {id: 'forecast', label: 'AI Prognose'},
                 {id: 'advisor', label: 'AI Rådgiver'}
               ].map(st => (
                 <button key={st.id} onClick={() => setFarmSubTab(st.id as any)} className={`text-[10px] font-black uppercase tracking-widest transition-all shrink-0 pb-2 ${farmSubTab === st.id ? 'text-yellow-400 border-b border-yellow-400' : 'text-slate-500'}`}>
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
                         <span className="text-lg font-black text-white font-mono">{farmProfile.totalTrees}</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-xs text-slate-400 uppercase">Siste Avling</span>
                         <span className="text-lg font-black text-white font-mono">1 370 L</span>
                      </div>
                   </div>
                </div>
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
               <div className="glass-panel p-8 border-l-4 border-l-emerald-500 bg-emerald-500/5 animate-in slide-in-from-right-4">
                  <div className="flex justify-between items-start mb-10">
                     <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <BrainCircuit className="text-emerald-400" /> STRATEGISK GÅRDSRÅDGIVER
                     </h3>
                     <CyberButton onClick={handleGenerateAdvice} variant="secondary" disabled={loadingAI} className="text-[10px]">
                        {loadingAI ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Analyser Drift'}
                     </CyberButton>
                  </div>

                  {aiAdvice ? (
                     <div className="space-y-8">
                        <div className="p-6 bg-emerald-500/10 border border-emerald-500/30">
                           <h4 className="text-[10px] font-black uppercase text-emerald-400 mb-3 flex items-center gap-2">
                              <Lightbulb className="w-3 h-3" /> Strategisk Innsikt
                           </h4>
                           <p className="text-sm text-white italic leading-relaxed">{aiAdvice.advice}</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-rose-500 flex items-center gap-2">
                                 <AlertTriangle className="w-3 h-3" /> Kritiske Varsler
                              </h4>
                              {aiAdvice.criticalAlerts.map((alert: string, i: number) => (
                                 <div key={i} className="p-3 bg-rose-500/5 border border-rose-500/20 text-xs text-rose-400 uppercase font-bold">{alert}</div>
                              ))}
                           </div>
                           <div className="space-y-4">
                              <h4 className="text-[10px] font-black uppercase text-cyan-400 flex items-center gap-2">
                                 <ArrowRight className="w-3 h-3" /> Neste Steg
                              </h4>
                              {aiAdvice.nextSteps.map((step: string, i: number) => (
                                 <div key={i} className="p-3 bg-cyan-500/5 border border-cyan-500/20 text-xs text-white uppercase font-bold flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 bg-cyan-400" /> {step}
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  ) : (
                     <div className="py-20 text-center opacity-30">
                        <BrainCircuit className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Engine klar for driftsevaluering</p>
                     </div>
                  )}
               </div>
            )}

            {farmSubTab === 'inventory' && (
              <div className="glass-panel p-8 border-l-4 border-l-emerald-500 animate-in slide-in-from-left-4">
                 <h3 className="text-sm font-black text-white uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Boxes className="text-emerald-400 w-5 h-5" /> Lagerbeholdning & Asset-sporing
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inventory.map(item => (
                      <div key={item.id} className="p-6 bg-black/40 border border-white/10 hover:border-emerald-500/50 transition-all">
                         <div className="flex justify-between items-start mb-4">
                            <p className="text-sm font-black text-white uppercase tracking-tight leading-tight">{item.productName}</p>
                            <Package className="w-4 h-4 text-emerald-500" />
                         </div>
                         <div className="flex items-end justify-between">
                            <div>
                               <p className="text-2xl font-black text-white font-mono">{item.quantity} <span className="text-[10px] uppercase text-slate-500">{item.unit}</span></p>
                               <p className="text-[8px] text-slate-500 font-mono mt-1 uppercase">Sist oppdatert: {item.lastUpdated}</p>
                            </div>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 border border-white/20 text-slate-400">{item.location}</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}

            {farmSubTab === 'profile' && (
              <div className="glass-panel p-8 border-l-4 border-l-yellow-500 animate-in slide-in-from-right-4">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                       <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="text-yellow-400 w-5 h-5" /> Gårdskart & Trekatalog
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {farmProfile.batches.map((batch, i) => (
                            <div key={i} className="p-5 bg-white/5 border border-white/10">
                               <div className="flex justify-between mb-4">
                                  <span className="text-[10px] font-black text-yellow-500 uppercase">{batch.variety}</span>
                                  <Leaf className={`w-4 h-4 ${batch.irrigated ? 'text-cyan-400' : 'text-orange-500'}`} />
                               </div>
                               <div className="flex items-end justify-between">
                                  <div>
                                     <p className="text-2xl font-black text-white font-mono">{batch.count}</p>
                                     <p className="text-[9px] text-slate-500 uppercase">Trær // Alder: {batch.age} år</p>
                                  </div>
                                  <span className="text-[8px] font-black uppercase px-2 py-1 bg-black/40 border border-white/5">
                                     {batch.irrigated ? 'Vanning OK' : 'Tørrdyrking'}
                                  </span>
                               </div>
                            </div>
                          ))}
                       </div>
                    </div>
                    <div className="space-y-6">
                       <div className="p-6 bg-black/40 border border-yellow-500/20">
                          <h4 className="text-[10px] font-black uppercase text-slate-500 mb-4 tracking-widest">Klimasituasjon</h4>
                          <div className="flex items-center gap-4 text-white">
                             <Droplets className="w-8 h-8 text-cyan-500" />
                             <div>
                                <p className="text-sm font-bold">Kilde: {farmProfile.irrigationSource}</p>
                                <p className="text-[9px] text-slate-500 uppercase italic">Alicante / Region Biar</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        )}

        {/* REAL ESTATE SECTION */}
        {activeTab === 'realestate' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="flex gap-6 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
                <button onClick={() => setReSubTab('deals')} className={`text-[10px] font-black uppercase tracking-widest transition-all pb-2 ${reSubTab === 'deals' ? 'text-cyan-400 border-b border-cyan-400' : 'text-slate-500'}`}>Salgsoversikt</button>
                <button onClick={() => setReSubTab('developers')} className={`text-[10px] font-black uppercase tracking-widest transition-all pb-2 ${reSubTab === 'developers' ? 'text-cyan-400 border-b border-cyan-400' : 'text-slate-500'}`}>Utbyggere & Partnere</button>
             </div>

             {reSubTab === 'deals' && (
                <>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Totalt Salgsvolum</p>
                         <p className="text-2xl font-black text-white font-mono">{formatCurrency(deals.reduce((acc, d) => acc + d.totalSaleValue, 0), 'EUR')}</p>
                      </div>
                      <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Netto Provisjon</p>
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
                               {deals.length === 0 && (
                                  <tr><td colSpan={5} className="py-20 text-center opacity-30 text-[10px] uppercase font-black tracking-widest">Ingen aktive deals funnet</td></tr>
                               )}
                            </tbody>
                         </table>
                      </div>
                   </div>
                </>
             )}

             {reSubTab === 'developers' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-left-4">
                   {developers.map(dev => (
                      <div key={dev.id} className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 group hover:bg-cyan-500/10 transition-all">
                         <div className="flex justify-between items-start mb-6">
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">{dev.name}</h3>
                            <Building2 className="w-5 h-5 text-cyan-400" />
                         </div>
                         <div className="space-y-4">
                            <div className="p-4 bg-black/40 border border-white/5">
                               <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Standard Provisjon</p>
                               <p className="text-2xl font-black text-white font-mono">{dev.defaultCommissionPct}%</p>
                            </div>
                            <div className="pt-4 border-t border-white/5">
                               <p className="text-[9px] uppercase text-cyan-400 font-black mb-3">Aktive Utbetalingsfaser</p>
                               <div className="space-y-2">
                                  <div className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                                     <span>Reservasjon</span>
                                     <span>25%</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                                     <span>Byggestart</span>
                                     <span>25%</span>
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                                     <span>Ferdigstillelse</span>
                                     <span>50%</span>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   ))}
                   <div className="glass-panel p-8 border-2 border-dashed border-white/10 flex flex-col items-center justify-center opacity-40 hover:opacity-100 transition-all cursor-pointer">
                      <Plus className="w-10 h-10 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]">Ny Utbygger-profil</p>
                   </div>
                </div>
             )}
          </div>
        )}

        {/* AFTER SALE SECTION */}
        {activeTab === 'aftersale' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel p-6 border-l-4 border-l-magenta-500 bg-magenta-500/5">
                   <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Total AfterSale Provisjon</p>
                   <p className="text-2xl font-black text-white font-mono">{formatCurrency(afterSales.reduce((acc, a) => acc + a.ourCommissionAmount, 0), 'EUR')}</p>
                </div>
                <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
                   <p className="text-[10px] uppercase text-slate-500 font-black mb-1 tracking-widest">Utestående Krav</p>
                   <p className="text-2xl font-black text-cyan-400 font-mono">{formatCurrency(afterSales.filter(a => !a.isPaid).reduce((acc, a) => acc + a.ourCommissionAmount, 0), 'EUR')}</p>
                </div>
             </div>

             <div className="glass-panel overflow-hidden border-l-4 border-l-magenta-500">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm min-w-[800px]">
                      <thead className="bg-white/5 uppercase text-[9px] font-black tracking-widest border-b border-white/5">
                         <tr>
                            <th className="px-6 py-5">Kunde / Produkt</th>
                            <th className="px-6 py-5">Leverandør</th>
                            <th className="px-6 py-5 text-right">Vår Provisjon</th>
                            <th className="px-6 py-5 text-center">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {afterSales.map(as => (
                            <tr key={as.id} className="hover:bg-magenta-500/5 transition-all">
                               <td className="px-6 py-5">
                                  <p className="text-white font-black uppercase tracking-tight">{as.customer}</p>
                                  <p className="text-[9px] text-magenta-400 font-bold mt-1 uppercase italic">{as.product}</p>
                               </td>
                               <td className="px-6 py-5 text-slate-400 uppercase font-bold text-[10px]">{as.vendor}</td>
                               <td className="px-6 py-5 text-right font-mono font-black text-emerald-400">{formatCurrency(as.ourCommissionAmount, as.currency)}</td>
                               <td className="px-6 py-5 text-center">
                                  <span className={`px-2 py-0.5 text-[8px] font-black uppercase border ${as.isPaid ? 'border-emerald-500 text-emerald-500' : 'border-rose-500 text-rose-500 animate-pulse'}`}>
                                     {as.isPaid ? 'Utbetalt' : 'Venter'}
                                  </span>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {/* EVO LAB SECTION */}
        {activeTab === 'oil_venture' && (
          <div className="space-y-8">
            <div className="flex gap-6 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
               <button onClick={() => setLabSubTab('calculator')} className={`text-[10px] font-black uppercase tracking-widest transition-all pb-2 ${labSubTab === 'calculator' ? 'text-emerald-400 border-b border-emerald-400' : 'text-slate-500'}`}>Venture-Kalkulator</button>
               <button onClick={() => setLabSubTab('market')} className={`text-[10px] font-black uppercase tracking-widest transition-all pb-2 ${labSubTab === 'market' ? 'text-emerald-400 border-b border-emerald-400' : 'text-slate-500'}`}>Markedskalkulator</button>
            </div>

            {labSubTab === 'calculator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
                <div className="lg:col-span-4 space-y-6">
                  <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Investerings-Matrise</h3>
                    <div className="space-y-4">
                       <div className="p-4 bg-black/40 border border-white/5 space-y-4">
                          <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest border-b border-white/5 pb-2">Norge Venture</p>
                          <div className="space-y-3">
                             <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400 uppercase">Pris Norge (kr)</span>
                                <input type="number" value={simConfig.norwayPriceNok} onChange={e => setSimConfig({...simConfig, norwayPriceNok: Number(e.target.value)})} className="w-16 bg-black border border-white/10 p-1 text-white text-right" />
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-8 glass-panel p-8 border-l-4 border-l-emerald-500">
                   <p className="text-[10px] uppercase text-slate-500 font-black mb-1">Estimert Profitt (År 1)</p>
                   <p className="text-4xl font-black text-emerald-400 font-mono">{formatCurrency(simResults.profitNorwayYear1, 'EUR')}</p>
                   <p className="text-xs text-slate-400 mt-4 italic">Beregnet for {simResults.numBottles} enheter à 0.5L.</p>
                </div>
              </div>
            )}

            {labSubTab === 'market' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in slide-in-from-right-4">
                <div className="lg:col-span-4 glass-panel p-6 border-l-4 border-l-orange-500 bg-orange-500/5">
                   <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6">Markeds-Kalkulator</h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-400 uppercase">Oliven Vekt (Kg)</span>
                         <input type="number" value={marketSim.oliveWeightKg} onChange={e => setMarketSim({...marketSim, oliveWeightKg: Number(e.target.value)})} className="w-20 bg-black border border-white/10 p-1 text-white text-right" />
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-400 uppercase">Markedspris (€/Kg)</span>
                         <input type="number" value={marketSim.pricePerKg} onChange={e => setMarketSim({...marketSim, pricePerKg: Number(e.target.value)})} className="w-20 bg-black border border-white/10 p-1 text-white text-right" />
                      </div>
                   </div>
                </div>
                <div className="lg:col-span-8 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-panel p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1">Netto Profitt (Marked)</p>
                         <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(marketResults.netProfit, 'EUR')}</p>
                      </div>
                      <div className="glass-panel p-6 border-l-4 border-l-cyan-500 bg-cyan-500/5">
                         <p className="text-[10px] uppercase text-slate-500 font-black mb-1">Merverdi vs Olje</p>
                         <p className="text-2xl font-black text-cyan-400 font-mono">+{formatCurrency(marketResults.diff, 'EUR')}</p>
                      </div>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
