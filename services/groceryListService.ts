// CRUD for handlelister og items i family.grocery_lists / family.grocery_items.
// Brukes av ShoppingList for å lage flere navngitte lister med datoer
// (f.eks. "Handleliste Victoria bursdag" 2026-06-12).

import { supabase, isSupabaseConfigured } from '../supabase';

export interface GroceryList {
  id: string;
  name: string;
  listDate?: string | null;       // YYYY-MM-DD
  occasion?: string | null;
  isDefault?: boolean;
  isArchived?: boolean;
  notes?: string | null;
  createdAt?: string;
}

export interface PersistedGroceryItem {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  unit: string;
  store?: string;
  category?: string | null;
  notes?: string | null;
  isBought: boolean;
  boughtAt?: string | null;
  position?: number;
}

function mapList(row: any): GroceryList {
  return {
    id: row.id,
    name: row.name,
    listDate: row.list_date,
    occasion: row.occasion,
    isDefault: !!row.is_default,
    isArchived: !!row.is_archived,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapItem(row: any): PersistedGroceryItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: Number(row.quantity || 1),
    unit: row.unit || 'stk',
    store: row.store || 'Andre',
    category: row.category,
    notes: row.notes,
    isBought: !!row.is_bought,
    boughtAt: row.bought_at,
    position: Number(row.position || 0),
  };
}

export async function loadGroceryLists(userId: string): Promise<GroceryList[]> {
  if (!userId || !isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('is_default', { ascending: false })
    .order('list_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[groceryListService] loadGroceryLists', error);
    return [];
  }
  return (data || []).map(mapList);
}

export async function ensureDefaultList(userId: string): Promise<GroceryList | null> {
  if (!userId || !isSupabaseConfigured()) return null;
  const { data: existing } = await supabase
    .from('grocery_lists')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .eq('is_archived', false)
    .limit(1)
    .maybeSingle();
  if (existing) return mapList(existing);
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({ user_id: userId, name: 'Familiens handleliste', list_date: today, is_default: true })
    .select()
    .single();
  if (error) {
    console.warn('[groceryListService] ensureDefaultList', error);
    return null;
  }
  return data ? mapList(data) : null;
}

export async function createGroceryList(userId: string, payload: { name: string; listDate?: string | null; occasion?: string | null; notes?: string | null }): Promise<GroceryList | null> {
  if (!userId || !isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('grocery_lists')
    .insert({
      user_id: userId,
      name: payload.name?.trim() || 'Ny handleliste',
      list_date: payload.listDate || null,
      occasion: payload.occasion?.trim() || null,
      notes: payload.notes?.trim() || null,
    })
    .select()
    .single();
  if (error) {
    console.warn('[groceryListService] createGroceryList', error);
    return null;
  }
  return data ? mapList(data) : null;
}

export async function renameGroceryList(listId: string, patch: { name?: string; listDate?: string | null; occasion?: string | null; notes?: string | null }): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const update: any = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.listDate !== undefined) update.list_date = patch.listDate;
  if (patch.occasion !== undefined) update.occasion = patch.occasion;
  if (patch.notes !== undefined) update.notes = patch.notes;
  const { error } = await supabase.from('grocery_lists').update(update).eq('id', listId);
  if (error) console.warn('[groceryListService] renameGroceryList', error);
  return !error;
}

export async function archiveGroceryList(listId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('grocery_lists').update({ is_archived: true }).eq('id', listId);
  if (error) console.warn('[groceryListService] archiveGroceryList', error);
  return !error;
}

export async function deleteGroceryList(listId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('grocery_lists').delete().eq('id', listId);
  if (error) console.warn('[groceryListService] deleteGroceryList', error);
  return !error;
}

export async function loadGroceryItems(listId: string): Promise<PersistedGroceryItem[]> {
  if (!listId || !isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('grocery_items')
    .select('*')
    .eq('list_id', listId)
    .order('is_bought', { ascending: true })
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[groceryListService] loadGroceryItems', error);
    return [];
  }
  return (data || []).map(mapItem);
}

export async function addGroceryItem(listId: string, userId: string, payload: { name: string; quantity?: number; unit?: string; store?: string; category?: string }): Promise<PersistedGroceryItem | null> {
  if (!listId || !userId || !isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('grocery_items')
    .insert({
      list_id: listId,
      user_id: userId,
      name: payload.name.trim(),
      quantity: payload.quantity ?? 1,
      unit: payload.unit || 'stk',
      store: payload.store || 'Andre',
      category: payload.category || null,
    })
    .select()
    .single();
  if (error) {
    console.warn('[groceryListService] addGroceryItem', error);
    return null;
  }
  return data ? mapItem(data) : null;
}

export async function toggleGroceryItem(itemId: string, isBought: boolean): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase
    .from('grocery_items')
    .update({ is_bought: isBought, bought_at: isBought ? new Date().toISOString() : null })
    .eq('id', itemId);
  if (error) console.warn('[groceryListService] toggleGroceryItem', error);
  return !error;
}

export async function deleteGroceryItem(itemId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('grocery_items').delete().eq('id', itemId);
  if (error) console.warn('[groceryListService] deleteGroceryItem', error);
  return !error;
}

export async function clearBoughtItems(listId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await supabase.from('grocery_items').delete().eq('list_id', listId).eq('is_bought', true);
  if (error) console.warn('[groceryListService] clearBoughtItems', error);
  return !error;
}
