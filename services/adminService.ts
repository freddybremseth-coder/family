import { supabase } from '../supabase';
import { ALL_NAVIGATION } from '../constants';
import { ModuleId } from '../config/productMode';

const LIFETIME_ADMIN_EMAIL = 'freddy.bremseth@gmail.com';

export type AdminUserProfile = {
  id: string;
  email: string;
  familyName: string;
  familyId?: string;
  subscriptionStatus: string;
  plan?: 'basic' | 'advanced' | 'lifetime';
  trialStartedAt?: string;
  createdAt?: string;
  enabledModules: string[];
};

const DEFAULT_USER_MODULES: ModuleId[] = [
  'dashboard',
  'familyplan',
  'shopping',
  'transactions',
  'bank',
  'documents',
  'trends',
  'receipts',
  'members',
  'settings',
];

export const ADMIN_MODULES = ALL_NAVIGATION.map((item) => ({ id: item.id as ModuleId, label: item.label }));

export const PLAN_DEFINITIONS = [
  { id: 'basic', label: 'Basic', description: 'Kalender, oppgaver, handleliste, familie, dokumenter og enkel økonomi.', modules: ['dashboard', 'familyplan', 'shopping', 'transactions', 'documents', 'members', 'settings'] },
  { id: 'advanced', label: 'Avansert', description: 'Alt i Basic pluss bank, eiendeler, likviditet, kvitteringer og regninger.', modules: DEFAULT_USER_MODULES },
  { id: 'lifetime', label: 'Livstidsabonnement', description: 'Full tilgang for eier/admin uten prøveperiode eller utløp.', modules: [...DEFAULT_USER_MODULES, 'business'] },
] as const;

export const MARKETPLACE_MODULES = [
  { id: 'business', label: 'Business / RealtyFlow', description: 'Salg, provisjoner, lån, Dona Anna/Olivia og fremtidig likviditet fra business.' },
  { id: 'receipts', label: 'Kvittering og kontoutskrift AI', description: 'AI-lesing, bankavstemming, kategorilæring og dokumentasjon.' },
  { id: 'documents', label: 'Dokumentlager', description: 'Household-dokumenter, kontrakter, pass, forsikring og garantier.' },
  { id: 'bank', label: 'Bank og eiendeler', description: 'Kontoer, lån, eiendeler og nettoformue.' },
  { id: 'familyplan', label: 'Kalender Pro', description: 'Familiekalender med gjentakelser, ansvarlig person, påminnelser og lokale helligdager.' },
];

function enabledFromAccess(accessRows: any[], userId: string): string[] {
  return accessRows
    .filter((access) => access.user_id === userId && access.enabled)
    .map((access) => access.module_id);
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isLifetimeAdmin(row: any) {
  return normalizeEmail(row.email) === LIFETIME_ADMIN_EMAIL;
}

function mapUser(row: any, accessRows: any[]): AdminUserProfile {
  const explicit = enabledFromAccess(accessRows, row.id);
  const lifetime = isLifetimeAdmin(row);
  return {
    id: row.id,
    email: row.email || '',
    familyName: lifetime ? 'BREMSETH' : (row.family_name || row.email || 'Ukjent familie'),
    familyId: row.family_id || row.household_id || undefined,
    subscriptionStatus: lifetime ? 'Livstidsabonnement' : (row.subscription_status || 'trial'),
    plan: lifetime ? 'lifetime' : (row.plan || row.subscription_plan || 'basic'),
    trialStartedAt: row.trial_started_at || undefined,
    createdAt: row.created_at || undefined,
    enabledModules: explicit.length > 0 ? explicit : (lifetime ? PLAN_DEFINITIONS.find((plan) => plan.id === 'lifetime')!.modules as string[] : DEFAULT_USER_MODULES),
  };
}

export async function fetchAdminUsers(): Promise<AdminUserProfile[]> {
  const [{ data: profiles, error: profilesError }, { data: accessRows, error: accessError }] = await Promise.all([
    supabase.from('user_profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('user_module_access').select('*'),
  ]);

  if (profilesError) throw profilesError;
  if (accessError) throw accessError;

  return (profiles || []).map((row) => mapUser(row, accessRows || []));
}

export async function fetchUserModuleAccess(userId: string): Promise<string[] | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_module_access')
    .select('module_id, enabled')
    .eq('user_id', userId);

  if (error) {
    console.warn('[adminService] fetchUserModuleAccess failed', error);
    return null;
  }

  if (!data || data.length === 0) return null;
  return data.filter((row: any) => row.enabled).map((row: any) => row.module_id);
}

export async function setUserModuleAccess(userId: string, moduleId: string, enabled: boolean, adminUserId?: string) {
  const { error } = await supabase
    .from('user_module_access')
    .upsert({
      user_id: userId,
      module_id: moduleId,
      enabled,
      updated_by: adminUserId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,module_id' });

  if (error) throw error;
}

export function defaultUserModules() {
  return DEFAULT_USER_MODULES;
}
