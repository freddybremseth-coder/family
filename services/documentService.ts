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
const LOCAL_DOCS_KEY = 'familyhub_local_documents';

function mapDocument(row: any): FamilyDocumentRecord {
  return {
    id: row.id,
    householdId: row.household_id || row.householdId,
    title: row.title,
    category: (row.category || 'Annet') as DocumentCategory,
    owner: row.owner_label || row.owner || 'Familien',
    expiryDate: row.expiry_date || row.expiryDate || undefined,
    note: row.note || undefined,
    fileName: row.file_name || row.fileName || undefined,
    storagePath: row.storage_path || row.storagePath || undefined,
    mimeType: row.mime_type || row.mimeType || undefined,
    fileSize: row.file_size ? Number(row.file_size) : row.fileSize ? Number(row.fileSize) : undefined,
    createdAt: row.created_at || row.createdAt || undefined,
    updatedAt: row.updated_at || row.updatedAt || undefined,
  };
}

function readLocalDocs(): FamilyDocumentRecord[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_DOCS_KEY) || '[]'); } catch { return []; }
}

function writeLocalDocs(rows: FamilyDocumentRecord[]) {
  try { localStorage.setItem(LOCAL_DOCS_KEY, JSON.stringify(rows)); } catch {}
}

function createLocalDocument(input: NewFamilyDocumentInput): FamilyDocumentRecord {
  const now = new Date().toISOString();
  const record: FamilyDocumentRecord = {
    id: `local-doc-${Date.now()}`,
    householdId: input.householdId,
    title: input.title,
    category: input.category || 'Annet',
    owner: input.owner || 'Familien',
    expiryDate: input.expiryDate,
    note: input.note || (input.file ? 'Metadata lagret lokalt. Supabase Storage er ikke tilgjengelig, så selve filen må lastes opp igjen etter databaseoppsett.' : undefined),
    fileName: input.file?.name || input.fileName,
    mimeType: input.file?.type,
    fileSize: input.file?.size,
    createdAt: now,
    updatedAt: now,
  };
  const rows = readLocalDocs();
  writeLocalDocs([record, ...rows]);
  return record;
}

function safeFileName(name: string) {
  const cleaned = String(name || 'document').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'document';
}

export async function fetchFamilyDocuments(householdId: string): Promise<FamilyDocumentRecord[]> {
  if (!householdId) return [];
  const localRows = readLocalDocs().filter((doc) => doc.householdId === householdId);
  if (!isSupabaseConfigured() || householdId.startsWith('local-household-')) return localRows;

  const { data, error } = await supabase.from('family_documents').select('*').eq('household_id', householdId).order('created_at', { ascending: false });
  if (error) {
    console.warn('[documentService] fetch documents failed, using local fallback', error);
    return localRows;
  }
  return [...(data || []).map(mapDocument), ...localRows];
}

export async function createFamilyDocument(input: NewFamilyDocumentInput): Promise<FamilyDocumentRecord | null> {
  if (!input.householdId) return null;
  if (!isSupabaseConfigured() || input.householdId.startsWith('local-household-')) return createLocalDocument(input);

  const { data: created, error: createError } = await supabase.from('family_documents').insert({
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
  }).select('*').single();

  if (createError) {
    console.warn('[documentService] create document failed, saving metadata locally', createError);
    return createLocalDocument(input);
  }

  let storagePath: string | null = null;
  if (input.file) {
    const fileName = safeFileName(input.file.name);
    storagePath = `${input.householdId}/${created.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, { cacheControl: '3600', upsert: false, contentType: input.file.type || undefined });

    if (uploadError) {
      console.warn('[documentService] upload document failed, keeping database metadata and local note', uploadError);
      const local = createLocalDocument({ ...input, note: `${input.note || ''}\nFilopplasting feilet i Supabase Storage. Metadata er lagret lokalt.`.trim() });
      return { ...mapDocument(created), note: local.note };
    }

    const { data: updated, error: updateError } = await supabase.from('family_documents').update({ storage_path: storagePath, file_name: input.file.name, mime_type: input.file.type || null, file_size: input.file.size, updated_at: new Date().toISOString() }).eq('id', created.id).select('*').single();
    if (updateError) {
      console.warn('[documentService] update document storage metadata failed', updateError);
      return mapDocument(created);
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
  if (!documentId) return;
  const localRows = readLocalDocs();
  if (localRows.some((doc) => doc.id === documentId)) writeLocalDocs(localRows.filter((doc) => doc.id !== documentId));
  if (!isSupabaseConfigured() || documentId.startsWith('local-doc-')) return;

  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (storageError) console.warn('[documentService] delete storage object failed', storageError);
  }

  const { error } = await supabase.from('family_documents').delete().eq('id', documentId);
  if (error) {
    console.warn('[documentService] delete document failed', error);
    throw error;
  }
}
