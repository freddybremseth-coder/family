
import React, { useState } from 'react';
import { UserConfig, Currency, Language } from '../types';
import { CyberButton } from './CyberButton';
import { translations } from '../translations';
import { 
  Settings2, Home, Globe, MapPin, Key, CreditCard, Save, 
  Link as LinkIcon, AlertCircle, ShieldCheck, Zap
} from 'lucide-react';

interface Props {
  userConfig: UserConfig;
  setUserConfig: React.Dispatch<React.SetStateAction<UserConfig>>;
  onApiUpdate: () => void;
}

export const SettingsManager: React.FC<Props> = ({ userConfig, setUserConfig, onApiUpdate }) => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
  const [saved, setSaved] = useState(false);
  const t = translations[userConfig.language];

  const handleSave = () => {
    // Lagre API-nøkkel lokalt
    if (apiKey) {
      localStorage.setItem('user_gemini_api_key', apiKey);
    } else {
      localStorage.removeItem('user_gemini_api_key');
    }
    
    // Trigger re-check i hovedappen
    onApiUpdate();
    
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-8 duration-500">
      <div className="glass-panel p-10 border-l-4 border-l-cyan-500 bg-cyan-500/5">
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

      <div className="glass-panel p-10 border-l-4 border-l-yellow-500 bg-yellow-500/5">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
          <Key className="text-yellow-400 w-6 h-6" /> AI & Neural Engine (BYOK)
        </h3>
        <div className="space-y-6">
          <p className="text-xs text-slate-400 italic leading-relaxed">
            For å aktivere avanserte funksjoner som kvitteringsskanning (OCR), ukemeny-generering og strategisk rådgivning, må du koble til din egen Gemini API-nøkkel.
          </p>
          
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Gemini API Key</label>
            <div className="relative">
              <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-500" />
              <input 
                type="password"
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                className="w-full bg-black border border-white/10 pl-12 pr-6 py-4 text-white text-sm outline-none focus:border-yellow-500 transition-all font-mono" 
                placeholder="Lim inn din nøkkel her..."
              />
            </div>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Nøkkelen lagres kun lokalt i din nettleser.</p>
          </div>

          <div className="p-5 bg-black/40 border border-yellow-500/20 space-y-4">
            <h4 className="text-[10px] font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Slik får du tak i en nøkkel:
            </h4>
            <ol className="text-[10px] text-slate-300 space-y-2 font-mono uppercase">
              <li>1. Gå til <a href="https://aistudio.google.com" target="_blank" className="text-cyan-400 underline">Google AI Studio</a></li>
              <li>2. Logg inn med din Google-konto</li>
              <li>3. Klikk "Create API Key" og kopier koden</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <CyberButton onClick={handleSave} className="px-20 py-5 flex items-center gap-3 shadow-[0_0_30px_rgba(0,243,255,0.2)]">
          {saved ? <ShieldCheck className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? 'Innstilinger Lagret!' : 'Lagre Systemoppsett'}
        </CyberButton>
      </div>
    </div>
  );
};
