
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

export interface FamilyMemberContribution {
  id: string;
  label: string;            // F.eks. "Provisjon eiendomssalg", "Mondeo renteinntekt", "Depositum"
  amount: number;           // i preferert valuta (NOK)
  frequency: 'monthly' | 'annual' | 'oneoff';
  note?: string;
  periodStart?: string;     // YYYY-MM-DD — historisk bidrag i en periode
  periodEnd?: string;       // YYYY-MM-DD
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
  extraContributions?: FamilyMemberContribution[];
  // ID-nummer (personnummer / nasjonalt ID)
  norwegianFnr?: string;       // 11 siffer
  spanishNie?: string;         // NIE — Número de Identidad de Extranjero (X-1234567-A eller Y-1234567-A)
  spanishDni?: string;         // DNI — Documento Nacional de Identidad (8 siffer + bokstav)
  passportNumber?: string;     // Passnummer
  passportExpiry?: string;     // Passets utløpsdato (YYYY-MM-DD)
  phone?: string;
  email?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  iban?: string;
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
  // Gjentakelses-metadata
  recurrence?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  recurrenceDay?: number;     // for weekly: 0=søn, 1=man, ... 6=lør. for monthly: dag i mnd
  recurrenceParentId?: string; // hvis dette er en generert instans av gjentakelse
  nextGenerationDate?: string; // brukes til å hindre duplisert generering
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

// ────────────────────────────────────────────────────────────────────
// Mondeo Eiendom AS – salgskontrakt med Odin Jacobsen / Nordic Invest AS
// Selger: Extrade Holding AS (eier aksjene inntil fullt oppgjør)
// ────────────────────────────────────────────────────────────────────
export interface MondeoLoanSettings {
  id: string;
  initialPrincipal: number;             // 4 800 000 NOK
  startDate: string;                    // dato kontrakten ble signert
  // Rente
  fixedAnnualRatePct?: number;          // 9 % avtalt – brukes hvis useFixedRate=true
  useFixedRate?: boolean;
  marginPct: number;                    // (legacy) margin over Norges Bank
  norgesBankRatePct: number;            // (legacy) referanse-rente
  norgesBankRateObservedAt?: string;
  // Betalingsstart + minimum
  interestStartDate?: string;           // 2026-06-01
  minMonthlyPayment?: number;           // 33 000 NOK
  // Partsinfo
  buyerName?: string;                   // Odin Jacobsen
  buyerCompany?: string;                // Nordic Invest AS
  buyerOrgNumber?: string;
  buyerEmail?: string;
  sellerEntity?: string;                // Extrade Holding AS
  sellerOrgNumber?: string;
  // Kontrakt
  contractStoragePath?: string;         // path i Supabase storage
  contractFileName?: string;
  notes?: string;
}

export interface MondeoLoanPayment {
  id: string;
  date: string;
  amount: number;
  note?: string;
  postedTransactionId?: string;
}

// Påløpte kostnader (strøm, kommunalt, andre utlegg)
// som Mondeo Eiendom / Extrade Holding har dekket på vegne av kjøper
// og som skal tillegges hovedstolen til avtalen er gjort opp
export interface MondeoAdditionalCharge {
  id: string;
  date: string;
  amount: number;
  type: 'Strøm' | 'Kommunalt' | 'Forsikring' | 'Eiendomsskatt' | 'Vedlikehold' | 'Annet';
  note?: string;
}

export interface MondeoKpiAdjustment {
  id: string;
  year: number;                         // 2026, 2027, …
  kpiPct: number;                       // f.eks. 3.2
  appliedAt?: string;                   // når justeringen ble bokført
  principalBefore?: number;
  principalAfter?: number;
  note?: string;
}

export interface MondeoLedgerRow {
  id: string;
  nr: number;
  fromDate: string;
  date: string;
  openingBalance: number;
  interestDue: number;
  paid: number;
  charges?: number;                     // Påløpte tillegg (strøm/kommunalt) i perioden
  principalChange: number;              // positiv = avdrag, negativ = lånet øker
  closingBalance: number;
  status: 'Avdrag' | 'Lånet øker' | 'KPI-justering' | 'Manglende min.' | 'Rente kapitaliseres' | 'Tillegg påløpt';
}
