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
  env.VITE_APP_MODE === 'saas' ? 'saas' : 'personal';

const rawEnabledModules = String(env.VITE_ENABLED_MODULES || '').trim();
const enabledModuleSet = new Set(
  rawEnabledModules
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

const rawDisabledModules = String(env.VITE_DISABLED_MODULES || '').trim();
const disabledModuleSet = new Set(
  rawDisabledModules
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
);

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

export function isModuleEnabled(moduleId: ModuleId): boolean {
  if (enabledModuleSet.size > 0) return enabledModuleSet.has(moduleId);
  if (disabledModuleSet.has(moduleId)) return false;
  if (PRODUCT_MODE === 'saas') return SAAS_DEFAULT_MODULES.has(moduleId);
  return true;
}

export function filterEnabledModules<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => isModuleEnabled(item.id as ModuleId));
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
