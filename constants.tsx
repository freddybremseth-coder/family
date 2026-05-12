
import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  CalendarDays,
  Users,
  Settings,
  Receipt,
  CreditCard,
  TrendingUp,
  Landmark,
  Briefcase,
} from 'lucide-react';
import { FarmCategory } from './types';

export const COLORS = {
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryDark: '#1D4ED8',
  accent: '#0F172A',
  accentLight: '#F1F5F9',
  success: '#059669',
  danger: '#DC2626',
  warning: '#D97706',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',
};

export const EXCHANGE_RATE_EUR_TO_NOK = 11.55;

export const NAVIGATION = [
  { id: 'dashboard',    label: 'Oversikt',        icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'familyplan',  label: 'Kalender',         icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'shopping',    label: 'Handleliste',       icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'transactions',label: 'Transaksjoner',     icon: <CreditCard className="w-5 h-5" /> },
  { id: 'bank',        label: 'Bank & Eiendeler',  icon: <Landmark className="w-5 h-5" /> },
  { id: 'trends',      label: 'Regninger',         icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'receipts',    label: 'Kvitteringer',      icon: <Receipt className="w-5 h-5" /> },
  { id: 'business',    label: 'Business',          icon: <Briefcase className="w-5 h-5" /> },
  { id: 'members',     label: 'Familiemedlemmer',  icon: <Users className="w-5 h-5" /> },
  { id: 'settings',    label: 'Innstillinger',     icon: <Settings className="w-5 h-5" /> },
];

export const GROCERY_STORES = ['Meny', 'Rema 1000', 'Kiwi', 'Coop', 'Bunnpris', 'Spar', 'Lidl', 'Aldi', 'Andre'] as const;

export const CURRENCIES = ['NOK', 'EUR'] as const;

export const FARM_CATEGORIES_ARRAY: FarmCategory[] = ['Picking', 'Pruning', 'Maintenance', 'Cooperativa', 'Market', 'Export', 'Other', 'Utilities'];

export const MEMBER_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
];
