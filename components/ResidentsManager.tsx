
import React from 'react';
import { FamilyMember, Language } from '../types';
import { translations } from '../translations';
import { Users, UserPlus, Trash2, Edit3, Heart, Wallet, Baby } from 'lucide-react';

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Oversikt over husholdningen</h3>
          <p className="text-xs text-slate-400 italic">Administrer medlemmer, lønn og sosiale ytelser.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 border border-cyan-500 text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all">
          <UserPlus className="w-4 h-4" /> Ny Beboer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {familyMembers.map(member => (
          <div key={member.id} className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="w-20 h-20" />
            </div>
            
            <div className="flex items-center gap-6 mb-8 relative z-10">
              <div className="w-20 h-20 rounded-full border-2 border-cyan-500 p-1 bg-black overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)]">
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
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 text-slate-500 hover:text-white transition-colors"><Edit3 className="w-4 h-4" /></button>
              <button className="p-2 text-slate-500 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
