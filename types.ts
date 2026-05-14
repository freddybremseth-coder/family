
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
  address?: string;
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
  verifiedByBankStatement?: boolean;
  verifiedAt?: string;
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
  isVerified?: boolean;
  verifiedAt?: string;
  verificationSource?: 'receipt' | 'bank_statement' | 'manual';
  matchedReceiptId?: string;
  bankStatementRef?: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  dueDay: number;
  category: string;
  isAutoPay: boolean;
  isPaid?: boolean;
  paidDate?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  birthDate: string;
  monthlySalary: number;
  monthlyBenefits: number;
  monthlyChildBenefit: number;
  salaryDay?: number;
  salaryAccountId?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  balance: number;
  currency: Currency;
  type: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN' | 'INVESTMENT';
  interestRate?: number;
  creditLimit?: number;
}

export interface Asset {
  id: string;
  name: string;
  category: 'REAL_ESTATE' | 'VEHICLE' | 'CRYPTO' | 'STOCKS' | 'FUND' | 'OTHER';
  value: number;
  currency: Currency;
  purchasePrice?: number;
  purchaseDate?: string;
  linkedLoanAccountId?: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
  isBought: boolean;
  price?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  assignedTo?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  isDone: boolean;
  assignedTo?: string;
}

export interface Developer {
  id: string;
  name: string;
  defaultCommissionPct: number;
  payoutPhases: any[];
}

export interface RealEstateDeal {
  id: string;
  user_id?: string;
  propertyName: string;
  clientName: string;
  developerId?: string;
  status: DealStatus | string;
  salePrice: number;
  currency: Currency;
  commissionPct: number;
  expectedPayoutDate?: string;
  createdAt?: string;
}

export interface AfterSaleCommission {
  id: string;
  partnerName: string;
  description: string;
  amount: number;
  currency: Currency;
  expectedPayoutDate?: string;
  status?: string;
}

export interface FarmOperation {
  id: string;
  date: string;
  description: string;
  income: number;
  expense: number;
  currency: Currency;
}
