
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured } from './supabase';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ShoppingList } from './components/ShoppingList';
import { TransactionManager } from './components/TransactionManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { BillsManager } from './components/BillsManager';
import { BusinessManager } from './components/BusinessManager';
import { BankManager } from './components/BankManager';
import { AssetManager } from './components/AssetManager';
import { FamilyCalendar } from './components/FamilyCalendar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SettingsManager } from './components/SettingsManager';
import { ResidentsManager } from './components/ResidentsManager';
import { NAVIGATION } from './constants';
import { Transaction, TransactionType, Bill, RealEstateDeal, AfterSaleCommission, FarmOperation, BankAccount, Developer, Asset, GroceryItem, FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig, ScannedReceipt, Language, UserRole } from './types';
import { translations } from './translations';
import { Home, Globe, LogOut, ShieldCheck, Loader2, AlertCircle, Key } from 'lucide-react';
import { isAiAvailable } from './services/geminiService';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cashBalance, setCashBalance] = useState(4250);
  
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState<any[]>([]);
  const [scannedReceipts, setScannedReceipts] = useState<ScannedReceipt[]>([]);
  const [aiConfigured, setAiConfigured] = useState(isAiAvailable());

  const [userConfig, setUserConfig] = useState<UserConfig>({
    familyName: 'LEDGER',
    location: 'Benidorm, Spain',
    timezone: 'Europe/Madrid',
    preferredCurrency: 'EUR',
    language: 'no',
    role: UserRole.USER,
    subscriptionStatus: 'Active'
  });

  const t = translations[userConfig.language] || translations['no'];

  useEffect(() => {
    try {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) handleRoleAssignment(session.user);
        setLoading(false);
      }).catch(err => {
        setLoading(false);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) handleRoleAssignment(session.user);
      });

      return () => subscription?.unsubscribe();
    } catch (e) {
      setLoading(false);
    }
  }, []);

  const handleRoleAssignment = (user: any) => {
    if (user.email === 'freddy.bremseth@gmail.com') {
      setUserConfig(prev => ({
        ...prev,
        familyName: 'BREMSETH',
        role: UserRole.SUPER_ADMIN,
        subscriptionStatus: 'Lifetime'
      }));
    } else {
      setUserConfig(prev => ({
        ...prev,
        familyName: user.user_metadata?.family_name || 'FAMILY',
        role: UserRole.USER,
        subscriptionStatus: 'Active'
      }));
    }
  };

  const handleLogin = async (credentials: { email: string, password?: string }) => {
    if (!isSupabaseConfigured()) {
      if (credentials.email === 'freddy.bremseth@gmail.com' && credentials.password === 'AllFamily1!') {
        setSession({ user: { email: credentials.email } });
        handleRoleAssignment({ email: credentials.email });
      } else {
        alert("Demo-modus: Bruk admin-epost for å logge inn.");
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password || '',
    });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setSession(null);
  };

  // Data states
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: 'fm-1', name: 'Freddy', birthDate: '1975-04-12', monthlySalary: 45000, monthlyBenefits: 0, monthlyChildBenefit: 0 },
    { id: 'fm-2', name: 'Anna', birthDate: '1980-08-25', monthlySalary: 32000, monthlyBenefits: 5000, monthlyChildBenefit: 0 },
    { id: 'fm-3', name: 'Victoria', birthDate: '2015-01-10', monthlySalary: 0, monthlyBenefits: 0, monthlyChildBenefit: 1700 },
  ]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    { id: 'bank-1', name: 'Hovedkonto DNB', balance: 50000, currency: 'NOK', lastReconciledDate: '2023-10-31' },
    { id: 'bank-2', name: 'Caixa Spania', balance: 15000, currency: 'EUR', lastReconciledDate: '2023-10-20' },
  ]);
  const [assets, setAssets] = useState<Asset[]>([
    { id: 'a1', name: 'Enebolig Pinoso', type: 'Property', location: 'Pinoso, Alicante', purchasePrice: 350000, currentValue: 420000, currency: 'EUR', annualGrowthRate: 4.2, purchaseDate: '2021-05-10' },
  ]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([
    { id: 'dev-asencio', name: 'Asencio Homes', defaultCommissionPct: 5, payoutPhases: [] },
  ]);
  const [realEstateDeals, setRealEstateDeals] = useState<RealEstateDeal[]>([]);
  const [afterSales, setAfterSales] = useState<AfterSaleCommission[]>([]);
  const [farmOps, setFarmOps] = useState<FarmOperation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  const handleNewScannedReceipt = (data: any, imageUrl: string) => {
    const transactionId = `tx-rcpt-${Date.now()}`;
    const newT: Transaction = {
      id: transactionId,
      date: data.date || new Date().toISOString().split('T')[0],
      amount: data.totalAmount,
      currency: 'EUR',
      description: data.vendor,
      category: 'Shopping',
      type: TransactionType.EXPENSE,
      paymentMethod: 'Kontant',
      isAccrual: false
    };
    setTransactions(prev => [newT, ...prev]);
    setCashBalance(prev => prev - data.totalAmount);
    setActiveTab('transactions');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'superadmin': return <SuperAdminDashboard />;
      case 'dashboard': return (
        <Dashboard 
          transactions={transactions} 
          realEstateDeals={realEstateDeals}
          bankAccounts={bankAccounts}
          assets={assets}
          lang={userConfig.language}
        />
      );
      case 'shopping': return (
        <ShoppingList 
          cashBalance={cashBalance} 
          groceryItems={groceryItems} 
          setGroceryItems={setGroceryItems}
          weeklyMenu={weeklyMenu}
          setWeeklyMenu={setWeeklyMenu}
        />
      );
      case 'familyplan': return (
        <FamilyCalendar
          familyMembers={familyMembers}
          calendarEvents={calendarEvents}
          setCalendarEvents={setCalendarEvents}
          tasks={tasks}
          setTasks={setTasks}
          userConfig={userConfig}
          localEvents={localEvents}
          setLocalEvents={setLocalEvents}
        />
      );
      case 'members': return (
        <ResidentsManager 
          familyMembers={familyMembers} 
          setFamilyMembers={setFamilyMembers} 
          lang={userConfig.language}
        />
      );
      case 'settings': return (
        <SettingsManager 
          userConfig={userConfig} 
          setUserConfig={setUserConfig} 
          onApiUpdate={() => setAiConfigured(isAiAvailable())}
        />
      );
      case 'bank': return (
        <div className="space-y-12">
            <BankManager bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} transactions={transactions} setTransactions={setTransactions} />
            <AssetManager assets={assets} setAssets={setAssets} />
        </div>
      );
      case 'business': return (
        <BusinessManager 
          deals={realEstateDeals} setDeals={setRealEstateDeals}
          afterSales={afterSales} setAfterSales={setAfterSales}
          farmOps={farmOps} setFarmOps={setFarmOps}
          developers={developers} setDevelopers={setDevelopers}
          afterSalePartners={[]} setAfterSalePartners={() => {}}
          transactions={transactions} setTransactions={setTransactions}
          bankAccounts={bankAccounts}
        />
      );
      case 'transactions': return (
        <TransactionManager 
          transactions={transactions} setTransactions={setTransactions} 
          bankAccounts={bankAccounts} setBankAccounts={setBankAccounts}
          deals={realEstateDeals} setDeals={setRealEstateDeals}
          afterSales={afterSales} setAfterSales={setAfterSales}
          cashBalance={cashBalance} setCashBalance={setCashBalance}
        />
      );
      case 'receipts': return <ReceiptScanner receipts={scannedReceipts} onScan={handleNewScannedReceipt} />;
      case 'trends': return <BillsManager bills={bills} setBills={setBills} />;
      default: return <Dashboard transactions={transactions} bankAccounts={bankAccounts} assets={assets} lang={userConfig.language} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <p className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.4em]">Initializing Core...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black">
        {!isSupabaseConfigured() && (
          <div className="fixed top-0 left-0 right-0 z-[200] bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 flex items-center justify-center gap-2">
            <AlertCircle className="w-3 h-3" /> Supabase demo-modus
          </div>
        )}
        <LandingPage onLogin={handleLogin} lang={userConfig.language} setLang={(l) => setUserConfig({...userConfig, language: l})} />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-black text-slate-200">
      {!aiConfigured && (
        <button 
          onClick={() => setActiveTab('settings')}
          className="fixed top-0 left-0 right-0 z-[300] bg-yellow-500 text-black text-[9px] font-black uppercase tracking-[0.2em] py-1 px-4 flex items-center justify-center gap-2 hover:bg-yellow-400 transition-all"
        >
          <Key className="w-3 h-3" /> AI Engine Offline (Klikk her for å konfigurere API-nøkkel)
        </button>
      )}
      <nav className="w-full md:w-64 glass-panel border-r border-cyan-500/30 p-6 space-y-8 z-10">
        <div className="flex items-center gap-3 mb-10 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="relative w-12 h-12 bg-black border-2 border-cyan-500 flex items-center justify-center shadow-[0_0_15px_#00f3ff] overflow-hidden">
            <Home className="text-cyan-400 w-8 h-8 group-hover:scale-110 transition-transform" />
            <div className="absolute bottom-0 right-0 bg-cyan-500 text-black text-[8px] font-black px-1 uppercase tracking-tighter">CB</div>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase leading-none">CASA<br /><span className="text-cyan-400">{userConfig.familyName}</span></h1>
            <p className="text-[8px] font-bold text-slate-500 tracking-[0.3em] uppercase mt-1">
              {userConfig.role === UserRole.SUPER_ADMIN ? 'COMMAND CENTER' : 'FINANS'}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          {userConfig.role === UserRole.SUPER_ADMIN && (
            <button
              onClick={() => setActiveTab('superadmin')}
              className={`w-full flex items-center gap-4 px-4 py-3 transition-all duration-300 ${
                activeTab === 'superadmin' 
                  ? 'bg-purple-500/20 border-l-4 border-purple-400 text-purple-400 shadow-[inset_0_0_10px_rgba(168,85,247,0.1)]' 
                  : 'text-purple-500/60 hover:text-purple-400 hover:bg-white/5'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
              <span className="font-black uppercase tracking-wider text-xs">Super Admin</span>
            </button>
          )}

          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 transition-all duration-300 ${
                activeTab === item.id 
                  ? 'bg-cyan-500/20 border-l-4 border-cyan-400 text-cyan-400 shadow-[inset_0_0_10px_rgba(0,243,255,0.1)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="font-medium uppercase tracking-wider text-sm">{t[item.id] || item.label}</span>
            </button>
          ))}
        </div>

        <div className="pt-8 border-t border-white/10">
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-4 px-4 py-3 text-rose-500 hover:bg-rose-500/10 transition-all uppercase text-[10px] font-black tracking-widest"
           >
              <LogOut className="w-4 h-4" /> {t.logout}
           </button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">
              {activeTab === 'superadmin' ? 'Business Operations' : (t[activeTab] || NAVIGATION.find(n => n.id === activeTab)?.label)}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {userConfig.role === UserRole.SUPER_ADMIN ? 'MASTER SYSTEM ADMIN' : t.operational_status} // {new Date().toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US')}
            </p>
          </div>
          <div className="flex gap-4">
            {familyMembers.map(member => (
              <div key={member.id} className="w-10 h-10 rounded-full border border-cyan-500 flex items-center justify-center overflow-hidden bg-black/50">
                <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member.name}`} alt={member.name} />
              </div>
            ))}
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
