
import React, { useState, useMemo } from 'react';
import { FamilyMember, CalendarEvent, Task, Asset, FinancialGoal, LocalEvent, UserConfig, Currency, Language } from '../types';
import { CyberButton } from './CyberButton';
import { translations } from '../translations';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { 
  Users, CalendarDays, ClipboardList, Plus, Trash2, X, CheckCircle2, Circle, 
  Rocket, BrainCircuit, RefreshCw, Zap, Wallet, Activity, TrendingUp, TrendingDown, 
  Landmark, Info, Settings2, Target, ShieldCheck, ShieldAlert, Home, Coins, 
  Globe, MapPin, Palmtree, PartyPopper, Calendar as CalendarIcon, Save,
  AlertTriangle, Loader2, Key, ExternalLink, ChevronRight, Clock, Star,
  TrendingUp as ProfitIcon, PieChart as ChartIcon, CalendarRange, CreditCard, ExternalLink as LinkIcon
} from 'lucide-react';
import { getLocalCalendarEvents } from '../services/geminiService';
import { EXCHANGE_RATE_EUR_TO_NOK } from '../constants';

interface Props {
  familyMembers: FamilyMember[];
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  calendarEvents: CalendarEvent[];
  setCalendarEvents: React.Dispatch<React.SetStateAction<CalendarEvent[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  assets: Asset[];
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  localEvents: LocalEvent[];
  setLocalEvents: React.Dispatch<React.SetStateAction<LocalEvent[]>>;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const FamilyCalendar: React.FC<Props> = ({ 
  familyMembers, 
  setFamilyMembers,
  calendarEvents,
  setCalendarEvents,
  tasks,
  setTasks,
  assets,
  userConfig, 
  setUserConfig, 
  localEvents, 
  setLocalEvents 
}) => {
  const [activeTab, setActiveTab] = useState<'unified' | 'members' | 'wealth' | 'settings'>('unified');
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  
  const t = translations[userConfig.language];

  const currentPrice = useMemo(() => {
    const base = 4;
    const extraCount = Math.max(0, familyMembers.length - 5);
    return base + extraCount;
  }, [familyMembers.length]);

  const unifiedTimeline = useMemo(() => {
    const combined = [
      ...calendarEvents.map(e => ({ ...e, source: 'family' as const })),
      ...localEvents.map(e => ({ ...e, source: 'local' as const, id: `local-${e.date}-${e.title}` })),
      ...tasks.filter(t => t.priority === 'High' && !t.isComplete).map(t => ({ 
        id: t.id, 
        date: t.date, 
        description: `GJØREMÅL: ${t.description}`, 
        source: 'task' as const,
        type: 'Social' as const,
        assignedToId: t.assignedToId
      }))
    ];
    return combined.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendarEvents, localEvents, tasks]);

  const calendarGrid = useMemo(() => {
    const year = new Date().getFullYear();
    const firstDayOfMonth = new Date(year, selectedMonth, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth + 1, 0).getDate();
    const days = [];
    const padding = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    for (let i = 0; i < padding; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const eventsOnDay = unifiedTimeline.filter(e => e.date === dateStr);
      days.push({ day: i, events: eventsOnDay, dateStr });
    }
    return days;
  }, [selectedMonth, unifiedTimeline]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex gap-4 border-b border-white/10 pb-4 overflow-x-auto no-scrollbar">
        {[
          { id: 'unified', label: t.familyplan, icon: <CalendarIcon className="w-4 h-4" /> },
          { id: 'members', label: t.resident + 's', icon: <Users className="w-4 h-4" /> },
          { id: 'wealth', label: 'Wealth Engine', icon: <Rocket className="w-4 h-4" /> },
          { id: 'settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" /> },
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
              activeTab === tab.id ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'unified' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-12">
            <div className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5">
              <div className="flex justify-between items-center mb-8">
                 <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                  <CalendarRange className="text-cyan-400 w-5 h-5" /> {t.familyplan}
                 </h3>
                <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-black border border-white/10 text-cyan-400 text-[10px] font-black uppercase px-4 py-2 outline-none">
                  {Array.from({length: 12}).map((_, i) => (
                    <option key={i} value={i}>{new Date(0, i).toLocaleString(userConfig.language === 'no' ? 'no-NO' : 'en-US', {month: 'long'})}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => (
                  <div key={d} className="text-center text-[9px] font-black text-slate-600 uppercase mb-4">{d}</div>
                ))}
                {calendarGrid.map((day, i) => (
                  <div key={i} className={`aspect-square border border-white/5 flex flex-col items-center justify-center relative group cursor-pointer transition-all ${
                    day?.events.length ? 'bg-cyan-500/10 border-cyan-500/40' : 'bg-black/20 hover:bg-white/5'
                  }`}>
                    {day && <span className={`text-xs font-black ${day.events.length ? 'text-cyan-400' : 'text-slate-700'}`}>{day.day}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {familyMembers.map(member => (
             <div key={member.id} className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 relative overflow-hidden group">
                <div className="flex items-center gap-6 mb-8 relative z-10">
                   <div className="w-24 h-24 rounded-full border-2 border-cyan-500 p-1 bg-black overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                      <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`} alt={member.name} className="w-full h-full" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{member.name}</h3>
                      <p className="text-[10px] text-cyan-400 font-mono uppercase tracking-[0.2em]">{t.age}: {new Date().getFullYear() - new Date(member.birthDate).getFullYear()} // {t.resident}</p>
                   </div>
                </div>
             </div>
           ))}
           <div className="glass-panel p-8 border-2 border-dashed border-white/5 flex flex-col items-center justify-center opacity-30 hover:opacity-100 transition-all cursor-pointer">
              <Plus className="w-12 h-12 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">Legg til familiemedlem</p>
           </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-8">
           {/* KONFIGURASJON */}
           <div className="glass-panel p-10 border-l-4 border-l-cyan-500">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-10 flex items-center gap-4">
                 <Settings2 className="text-cyan-400 w-6 h-6" /> System Configuration
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{t.family_name}</label>
                    <div className="relative">
                       <Home className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                       <input 
                         value={userConfig.familyName} 
                         onChange={e => setUserConfig({...userConfig, familyName: e.target.value.toUpperCase()})} 
                         className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 text-white text-sm outline-none focus:border-cyan-500 transition-all font-mono" 
                         placeholder="F.eks BREMSETH"
                       />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{t.language}</label>
                    <select 
                       value={userConfig.language} 
                       onChange={e => setUserConfig({...userConfig, language: e.target.value as Language})}
                       className="w-full bg-black border border-white/10 p-4 text-white text-sm outline-none focus:border-cyan-500 transition-all font-mono"
                    >
                       <option value="no">Norsk (no)</option>
                       <option value="en">English (en)</option>
                       <option value="ru">Русский (ru)</option>
                       <option value="es">Español (es)</option>
                       <option value="fr">Français (fr)</option>
                       <option value="de">Deutsch (de)</option>
                    </select>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{t.location}</label>
                    <div className="relative">
                       <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
                       <input value={userConfig.location} onChange={e => setUserConfig({...userConfig, location: e.target.value})} className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 text-white text-sm outline-none" />
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">{t.currency_preference}</label>
                    <select 
                       value={userConfig.preferredCurrency} 
                       onChange={e => setUserConfig({...userConfig, preferredCurrency: e.target.value as Currency})}
                       className="w-full bg-black border border-white/10 p-4 text-white text-sm outline-none focus:border-cyan-500 transition-all font-mono"
                    >
                       <option value="EUR">EUR (€)</option>
                       <option value="NOK">NOK (kr)</option>
                    </select>
                 </div>
              </div>
           </div>

           {/* ABONNEMENT */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-panel p-10 border-l-4 border-l-magenta-500 bg-magenta-500/5">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
                    <CreditCard className="text-magenta-400 w-6 h-6" /> {t.subscription}
                 </h3>
                 <div className="space-y-6">
                    <div className="p-5 bg-black/40 border border-white/5">
                       <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Ditt aktive abonnement</p>
                       <p className="text-3xl font-black text-white font-mono">{currentPrice}€ <span className="text-[10px] text-slate-500 uppercase">/ Måned</span></p>
                    </div>
                    <div className="flex flex-col gap-2">
                       <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex justify-between">
                          <span>Status</span> <span className="text-emerald-500">AKTIV</span>
                       </p>
                       <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest flex justify-between">
                          <span>Medlemmer</span> <span>{familyMembers.length} av 5 (Base)</span>
                       </p>
                       {familyMembers.length > 5 && (
                         <p className="text-[10px] text-magenta-400 uppercase font-black tracking-widest flex justify-between">
                            <span>Tillegg</span> <span>+{familyMembers.length - 5}€</span>
                         </p>
                       )}
                    </div>
                    <CyberButton variant="secondary" className="w-full text-[10px]">Administrer Fakturering</CyberButton>
                 </div>
              </div>

              {/* API KONFIGURASJON */}
              <div className="glass-panel p-10 border-l-4 border-l-yellow-500 bg-yellow-500/5">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
                    <Key className="text-yellow-400 w-6 h-6" /> {t.api_key_instruction}
                 </h3>
                 <div className="space-y-6">
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                       {t.api_help_text}
                    </p>
                    <div className="p-5 bg-black/40 border border-yellow-500/20 space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Hvordan legge inn nøkkel:</h4>
                       <ol className="text-[10px] text-slate-300 space-y-2 font-mono uppercase">
                          <li>1. Gå til <a href="https://aistudio.google.com" target="_blank" className="text-cyan-400 underline">Google AI Studio</a></li>
                          <li>2. Generer en ny API Key</li>
                          <li>3. Injiser nøkkelen som <span className="text-white">API_KEY</span> i miljøvariablene</li>
                       </ol>
                    </div>
                    <a 
                      href="https://ai.google.dev" 
                      target="_blank" 
                      className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 text-[9px] font-black uppercase text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                    >
                       <LinkIcon className="w-3 h-3" /> {t.api_link_text}
                    </a>
                 </div>
              </div>
           </div>
           
           <div className="flex justify-center">
              <CyberButton className="px-20 py-5"><Save className="w-5 h-5 mr-3" /> {t.save_settings}</CyberButton>
           </div>
        </div>
      )}
    </div>
  );
};
