
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
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
import { NAVIGATION } from './constants';
import { Transaction, TransactionType, Bill, RealEstateDeal, AfterSaleCommission, FarmOperation, BankAccount, Developer, Asset, GroceryItem, FamilyMember, CalendarEvent, Task, LocalEvent, UserConfig, ScannedReceipt, Language } from './types';
import { translations } from './translations';
import { Home, Globe, LogOut } from 'lucide-react';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [cashBalance, setCashBalance] = useState(4250);
  
  const [groceryItems, setGroceryItems] = useState<GroceryItem[]>([]);
  const [weeklyMenu, setWeeklyMenu] = useState<any[]>([]);
  const [scannedReceipts, setScannedReceipts] = useState<ScannedReceipt[]>([]);

  // SaaS / User Config
  const [userConfig, setUserConfig] = useState<UserConfig>({
    location: 'Benidorm, Spain',
    timezone: 'Europe/Madrid',
    preferredCurrency: 'EUR',
    language: 'no'
  });

  const t = translations[userConfig.language];

  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);

  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    { id: 'fm-1', name: 'Freddy', birthDate: '1975-04-12', monthlySalary: 45000, monthlyBenefits: 0, monthlyChildBenefit: 0 },
    { id: 'fm-2', name: 'Anna', birthDate: '1980-08-25', monthlySalary: 32000, monthlyBenefits: 5000, monthlyChildBenefit: 0 },
    { id: 'fm-3', name: 'Victoria', birthDate: '2015-01-10', monthlySalary: 0, monthlyBenefits: 0, monthlyChildBenefit: 1700 },
  ]);
  
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([
    { id: 'evt-1', date: '2024-07-20', description: 'Legetime Freddy', assignedToId: 'fm-1', type: 'Appointment' },
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    { id: 'tsk-1', date: '2024-07-22', description: 'Betale regninger', assignedToId: 'fm-1', priority: 'High', isComplete: false },
  ]);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    { id: 'bank-1', name: 'Hovedkonto DNB', balance: 50000, currency: 'NOK', lastReconciledDate: '2023-10-31' },
    { id: 'bank-2', name: 'Caixa Spania', balance: 15000, currency: 'EUR', lastReconciledDate: '2023-10-20' },
  ]);

  const [assets, setAssets] = useState<Asset[]>([
    { id: 'a1', name: 'Enebolig Pinoso', type: 'Property', location: 'Pinoso, Alicante', purchasePrice: 350000, currentValue: 420000, currency: 'EUR', annualGrowthRate: 4.2, purchaseDate: '2021-05-10' },
  ]);

  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', date: '2023-10-27', amount: 2500000, currency: 'NOK', description: 'Salg av leilighet (Oslo)', category: 'Eiendom', type: TransactionType.INCOME, paymentMethod: 'Bank', isAccrual: true, toAccountId: 'bank-1' },
  ]);

  const [developers, setDevelopers] = useState<Developer[]>([
    { id: 'dev-asencio', name: 'Asencio Homes', defaultCommissionPct: 5, payoutPhases: [] },
  ]);

  const [realEstateDeals, setRealEstateDeals] = useState<RealEstateDeal[]>([]);
  const [afterSales, setAfterSales] = useState<AfterSaleCommission[]>([]);
  const [farmOps, setFarmOps] = useState<FarmOperation[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  const handleNewScannedReceipt = (data: any, imageUrl: string) => {
    const receiptId = `rcpt-${Date.now()}`;
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
    const newReceipt: ScannedReceipt = {
      id: receiptId,
      imageUrl: imageUrl,
      vendor: data.vendor,
      date: data.date || new Date().toISOString().split('T')[0],
      amount: data.totalAmount,
      currency: 'EUR',
      category: 'Shopping',
      confidence: 0.95,
      linkedTransactionId: transactionId
    };
    setTransactions(prev => [newT, ...prev]);
    setScannedReceipts(prev => [newReceipt, ...prev]);
    setCashBalance(prev => prev - data.totalAmount);
    setActiveTab('transactions');
  };

  const renderContent = () => {
    switch (activeTab) {
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
          setFamilyMembers={setFamilyMembers}
          calendarEvents={calendarEvents}
          setCalendarEvents={setCalendarEvents}
          tasks={tasks}
          setTasks={setTasks}
          assets={assets}
          userConfig={userConfig}
          setUserConfig={setUserConfig}
          localEvents={localEvents}
          setLocalEvents={setLocalEvents}
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

  const changeLanguage = (l: Language) => {
    setUserConfig({...userConfig, language: l});
  };

  if (!isAuthenticated) {
    return <LandingPage onLogin={() => setIsAuthenticated(true)} lang={userConfig.language} setLang={changeLanguage} />;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <nav className="w-full md:w-64 glass-panel border-r border-cyan-500/30 p-6 space-y-8 z-10">
        <div className="flex items-center gap-3 mb-10 group cursor-pointer">
          <div className="relative w-12 h-12 bg-black border-2 border-cyan-500 flex items-center justify-center shadow-[0_0_15px_#00f3ff] overflow-hidden">
            <Home className="text-cyan-400 w-8 h-8 group-hover:scale-110 transition-transform" />
            <div className="absolute bottom-0 right-0 bg-cyan-500 text-black text-[8px] font-black px-1 uppercase tracking-tighter">CB</div>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-white uppercase leading-none">CASA<br /><span className="text-cyan-400">BREMSETH</span></h1>
            <p className="text-[8px] font-bold text-slate-500 tracking-[0.3em] uppercase mt-1">FINANS</p>
          </div>
        </div>
        
        <div className="space-y-2">
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
             onClick={() => setIsAuthenticated(false)}
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
              {t[activeTab] || NAVIGATION.find(n => n.id === activeTab)?.label}
            </h2>
            <p className="text-slate-500 text-sm mt-1">{t.operational_status} // {new Date().toLocaleDateString(userConfig.language === 'no' ? 'no-NO' : 'en-US')}</p>
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
