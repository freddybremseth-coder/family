import { supabase } from '../supabase';
import { ALL_NAVIGATION } from '../constants';
import { ModuleId } from '../config/productMode';

export type AdminUserProfile = {
  id: string;
  email: string;
  familyName: string;
  subscriptionStatus: string;
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

function enabledFromAccess(accessRows: any[], userId: string): string[] {
  return accessRows
    .filter((access) => access.user_id === userId && access.enabled)
    .map((access) => access.module_id);
}

function mapUser(row: any, accessRows: any[]): AdminUserProfile {
  const explicit = enabledFromAccess(accessRows, row.id);
  return {
    id: row.id,
    email: row.email || '',
    familyName: row.family_name || row.email || 'Ukjent familie',
    subscriptionStatus: row.subscription_status || 'trial',
    trialStartedAt: row.trial_started_at || undefined,
    createdAt: row.created_at || undefined,
    enabledModules: explicit.length > 0 ? explicit : DEFAULT_USER_MODULES,
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
