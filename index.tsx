
import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Transaction, TransactionType, Bill, RealEstateDeal, AfterSaleCommission,
  FarmOperation, BankAccount, Developer, Asset, GroceryItem, FamilyMember,
  CalendarEvent, Task, LocalEvent, UserConfig, ScannedReceipt, Language, UserRole
} from './types';
import { translations } from './translations';
import { Heart, LogOut, ShieldCheck, Loader2, AlertCircle, Key, Menu, X } from 'lucide-react';
import { isAiAvailable } from './services/geminiService';

const ADMIN_EMAIL = 'freddy.bremseth@gmail.com';

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cashBalance, setCashBalance] = useState(4250);

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

    const { data: residentData } = await supabase.from('family_members').select('*').eq('user_id', userId);
    if (residentData && residentData.length > 0) setFamilyMembers(residentData);
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
        }
        setLoading(false);
      }).catch(() => setLoading(false));

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) {
          handleRoleAssignment(session.user);
          fetchAllData(session.user.id);
        }
      });

      return () => subscription?.unsubscribe();
    } catch {
      setLoading(false);
    }
  }, [fetchAllData]);

  const handleRoleAssignment = (user: any) => {
    if (user.email === ADMIN_EMAIL) {
      setUserConfig(prev => ({
        ...prev,
        familyName: 'BREMSETH',
        role: UserRole.SUPER_ADMIN,
        subscriptionStatus: 'Lifetime',
      }));
    } else {
      setUserConfig(prev => ({
        ...prev,
        familyName: user.user_metadata?.family_name || 'FAMILIE',
        role: UserRole.USER,
        subscriptionStatus: 'Active',
      }));
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
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password || '',
    });
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

    if (isSupabaseConfigured() && session?.user) {
      await supabase.from('transactions').insert([newT]);
    }

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
      case 'superadmin':
        return <SuperAdminDashboard />;

      case 'dashboard':
        return (
          <Dashboard
            transactions={transactions}
            bankAccounts={bankAccounts}
            assets={assets}
            familyMembers={familyMembers}
            tasks={tasks}
            calendarEvents={calendarEvents}
            groceryCount={groceryItems.filter(i => !i.isBought).length}
            lang={userConfig.language}
          />
        );

      case 'shopping':
        return (
          <ShoppingList
            cashBalance={cashBalance}
            groceryItems={groceryItems}
            setGroceryItems={setGroceryItems}
            weeklyMenu={weeklyMenu}
            setWeeklyMenu={setWeeklyMenu}
          />
        );

      case 'familyplan':
        return (
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

      case 'members':
        return (
          <ResidentsManager
            familyMembers={familyMembers}
            setFamilyMembers={setFamilyMembers}
            lang={userConfig.language}
          />
        );

      case 'settings':
        return (
          <SettingsManager
            userConfig={userConfig}
            setUserConfig={setUserConfig}
            onApiUpdate={() => setAiConfigured(isAiAvailable())}
          />
        );

      case 'bank':
        return (
          <div className="space-y-8">
            <BankManager bankAccounts={bankAccounts} setBankAccounts={setBankAccounts} transactions={transactions} setTransactions={setTransactions} />
            <AssetManager assets={assets} setAssets={setAssets} />
          </div>
        );

      case 'business':
        return (
          <BusinessManager
            deals={realEstateDeals}
            setDeals={async (val: any) => {
              const next = typeof val === 'function' ? val(realEstateDeals) : val;
              setRealEstateDeals(next);
            }}
            afterSales={afterSales} setAfterSales={setAfterSales}
            farmOps={farmOps}
            setFarmOps={async (val: any) => {
              const next = typeof val === 'function' ? val(farmOps) : val;
              setFarmOps(next);
            }}
            developers={developers} setDevelopers={setDevelopers}
            afterSalePartners={[]} setAfterSalePartners={() => {}}
            transactions={transactions} setTransactions={setTransactions}
            bankAccounts={bankAccounts}
          />
        );

      case 'transactions':
        return (
          <TransactionManager
            transactions={transactions}
            setTransactions={async (val: any) => {
              const next = typeof val === 'function' ? val(transactions) : val;
              setTransactions(next);
              if (next.length > transactions.length && isSupabaseConfigured() && session?.user) {
                await supabase.from('transactions').insert([{ ...next[0], user_id: session.user.id }]);
              }
            }}
            bankAccounts={bankAccounts} setBankAccounts={setBankAccounts}
            deals={realEstateDeals} setDeals={setRealEstateDeals}
            afterSales={afterSales} setAfterSales={setAfterSales}
            cashBalance={cashBalance} setCashBalance={setCashBalance}
          />
        );

      case 'receipts':
        return <ReceiptScanner receipts={scannedReceipts} onScan={handleNewScannedReceipt} />;

      case 'trends':
        return <BillsManager bills={bills} setBills={setBills} />;

      default:
        return <Dashboard transactions={transactions} bankAccounts={bankAccounts} assets={assets} lang={userConfig.language} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Heart className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Laster FamilieHub...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white">
        {!isSupabaseConfigured() && (
          <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-500 text-white text-xs font-semibold py-2 px-4 flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Demo-modus — Supabase ikke konfigurert
          </div>
        )}
        <LandingPage
          onLogin={handleLogin}
          lang={userConfig.language}
          setLang={(l) => setUserConfig({ ...userConfig, language: l })}
        />
      </div>
    );
  }

  const pageTitle = activeTab === 'superadmin'
    ? 'Admin'
    : (t[activeTab] || NAVIGATION.find(n => n.id === activeTab)?.label || '');

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-50 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:z-auto
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-100">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('dashboard')}
          >
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 leading-none">FamilieHub</p>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Familie {userConfig.familyName}
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {userConfig.role === UserRole.SUPER_ADMIN && (
            <button
              onClick={() => navigate('superadmin')}
              className={`nav-item w-full text-left ${activeTab === 'superadmin' ? 'active' : ''}`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" />
              Admin
            </button>
          )}

          {NAVIGATION.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`nav-item w-full text-left ${activeTab === item.id ? 'active' : ''}`}
            >
              {item.icon}
              <span className="truncate">{t[item.id] || item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom: AI status + logout */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {!aiConfigured && (
            <button
              onClick={() => navigate('settings')}
              className="w-full flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <Key className="w-4 h-4 shrink-0" />
              <span>AI ikke aktivert – konfigurer nøkkel</span>
            </button>
          )}

          {/* Family avatars */}
          <div className="flex items-center gap-2 px-1 py-2">
            <div className="flex -space-x-1.5">
              {familyMembers.slice(0, 4).map((m, i) => (
                <div
                  key={m.id}
                  className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: ['#4F46E5','#10B981','#F59E0B','#EF4444'][i % 4] }}
                  title={m.name}
                >
                  {m.name.charAt(0)}
                </div>
              ))}
            </div>
            {familyMembers.length > 0 && (
              <span className="text-xs text-slate-400 font-medium">{familyMembers.length} medlemmer</span>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="nav-item w-full text-left text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {t.logout}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h2 className="font-bold text-slate-800 text-base leading-none">{pageTitle}</h2>
              <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                {new Date().toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {familyMembers.slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-bold text-white"
                style={{ background: ['#4F46E5','#10B981','#F59E0B'][i % 3] }}
                title={m.name}
              >
                {m.name.charAt(0)}
              </div>
            ))}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
