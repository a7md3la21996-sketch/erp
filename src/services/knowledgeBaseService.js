import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_knowledge_base';
const MAX_ARTICLES = 500;

// ── Categories ─────────────────────────────────────────────────────────
export const CATEGORIES = {
  sales_process:      { ar: 'عمليات المبيعات',    en: 'Sales Process',       color: '#4A7AAB', icon: 'TrendingUp' },
  product_info:       { ar: 'معلومات المنتجات',    en: 'Product Info',        color: '#10B981', icon: 'Package' },
  objection_handling: { ar: 'معالجة الاعتراضات',   en: 'Objection Handling',  color: '#F59E0B', icon: 'MessageCircle' },
  onboarding:         { ar: 'تأهيل الموظفين',      en: 'Onboarding',         color: '#8B5CF6', icon: 'UserPlus' },
  policies:           { ar: 'السياسات',            en: 'Policies',           color: '#EF4444', icon: 'Shield' },
  faq:                { ar: 'الأسئلة الشائعة',     en: 'FAQ',                color: '#06B6D4', icon: 'HelpCircle' },
};

// ── localStorage helpers ───────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_ARTICLES) list = list.slice(0, MAX_ARTICLES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_ARTICLES / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── CRUD ───────────────────────────────────────────────────────────────

export async function getAll() {
  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }).range(0, 199);
    if (error) throw error;
    if (data) {
      save(data); // sync to localStorage
      return data;
    }
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // fallback to localStorage
  }
  const list = load();
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

export async function getById(id) {
  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data || null;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // fallback to localStorage
  }
  return load().find(a => a.id === id) || null;
}

export async function create(data) {
  const article = {
    id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: data.title || '',
    title_ar: data.title_ar || '',
    content: data.content || '',
    content_ar: data.content_ar || '',
    category: data.category || 'faq',
    tags: data.tags || [],
    author: data.author || 'Unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    views: 0,
    pinned: data.pinned || false,
  };

  // Optimistic localStorage save
  const list = load();
  list.unshift(article);
  save(list);

  try {
    const { data: row, error } = await supabase
      .from('knowledge_articles')
      .insert([article])
      .select('*')
      .single();
    if (error) throw error;
    if (row) return row;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // localStorage already saved
  }
  return article;
}

export async function update(id, data) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...data,
    id, // preserve id
    updated_at: new Date().toISOString(),
  };
  save(list);

  try {
    const { data: row, error } = await supabase
      .from('knowledge_articles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (row) return row;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // localStorage already saved
  }
  return list[idx];
}

export async function remove(id) {
  // Optimistic localStorage delete
  const list = load().filter(a => a.id !== id);
  save(list);

  try {
    const { error } = await supabase
      .from('knowledge_articles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // localStorage already saved
  }
  return true;
}

// ── Queries ────────────────────────────────────────────────────────────

export async function searchArticles(query) {
  if (!query || !query.trim()) return getAll();
  const q = query.toLowerCase().trim();

  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .or(`title.ilike.%${q}%,title_ar.ilike.%${q}%,content.ilike.%${q}%,content_ar.ilike.%${q}%`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }).range(0, 199);
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // fallback to localStorage
  }

  const all = await getAll();
  return all.filter(a => {
    return (
      a.title.toLowerCase().includes(q) ||
      a.title_ar.includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.content_ar.includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}

export async function getByCategory(cat) {
  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .select('*')
      .eq('category', cat)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }).range(0, 199);
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // fallback to localStorage
  }
  const all = await getAll();
  return all.filter(a => a.category === cat);
}

export async function incrementViews(id) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return;
  list[idx].views = (list[idx].views || 0) + 1;
  save(list);

  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({ views: list[idx].views })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // localStorage already saved
  }
  return list[idx];
}

export async function togglePin(id) {
  // Optimistic localStorage update
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx].pinned = !list[idx].pinned;
  list[idx].updated_at = new Date().toISOString();
  save(list);

  try {
    const { data, error } = await supabase
      .from('knowledge_articles')
      .update({ pinned: list[idx].pinned, updated_at: list[idx].updated_at })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (data) return data;
  } catch (err) { reportError('knowledgeBaseService', 'query', err);
    // localStorage already saved
  }
  return list[idx];
}
