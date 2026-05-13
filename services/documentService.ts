import { supabase, isSupabaseConfigured } from '../supabase';

export type DocumentCategory = 'Forsikring' | 'Bolig' | 'Bil' | 'Helse' | 'Barn' | 'Kontrakt' | 'Garanti' | 'Annet';

export interface FamilyDocumentRecord {
  id: string;
  householdId: string;
  title: string;
  category: DocumentCategory;
  owner: string;
  expiryDate?: string;
  note?: string;
  fileName?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NewFamilyDocumentInput {
  householdId: string;
  userId?: string;
  title: string;
  category: DocumentCategory;
  owner: string;
  expiryDate?: string;
  note?: string;
  fileName?: string;
}

function mapDocument(row: any): FamilyDocumentRecord {
  return {
    id: row.id,
    householdId: row.household_id,
    title: row.title,
    category: (row.category || 'Annet') as DocumentCategory,
    owner: row.owner_label || 'Familien',
    expiryDate: row.expiry_date || undefined,
    note: row.note || undefined,
    fileName: row.file_name || undefined,
    storagePath: row.storage_path || undefined,
    mimeType: row.mime_type || undefined,
    fileSize: row.file_size ? Number(row.file_size) : undefined,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

export async function fetchFamilyDocuments(householdId: string): Promise<FamilyDocumentRecord[]> {
  if (!householdId || !isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('family_documents')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[documentService] fetch documents failed', error);
    throw error;
  }

  return (data || []).map(mapDocument);
}

export async function createFamilyDocument(input: NewFamilyDocumentInput): Promise<FamilyDocumentRecord | null> {
  if (!input.householdId || !isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('family_documents')
    .insert({
      household_id: input.householdId,
      created_by: input.userId || null,
      title: input.title,
      category: input.category || 'Annet',
      owner_label: input.owner || 'Familien',
      expiry_date: input.expiryDate || null,
      note: input.note || null,
      file_name: input.fileName || null,
    })
    .select('*')
    .single();

  if (error) {
    console.warn('[documentService] create document failed', error);
    throw error;
  }

  return mapDocument(data);
}

export async function deleteFamilyDocument(documentId: string): Promise<void> {
  if (!documentId || !isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('family_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.warn('[documentService] delete document failed', error);
    throw error;
  }
}
