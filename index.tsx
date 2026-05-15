
import './styles/app-polish.css';
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, isSupabaseConfigured, SUPABASE_REFS, SUPABASE_STATUS } from './supabase';
import { LandingPageClean as LandingPage } from './components/LandingPageClean';
import { Dashboard } from './components/Dashboard';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { LiquidityForecastCard } from './components/LiquidityForecastCard';
import { ShoppingList } from './components/ShoppingList';
import { TransactionManager } from './components/TransactionManager';
import { ReceiptScanner } from './components/ReceiptScanner';
import { BillsManager } from './components/BillsManager';
import { BusinessManagerClean as BusinessManager } from './components/BusinessManagerClean';
import { BankManager } from './components/BankManager';
import { AssetManager } from './components/AssetManager';
import { NetWorthOverview } from './components/NetWorthOverview';
import { DocumentsManager } from './components/DocumentsManager';
import { FamilyCalendar } from './components/FamilyCalendar';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SettingsManager } from './components/SettingsManager';
import { ResidentsManager } from './components/ResidentsManager';
import { PaywallModal } from './components/PaywallModal';
import { ALL_NAVIGATION } from './constants';
import { filterModulesForUser, isModuleVisibleForUser } from './config/productMode';
import { Transaction, TransactionType, Bill, RealEstateDeal, AfterSaleCommission, FarmOperation, BankAccount, Developer, Asset, GroceryItem, FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig, ScannedReceipt, UserRole } from './types';
import { translations } from './translations';
import { Heart, LogOut, ShieldCheck, Loader2, Menu, X, LayoutDashboard, ShoppingCart, CalendarDays, CreditCard, MoreHorizontal } from 'lucide-react';
import { isAiAvailable } from './services/geminiService';
import { loadFamilyPersistentData, syncAssets, syncBankAccounts, syncMembers, syncTransactions } from './services/familyPersistenceService';
import { inferTransactionCategory } from './services/categoryService';

const ADMIN_EMAIL = 'freddy.bremseth@gmail.com';
const TRIAL_DAYS = 3;
const USER_CONFIG_KEY = 'familyhub_user_config';

const defaultUserConfig: UserConfig = { familyName: 'FAMILIE', location: '', address: '', timezone: 'Europe/Oslo', preferredCurrency: 'NOK', language: 'no', role: UserRole.USER, subscriptionStatus: 'Active' };
function loadUserConfig(): UserConfig { try { return { ...defaultUserConfig, ...JSON.parse(localStorage.getItem(USER_CONFIG_KEY) || '{}') }; } catch { return defaultUserConfig; } }
const getTrialDaysLeft = (trialStartedAt: string): number => Math.ceil(TRIAL_DAYS - ((Date.now() - new Date(trialStartedAt).getTime()) / (1000 * 60 * 60 * 24)));
function authSetupError() { return ['FamilyHub Supabase er ikke riktig konfigurert for innlogging.', `Family URL konfigurert: ${SUPABASE_STATUS.familyUrlConfigured ? 'ja' : 'nei'}`, `Family key konfigurert: ${SUPABASE_STATUS.familyKeyConfigured ? 'ja' : 'nei'}`, `Family URL i build: ${SUPABASE_REFS.family || 'mangler'}`, `Family key-navn: ${SUPABASE_STATUS.familyResolvedKeyName || 'mangler'}`].join('\n'); }

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [persistentReady, setPersistentReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cashBalance, setCashBalance] = useState(4250);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('trial');
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(TRIAL_DAYS);
  const [showPaywall, setShowPaywall] = useState(false);
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
  const [developers, setDevelopers] = useState<Developer[]>([{ id: 'dev-default', name: 'Standard Utvikler', defaultCommissionPct: 5, payoutPhases: [] }]);
  const [realEstateDeals, setRealEstateDeals] = useState<RealEstateDeal[]>([]);
  const [afterSales, setAfterSales] = useState<AfterSaleCommission[]>([]);
  const [farmOps, setFarmOps] = useState<FarmOperation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [userConfig, setUserConfig] = useState<UserConfig>(loadUserConfig);

  useEffect(() => { localStorage.setItem(USER_CONFIG_KEY, JSON.stringify({ familyName: userConfig.familyName, location: userConfig.location, address: userConfig.address || '', timezone: userConfig.timezone, preferredCurrency: userConfig.preferredCurrency, language: userConfig.language })); }, [userConfig.familyName, userConfig.location, userConfig.address, userConfig.timezone, userConfig.preferredCurrency, userConfig.language]);

  const userEmail = session?.user?.email || null;
  const visibleNavigation = useMemo(() => filterModulesForUser(ALL_NAVIGATION, userEmail), [userEmail]);
  const t = translations[userConfig.language] || translations['no'];
  const labelFor = (id: string, fallback?: string) => id === 'business' ? 'Business' : (t[id] || fallback || id);
  const dashboardProps = { transactions, bankAccounts, assets, familyMembers, tasks, calendarEvents, groceryCount: groceryItems.filter(i => !i.isBought).length, lang: userConfig.language, userId: session?.user?.id, realEstateDeals, afterSales, farmOps, bills };
  const dashboardView = <AppErrorBoundary label="Oversikt"><div className="space-y-6"><Dashboard {...dashboardProps} /><LiquidityForecastCard familyMembers={familyMembers} bankAccounts={bankAccounts} transactions={transactions} /></div></AppErrorBoundary>;

  useEffect(() => { if (session?.user && !isModuleVisibleForUser(activeTab as any, userEmail)) setActiveTab('dashboard'); }, [activeTab, session, userEmail]);

  const fetchAllData = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured()) { setPersistentReady(true); return; }
    setPersistentReady(false);
    try {
      const persistent = await loadFamilyPersistentData(userId);
      if (persistent.transactions) setTransactions(persistent.transactions);
      if (persistent.members) setFamilyMembers(persistent.members);
      if (persistent.assets) setAssets(persistent.assets);
      if (persistent.bankAccounts) setBankAccounts(persistent.bankAccounts);

      const { data: reData } = await supabase.from('real_estate_deals').select('*').eq('user_id', userId);
      if (reData) setRealEstateDeals(reData);
      const { data: farmData } = await supabase.from('farm_operations').select('*').eq('user_id', userId);
      if (farmData) setFarmOps(farmData);
    } catch (err) {
      console.warn('[App] fetchAllData failed', err);
    } finally {
      setPersistentReady(true);
    }
  }, []);

  useEffect(() => { if (!session?.user?.id || !persistentReady) return; const timer = setTimeout(() => { syncTransactions(session.user.id, transactions); }, 800); return () => clearTimeout(timer); }, [transactions, session?.user?.id, persistentReady]);
  useEffect(() => { if (!session?.user?.id || !persistentReady) return; const timer = setTimeout(() => { syncMembers(session.user.id, familyMembers); }, 800); return () => clearTimeout(timer); }, [familyMembers, session?.user?.id, persistentReady]);
  useEffect(() => { if (!session?.user?.id || !persistentReady) return; const timer = setTimeout(() => { syncAssets(session.user.id, assets); }, 800); return () => clearTimeout(timer); }, [assets, session?.user?.id, persistentReady]);
  useEffect(() => { if (!session?.user?.id || !persistentReady) return; const timer = setTimeout(() => { syncBankAccounts(session.user.id, bankAccounts); }, 800); return () => clearTimeout(timer); }, [bankAccounts, session?.user?.id, persistentReady]);

  const checkSubscription = useCallback(async (user: any) => {
    if (user.email === ADMIN_EMAIL) { setSubscriptionStatus('lifetime'); return; }
    if (!isSupabaseConfigured()) return;
    const { data: profile } = await supabase.from('user_profiles').select('subscription_status, trial_started_at').eq('id', user.id).single();
    if (!profile) { await supabase.from('user_profiles').insert({ id: user.id }); setSubscriptionStatus('trial'); setTrialDaysLeft(TRIAL_DAYS); return; }
    setSubscriptionStatus(profile.subscription_status);
    if (profile.subscription_status === 'trial') { const daysLeft = getTrialDaysLeft(profile.trial_started_at); setTrialDaysLeft(daysLeft); if (daysLeft <= 0) setShowPaywall(true); }
  }, []);

  useEffect(() => {
    try {
      if (!isSupabaseConfigured()) { setLoading(false); setPersistentReady(true); setFamilyMembers([{ id: 'fm-1', name: 'Freddy', birthDate: '1975-04-12', monthlySalary: 45000, monthlyBenefits: 0, monthlyChildBenefit: 0, salaryDay: 25 }, { id: 'fm-2', name: 'Anna', birthDate: '1980-08-25', monthlySalary: 32000, monthlyBenefits: 5000, monthlyChildBenefit: 0, salaryDay: 25 }]); return; }
      let cancelled = false;
      const safetyTimer = setTimeout(() => { if (!cancelled) setLoading(false); }, 3500);
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (cancelled) return;
        setSession(session);
        setLoading(false);
        if (session?.user) {
          handleRoleAssignment(session.user);
          fetchAllData(session.user.id).catch((err) => console.warn('[App] startup data load failed', err));
          checkSubscription(session.user).catch((err) => console.warn('[App] subscription check failed', err));
        } else setPersistentReady(false);
      }).catch((err) => { console.warn('[App] getSession failed', err); if (!cancelled) { setPersistentReady(false); setLoading(false); } });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setSession(session);
        if (session?.user) { handleRoleAssignment(session.user); fetchAllData(session.user.id).catch((err) => console.warn('[App] auth data load failed', err)); checkSubscription(session.user).catch((err) => console.warn('[App] auth subscription check failed', err)); }
        else { setPersistentReady(false); setTransactions([]); setFamilyMembers([]); setAssets([]); setBankAccounts([]); }
      });
      return () => { cancelled = true; clearTimeout(safetyTimer); subscription?.unsubscribe(); };
    } catch (err) { console.warn('[App] startup failed', err); setPersistentReady(false); setLoading(false); }
  }, [fetchAllData, checkSubscription]);

  const handleRoleAssignment = (user: any) => { if (user.email === ADMIN_EMAIL) setUserConfig(prev => ({ ...prev, familyName: prev.familyName && prev.familyName !== 'FAMILIE' ? prev.familyName : 'BREMSETH', role: UserRole.SUPER_ADMIN, subscriptionStatus: 'Lifetime' })); else setUserConfig(prev => ({ ...prev, familyName: prev.familyName && prev.familyName !== 'FAMILIE' ? prev.familyName : (user.user_metadata?.family_name || 'FAMILIE'), role: UserRole.USER, subscriptionStatus: 'Active' })); };
  const handleLogin = async (credentials: { email: string; password?: string }) => {
    if (!isSupabaseConfigured()) { if (credentials.email === ADMIN_EMAIL) { setSession({ user: { email: credentials.email, id: 'demo-user' } }); handleRoleAssignment({ email: credentials.email }); return { ok: true }; } return { ok: false, error: authSetupError() }; }
    const { data, error } = await supabase.auth.signInWithPassword({ email: credentials.email.trim(), password: credentials.password || '' });
    if (error) { const msg = String(error.message || '').toLowerCase(); if (msg.includes('invalid login credentials')) return { ok: false, error: 'Feil e-post eller passord. Hvis du nettopp opprettet konto, må e-posten være bekreftet først. Bruk “Glemt passord” bare hvis kontoen faktisk finnes i FamilyHub Supabase Auth.' }; if (msg.includes('email not confirmed')) return { ok: false, error: 'E-posten er ikke bekreftet ennå. Sjekk innboksen/spam, eller opprett kontoen på nytt for å sende bekreftelseslenke.' }; return { ok: false, error: error.message }; }
    if (data.session?.user) { handleRoleAssignment(data.session.user); fetchAllData(data.session.user.id).catch((err) => console.warn('[App] login data load failed', err)); checkSubscription(data.session.user).catch((err) => console.warn('[App] login subscription check failed', err)); }
    return { ok: true };
  };

  const handleLogout = async () => { if (isSupabaseConfigured()) await supabase.auth.signOut(); setPersistentReady(false); setSession(null); setTransactions([]); setFamilyMembers([]); setAssets([]); setBankAccounts([]); };
  const handleNewScannedReceipt = async (data: any, imageUrl: string) => { const txId = `tx-rcpt-${Date.now()}`; const receiptId = `receipt-${Date.now()}`; const smartCategory = inferTransactionCategory({ vendor: data.vendor, description: data.vendor || 'Kvittering', category: data.category, amount: data.totalAmount, items: data.items }); const tx: Transaction = { id: txId, date: data.date || new Date().toISOString().split('T')[0], amount: Number(data.totalAmount || 0), currency: data.currency || userConfig.preferredCurrency, description: data.vendor || 'Kvittering', category: smartCategory, type: TransactionType.EXPENSE, paymentMethod: 'Bank', isAccrual: false, verificationSource: 'receipt', matchedReceiptId: receiptId }; if (isSupabaseConfigured() && session?.user) await supabase.from('transactions').insert([{ ...tx, user_id: session.user.id, payment_method: tx.paymentMethod }]); const receipt: ScannedReceipt = { id: receiptId, imageUrl, vendor: tx.description, date: tx.date, amount: tx.amount, currency: tx.currency, category: tx.category, confidence: Number(data.confidence || 0.75), linkedTransactionId: txId }; setScannedReceipts(prev => [receipt, ...prev]); setTransactions(prev => [tx, ...prev]); setCashBalance(prev => prev - tx.amount); setActiveTab('transactions'); };
  const navigate = (tab: string) => { if (!isModuleVisibleForUser(tab as any, userEmail)) return setActiveTab('dashboard'); setActiveTab(tab); setSidebarOpen(false); };

  const renderContent = () => {
    if (!isModuleVisibleForUser(activeTab as any, userEmail)) return dashboardView;
    switch (activeTab) {
      case 'superadmin': return <SuperAdminDashboard />;
      case 'dashboard': return dashboardView;
      case 'shopping': return <ShoppingList cashBalance={cashBalance} groceryItems={groceryItems} setGroceryItems={setGroceryItems} weeklyMenu={weeklyMenu} setWeeklyMenu={setWeeklyMenu} lang={userConfig.language} userId={session?.user?.id} />;
      case 'familyplan': return <FamilyCalendar familyMembers={familyMembers} calendarEvents={calendarEvents} setCalendarEvents={setCalendarEvents} tasks={tasks} setTasks={setTasks} userConfig={userConfig} localEvents={localEvents} setLocalEvents={setLocalEvents} />;
      case 'members': return <ResidentsManager familyMembers={familyMembers} setFamilyMembers={setFamilyMembers} lang={userConfig.language} />;
      case 'settings': return <SettingsManager userConfig={userConfig} setUserConfig={setUserConfig} onApiUpdate={() => setAiConfigured(isAiAvailable())} />;
      case 'bank': return <div className="space-y-8"><NetWorthOverview bankAccounts={bankAccounts} assets={assets} realEstateDeals={realEstateDeals} userId={session?.user?.id} /><BankManager userId={session?.user?.id} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} transactions={transactions} setTransactions={setTransactions} /><AssetManager assets={assets} setAssets={setAssets} /></div>;
      case 'documents': return <DocumentsManager userId={session?.user?.id} familyName={userConfig.familyName} familyLocation={userConfig.location} familyAddress={userConfig.address || ''} />;
      case 'business': return <BusinessManager deals={realEstateDeals} setDeals={setRealEstateDeals} afterSales={afterSales} setAfterSales={setAfterSales} farmOps={farmOps} setFarmOps={setFarmOps} developers={developers} setDevelopers={setDevelopers} afterSalePartners={[]} setAfterSalePartners={() => {}} transactions={transactions} setTransactions={setTransactions} bankAccounts={bankAccounts} userId={session?.user?.id} />;
      case 'transactions': return <TransactionManager transactions={transactions} setTransactions={setTransactions as any} bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} deals={realEstateDeals} setDeals={setRealEstateDeals} afterSales={afterSales} setAfterSales={setAfterSales} cashBalance={cashBalance} setCashBalance={setCashBalance} receipts={scannedReceipts} />;
      case 'receipts': return <ReceiptScanner receipts={scannedReceipts} onScan={handleNewScannedReceipt} />;
      case 'trends': return <BillsManager bills={bills} setBills={setBills} />;
      default: return dashboardView;
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4"><div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center shadow-sm"><Heart className="w-7 h-7 text-white" /></div><Loader2 className="w-6 h-6 text-slate-500 animate-spin" /><p className="text-sm text-slate-500 font-medium">Laster FamilieHub...</p></div>;
  if (!session) return <div className="min-h-screen bg-white"><LandingPage onLogin={handleLogin} lang={userConfig.language} setLang={(l) => setUserConfig({ ...userConfig, language: l })} /></div>;
  const pageTitle = activeTab === 'superadmin' ? 'Admin' : labelFor(activeTab, visibleNavigation.find(n => n.id === activeTab)?.label || '');

  return <div className="flex min-h-screen bg-slate-50">
    {showPaywall && session?.user && <PaywallModal userEmail={session.user.email} daysLeft={trialDaysLeft} onClose={trialDaysLeft > 0 ? () => setShowPaywall(false) : undefined} lang={userConfig.language} />}
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />}
    <nav className="bottom-nav md:hidden">{[{ id: 'dashboard', icon: <LayoutDashboard /> }, { id: 'shopping', icon: <ShoppingCart /> }, { id: 'familyplan', icon: <CalendarDays /> }, { id: 'transactions', icon: <CreditCard /> }].filter(item => isModuleVisibleForUser(item.id as any, userEmail)).map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`bottom-nav-item ${activeTab === item.id ? 'active' : ''}`}>{item.icon}<span>{labelFor(item.id)}</span></button>)}<button onClick={() => setSidebarOpen(true)} className={`bottom-nav-item ${!['dashboard','shopping','familyplan','transactions'].includes(activeTab) ? 'active' : ''}`}><MoreHorizontal /><span>{t.see_all}</span></button></nav>
    <aside className={`app-sidebar fixed top-0 left-0 h-full w-64 z-50 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:z-auto`}><div className="p-5 border-b border-slate-100"><div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('dashboard')}><div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm bg-slate-900"><Heart className="w-5 h-5 text-white" /></div><div><p className="font-extrabold text-slate-900 leading-none tracking-tight">FamilieHub</p><p className="text-[11px] text-slate-500 mt-0.5 font-semibold uppercase tracking-wider">{userConfig.familyName}</p></div></div></div><nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">{userConfig.role === UserRole.SUPER_ADMIN && <button onClick={() => navigate('superadmin')} className={`nav-item w-full text-left ${activeTab === 'superadmin' ? 'active' : ''}`}><ShieldCheck className="w-5 h-5 shrink-0" />Admin</button>}{visibleNavigation.map(item => <button key={item.id} onClick={() => navigate(item.id)} className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}>{item.icon}<span className="truncate">{labelFor(item.id, item.label)}</span></button>)}</nav><div className="p-4 border-t border-slate-100"><button onClick={handleLogout} className="nav-item w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600"><LogOut className="w-5 h-5 shrink-0" />{t.logout}</button></div></aside>
    <div className="flex-1 flex flex-col min-w-0 md:ml-0"><header className="sticky top-0 z-30 px-4 md:px-8 h-16 flex items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-xl"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">{sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button><div><h2 className="font-extrabold text-slate-900 text-lg leading-none tracking-tight">{pageTitle}</h2><p className="text-[11px] text-slate-500 mt-1 hidden sm:block font-medium">{new Date().toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div></div></header><main className="flex-1 p-4 md:p-8 overflow-y-auto">{renderContent()}</main></div>
  </div>;
};

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
