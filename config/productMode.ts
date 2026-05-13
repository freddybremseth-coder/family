export type ProductMode = 'personal' | 'saas';
export type ModuleId =
  | 'dashboard'
  | 'familyplan'
  | 'shopping'
  | 'transactions'
  | 'bank'
  | 'documents'
  | 'trends'
  | 'receipts'
  | 'business'
  | 'members'
  | 'settings';

const env = import.meta.env;

export const PRODUCT_MODE: ProductMode =
  env.VITE_APP_MODE === 'personal' ? 'personal' : 'saas';

const normalizeList = (value: unknown) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const rawEnabledModules = String(env.VITE_ENABLED_MODULES || '').trim();
const enabledModuleSet = new Set(normalizeList(rawEnabledModules));

const rawDisabledModules = String(env.VITE_DISABLED_MODULES || '').trim();
const disabledModuleSet = new Set(normalizeList(rawDisabledModules));

const adminEmailSet = new Set(normalizeList(env.VITE_ADMIN_EMAILS || 'freddy.bremseth@gmail.com'));
const businessEmailSet = new Set(normalizeList(env.VITE_BUSINESS_EMAILS || 'freddy.bremseth@gmail.com'));

const SAAS_DEFAULT_MODULES = new Set<ModuleId>([
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
]);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmailSet.has(email.trim().toLowerCase());
}

export function canAccessBusiness(email?: string | null): boolean {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  if (String(env.VITE_ENABLE_BUSINESS_FOR_ALL || '').toLowerCase() === 'true') return true;
  return businessEmailSet.has(email.trim().toLowerCase());
}

export function isModuleEnabled(moduleId: ModuleId): boolean {
  const id = moduleId.toLowerCase();
  if (enabledModuleSet.size > 0) return enabledModuleSet.has(id);
  if (disabledModuleSet.has(id)) return false;
  if (PRODUCT_MODE === 'saas') return SAAS_DEFAULT_MODULES.has(moduleId);
  return true;
}

export function isModuleVisibleForUser(moduleId: ModuleId, email?: string | null): boolean {
  if (isAdminEmail(email)) return true;
  if (moduleId === 'business') return canAccessBusiness(email) && isModuleEnabled(moduleId);
  return isModuleEnabled(moduleId);
}

export function filterEnabledModules<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => isModuleEnabled(item.id as ModuleId));
}

export function filterModulesForUser<T extends { id: string }>(items: T[], email?: string | null): T[] {
  return items.filter((item) => isModuleVisibleForUser(item.id as ModuleId, email));
}

export const PRODUCT_COPY = {
  personal: {
    name: 'FamilieHub',
    tagline: 'Familiens private kontrollpanel for økonomi, kalender, eiendeler og business.',
  },
  saas: {
    name: 'FamilieHub',
    tagline: 'Familiens private kontrollpanel for økonomi, kalender, eiendeler og viktige dokumenter.',
  },
};

export const isPersonalBusinessEnabled = () => isModuleEnabled('business');
