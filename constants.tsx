
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
  FileText,
} from 'lucide-react';
import { FarmCategory } from './types';
import { filterEnabledModules } from './config/productMode';

export const COLORS = {
  primary: '#0F172A',
  primaryLight: '#F1F5F9',
  primaryDark: '#020617',
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

export const ALL_NAVIGATION = [
  { id: 'dashboard',    label: 'Oversikt',        icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'familyplan',  label: 'Kalender',         icon: <CalendarDays className="w-5 h-5" /> },
  { id: 'shopping',    label: 'Handleliste',       icon: <ShoppingCart className="w-5 h-5" /> },
  { id: 'transactions',label: 'Økonomi',           icon: <CreditCard className="w-5 h-5" /> },
  { id: 'bank',        label: 'Eiendeler',         icon: <Landmark className="w-5 h-5" /> },
  { id: 'documents',   label: 'Dokumenter',        icon: <FileText className="w-5 h-5" /> },
  { id: 'trends',      label: 'Regninger',         icon: <TrendingUp className="w-5 h-5" /> },
  { id: 'receipts',    label: 'Kvitteringer',      icon: <Receipt className="w-5 h-5" /> },
  { id: 'business',    label: 'Business',          icon: <Briefcase className="w-5 h-5" /> },
  { id: 'members',     label: 'Familie',           icon: <Users className="w-5 h-5" /> },
  { id: 'settings',    label: 'Innstillinger',     icon: <Settings className="w-5 h-5" /> },
];

export const NAVIGATION = filterEnabledModules(ALL_NAVIGATION);

export const GROCERY_STORES = ['Meny', 'Rema 1000', 'Kiwi', 'Coop', 'Bunnpris', 'Spar', 'Lidl', 'Aldi', 'Andre'] as const;

export const CURRENCIES = ['NOK', 'EUR'] as const;

export const FARM_CATEGORIES_ARRAY: FarmCategory[] = ['Picking', 'Pruning', 'Maintenance', 'Cooperativa', 'Market', 'Export', 'Other', 'Utilities'];

export const MEMBER_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777', '#0891B2', '#65A30D'
];
