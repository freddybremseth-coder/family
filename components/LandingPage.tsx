
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { CyberButton } from './CyberButton';
import { translations } from '../translations';
import { Language } from '../types';
import { 
  ShieldCheck, Cpu, Zap, CreditCard, Lock, Mail, ChevronRight, Globe, 
  Sparkles, Building2, Landmark, Sprout, X, Play, BrainCircuit, 
  Activity, BarChart3, Receipt, Search, Terminal, ArrowRight, Loader2
} from 'lucide-react';

interface Props {
  onLogin: (credentials: { email: string, password?: string }) => void;
  lang: Language;
  setLang: (l: Language) => void;
}

const SystemSimulation = () => {
  const [step, setStep] = useState(0);
  const [logs, setLogs] = useState<string[]>(['[SYSTEM]: Initializing Neural Interface...']);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => (s + 1) % 4);
    }, 4000);

    const logTimer = setInterval(() => {
      const messages = [
        "[DATA]: Syncing bank accounts...",
        "[AI]: Analyzing real estate portfolio...",
        "[SCAN]: Processing olive yield forecast...",
        "[SECURE]: Encrypting family assets...",
        "[NEURAL]: Strategic advice generated."
      ];
      setLogs(prev => [...prev.slice(-4), messages[Math.floor(Math.random() * messages.length)]]);
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(logTimer);
    };
  }, []);

  return (
    <div className="w-full h-full bg-black relative flex flex-col overflow-hidden font-mono">
      <div className="p-4 border-b border-cyan-500/30 flex justify-between items-center bg-black/50 z-10">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">System Demo Mode // Live Simulation</span>
        </div>
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-slate-800" />
        </div>
      </div>

      <div className="flex-1 p-6 relative">
        {step === 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-700">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border border-cyan-500/20 bg-cyan-500/5">
                   <p className="text-[8px] text-slate-500 uppercase">Netto Likviditet</p>
                   <p className="text-xl font-black text-white">€ 142,500</p>
                </div>
                <div className="p-4 border border-magenta-500/20 bg-magenta-500/5">
                   <p className="text-[8px] text-slate-500 uppercase">Formuesverdi</p>
                   <p className="text-xl font-black text-white">€ 1,204,000</p>
                </div>
             </div>
             <div className="p-6 border border-white/10 bg-white/5">
                <p className="text-[9px] text-slate-400 uppercase mb-2">Neural Insight:</p>
                <p className="text-xs text-white italic">"Optimal likviditet funnet."</p>
             </div>
          </div>
        )}

        {step === 1 && (
          <div className="h-full flex flex-col justify-center items-center space-y-6 animate-in zoom-in-95 duration-700">
             <div className="relative w-48 h-64 border-2 border-dashed border-cyan-500/50 p-4 bg-cyan-500/5">
                <div className="w-full h-1 bg-cyan-500 absolute top-0 left-0 animate-[scan_2s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Receipt className="w-12 h-12 text-cyan-400" />
                </div>
             </div>
             <p className="text-xs font-black text-cyan-400 uppercase tracking-widest">Digitaliserer...</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
             <h4 className="text-sm font-black uppercase">Landbruk: Dona Anna</h4>
             <div className="grid grid-cols-3 gap-2">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className={`aspect-square border border-white/10 ${i % 3 === 0 ? 'bg-emerald-500/20' : 'bg-black'}`} />
                ))}
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-700">
             <h4 className="text-sm font-black uppercase">Eiendomsportefølje</h4>
             <div className="space-y-4">
                {[
                  { name: "CASA ANNA", value: "€ 420,000" },
                  { name: "VILLA PINOSO", value: "€ 315,000" }
                ].map((p, i) => (
                  <div key={i} className="p-4 border border-white/10 bg-white/5 flex justify-between items-center">
                     <p className="text-[10px] font-black text-white uppercase">{p.name}</p>
                     <p className="text-sm font-black text-white">{p.value}</p>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-black border-t border-white/5 text-[8px] font-mono text-slate-600">
         <div className="flex flex-col gap-1">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                 <span className="text-cyan-500/50">[{new Date().toLocaleTimeString()}]</span>
                 <span className={i === logs.length - 1 ? 'text-cyan-400 animate-pulse' : ''}>{log}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC<Props> = ({ onLogin, lang, setLang }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { family_name: familyName }
        }
      });
      if (error) alert(error.message);
      else alert("Sjekk e-posten din for bekreftelseslenke!");
    } else {
      await onLogin({ email, password });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500 selection:text-black">
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 py-4 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-500 flex items-center justify-center bg-black shadow-[0_0_15px_#00f3ff]">
             <Zap className="text-cyan-400 w-6 h-6" />
          </div>
          <h1 className="text-lg font-black tracking-widest uppercase">CASA CORE</h1>
        </div>
        <div className="flex gap-4 items-center">
           <div className="hidden md:flex gap-2">
              {(['no', 'en', 'es', 'ru', 'fr', 'de'] as Language[]).map(l => (
                <button 
                  key={l} 
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-[10px] font-black uppercase border transition-all ${lang === l ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10' : 'border-white/10 text-slate-500 hover:text-slate-300'}`}
                >
                  {l}
                </button>
              ))}
           </div>
           <CyberButton onClick={() => setShowAuth(true)} className="text-[10px] px-6">{t.login}</CyberButton>
        </div>
      </nav>

      <section className="pt-40 pb-20 px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="space-y-10">
          <div className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">
             System Alpha v.2.5 - Live
          </div>
          <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-none">
            Ta Kontroll Over <span className="text-cyan-400 italic">Din Arv.</span>
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed max-w-lg">
            Den ultimate plattformen for moderne familier og eiendomsinvestorer. Full oversikt over likviditet, eiendom, landbruk og AI-drevet økonomisk styring.
          </p>
          <div className="flex gap-4">
             <CyberButton onClick={() => { setAuthMode('signup'); setShowAuth(true); }} className="py-5 px-10">Kom i gang</CyberButton>
             <button onClick={() => setShowVideo(true)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-all group">
                Se system-demo <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
          </div>
        </div>
        <div className="relative group">
           <div className="glass-panel border-cyan-500/30 p-8 rotate-2 hover:rotate-0 transition-transform duration-700">
              <div className="aspect-video bg-black/80 border border-white/5 flex items-center justify-center relative overflow-hidden">
                 <Cpu className="w-16 h-16 text-cyan-500 relative z-10 animate-pulse" />
              </div>
           </div>
        </div>
      </section>

      {showVideo && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={() => setShowVideo(false)} />
          <div className="glass-panel w-full max-w-5xl border-t-4 border-cyan-500 relative overflow-hidden aspect-video shadow-[0_0_100px_rgba(0,243,255,0.2)]">
            <div className="absolute top-4 right-4 z-20">
               <button onClick={() => setShowVideo(false)} className="p-2 bg-black/50 border border-white/10 text-white hover:text-cyan-400 transition-all">
                  <X className="w-6 h-6" />
               </button>
            </div>
            <SystemSimulation />
          </div>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowAuth(false)} />
          <div className="glass-panel w-full max-w-md p-10 border-t-4 border-cyan-500 animate-in zoom-in-95 duration-300">
            <div className="text-center mb-10">
               <h3 className="text-3xl font-black uppercase tracking-tighter">
                  {authMode === 'login' ? t.login : authMode === 'signup' ? t.signup : t.forgot_password}
               </h3>
               <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-2">Neural Link Authentication</p>
            </div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              {authMode === 'signup' && (
                <div className="space-y-2">
                   <label className="text-[9px] uppercase font-black text-slate-500">{t.family_name}</label>
                   <input value={familyName} onChange={e => setFamilyName(e.target.value)} required className="w-full bg-black border border-white/10 pl-4 pr-4 py-3 text-sm focus:border-cyan-500 outline-none" placeholder="F.eks BREMSETH" />
                </div>
              )}
              <div className="space-y-2">
                 <label className="text-[9px] uppercase font-black text-slate-500">E-post</label>
                 <input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="w-full bg-black border border-white/10 pl-4 pr-4 py-3 text-sm focus:border-cyan-500 outline-none" placeholder="navn@domene.com" />
              </div>

              {authMode !== 'forgot' && (
                <div className="space-y-2">
                   <label className="text-[9px] uppercase font-black text-slate-500">Passord</label>
                   <input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="w-full bg-black border border-white/10 pl-4 pr-4 py-3 text-sm focus:border-cyan-500 outline-none" />
                </div>
              )}

              <CyberButton disabled={loading} className="w-full py-4 uppercase">
                 {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (authMode === 'login' ? t.login : authMode === 'signup' ? t.signup : 'Send Reset Link')}
              </CyberButton>

              <div className="flex justify-between items-center pt-4">
                 {authMode === 'login' ? (
                   <>
                      <button type="button" onClick={() => setAuthMode('forgot')} className="text-[9px] uppercase font-black text-slate-500 hover:text-white">{t.forgot_password}</button>
                      <button type="button" onClick={() => setAuthMode('signup')} className="text-[9px] uppercase font-black text-cyan-400 hover:underline">Ny bruker? Registrer her</button>
                   </>
                 ) : (
                   <button type="button" onClick={() => setAuthMode('login')} className="text-[9px] uppercase font-black text-cyan-400 hover:underline w-full text-center">Tilbake til innlogging</button>
                 )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
