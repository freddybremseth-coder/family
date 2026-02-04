
import React, { useState } from 'react';
import { CyberButton } from './CyberButton';
import { translations } from '../translations';
import { Language } from '../types';
import { ShieldCheck, Cpu, Zap, CreditCard, Lock, Mail, ChevronRight, Globe, Sparkles, Building2, Landmark, Sprout } from 'lucide-react';

interface Props {
  onLogin: () => void;
  lang: Language;
  setLang: (l: Language) => void;
}

export const LandingPage: React.FC<Props> = ({ onLogin, lang, setLang }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500 selection:text-black">
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/5 py-4 px-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border-2 border-cyan-500 flex items-center justify-center bg-black shadow-[0_0_15px_#00f3ff]">
             <Zap className="text-cyan-400 w-6 h-6" />
          </div>
          <h1 className="text-lg font-black tracking-widest uppercase">CASA BREMSETH</h1>
        </div>
        <div className="flex gap-4 items-center">
           <div className="hidden md:flex gap-2">
              {(['no', 'en', 'es'] as Language[]).map(l => (
                <button 
                  key={l} 
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 text-[10px] font-black uppercase border ${lang === l ? 'border-cyan-500 text-cyan-400' : 'border-white/10 text-slate-500'}`}
                >
                  {l}
                </button>
              ))}
           </div>
           <CyberButton onClick={() => setShowAuth(true)} className="text-[10px] px-6">{t.login}</CyberButton>
        </div>
      </nav>

      {/* HERO */}
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
             <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all">
                Se demovideo <ChevronRight className="w-4 h-4" />
             </button>
          </div>
        </div>
        <div className="relative group">
           <div className="absolute -inset-4 bg-cyan-500/10 blur-3xl opacity-20 group-hover:opacity-40 transition-all"></div>
           <div className="glass-panel border-cyan-500/30 p-8 rotate-2 hover:rotate-0 transition-transform duration-700">
              <div className="aspect-video bg-black/80 border border-white/5 flex items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"></div>
                 <div className="grid grid-cols-2 gap-4 p-8 w-full h-full opacity-60">
                    <div className="bg-white/5 border border-white/10"></div>
                    <div className="bg-white/5 border border-white/10"></div>
                    <div className="bg-white/5 border border-white/10 col-span-2"></div>
                 </div>
                 <Cpu className="w-16 h-16 text-cyan-500 relative z-10 animate-pulse" />
              </div>
           </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="py-32 px-8 bg-black/40">
         <div className="max-w-7xl mx-auto text-center mb-20">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-[0.5em] mb-4">Abonnement</h3>
            <h2 className="text-4xl font-black uppercase tracking-tight">Klarhet har en pris.</h2>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="glass-panel p-10 border-l-4 border-l-white/20 hover:border-l-cyan-500 transition-all group">
               <h4 className="text-xl font-black uppercase mb-2">Månedlig</h4>
               <p className="text-4xl font-black font-mono mb-6">{t.pricing_monthly}</p>
               <ul className="space-y-4 text-slate-400 text-sm mb-10">
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Inntil 5 familiemedlemmer</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> AI Kvitteringsscan</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Landbruks-prognoser</li>
               </ul>
               <CyberButton onClick={() => setShowAuth(true)} className="w-full">Velg Månedlig</CyberButton>
            </div>
            <div className="glass-panel p-10 border-l-4 border-l-magenta-500 bg-magenta-500/5 relative overflow-hidden">
               <div className="absolute top-4 right-4 bg-magenta-500 text-black text-[8px] font-black px-2 py-1 uppercase">Best Verdi</div>
               <h4 className="text-xl font-black uppercase mb-2">Årlig</h4>
               <p className="text-4xl font-black font-mono mb-6">{t.pricing_annual}</p>
               <ul className="space-y-4 text-slate-400 text-sm mb-10">
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Alt i månedlig</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Prioritert AI-prosessering</li>
                  <li className="flex items-center gap-3"><ShieldCheck className="w-4 h-4 text-emerald-500" /> 2 måneder gratis</li>
               </ul>
               <CyberButton onClick={() => setShowAuth(true)} variant="secondary" className="w-full">Velg Årlig</CyberButton>
            </div>
         </div>
         <p className="text-center text-[10px] text-slate-600 uppercase font-black tracking-widest mt-10">
            {t.pricing_extra}
         </p>
      </section>

      {/* AUTH MODAL */}
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
            
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
              <div className="space-y-2">
                 <label className="text-[9px] uppercase font-black text-slate-500">E-post</label>
                 <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
                    <input type="email" required className="w-full bg-black border border-white/10 pl-10 pr-4 py-3 text-sm focus:border-cyan-500 outline-none transition-all" placeholder="navn@domene.com" />
                 </div>
              </div>

              {authMode !== 'forgot' && (
                <div className="space-y-2">
                   <label className="text-[9px] uppercase font-black text-slate-500">Passord</label>
                   <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400/50" />
                      <input type="password" required className="w-full bg-black border border-white/10 pl-10 pr-4 py-3 text-sm focus:border-cyan-500 outline-none transition-all" />
                   </div>
                </div>
              )}

              <CyberButton className="w-full py-4 uppercase">
                 {authMode === 'login' ? t.login : authMode === 'signup' ? t.signup : 'Send Reset Link'}
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
