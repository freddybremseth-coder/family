
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER'
}

export enum UserRole {
  USER = 'USER',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export type Currency = 'NOK' | 'EUR' | 'BTC' | 'ETH' | 'SOL';
export type Language = 'no' | 'en' | 'ru' | 'es' | 'fr' | 'de';
export type PaymentMethod = 'Bank' | 'Kontant' | 'On-Chain';

export type BusinessDomain = 'Soleada' | 'Pinosoecolife' | 'ZenEcoHomes' | 'AfterSale' | 'DonaAnna' | 'Private' | 'Crypto';

export interface UserConfig {
  familyName: string;
  location: string;
  timezone: string;
  preferredCurrency: Currency;
  language: Language;
  role: UserRole;
  subscriptionStatus: 'Active' | 'Lifetime' | 'Expired';
}

export interface SaaSUser {
  id: string;
  email: string;
  familyName: string;
  plan: 'Monthly' | 'Annual' | 'Lifetime';
  status: 'Paid' | 'Pending' | 'Churned';
  joinedDate: string;
  lastActive: string;
  revenue: number;
}

export interface LocalEvent {
  date: string;
  title: string;
  description: string;
  type: 'Holiday' | 'Fiesta' | 'Bank Holiday' | 'Market';
  isLocal?: boolean;
}

export enum DealStatus {
  RESERVED = 'Reserved',
  CONTRACTED = 'Contracted',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export interface ScannedReceipt {
  id: string;
  imageUrl: string;
  vendor: string;
  date: string;
  amount: number;
  currency: Currency;
  category: string;
  confidence: number;
  linkedTransactionId?: string;
}

export interface CryptoAsset {
  id: string;
  symbol: string;
  amount: number;
  averageBuyPrice: number;
  currentPrice?: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category: 'Savings' | 'Investment' | 'Purchase';
}

export interface InventoryItem {
  id: string;
  productName: string;
  quantity: number;
  unit: 'Liters' | 'Bottles' | 'Pallets';
  location: 'Spain' | 'Norway' | 'Transit';
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  currency: Currency;
  description: string;
  category: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  isAccrual: boolean;
  taxAmount?: number;
  fromAccountId?: string;
  toAccountId?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  dueDate: string;
  isPaid: boolean;
  category: string;
  isRecurring?: boolean;
  frequency?: 'monthly' | 'yearly';
}

export interface BankAccount {
  id: string;
  name: string;
  balance: number;
  currency: Currency;
  lastReconciledDate: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'Property' | 'Vehicle' | 'Land' | 'Other';
  location: string;
  purchasePrice: number;
  currentValue: number;
  currency: Currency;
  annualGrowthRate: number;
  purchaseDate: string;
  notes?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  frequency: 'low' | 'medium' | 'high';
  store: 'Mercadona' | 'Carrefour' | 'Lidl' | 'Aldi' | 'Family Cash' | 'Markedet (Benidorm)';
  isBought: boolean;
  isSuggestion?: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  birthDate: string;
  monthlySalary: number;
  monthlyBenefits: number;
  monthlyChildBenefit: number;
}

export interface CalendarEvent {
  id: string;
  date: string;
  description: string;
  assignedToId: string;
  type: 'Appointment' | 'Meeting' | 'Social' | 'Travel';
}

export interface Task {
  id: string;
  date: string;
  description: string;
  assignedToId: string;
  priority: 'Low' | 'Medium' | 'High';
  isComplete: boolean;
}

export interface TreeBatch {
  variety: string;
  count: number;
  age: number;
  irrigated: boolean;
  notes?: string;
}

export interface FarmProfile {
  totalTrees: number;
  batches: TreeBatch[];
  irrigationSource: string;
  location: string;
  country: string;
  yieldHistory: { year: number; liters: number }[];
}

export interface FarmOperation {
  id: string;
  date: string;
  type: 'Income' | 'Expense';
  category: FarmCategory;
  amount: number;
  description: string;
  currency: Currency;
}

export type FarmCategory = 'Picking' | 'Pruning' | 'Maintenance' | 'Cooperativa' | 'Market' | 'Export' | 'Other' | 'Utilities';

export enum CommissionTrigger {
  RESERVATION = 'Reservation',
  CONTRACT = 'Contract',
  BUILD_START = 'Build Start',
  COMPLETION = 'Completion'
}

export interface PayoutPhase {
  id: string;
  name: string;
  percentage: number;
  trigger: CommissionTrigger;
  offsetDays: number;
}

export interface Developer {
  id: string;
  name: string;
  defaultCommissionPct: number;
  payoutPhases: PayoutPhase[];
}

export enum CommissionPayoutStatus {
  PENDING = 'Pending',
  EXPECTED = 'Expected',
  PAID = 'Paid',
  OVERDUE = 'Overdue'
}

export interface CommissionPayout {
  id: string;
  phaseName: string;
  expectedDate: string;
  amount: number;
  currency: Currency;
  status: CommissionPayoutStatus;
  paidDate?: string;
  linkedTransactionId?: string;
}

export interface RealEstateDeal {
  id: string;
  developerId: string;
  customerName: string;
  leadSource: string;
  totalSaleValue: number;
  grossCommissionBase: number;
  commissionPct: number;
  ourGrossCommission: number;
  ourNetCommission: number;
  status: DealStatus;
  currency: Currency;
  businessUnit: BusinessDomain;
  saleDate: string;
  reservationDate?: string;
  contractDate?: string;
  completionDate?: string;
  commissionPayouts: CommissionPayout[];
  customerPayments: any[];
}

export interface AfterSaleCommission {
  id: string;
  partnerId: string;
  customer: string;
  product: string;
  vendor: string;
  amount: number;
  commissionPct: number;
  ourCommissionAmount: number;
  isPaid: boolean;
  paymentDate: string;
  currency: Currency;
}

export interface AfterSalePartner {
  id: string;
  name: string;
  category: string;
}

export interface FarmTask {
  id: string;
  description: string;
  dueDate: string;
  status: 'Pending' | 'Completed';
}
