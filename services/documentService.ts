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
  file?: File | null;
}

const BUCKET = 'family-documents';

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

function safeFileName(name: string) {
  const cleaned = String(name || 'document')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'document';
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

  const { data: created, error: createError } = await supabase
    .from('family_documents')
    .insert({
      household_id: input.householdId,
      created_by: input.userId || null,
      title: input.title,
      category: input.category || 'Annet',
      owner_label: input.owner || 'Familien',
      expiry_date: input.expiryDate || null,
      note: input.note || null,
      file_name: input.file?.name || input.fileName || null,
      mime_type: input.file?.type || null,
      file_size: input.file?.size || null,
    })
    .select('*')
    .single();

  if (createError) {
    console.warn('[documentService] create document failed', createError);
    throw createError;
  }

  let storagePath: string | null = null;
  if (input.file) {
    const fileName = safeFileName(input.file.name);
    storagePath = `${input.householdId}/${created.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: input.file.type || undefined,
      });

    if (uploadError) {
      await supabase.from('family_documents').delete().eq('id', created.id);
      console.warn('[documentService] upload document failed', uploadError);
      throw uploadError;
    }

    const { data: updated, error: updateError } = await supabase
      .from('family_documents')
      .update({
        storage_path: storagePath,
        file_name: input.file.name,
        mime_type: input.file.type || null,
        file_size: input.file.size,
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.id)
      .select('*')
      .single();

    if (updateError) {
      console.warn('[documentService] update document storage metadata failed', updateError);
      throw updateError;
    }

    return mapDocument(updated);
  }

  return mapDocument(created);
}

export async function getFamilyDocumentSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath || !isSupabaseConfigured()) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 5);
  if (error) {
    console.warn('[documentService] signed url failed', error);
    throw error;
  }
  return data?.signedUrl || null;
}

export async function deleteFamilyDocument(documentId: string, storagePath?: string): Promise<void> {
  if (!documentId || !isSupabaseConfigured()) return;

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (storageError) console.warn('[documentService] delete storage object failed', storageError);
  }

  const { error } = await supabase
    .from('family_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.warn('[documentService] delete document failed', error);
    throw error;
  }
}
