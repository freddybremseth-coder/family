
import React, { useState } from 'react';
import { Asset, Currency } from '../types';
import { CyberButton } from './CyberButton';
import { Home, Plus, Trash2, Edit3, Save, Sparkles, MapPin, TrendingUp, TrendingDown, Car, Landmark, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { estimateAssetGrowth } from '../services/geminiService';

interface Props {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const AssetManager: React.FC<Props> = ({ assets, setAssets }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    type: 'Property',
    currency: 'EUR',
    annualGrowthRate: 4,
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  const handleAddAsset = () => {
    if (!newAsset.name || !newAsset.currentValue) return;
    const assetToAdd: Asset = {
      id: `asset-${Date.now()}`,
      name: newAsset.name || '',
      type: newAsset.type as any || 'Property',
      location: newAsset.location || '',
      purchasePrice: Number(newAsset.purchasePrice || 0),
      currentValue: Number(newAsset.currentValue || 0),
      currency: newAsset.currency as any || 'EUR',
      annualGrowthRate: Number(newAsset.annualGrowthRate || 0),
      purchaseDate: newAsset.purchaseDate || '',
      notes: newAsset.notes
    };
    setAssets([...assets, assetToAdd]);
    setShowAddForm(false);
    setNewAsset({ type: 'Property', currency: 'EUR', annualGrowthRate: 4, purchaseDate: new Date().toISOString().split('T')[0] });
  };

  const handleAIAppreciation = async (id: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset || !asset.location) return;

    setLoadingAI(id);
    try {
      const result = await estimateAssetGrowth(asset.type, asset.location);
      setAssets(prev => prev.map(a => 
        a.id === id ? { ...a, annualGrowthRate: result.annualGrowthPct, notes: `${result.reasoning}\n\n${result.historicalContext}` } : a
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAI(null);
    }
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    setConfirmDeleteId(null);
  };

  const assetToDelete = assets.find(a => a.id === confirmDeleteId);

  return (
    <div className="space-y-6 relative">
      {/* SLETTE-MODAL */}
      {confirmDeleteId && assetToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setConfirmDeleteId(null)} />
          <div className="glass-panel w-full max-w-md p-8 border-2 border-rose-500 animate-in zoom-in-95 duration-200 shadow-[0_0_50px_rgba(244,63,94,0.3)]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500 flex items-center justify-center">
                 <AlertTriangle className="text-rose-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Fjern Eiendel?</h3>
                <p className="text-[10px] text-rose-500 uppercase font-black tracking-widest">Permanent operasjon</p>
              </div>
            </div>
            <p className="text-slate-300 text-sm mb-8 leading-relaxed">
              Er du sikker på at du vil slette <span className="text-white font-bold underline decoration-rose-500/50 uppercase">{assetToDelete.name}</span> fra registeret? 
              Dette vil fjerne verdien på <span className="text-rose-400 font-mono font-bold">{formatCurrency(assetToDelete.currentValue, assetToDelete.currency)}</span> fra din totale formue.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setConfirmDeleteId(null)} 
                className="flex-1 py-3 border border-white/10 text-slate-100 uppercase text-[10px] font-black tracking-[0.2em] hover:bg-white/5 transition-all"
              >
                Avbryt
              </button>
              <button 
                onClick={() => deleteAsset(confirmDeleteId)} 
                className="flex-1 py-3 bg-rose-600 text-white uppercase text-[10px] font-black tracking-[0.2em] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)] transition-all"
              >
                Bekreft Sletting
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
          <Landmark className="text-yellow-400" /> Eiendels-register
        </h3>
        <CyberButton onClick={() => setShowAddForm(!showAddForm)} variant="ghost" className="text-[10px]">
            {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {showAddForm ? 'Lukk' : 'Ny Eiendel'}
        </CyberButton>
      </div>

      {showAddForm && (
        <div className="glass-panel p-6 border-l-4 border-l-yellow-500 animate-in slide-in-from-top-4 bg-yellow-500/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Navn</label>
                    <input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" placeholder="F.eks Casa Anna" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Type</label>
                    <select value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value as any})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none">
                        <option value="Property">Bolig</option>
                        <option value="Land">Tomt</option>
                        <option value="Vehicle">Bil / Kjøretøy</option>
                        <option value="Other">Annet</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Lokasjon</label>
                    <input value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" placeholder="F.eks Pinoso, Spania" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Nåverdi</label>
                    <div className="flex gap-2">
                        <input type="number" value={newAsset.currentValue} onChange={e => setNewAsset({...newAsset, currentValue: Number(e.target.value)})} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" />
                        <select value={newAsset.currency} onChange={e => setNewAsset({...newAsset, currency: e.target.value as any})} className="bg-black border border-white/10 p-2 text-yellow-400 text-xs font-bold outline-none">
                            <option value="EUR">EUR</option>
                            <option value="NOK">NOK</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Årlig Vekst %</label>
                    <input type="number" step="0.1" value={newAsset.annualGrowthRate} onChange={e => setNewAsset({...newAsset, annualGrowthRate: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none" />
                </div>
            </div>
            <CyberButton onClick={handleAddAsset} className="w-full py-3">Lagre Eiendel i Registeret</CyberButton>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map(asset => (
          <div key={asset.id} className="glass-panel p-6 border-l-4 border-l-yellow-500 relative group overflow-hidden hover:border-l-yellow-400 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {asset.type === 'Vehicle' ? <Car className="w-16 h-16" /> : <Home className="w-16 h-16" />}
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">{asset.name}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">
                  <MapPin className="w-3 h-3 text-yellow-500" /> {asset.location}
                </div>
              </div>
              <div className="flex gap-2 relative z-10">
                <button 
                    onClick={() => handleAIAppreciation(asset.id)} 
                    disabled={loadingAI === asset.id}
                    className="p-2 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all"
                    title="AI Estimering"
                >
                  {loadingAI === asset.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setConfirmDeleteId(asset.id)} 
                  className="p-2 border border-white/10 text-slate-600 hover:text-rose-500 hover:border-rose-500/50 transition-all"
                  title="Fjern eiendel"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                <div>
                    <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Nåverdi</p>
                    <p className="text-2xl font-black text-white font-mono">{formatCurrency(asset.currentValue, asset.currency)}</p>
                </div>
                <div>
                    <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Årlig Vekst</p>
                    <p className={`text-lg font-black font-mono ${asset.annualGrowthRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {asset.annualGrowthRate > 0 ? '+' : ''}{asset.annualGrowthRate}%
                    </p>
                </div>
            </div>

            {asset.notes && (
                <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-sm relative z-10">
                    <p className="text-[9px] uppercase text-yellow-500 font-black mb-1 flex items-center gap-1">
                        <Sparkles className="w-2 h-2" /> AI Innsikt
                    </p>
                    <p className="text-[10px] text-slate-400 italic leading-tight">{asset.notes.slice(0, 150)}...</p>
                </div>
            )}
          </div>
        ))}
        {assets.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 opacity-20">
             <Landmark className="w-12 h-12 mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Eiendelsregisteret er tomt</p>
          </div>
        )}
      </div>
    </div>
  );
};
