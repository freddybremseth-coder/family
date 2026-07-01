import { supabaseFamilyData as supabase, isSupabaseConfigured } from '../supabase';

export interface Household {
  id: string;
  name: string;
  ownerUserId: string;
  plan: 'free' | 'family' | 'family_pro' | 'business';
  isLocalFallback?: boolean;
  fallbackReason?: string;
}

const LOCAL_HOUSEHOLD_KEY = 'familyhub_local_household';

function mapHousehold(row: any): Household {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    plan: row.plan || 'family',
  };
}

function localHousehold(userId: string, fallbackName = 'Familien', lastError?: string): Household {
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_HOUSEHOLD_KEY) || 'null');
    if (existing?.id && existing?.ownerUserId === userId) return existing;
  } catch {}
  const household: Household = {
    id: `local-household-${userId || 'demo'}`,
    name: fallbackName || 'Familien',
    ownerUserId: userId || 'local-user',
    plan: 'family',
    isLocalFallback: true,
    fallbackReason: lastError,
  };
  try { localStorage.setItem(LOCAL_HOUSEHOLD_KEY, JSON.stringify(household)); } catch {}
  return household;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId?: string;              // Fylles inn når personen har opprettet konto
  invitedEmail?: string;        // Fylles ved invitasjon, blir null når claimet
  name: string;
  role: 'owner' | 'admin' | 'member' | 'child';
  status: 'active' | 'pending';
  invitedAt?: string;
  joinedAt?: string;
}

function mapMember(row: any): HouseholdMember {
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id || undefined,
    invitedEmail: row.invited_email || undefined,
    name: row.name || row.invited_email || 'Ukjent',
    role: (row.role || 'member') as HouseholdMember['role'],
    status: row.user_id ? 'active' : 'pending',
    invitedAt: row.invited_at || undefined,
    joinedAt: row.joined_at || undefined,
  };
}

export async function listHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!householdId || !isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('role', { ascending: true });
  if (error || !data) { console.warn('[householdService] list members failed', error); return []; }
  return data.map(mapMember);
}

export async function inviteHouseholdMember(householdId: string, email: string, name: string, role: HouseholdMember['role'] = 'member'): Promise<HouseholdMember | null> {
  const cleanedEmail = String(email || '').trim().toLowerCase();
  if (!householdId || !cleanedEmail) throw new Error('Household eller e-post mangler.');
  if (!isSupabaseConfigured()) throw new Error('Supabase ikke konfigurert.');

  // Sjekk om denne e-posten er invitert allerede
  const { data: existing } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .eq('invited_email', cleanedEmail)
    .maybeSingle();
  if (existing) return mapMember(existing);

  const { data, error } = await supabase
    .from('household_members')
    .insert({
      household_id: householdId,
      invited_email: cleanedEmail,
      name: name.trim() || cleanedEmail,
      role,
      invited_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapMember(data);
}

export async function removeHouseholdMember(memberId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('household_members').delete().eq('id', memberId);
  if (error) throw error;
}

// Kalles etter innlogging: hvis brukerens e-post finnes som invited_email i noen household,
// kobles brukeren til hushodet.
export async function claimPendingInvites(userId: string, email: string): Promise<{ joined: number }> {
  if (!userId || !email || !isSupabaseConfigured()) return { joined: 0 };
  const cleanedEmail = email.trim().toLowerCase();
  try {
    const { data: pending, error } = await supabase
      .from('household_members')
      .select('*')
      .eq('invited_email', cleanedEmail)
      .is('user_id', null);
    if (error || !pending || pending.length === 0) return { joined: 0 };
    let joined = 0;
    for (const row of pending) {
      const { error: updateError } = await supabase
        .from('household_members')
        .update({ user_id: userId, joined_at: new Date().toISOString(), invited_email: null })
        .eq('id', row.id);
      if (!updateError) joined += 1;
    }
    return { joined };
  } catch (e) {
    console.warn('[householdService] claim invites failed', e);
    return { joined: 0 };
  }
}

/**
 * Returnerer "effektiv" user_id for datalasting:
 * - Hvis brukeren er eier av et household → egen user_id
 * - Hvis brukeren er medlem (invitert) av et household → household-eierens user_id
 * - Fallback: egen user_id
 * Slik at Anna som er invitert til Freddys household ser Freddys data.
 */
export async function resolveEffectiveUserId(userId: string): Promise<string> {
  if (!userId || !isSupabaseConfigured()) return userId;
  try {
    // 1. Sjekk om brukeren er eier av et household — bruker egen id da
    const { data: owned } = await supabase
      .from('households')
      .select('owner_user_id')
      .eq('owner_user_id', userId)
      .limit(1)
      .maybeSingle();
    if (owned?.owner_user_id) return owned.owner_user_id;

    // 2. Ellers: sjekk om brukeren er medlem av et household → returner eierens id
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, households:household_id(owner_user_id)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    const ownerId = (membership as any)?.households?.owner_user_id;
    if (ownerId) return ownerId;
  } catch (e) {
    console.warn('[householdService] resolveEffectiveUserId failed', e);
  }
  return userId;
}

export async function getOrCreateHousehold(userId: string, fallbackName = 'Familien'): Promise<Household | null> {
  if (!userId) return null;
  if (!isSupabaseConfigured()) return localHousehold(userId, fallbackName);

  try {
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
      const msg = `${createError.code || 'ERR'}: ${createError.message || 'ukjent'}${createError.hint ? ' — ' + createError.hint : ''}`;
      console.warn('[householdService] create household failed, using local fallback', createError);
      return localHousehold(userId, fallbackName, msg);
    }

    const { error: memberError } = await supabase.from('household_members').insert({
      household_id: created.id,
      user_id: userId,
      name: fallbackName || 'Familien',
      role: 'owner',
    });
    if (memberError) console.warn('[householdService] first member insert failed', memberError);

    return mapHousehold(created);
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.warn('[householdService] household lookup/create crashed, using local fallback', err);
    return localHousehold(userId, fallbackName, msg);
  }
}
