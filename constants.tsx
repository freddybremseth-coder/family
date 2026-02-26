
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
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#3730A3',
  accent: '#F59E0B',
  accentLight: '#FDE68A',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#1E293B',
  textMuted: '#64748B',
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
  { id: 'business',    label: 'Forretning',        icon: <Briefcase className="w-5 h-5" /> },
  { id: 'members',     label: 'Familiemedlemmer',  icon: <Users className="w-5 h-5" /> },
  { id: 'settings',    label: 'Innstillinger',     icon: <Settings className="w-5 h-5" /> },
];

// Butikker er nå generiske og konfigurerbare – ikke hardkodet til Spania
export const GROCERY_STORES = ['Meny', 'Rema 1000', 'Kiwi', 'Coop', 'Bunnpris', 'Spar', 'Lidl', 'Aldi', 'Andre'] as const;

export const CURRENCIES = ['NOK', 'EUR'] as const;

export const FARM_CATEGORIES_ARRAY: FarmCategory[] = ['Picking', 'Pruning', 'Maintenance', 'Cooperativa', 'Market', 'Export', 'Other', 'Utilities'];

export const MEMBER_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];
