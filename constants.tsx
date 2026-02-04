
import React from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  ShoppingCart, 
  CreditCard, 
  TrendingUp, 
  Briefcase,
  Banknote,
  Landmark,
  CalendarDays,
  Users,
  Settings
} from 'lucide-react';
import { FarmCategory } from './types'; 

export const COLORS = {
  primary: '#00f3ff', // Neon Cyan
  secondary: '#ff00ff', // Neon Magenta
  accent: '#fff200', // Neon Yellow
  success: '#00ff41', // Matrix Green
  warning: '#ffae00',
  error: '#ff0033',
  background: '#050505',
};

export const EXCHANGE_RATE_EUR_TO_NOK = 11.55; 

export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'bank', label: 'Bank & Eiendeler', icon: <Landmark className="w-5 h-5" /> }, 
  { id: 'business', label: 'Forretning', icon: <Briefcase className="w-5 h-5" /> },
  { id: 'transactions', label: 'Transaksjoner', icon: <CreditCard className="w-5 h-5" /> },
  { id: 'receipts', label: 'Kvitteringer', icon: <Receipt className="w-5 h-5" /> },
  { id: 'trends', label: 'Regninger', icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'shopping', label: 'Handleliste', icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'familyplan', label: 'Familieplan', icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'members', label: 'Beboere', icon: <Users className="w-5 h-5" /> },
  { id: 'settings', label: 'Innstillinger', icon: <Settings className="w-5 h-5" /> },
];

export const GROCERY_STORES = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'Family Cash', 'Markedet (Benidorm)'] as const;
export const CURRENCIES = ['NOK', 'EUR'] as const;

export const FARM_CATEGORIES_ARRAY: FarmCategory[] = ['Picking', 'Pruning', 'Maintenance', 'Cooperativa', 'Market', 'Export', 'Other', 'Utilities'];
