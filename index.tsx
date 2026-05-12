
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured } from './supabase';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ShoppingList } from './components/ShoppingList';
import { TransactionManager } from './components/TransactionManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { BillsManager } from './components/BillsManager';
import { BusinessManagerClean as BusinessManager } from './components/BusinessManagerClean';
import { BankManager } from './components/BankManager';
import { AssetManager } from './components/AssetManager';
import { FamilyCalendar } from './components/FamilyCalendar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SettingsManager } from './components/SettingsManager';
import { ResidentsManager } from './components/ResidentsManager';
import { PaywallModal } from './components/PaywallModal';
import { NAVIGATION } from './constants';
import {
  Transaction, TransactionType, Bill, RealEstateDeal, AfterSaleCommission,
  FarmOperation, BankAccount, Developer, Asset, GroceryItem, FamilyMember,
  CalendarEvent, Task, LocalEvent, UserConfig, ScannedReceipt, Language, UserRole
} from './types';
import { translations } from './translations';
import {
  Heart, LogOut, ShieldCheck, Loader2, AlertCircle, Key, Menu, X, Crown,
  LayoutDashboard, ShoppingCart, CalendarDays, CreditCard, MoreHorizontal,
} from 'lucide-react';
import { isAiAvailable } from './services/geminiService';

const ADMIN_EMAIL = 'freddy.bremseth@gmail.com';
const TRIAL_DAYS = 3;

const getTrialDaysLeft = (trialStartedAt: string): number => {
  const start = new Date(trialStartedAt).getTime();
  const now = Date.now();
  const elapsed = (now - start) / (1000 * 60 * 60 * 24);
  return Math.ceil(TRIAL_DAYS - elapsed);
};

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cashBalance, setCashBalance] = useState(4250);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('trial');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(TRIAL_DAYS);
  const [showPaywall, setShowPaywall] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.search.includes('recover=1') ||
      window.location.hash.includes('type=recovery')
    );
  });
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<string>('');

  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState<any[]>([]);
  const [scannedReceipts, setScannedReceipts] = useState<ScannedReceipt[]>([]);
  const [aiConfigured, setAiConfigured] = useState(isAiAvailable());

  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([
    { id: 'dev-default', name: 'Standard Utvikler', defaultCommissionPct: 5, payoutPhases: [] },
  ]);
  const [realEstateDeals, setRealEstateDeals] = useState<RealEstateDeal[]>([]);
  const [afterSales, setAfterSales] = useState<AfterSaleCommission[]>([]);
  const [farmOps, setFarmOps] = useState<FarmOperation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  const [userConfig, setUserConfig] = useState<UserConfig>({
    familyName: 'FAMILIE',
    location: '',
    timezone: 'Europe/Oslo',
    preferredCurrency: 'NOK',
    language: 'no',
    role: UserRole.USER,
    subscriptionStatus: 'Active',
  });

  const t = translations[userConfig.language] || translations['no'];

  const fetchAllData = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) return;

    const { data: txData } = await supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false });
    if (txData) setTransactions(txData);

    const { data: reData } = await supabase.from('real_estate_deals').select('*').eq('user_id', userId);
    if (reData) setRealEstateDeals(reData);

    const { data: farmData } = await supabase.from('farm_operations').select('*').eq('user_id', userId);
    if (farmData) setFarmOps(farmData);

    const { data: residentData } = await supabase.from('members').select('*').eq('user_id', userId);
    if (residentData && residentData.length > 0) setFamilyMembers(residentData);
  }, []);

  const checkSubscription = useCallback(async (user: any) => {
    if (user.email === ADMIN_EMAIL) {
      setSubscriptionStatus('lifetime');
      return;
    }
    if (!isSupabaseConfigured()) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_status, trial_started_at')
      .eq('id', user.id)
      .single();

    if (!profile) {
      await supabase.from('user_profiles').insert({ id: user.id });
      setSubscriptionStatus('trial');
      setTrialDaysLeft(TRIAL_DAYS);
      return;
    }

    setSubscriptionStatus(profile.subscription_status);

    if (profile.subscription_status === 'trial') {
      const daysLeft = getTrialDaysLeft(profile.trial_started_at);
      setTrialDaysLeft(daysLeft);
      if (daysLeft <= 0) setShowPaywall(true);
    }
  }, []);

  useEffect(() => {
    try {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        setFamilyMembers([
          { id: 'fm-1', name: 'Freddy', birthDate: '1975-04-12', monthlySalary: 45000, monthlyBenefits: 0, monthlyChildBenefit: 0 },
          { id: 'fm-2', name: 'Anna', birthDate: '1980-08-25', monthlySalary: 32000, monthlyBenefits: 5000, monthlyChildBenefit: 0 },
        ]);
        return;
      }

      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session?.user) {
          handleRoleAssignment(session.user);
          fetchAllData(session.user.id);
          checkSubscription(session.user);
        }
        setLoading(false);
      }).catch(() => setLoading(false));

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
        if (session?.user) {
          handleRoleAssignment(session.user);
          fetchAllData(session.user.id);
          checkSubscription(session.user);
        }
      });

      return () => subscription?.unsubscribe();
    } catch {
      setLoading(false);
    }
  }, [fetchAllData, checkSubscription]);

  const handleRoleAssignment = (user: any) => {
    if (user.email === ADMIN_EMAIL) {
      setUserConfig(prev => ({ ...prev, familyName: 'BREMSETH', role: UserRole.SUPER_ADMIN, subscriptionStatus: 'Lifetime' }));
    } else {
      setUserConfig(prev => ({ ...prev, familyName: user.user_metadata?.family_name || 'FAMILIE', role: UserRole.USER, subscriptionStatus: 'Active' }));
    }
  };

  const handleLogin = async (credentials: { email: string; password?: string }) => {
    if (!isSupabaseConfigured()) {
      if (credentials.email === ADMIN_EMAIL) {
        setSession({ user: { email: credentials.email, id: 'demo-user' } });
        handleRoleAssignment({ email: credentials.email });
      } else {
        alert('Demo-modus: Bruk admin-e-post for å logge inn, eller konfigurer Supabase.');
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: credentials.email, password: credentials.password || '' });
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured()) await supabase.auth.signOut();
    setSession(null);
  };

  const handleNewScannedReceipt = async (data: any, imageUrl: string) => {
    const newT: any = {
      date: data.date || new Date().toISOString().split('T')[0],
      amount: data.totalAmount,
      currency: userConfig.preferredCurrency,
      description: data.vendor,
      category: 'Shopping',
      type: TransactionType.EXPENSE,
      payment_method: 'Bank',
      user_id: session?.user?.id,
    };

    if (isSupabaseConfigured() && session?.user) await supabase.from('transactions').insert([newT]);
    setTransactions(prev => [{ ...newT, id: `tx-rcpt-${Date.now()}` }, ...prev]);
    setCashBalance(prev => prev - data.totalAmount);
    setActiveTab('transactions');
  };

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'superadmin': return <SuperAdminDashboard />;
      case 'dashboard': return <Dashboard transactions={transactions} bankAccounts={bankAccounts} assets={assets} familyMembers={familyMembers} tasks={tasks} calendarEvents={calendarEvents} groceryCount={groceryItems.filter(i => !i.isBought).length} lang={userConfig.language} userId={session?.user?.id} />;
      case 'shopping': return <ShoppingList cashBalance={cashBalance} groceryItems={groceryItems} setGroceryItems={setGroceryItems} weeklyMenu={weeklyMenu} setWeeklyMenu={setWeeklyMenu} lang={userConfig.language} userId={session?.user?.id} />;
      case 'familyplan': return <FamilyCalendar familyMembers={familyMembers} calendarEvents={calendarEvents} setCalendarEvents={setCalendarEvents} tasks={tasks} setTasks={setTasks} userConfig={userConfig} localEvents={localEvents} setLocalEvents={setLocalEvents} />;
      case 'members': return <ResidentsManager familyMembers={familyMembers} setFamilyMembers={setFamilyMembers} lang={userConfig.language} />;
      case 'settings': return <SettingsManager userConfig={userConfig} setUserConfig={setUserConfig} onApiUpdate={() => setAiConfigured(isAiAvailable())} />;
      case 'bank': return <div className="space-y-8"><BankManager bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} transactions={transactions} setTransactions={setTransactions} /><AssetManager assets={assets} setAssets={setAssets} /></div>;
      case 'business': return <BusinessManager deals={realEstateDeals} setDeals={setRealEstateDeals} afterSales={afterSales} setAfterSales={setAfterSales} farmOps={farmOps} setFarmOps={setFarmOps} developers={developers} setDevelopers={setDevelopers} afterSalePartners={[]} setAfterSalePartners={() => {}} transactions={transactions} setTransactions={setTransactions} bankAccounts={bankAccounts} userId={session?.user?.id} />;
      case 'transactions': return <TransactionManager transactions={transactions} setTransactions={setTransactions as any} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} deals={realEstateDeals} setDeals={setRealEstateDeals} afterSales={afterSales} setAfterSales={setAfterSales} cashBalance={cashBalance} setCashBalance={setCashBalance} />;
      case 'receipts': return <ReceiptScanner receipts={scannedReceipts} onScan={handleNewScannedReceipt} />;
      case 'trends': return <BillsManager bills={bills} setBills={setBills} />;
      default: return <Dashboard transactions={transactions} bankAccounts={bankAccounts} assets={assets} lang={userConfig.language} />;
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#DDE3EE] flex flex-col items-center justify-center gap-4"><div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><Heart className="w-7 h-7 text-white" /></div><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /><p className="text-sm text-slate-400 font-medium">Laster FamilieHub...</p></div>;
  }

  if (!session) {
    return <div className="min-h-screen bg-white"><LandingPage onLogin={handleLogin} lang={userConfig.language} setLang={(l) => setUserConfig({ ...userConfig, language: l })} /></div>;
  }

  const pageTitle = activeTab === 'superadmin' ? 'Admin' : (t[activeTab] || NAVIGATION.find(n => n.id === activeTab)?.label || '');

  return (
    <div className="flex min-h-screen">
      {showPaywall && session?.user && <PaywallModal userEmail={session.user.email} daysLeft={trialDaysLeft} onClose={trialDaysLeft > 0 ? () => setShowPaywall(false) : undefined} lang={userConfig.language} />}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}
      <nav className="bottom-nav md:hidden">
        {[{ id: 'dashboard', icon: <LayoutDashboard /> }, { id: 'shopping', icon: <ShoppingCart /> }, { id: 'familyplan', icon: <CalendarDays /> }, { id: 'transactions', icon: <CreditCard /> }].map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}>{item.icon}<span>{t[item.id] || item.id}</span></button>)}
        <button onClick={() => setSidebarOpen(true)} className={`bottom-nav-item ${!['dashboard','shopping','familyplan','transactions'].includes(activeTab) ? 'active' : ''}`}><MoreHorizontal /><span>{t.see_all}</span></button>
      </nav>
      <aside className={`app-sidebar fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}>
        <div className="p-5 border-b border-slate-100"><div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('dashboard')}><div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg bg-blue-600"><Heart className="w-5 h-5 text-white" /></div><div><p className="font-extrabold text-slate-900 leading-none tracking-tight">FamilieHub</p><p className="text-[11px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wider">{userConfig.familyName}</p></div></div></div>
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {userConfig.role === UserRole.SUPER_ADMIN && <button onClick={() => navigate('superadmin')} className={`nav-item w-full text-left ${activeTab === 'superadmin' ? 'active' : ''}`}><ShieldCheck className="w-5 h-5 shrink-0" />Admin</button>}
          {NAVIGATION.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}>{item.icon}<span className="truncate">{t[item.id] || item.label}</span></button>)}
        </nav>
        <div className="p-4 border-t border-slate-100 space-y-2"><button onClick={handleLogout} className="nav-item w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600"><LogOut className="w-5 h-5 shrink-0" />{t.logout}</button></div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        <header className="sticky top-0 z-30 px-4 md:px-8 h-16 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-xl"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">{sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button><div><h2 className="font-extrabold text-slate-900 text-lg leading-none tracking-tight">{pageTitle}</h2><p className="text-[11px] text-slate-500 mt-1 hidden sm:block font-medium">{new Date().toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div></header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{renderContent()}</main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
