import { supabase, isSupabaseConfigured } from '../supabase';

export interface Household {
  id: string;
  name: string;
  ownerUserId: string;
  plan: 'free' | 'family' | 'family_pro' | 'business';
}

function mapHousehold(row: any): Household {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    plan: row.plan || 'family',
  };
}

export async function getOrCreateHousehold(userId: string, fallbackName = 'Familien'): Promise<Household | null> {
  if (!userId || !isSupabaseConfigured()) return null;

  const { data: owned, error: ownedError } = await supabase
    .from('households')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (owned) return mapHousehold(owned);
  if (ownedError && ownedError.code !== 'PGRST116') console.warn('[householdService] owned household lookup failed', ownedError);

  const { data: membershipRows, error: membershipError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .limit(1);

  if (!membershipError && membershipRows?.[0]?.household_id) {
    const { data: memberHousehold } = await supabase
      .from('households')
      .select('*')
      .eq('id', membershipRows[0].household_id)
      .maybeSingle();
    if (memberHousehold) return mapHousehold(memberHousehold);
  }

  const { data: created, error: createError } = await supabase
    .from('households')
    .insert({ name: fallbackName || 'Familien', owner_user_id: userId, plan: 'family' })
    .select('*')
    .single();

  if (createError) {
    console.warn('[householdService] create household failed', createError);
    return null;
  }

  await supabase.from('household_members').insert({
    household_id: created.id,
    user_id: userId,
    name: fallbackName || 'Familien',
    role: 'owner',
  });

  return mapHousehold(created);
}
