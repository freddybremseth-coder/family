import React, { useEffect, useMemo, useState } from 'react';
import { BankAccount, FamilyMember, FamilyMemberContribution, Language } from '../types';
import { translations } from '../translations';
import { Users, UserPlus, Trash2, Edit3, Heart, Wallet, Baby, X, Save, Calendar, User, Landmark, Sparkles, FileText, Download, Plus } from 'lucide-react';
import { CyberButton } from './CyberButton';
import { fetchFamilyDocuments, getFamilyDocumentSignedUrl, FamilyDocumentRecord } from '../services/documentService';
import { getOrCreateHousehold, Household } from '../services/householdService';

interface Props {
  familyMembers: FamilyMember[];
  setFamilyMembers: React.Dispatch<React.SetStateAction<FamilyMember[]>>;
  lang: Language;
  bankAccounts?: BankAccount[];
  userId?: string;
  familyName?: string;
}

const formatCurrency = (amount: number, lang: Language) => {
  const symbol = lang === 'no' ? 'kr' : '€';
  return `${symbol} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

function cleanSalaryDay(value: number) {
  if (!Number.isFinite(value) || value < 1) return undefined;
  return Math.min(31, Math.max(1, Math.round(value)));
}

function newContribution(): FamilyMemberContribution {
  return { id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, label: '', amount: 0, frequency: 'annual' };
}

// Sum av bidrag på månedsbasis (engangs vises adskilt)
function monthlyExtras(contribs: FamilyMemberContribution[] = []): number {
  return contribs.reduce((sum, c) => {
    if (c.frequency === 'monthly') return sum + Number(c.amount || 0);
    if (c.frequency === 'annual') return sum + Number(c.amount || 0) / 12;
    return sum; // oneoff vises ikke i månedlig
  }, 0);
}

function annualExtras(contribs: FamilyMemberContribution[] = []): number {
  return contribs.reduce((sum, c) => {
    if (c.frequency === 'monthly') return sum + Number(c.amount || 0) * 12;
    if (c.frequency === 'annual') return sum + Number(c.amount || 0);
    return sum;
  }, 0);
}

function oneOffExtras(contribs: FamilyMemberContribution[] = []): number {
  return contribs.reduce((sum, c) => c.frequency === 'oneoff' ? sum + Number(c.amount || 0) : sum, 0);
}

export const ResidentsManager: React.FC<Props> = ({ familyMembers, setFamilyMembers, lang, bankAccounts = [], userId, familyName = 'Familien' }) => {
  const t = translations[lang];
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [documents, setDocuments] = useState<FamilyDocumentRecord[]>([]);
  const [household, setHousehold] = useState<Household | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const emptyMember: FamilyMember = { id: `fm-${Date.now()}`, name: '', birthDate: new Date().toISOString().split('T')[0], monthlySalary: 0, monthlyBenefits: 0, monthlyChildBenefit: 0, salaryDay: 25, salaryAccountId: bankAccounts[0]?.id, extraContributions: [] };
  const accountLabel = (id?: string) => bankAccounts.find((a) => a.id === id)?.accountName || bankAccounts.find((a) => a.id === id)?.bankName || id || 'Ikke valgt';

  // Last household + dokumenter
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const hh = await getOrCreateHousehold(userId, familyName);
      setHousehold(hh);
      if (hh) {
        const docs = await fetchFamilyDocuments(hh.id);
        setDocuments(docs);
      }
    })();
  }, [userId, familyName]);

  // Map dokumenter per medlem basert på owner-feltet
  const documentsForMember = useMemo(() => {
    const map = new Map<string, FamilyDocumentRecord[]>();
    for (const member of familyMembers) {
      const memberName = member.name.toLowerCase().trim();
      const firstName = memberName.split(/\s+/)[0];
      const docs = documents.filter(doc => {
        const owner = String(doc.owner || '').toLowerCase().trim();
        if (!owner || owner === 'familien' || owner === 'family') return false;
        return owner === memberName || owner.includes(memberName) || owner.includes(firstName);
      });
      map.set(member.id, docs);
    }
    return map;
  }, [familyMembers, documents]);

  const familyDocs = useMemo(() => documents.filter(doc => {
    const owner = String(doc.owner || '').toLowerCase().trim();
    return !owner || owner === 'familien' || owner === 'family';
  }), [documents]);

  const handleSave = () => {
    if (!editingMember) return;
    const cleanedContribs = (editingMember.extraContributions || []).filter(c => c.label.trim() && Number(c.amount || 0) > 0);
    const normalized: FamilyMember = { ...editingMember, salaryDay: cleanSalaryDay(editingMember.salaryDay || 0), extraContributions: cleanedContribs.length > 0 ? cleanedContribs : undefined };
    if (isAddingNew) setFamilyMembers(prev => [...prev, normalized]);
    else setFamilyMembers(prev => prev.map(m => m.id === normalized.id ? normalized : m));
    setEditingMember(null);
    setIsAddingNew(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Er du sikker på at du vil fjerne denne beboeren?')) setFamilyMembers(prev => prev.filter(m => m.id !== id));
  };

  const openEdit = (member: FamilyMember) => { setEditingMember({ ...member, salaryDay: member.salaryDay || 25, salaryAccountId: member.salaryAccountId || bankAccounts[0]?.id, extraContributions: [...(member.extraContributions || [])] }); setIsAddingNew(false); };
  const openAdd = () => { setEditingMember(emptyMember); setIsAddingNew(true); };

  const addContribution = () => {
    if (!editingMember) return;
    setEditingMember({ ...editingMember, extraContributions: [...(editingMember.extraContributions || []), newContribution()] });
  };
  const updateContribution = (id: string, patch: Partial<FamilyMemberContribution>) => {
    if (!editingMember) return;
    setEditingMember({ ...editingMember, extraContributions: (editingMember.extraContributions || []).map(c => c.id === id ? { ...c, ...patch } : c) });
  };
  const removeContribution = (id: string) => {
    if (!editingMember) return;
    setEditingMember({ ...editingMember, extraContributions: (editingMember.extraContributions || []).filter(c => c.id !== id) });
  };

  const openDocument = async (doc: FamilyDocumentRecord) => {
    if (!doc.storagePath) return;
    setOpeningId(doc.id);
    try {
      const url = await getFamilyDocumentSignedUrl(doc.storagePath);
      if (url) window.open(url, '_blank');
    } finally { setOpeningId(null); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {editingMember && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setEditingMember(null)} />
          <div className="glass-panel w-full max-w-2xl p-10 border-t-4 border-cyan-500 animate-in zoom-in-95 duration-300 relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditingMember(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            <div className="mb-10"><h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3"><Edit3 className="text-cyan-400" /> {isAddingNew ? 'Legg til Beboer' : 'Oppdater Profil'}</h3><p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-mono mt-1">Husholdningsregister v.4.2</p></div>
            <div className="space-y-6">
              <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><User className="w-3 h-3 text-cyan-500" /> Fullt Navn</label><input value={editingMember.name} onChange={e => setEditingMember({ ...editingMember, name: e.target.value })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all" placeholder="Navn" /></div>
              <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Calendar className="w-3 h-3 text-cyan-500" /> Fødselsdato</label><input type="date" value={editingMember.birthDate} onChange={e => setEditingMember({ ...editingMember, birthDate: e.target.value })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all" /></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Wallet className="w-3 h-3 text-emerald-400" /> Månedslønn (Netto)</label><input type="number" value={editingMember.monthlySalary} onChange={e => setEditingMember({ ...editingMember, monthlySalary: Number(e.target.value) })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Calendar className="w-3 h-3 text-emerald-400" /> Lønnsdag</label><input type="number" min={1} max={31} value={editingMember.salaryDay || ''} onChange={e => setEditingMember({ ...editingMember, salaryDay: cleanSalaryDay(Number(e.target.value)) })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none transition-all" placeholder="25" /></div>
              </div>
              <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Landmark className="w-3 h-3 text-cyan-400" /> Konto for lønn</label>{bankAccounts.length > 0 ? <select value={editingMember.salaryAccountId || ''} onChange={e => setEditingMember({ ...editingMember, salaryAccountId: e.target.value })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all"><option value="">Velg konto</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.accountName} · {account.bankName} · {Number(account.balance || 0).toLocaleString('nb-NO')} {account.currency}</option>)}</select> : <input value={editingMember.salaryAccountId || ''} onChange={e => setEditingMember({ ...editingMember, salaryAccountId: e.target.value })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all" placeholder="Opprett bankkonto først" />}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Heart className="w-3 h-3 text-magenta-400" /> Andre Ytelser / mnd</label><input type="number" value={editingMember.monthlyBenefits} onChange={e => setEditingMember({ ...editingMember, monthlyBenefits: Number(e.target.value) })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-magenta-500 outline-none transition-all" /></div>
                <div className="space-y-2"><label className="text-[9px] uppercase font-black text-slate-500 tracking-widest flex items-center gap-2"><Baby className="w-3 h-3 text-cyan-400" /> Barnetrygd / Bidrag / mnd</label><input type="number" value={editingMember.monthlyChildBenefit} onChange={e => setEditingMember({ ...editingMember, monthlyChildBenefit: Number(e.target.value) })} className="w-full bg-black border border-white/10 px-4 py-3 text-white text-sm focus:border-cyan-500 outline-none transition-all" /></div>
              </div>

              {/* EKSTRA BIDRAG */}
              <div className="space-y-3 border-t border-white/5 pt-6">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Ekstra bidrag (provisjon, renter, depositum)</label>
                  <button type="button" onClick={addContribution} className="text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Legg til</button>
                </div>
                {(editingMember.extraContributions || []).length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">Eksempler: «Provisjon eiendomssalg» (årlig), «Mondeo renteinntekt» (årlig), «Depositum» (engangs)</p>
                )}
                {(editingMember.extraContributions || []).map(c => (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-black/40 border border-white/5 p-3">
                    <input value={c.label} onChange={e => updateContribution(c.id, { label: e.target.value })} placeholder="Beskrivelse" className="md:col-span-5 bg-black border border-white/10 px-3 py-2 text-white text-xs focus:border-cyan-500 outline-none" />
                    <input type="number" value={c.amount} onChange={e => updateContribution(c.id, { amount: Number(e.target.value) })} placeholder="Beløp NOK" className="md:col-span-3 bg-black border border-white/10 px-3 py-2 text-white text-xs focus:border-cyan-500 outline-none font-mono" />
                    <select value={c.frequency} onChange={e => updateContribution(c.id, { frequency: e.target.value as FamilyMemberContribution['frequency'] })} className="md:col-span-3 bg-black border border-white/10 px-3 py-2 text-white text-xs focus:border-cyan-500 outline-none">
                      <option value="monthly">Månedlig</option>
                      <option value="annual">Årlig</option>
                      <option value="oneoff">Engangs</option>
                    </select>
                    <button type="button" onClick={() => removeContribution(c.id)} className="md:col-span-1 text-slate-500 hover:text-rose-400 transition-colors flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="pt-6"><CyberButton onClick={handleSave} className="w-full py-4 flex items-center justify-center gap-3"><Save className="w-5 h-5" /> {isAddingNew ? 'Opprett Beboer' : 'Lagre Endringer'}</CyberButton></div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-10"><div><h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">Husholdningsregister</h3><p className="text-xs text-slate-400 italic">Oversikt over lønn, bidrag og dokumenter pr beboer.</p></div><button onClick={openAdd} className="flex items-center gap-2 px-6 py-3 border border-cyan-500 text-cyan-400 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all shadow-[0_0_15px_rgba(0,243,255,0.2)]"><UserPlus className="w-4 h-4" /> Ny Beboer</button></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {familyMembers.map(member => {
          const monthlyExtra = monthlyExtras(member.extraContributions);
          const annualExtra = annualExtras(member.extraContributions);
          const oneOff = oneOffExtras(member.extraContributions);
          const baseMonthly = member.monthlySalary + member.monthlyBenefits + member.monthlyChildBenefit;
          const totalMonthly = baseMonthly + monthlyExtra;
          const totalAnnual = baseMonthly * 12 + annualExtra;
          const memberDocs = documentsForMember.get(member.id) || [];
          return (
            <div key={member.id} className="glass-panel p-8 border-l-4 border-l-cyan-500 bg-cyan-500/5 relative overflow-hidden group hover:border-l-cyan-400 transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users className="w-20 h-20" /></div>
              <div className="flex items-center gap-6 mb-8 relative z-10"><div className="w-20 h-20 rounded-full border-2 border-cyan-500 p-1 bg-black overflow-hidden shadow-[0_0_20px_rgba(0,243,255,0.2)]"><img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`} alt={member.name} className="w-full h-full" /></div><div><h3 className="text-2xl font-black text-white uppercase tracking-tighter">{member.name}</h3><p className="text-[10px] text-cyan-400 font-mono uppercase tracking-[0.2em]">{t.age}: {new Date().getFullYear() - new Date(member.birthDate).getFullYear()}</p></div></div>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center p-3 bg-black/40 border border-white/5"><div className="flex items-center gap-2 text-slate-400"><Wallet className="w-3 h-3" /><span className="text-[9px] uppercase font-black">Lønn / mnd</span></div><span className="text-sm font-black text-white font-mono">{formatCurrency(member.monthlySalary, lang)}</span></div>
                {member.monthlyBenefits > 0 && <div className="flex justify-between items-center p-3 bg-emerald-500/5 border border-emerald-500/10"><div className="flex items-center gap-2 text-emerald-400"><Heart className="w-3 h-3" /><span className="text-[9px] uppercase font-black">Ytelser / mnd</span></div><span className="text-sm font-black text-emerald-400 font-mono">{formatCurrency(member.monthlyBenefits, lang)}</span></div>}
                {member.monthlyChildBenefit > 0 && <div className="flex justify-between items-center p-3 bg-purple-500/5 border border-purple-500/10"><div className="flex items-center gap-2 text-purple-400"><Baby className="w-3 h-3" /><span className="text-[9px] uppercase font-black">Barnetrygd / mnd</span></div><span className="text-sm font-black text-purple-400 font-mono">{formatCurrency(member.monthlyChildBenefit, lang)}</span></div>}

                {/* EKSTRA BIDRAG */}
                {(member.extraContributions || []).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-fuchsia-500/10 border border-fuchsia-500/30">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase font-black text-fuchsia-200 truncate">{c.label}</p>
                      <p className="text-[8px] text-fuchsia-300 font-mono uppercase">{c.frequency === 'monthly' ? 'pr mnd' : c.frequency === 'annual' ? 'pr år' : 'engangs'}</p>
                    </div>
                    <span className="text-sm font-black text-fuchsia-100 font-mono shrink-0 ml-3">{formatCurrency(c.amount, lang)}</span>
                  </div>
                ))}

                <div className="pt-2 mt-4 border-t border-white/5 space-y-1.5">
                  <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Totalbidrag / mnd</span><span className="text-xs font-black text-cyan-400 font-mono">{formatCurrency(totalMonthly, lang)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Totalbidrag / år</span><span className="text-xs font-black text-emerald-400 font-mono">{formatCurrency(totalAnnual, lang)}</span></div>
                  {oneOff > 0 && <div className="flex justify-between items-center"><span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Engangsbidrag totalt</span><span className="text-xs font-black text-yellow-400 font-mono">{formatCurrency(oneOff, lang)}</span></div>}
                </div>

                {/* DOKUMENTER FOR DENNE PERSONEN */}
                <div className="pt-4 mt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1.5"><FileText className="w-3 h-3" /> Dokumenter ({memberDocs.length})</p>
                  </div>
                  {memberDocs.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic">Ingen dokumenter knyttet til {member.name}. Sett «Gjelder = {member.name}» i Dokumenter-fanen.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {memberDocs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => openDocument(doc)}
                          disabled={!doc.storagePath || openingId === doc.id}
                          className="w-full flex items-center justify-between gap-2 p-2 bg-black/40 border border-white/5 hover:border-cyan-500/40 transition-all text-left disabled:opacity-50"
                          title={doc.storagePath ? 'Åpne dokument' : 'Ingen fil tilknyttet'}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3 h-3 text-cyan-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-white truncate">{doc.title}</p>
                              <p className="text-[9px] text-slate-500 truncate">{doc.category}{doc.expiryDate ? ` · utløper ${doc.expiryDate}` : ''}</p>
                            </div>
                          </div>
                          {doc.storagePath && <Download className="w-3 h-3 text-cyan-400/60 shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => openEdit(member)} className="p-2 text-slate-500 hover:text-cyan-400 transition-colors" title="Rediger info"><Edit3 className="w-4 h-4" /></button><button onClick={() => handleDelete(member.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-colors" title="Slett beboer"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          );
        })}
        {familyMembers.length === 0 && <div className="col-span-full py-20 text-center glass-panel border-2 border-dashed border-white/5 opacity-30 flex flex-col items-center"><Users className="w-16 h-16 mb-4" /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Registeret er tomt // Legg til beboere</p><CyberButton onClick={openAdd} variant="ghost" className="mt-6 text-[9px]">Start Database</CyberButton></div>}
      </div>

      {/* FELLES FAMILIE-DOKUMENTER */}
      {familyDocs.length > 0 && (
        <div className="glass-panel p-6 border-l-4 border-l-yellow-500 bg-yellow-500/5">
          <h3 className="text-sm font-black text-yellow-300 uppercase tracking-[0.3em] mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Felles familie-dokumenter ({familyDocs.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {familyDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => openDocument(doc)}
                disabled={!doc.storagePath || openingId === doc.id}
                className="flex items-center justify-between gap-2 p-2 bg-black/40 border border-white/5 hover:border-yellow-500/40 transition-all text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3 h-3 text-yellow-400 shrink-0" />
                  <div className="min-w-0"><p className="text-[10px] font-black text-white truncate">{doc.title}</p><p className="text-[9px] text-slate-500 truncate">{doc.category}</p></div>
                </div>
                {doc.storagePath && <Download className="w-3 h-3 text-yellow-400/60 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel p-8 border-l-4 border-l-emerald-500 bg-emerald-500/5 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Husholdningsinntekt / mnd</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(familyMembers.reduce((acc, m) => acc + m.monthlySalary + m.monthlyBenefits + m.monthlyChildBenefit + monthlyExtras(m.extraContributions), 0), lang)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Total / år</p>
            <p className="text-2xl font-black text-cyan-400 font-mono">{formatCurrency(familyMembers.reduce((acc, m) => acc + (m.monthlySalary + m.monthlyBenefits + m.monthlyChildBenefit) * 12 + annualExtras(m.extraContributions), 0), lang)}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Antall Beboere</p>
            <p className="text-2xl font-black text-white font-mono">{familyMembers.length}</p>
          </div>
          <div className="flex items-center"><div className="p-4 bg-black/40 border border-emerald-500/20 flex items-center gap-4"><Sparkles className="text-yellow-400 w-5 h-5" /><p className="text-[10px] text-slate-400 italic leading-tight uppercase font-mono">Lønn bokføres månedlig. Årlige bidrag (provisjon, renter) er fordelt over 12 mnd i månedstotal.</p></div></div>
        </div>
      </div>
    </div>
  );
};
