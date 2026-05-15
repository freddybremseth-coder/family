
import React, { useEffect, useMemo, useState } from 'react';
import { Asset, Currency } from '../types';
import { CyberButton } from './CyberButton';
import { Home, Plus, Trash2, Sparkles, MapPin, Landmark, RefreshCw, AlertTriangle, X, Car } from 'lucide-react';
import { estimateAssetGrowth } from '../services/geminiService';
import { fetchRealtyflowCommissions } from '../services/realtyflowService';

interface Props {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const EXPECTED_PROPERTY_COMMISSION_ASSET_ID = 'asset-expected-property-commissions';
const EXPECTED_PROPERTY_COMMISSION_ASSET_NAME = 'Forventede eiendomsprovisjoner';

const formatCurrency = (amount: number, currency: Currency) => {
  const symbol = currency === 'NOK' ? 'kr' : '€';
  return `${symbol} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

function assetValue(asset: any) {
  return Number(asset?.currentValue ?? asset?.value ?? 0) || 0;
}

function isExpectedCommissionAsset(asset: any) {
  return asset?.id === EXPECTED_PROPERTY_COMMISSION_ASSET_ID || String(asset?.name || '').trim().toLowerCase() === EXPECTED_PROPERTY_COMMISSION_ASSET_NAME.toLowerCase();
}

export const AssetManager: React.FC<Props> = ({ assets, setAssets }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [commissionSyncNote, setCommissionSyncNote] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [newAsset, setNewAsset] = useState<Partial<Asset> & any>({
    type: 'Property',
    category: 'REAL_ESTATE',
    currency: 'EUR',
    annualGrowthRate: 4,
    purchaseDate: new Date().toISOString().split('T')[0]
  });

  const syncExpectedPropertyCommissions = async () => {
    setLoadingCommissions(true);
    try {
      const summary = await fetchRealtyflowCommissions();
      const totalNok = Math.round(Number(summary.totalNok || 0));
      const totalEur = Math.round(Number(summary.totalEur || 0));
      const count = summary.brands.reduce((sum, brand) => sum + Number(brand.count || 0), 0);
      const brandText = summary.brands
        .filter((brand) => Number(brand.totalNok || 0) > 0 || Number(brand.count || 0) > 0)
        .map((brand) => `${brand.brand}: ${formatCurrency(Math.round(brand.totalNok || 0) as any, 'NOK' as Currency)} (${brand.count})`)
        .join('\n');
      const note = [
        `Automatisk oppdatert fra RealtyFlow/Salg av eiendom ${new Date().toLocaleDateString('nb-NO')}.`,
        `Samlet forventet provisjon: ${formatCurrency(totalNok as any, 'NOK' as Currency)} / ca. € ${totalEur.toLocaleString('nb-NO')}.`,
        `Antall provisjonsposter: ${count}.`,
        brandText,
      ].filter(Boolean).join('\n');

      setAssets((prev: any[]) => {
        const existingIndex = prev.findIndex(isExpectedCommissionAsset);
        const existing = existingIndex >= 0 ? prev[existingIndex] : null;
        const nextAsset: any = {
          ...(existing || {}),
          id: existing?.id || EXPECTED_PROPERTY_COMMISSION_ASSET_ID,
          name: EXPECTED_PROPERTY_COMMISSION_ASSET_NAME,
          type: existing?.type || 'Property',
          category: 'REAL_ESTATE',
          location: 'RealtyFlow / Soleada / ZenEcoHomes',
          purchasePrice: 0,
          value: totalNok,
          currentValue: totalNok,
          currency: 'NOK',
          annualGrowthRate: 0,
          purchaseDate: existing?.purchaseDate || new Date().toISOString().split('T')[0],
          notes: note,
        };
        if (existingIndex >= 0) {
          const copy = [...prev];
          copy[existingIndex] = nextAsset;
          return copy;
        }
        return [nextAsset, ...prev];
      });
      setCommissionSyncNote(totalNok > 0 ? `Oppdatert til ${formatCurrency(totalNok as any, 'NOK' as Currency)} fra RealtyFlow.` : 'Fant ingen provisjonstall i RealtyFlow ennå.');
    } catch (err: any) {
      console.warn('[AssetManager] RealtyFlow commission asset sync failed', err);
      setCommissionSyncNote('Kunne ikke hente provisjoner fra RealtyFlow akkurat nå.');
    } finally {
      setLoadingCommissions(false);
    }
  };

  useEffect(() => {
    syncExpectedPropertyCommissions();
  }, []);

  const totalAssetValueNok = useMemo(() => assets.reduce((sum: number, asset: any) => sum + (asset.currency === 'EUR' ? assetValue(asset) * 11.55 : assetValue(asset)), 0), [assets]);

  const handleAddAsset = () => {
    if (!newAsset.name || !(newAsset.currentValue ?? newAsset.value)) return;
    const currentValue = Number(newAsset.currentValue ?? newAsset.value ?? 0);
    const assetToAdd: any = {
      id: `asset-${Date.now()}`,
      name: newAsset.name || '',
      type: newAsset.type as any || 'Property',
      category: newAsset.category || 'REAL_ESTATE',
      location: newAsset.location || '',
      purchasePrice: Number(newAsset.purchasePrice || 0),
      value: currentValue,
      currentValue,
      currency: newAsset.currency as any || 'EUR',
      annualGrowthRate: Number(newAsset.annualGrowthRate || 0),
      purchaseDate: newAsset.purchaseDate || '',
      notes: newAsset.notes
    };
    setAssets([...assets, assetToAdd]);
    setShowAddForm(false);
    setNewAsset({ type: 'Property', category: 'REAL_ESTATE', currency: 'EUR', annualGrowthRate: 4, purchaseDate: new Date().toISOString().split('T')[0] });
  };

  const handleAIAppreciation = async (id: string) => {
    const asset: any = assets.find(a => a.id === id);
    if (!asset || !asset.location || isExpectedCommissionAsset(asset)) return;

    setLoadingAI(id);
    try {
      const result = await estimateAssetGrowth(asset.type || asset.category || 'Property', asset.location);
      setAssets(prev => (prev as any[]).map(a => 
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

  const assetToDelete: any = assets.find(a => a.id === confirmDeleteId);

  return (
    <div className="space-y-6 relative">
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
              Dette vil fjerne verdien på <span className="text-rose-400 font-mono font-bold">{formatCurrency(assetValue(assetToDelete), assetToDelete.currency)}</span> fra din totale formue.
            </p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 border border-white/10 text-slate-100 uppercase text-[10px] font-black tracking-[0.2em] hover:bg-white/5 transition-all">Avbryt</button>
              <button onClick={() => deleteAsset(confirmDeleteId)} className="flex-1 py-3 bg-rose-600 text-white uppercase text-[10px] font-black tracking-[0.2em] hover:shadow-[0_0_25px_rgba(225,29,72,0.6)] transition-all">Bekreft Sletting</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
            <Landmark className="text-yellow-400" /> Eiendels-register
          </h3>
          <p className="mt-1 text-xs text-slate-500">Samlet verdi: {formatCurrency(Math.round(totalAssetValueNok) as any, 'NOK' as Currency)}</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {commissionSyncNote && <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{commissionSyncNote}</span>}
          <CyberButton onClick={syncExpectedPropertyCommissions} variant="ghost" className="text-[10px]" disabled={loadingCommissions as any}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingCommissions ? 'animate-spin' : ''}`} />
            Hent provisjoner
          </CyberButton>
          <CyberButton onClick={() => setShowAddForm(!showAddForm)} variant="ghost" className="text-[10px]">
              {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showAddForm ? 'Lukk' : 'Ny Eiendel'}
          </CyberButton>
        </div>
      </div>

      {showAddForm && (
        <div className="glass-panel p-6 border-l-4 border-l-yellow-500 animate-in slide-in-from-top-4 bg-yellow-500/5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Navn</label>
                    <input value={newAsset.name || ''} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" placeholder="F.eks Casa Anna" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Type</label>
                    <select value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value as any, category: e.target.value === 'Vehicle' ? 'VEHICLE' : e.target.value === 'Other' ? 'OTHER' : 'REAL_ESTATE'})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none">
                        <option value="Property">Bolig</option>
                        <option value="Land">Tomt</option>
                        <option value="Vehicle">Bil / Kjøretøy</option>
                        <option value="Other">Annet</option>
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Lokasjon</label>
                    <input value={newAsset.location || ''} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" placeholder="F.eks Pinoso, Spania" />
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Nåverdi</label>
                    <div className="flex gap-2">
                        <input type="number" value={newAsset.currentValue ?? newAsset.value ?? ''} onChange={e => setNewAsset({...newAsset, currentValue: Number(e.target.value), value: Number(e.target.value)})} className="flex-1 bg-black border border-white/10 p-2 text-white text-xs outline-none focus:border-yellow-500" />
                        <select value={newAsset.currency} onChange={e => setNewAsset({...newAsset, currency: e.target.value as any})} className="bg-black border border-white/10 p-2 text-yellow-400 text-xs font-bold outline-none">
                            <option value="EUR">EUR</option>
                            <option value="NOK">NOK</option>
                        </select>
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[9px] uppercase text-slate-500 font-black tracking-widest">Årlig Vekst %</label>
                    <input type="number" step="0.1" value={newAsset.annualGrowthRate || 0} onChange={e => setNewAsset({...newAsset, annualGrowthRate: Number(e.target.value)})} className="w-full bg-black border border-white/10 p-2 text-white text-xs outline-none" />
                </div>
            </div>
            <CyberButton onClick={handleAddAsset} className="w-full py-3">Lagre Eiendel i Registeret</CyberButton>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(assets as any[]).map(asset => {
          const isCommissionAsset = isExpectedCommissionAsset(asset);
          return (
          <div key={asset.id} className="glass-panel p-6 border-l-4 border-l-yellow-500 relative group overflow-hidden hover:border-l-yellow-400 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {asset.type === 'Vehicle' ? <Car className="w-16 h-16" /> : <Home className="w-16 h-16" />}
            </div>
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">{asset.name}</h4>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">
                  <MapPin className="w-3 h-3 text-yellow-500" /> {asset.location || (isCommissionAsset ? 'RealtyFlow' : '')}
                </div>
              </div>
              <div className="flex gap-2 relative z-10">
                {isCommissionAsset ? (
                  <button onClick={syncExpectedPropertyCommissions} disabled={loadingCommissions} className="p-2 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all" title="Oppdater fra RealtyFlow">
                    <RefreshCw className={`w-4 h-4 ${loadingCommissions ? 'animate-spin' : ''}`} />
                  </button>
                ) : (
                  <button onClick={() => handleAIAppreciation(asset.id)} disabled={loadingAI === asset.id} className="p-2 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all" title="AI Estimering">
                    {loadingAI === asset.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </button>
                )}
                <button onClick={() => setConfirmDeleteId(asset.id)} className="p-2 border border-white/10 text-slate-600 hover:text-rose-500 hover:border-rose-500/50 transition-all" title="Fjern eiendel">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                <div>
                    <p className="text-[9px] uppercase text-slate-500 font-black mb-1">Nåverdi</p>
                    <p className="text-2xl font-black text-white font-mono">{formatCurrency(assetValue(asset), asset.currency)}</p>
                </div>
                <div>
                    <p className="text-[9px] uppercase text-slate-500 font-black mb-1">{isCommissionAsset ? 'Kilde' : 'Årlig Vekst'}</p>
                    <p className={`text-lg font-black font-mono ${isCommissionAsset ? 'text-yellow-400' : (Number(asset.annualGrowthRate || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                        {isCommissionAsset ? 'RealtyFlow' : `${Number(asset.annualGrowthRate || 0) > 0 ? '+' : ''}${Number(asset.annualGrowthRate || 0)}%`}
                    </p>
                </div>
            </div>

            {asset.notes && (
                <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-sm relative z-10">
                    <p className="text-[9px] uppercase text-yellow-500 font-black mb-1 flex items-center gap-1">
                        <Sparkles className="w-2 h-2" /> {isCommissionAsset ? 'Provisjonsgrunnlag' : 'AI Innsikt'}
                    </p>
                    <p className="text-[10px] text-slate-400 italic leading-tight whitespace-pre-line">{String(asset.notes).slice(0, 240)}{String(asset.notes).length > 240 ? '...' : ''}</p>
                </div>
            )}
          </div>
        );})}
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
