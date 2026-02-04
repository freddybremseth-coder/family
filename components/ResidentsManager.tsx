
import React, { useState } from 'react';
import { FamilyMember, Language } from '../types';
import { translations } from '../translations';
import { 
  Users, UserPlus, Trash2, Edit3, Heart, Wallet, Baby, 
  X, Save, Calendar, User, BadgeEuro, Sparkles 
} from 'lucide-react';
import { CyberButton } from './CyberButton';

interface Props {
  familyMembers: FamilyMember[];
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  lang: Language;
}

const formatCurrency = (amount: number, lang: Language) => {
  const symbol = lang === 'no' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const ResidentsManager: React.FC<Props> = ({ familyMembers, setFamilyMembers, lang }) => {
  const t = translations[lang];
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Initial stat for et nytt medlem
  const emptyMember: FamilyMember = {
    id: `fm-${Date.now()}`,
    name: '',
    birthDate: new Date().toISOString().split('T')[0],
    monthlySalary: 0,
    monthlyBenefits: 0,
    monthlyChildBenefit: 0
  };

  const handleSave = () => {
    if (!editingMember) return;

    if (isAddingNew) {
      setFamilyMembers(prev => [...prev, editingMember]);
    } else {
      setFamilyMembers(prev => prev.map(m => m.id === editingMember.id ? editingMember : m));
    }

    setEditingMember(null);
    setIsAddingNew(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Er du sikker på at du vil fjerne denne beboeren?")) {
      setFamilyMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const openEdit = (member: FamilyMember) => {
    setEditingMember({ ...member });
    setIsAddingNew(false);
  };

  const openAdd = () => {
    setEditingMember(emptyMember);
    setIsAddingNew(true);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* REDIGERINGS-MODAL */}
      {editingMember && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setEditingMember(null)} />
          <div className="glass-panel w-full max-w-lg p-10 border-t-4 border-cyan-500 animate-in zoom-in-95 duration-300 relative">
            <button 
              onClick={() => setEditingMember(null)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="mb-10">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Edit3 className="text-cyan-400" /> {isAddingNew ? 'Legg til Beboer' : 'Oppdater Profil'}
              </h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-mono mt-1">Husholdningsregister v.4.0</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                  <User className="w-3 h-3 text-cyan-500" /> Fullt Navn
                </label>
                <input 
                  value={editingMember.name} 
                  onChange={e => setEditingMember({...editingMember, name: e.target.value})}
                  className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all"
                  placeholder="Navn"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-cyan-500" /> Fødselsdato
                </label>
                <input 
                  type="date"
                  value={editingMember.birthDate} 
                  onChange={e => setEditingMember({...editingMember, birthDate: e.target.value})}
                  className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                    <Wallet className="w-3 h-3 text-emerald-400" /> Månedslønn (Netto)
                  </label>
                  <input 
                    type="number"
                    value={editingMember.monthlySalary} 
                    onChange={e => setEditingMember({...editingMember, monthlySalary: Number(e.target.value)})}
                    className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                    <Heart className="w-3 h-3 text-magenta-400" /> Andre Ytelser
                  </label>
                  <input 
                    type="number"
                    value={editingMember.monthlyBenefits} 
                    onChange={e => setEditingMember({...editingMember, monthlyBenefits: Number(e.target.value)})}
                    className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-magenta-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2">
                  <Baby className="w-3 h-3 text-cyan-400" /> Barnetrygd / Bidrag
                </label>
                <input 
                  type="number"
                  value={editingMember.monthlyChildBenefit} 
                  onChange={e => setEditingMember({...editingMember, monthlyChildBenefit: Number(e.target.value)})}
                  className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all"
                />
              </div>

              <div className="pt-6">
                <CyberButton onClick={handleSave} className="w-full py-4 flex items-center justify-center gap-3">
                  <Save className="w-5 h-5" /> {isAddingNew ? 'Opprett Beboer' : 'Lagre Endringer'}
                </CyberButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Husholdningsregister</h3>
          <p className="text-xs text-slate-400 italic">Oversikt over lønn, ytelser og familiebidrag.</p>
        </div>
        <button 
          onClick={openAdd}
          className="flex items-center gap-2 px-6 py-3 border border-cyan-500 text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)]"
        >
          <UserPlus className="w-4 h-4" /> Ny Beboer
        </button>
      </div>

      {/* GRID MED BEBOERE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {familyMembers.map(member => (
          <div key={member.id} className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 relative overflow-hidden group hover:border-l-cyan-400 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="w-20 h-20" />
            </div>
            
            <div className="flex items-center gap-6 mb-8 relative z-10">
              <div className="w-20 h-20 rounded-full border-2 border-cyan-500 p-1 bg-black overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)] group-hover:shadow-[0_0_30px_rgba(0,243,255,0.4)] transition-all">
                <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`} alt={member.name} className="w-full h-full" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">{member.name}</h3>
                <p className="text-[10px] text-cyan-400 font-mono uppercase tracking-[0.2em]">
                  {t.age}: {new Date().getFullYear() - new Date(member.birthDate).getFullYear()}
                </p>
              </div>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center p-3 bg-black/40 border border-white/5">
                <div className="flex items-center gap-2 text-slate-400">
                  <Wallet className="w-3 h-3" />
                  <span className="text-[9px] uppercase font-black">Lønn</span>
                </div>
                <span className="text-sm font-black text-white font-mono">{formatCurrency(member.monthlySalary, lang)}</span>
              </div>

              {member.monthlyBenefits > 0 && (
                <div className="flex justify-between items-center p-3 bg-emerald-500/5 border border-emerald-500/10">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Heart className="w-3 h-3" />
                    <span className="text-[9px] uppercase font-black">Ytelser</span>
                  </div>
                  <span className="text-sm font-black text-emerald-400 font-mono">{formatCurrency(member.monthlyBenefits, lang)}</span>
                </div>
              )}

              {member.monthlyChildBenefit > 0 && (
                <div className="flex justify-between items-center p-3 bg-purple-500/5 border border-purple-500/10">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Baby className="w-3 h-3" />
                    <span className="text-[9px] uppercase font-black">Barnetrygd</span>
                  </div>
                  <span className="text-sm font-black text-purple-400 font-mono">{formatCurrency(member.monthlyChildBenefit, lang)}</span>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center border-t border-white/5 mt-4">
                 <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Totalbidrag</span>
                 <span className="text-xs font-black text-cyan-400 font-mono">
                    {formatCurrency(member.monthlySalary + member.monthlyBenefits + member.monthlyChildBenefit, lang)}
                 </span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => openEdit(member)}
                className="p-2 text-slate-500 hover:text-cyan-400 transition-colors"
                title="Rediger info"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDelete(member.id)}
                className="p-2 text-slate-500 hover:text-rose-500 transition-colors"
                title="Slett beboer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {familyMembers.length === 0 && (
          <div className="col-span-full py-20 text-center glass-panel border-2 border-dashed border-white/5 opacity-30 flex flex-col items-center">
             <Users className="w-16 h-16 mb-4" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Registeret er tomt // Legg til beboere</p>
             <CyberButton onClick={openAdd} variant="ghost" className="mt-6 text-[9px]">Start Database</CyberButton>
          </div>
        )}
      </div>

      {/* OPPSUMMERINGSPANEL */}
      <div className="glass-panel p-8 border-l-4 border-l-emerald-500 bg-emerald-500/5 mt-12">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
               <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Husholdningsinntekt</p>
               <p className="text-2xl font-black text-emerald-400 font-mono">
                 {formatCurrency(familyMembers.reduce((acc, m) => acc + m.monthlySalary + m.monthlyBenefits + m.monthlyChildBenefit, 0), lang)}
               </p>
            </div>
            <div>
               <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Antall Beboere</p>
               <p className="text-2xl font-black text-white font-mono">{familyMembers.length}</p>
            </div>
            <div className="md:col-span-2 flex items-center justify-end">
               <div className="p-4 bg-black/40 border border-emerald-500/20 flex items-center gap-4">
                  <Sparkles className="text-yellow-400 w-5 h-5" />
                  <p className="text-[10px] text-slate-400 italic leading-tight uppercase font-mono">
                    Alle tall brukes i sanntid for å beregne budsjettmarginer og sparekapasitet på dashboardet.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};
