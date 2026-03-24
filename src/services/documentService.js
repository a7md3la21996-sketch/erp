// ── Document Management Service ─────────────────────────────────────────
// localStorage-based document metadata storage with Supabase sync

import supabase from '../lib/supabase';

const LOCAL_KEY = 'platform_documents';

// ── Helpers ──────────────────────────────────────────────────────────────
function getAll() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}

function saveAll(docs) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(docs));
  } catch (e) {
    // QuotaExceededError — trim oldest entries and retry
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      const trimmed = docs.slice(0, Math.floor(docs.length * 0.6));
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
    }
  }
}

// ── Document Types ──────────────────────────────────────────────────────
export const DOCUMENT_TYPES = [
  { id: 'contract',  ar: 'عقد',       en: 'Contract' },
  { id: 'invoice',   ar: 'فاتورة',    en: 'Invoice' },
  { id: 'proposal',  ar: 'عرض سعر',   en: 'Proposal' },
  { id: 'report',    ar: 'تقرير',     en: 'Report' },
  { id: 'other',     ar: 'أخرى',      en: 'Other' },
];

export const DOC_TYPE_COLORS = {
  contract: '#10B981',
  invoice:  '#F59E0B',
  proposal: '#3B82F6',
  report:   '#8B5CF6',
  other:    '#6B7280',
};

// ── CRUD Operations ─────────────────────────────────────────────────────

/**
 * Add a new document metadata entry
 */
export async function addDocument({
  name,
  type = 'other',
  entity,       // 'contact' | 'deal' | 'opportunity'
  entity_id,
  entity_name = '',
  file_name = '',
  file_size = 0,
  file_type = '',
  uploaded_by = 'System',
  notes = '',
  tags = [],
}) {
  const doc = {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name,
    type,
    entity,
    entity_id: String(entity_id),
    entity_name,
    file_name: file_name || name,
    file_size,
    file_type,
    file_url: `https://storage.example.com/documents/${Date.now()}_${encodeURIComponent(file_name || name)}`,
    uploaded_by,
    uploaded_at: new Date().toISOString(),
    notes,
    tags: Array.isArray(tags) ? tags : [],
  };

  // Optimistic localStorage save
  const docs = getAll();
  docs.unshift(doc);
  saveAll(docs);

  try {
    const { data, error } = await supabase
      .from('documents')
      .insert([doc])
      .select('*')
      .single();
    if (error) throw error;
    if (data) return data;
  } catch {
    // localStorage already saved
  }
  return doc;
}

/**
 * Get all documents, optionally filtered
 */
export async function getDocuments({ entity, entity_id, type, search } = {}) {
  try {
    let query = supabase
      .from('documents')
      .select('*')
      .order('uploaded_at', { ascending: false });

    if (entity) query = query.eq('entity', entity);
    if (entity_id) query = query.eq('entity_id', String(entity_id));
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      saveAll(data); // sync to localStorage
      let docs = data;
      if (search) {
        const q = search.toLowerCase();
        docs = docs.filter(d =>
          (d.name || '').toLowerCase().includes(q) ||
          (d.file_name || '').toLowerCase().includes(q) ||
          (d.notes || '').toLowerCase().includes(q) ||
          (d.tags || []).some(t => t.toLowerCase().includes(q))
        );
      }
      return docs;
    }
  } catch {
    // fallback to localStorage
  }

  let docs = getAll();
  if (entity) docs = docs.filter(d => d.entity === entity);
  if (entity_id) docs = docs.filter(d => String(d.entity_id) === String(entity_id));
  if (type) docs = docs.filter(d => d.type === type);
  if (search) {
    const q = search.toLowerCase();
    docs = docs.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.file_name || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q) ||
      (d.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  return docs;
}

/**
 * Get documents for a specific entity
 */
export async function getDocumentsByEntity(entity, entity_id) {
  return getDocuments({ entity, entity_id });
}

/**
 * Delete a document by id
 */
export async function deleteDocument(id) {
  // Optimistic localStorage delete
  const docs = getAll();
  const idx = docs.findIndex(d => d.id === id);
  if (idx === -1) return null;
  const [removed] = docs.splice(idx, 1);
  saveAll(docs);

  try {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch {
    // localStorage already saved
  }

  return removed;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
