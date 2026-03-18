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

export function getAll() {
  const list = load();
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

export function getById(id) {
  return load().find(a => a.id === id) || null;
}

export function create(data) {
  const list = load();
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
  list.unshift(article);
  save(list);
  return article;
}

export function update(id, data) {
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
  return list[idx];
}

export function remove(id) {
  const list = load().filter(a => a.id !== id);
  save(list);
  return true;
}

// ── Queries ────────────────────────────────────────────────────────────

export function searchArticles(query) {
  if (!query || !query.trim()) return getAll();
  const q = query.toLowerCase().trim();
  return getAll().filter(a => {
    return (
      a.title.toLowerCase().includes(q) ||
      a.title_ar.includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.content_ar.includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}

export function getByCategory(cat) {
  return getAll().filter(a => a.category === cat);
}

export function incrementViews(id) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return;
  list[idx].views = (list[idx].views || 0) + 1;
  save(list);
  return list[idx];
}

export function togglePin(id) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx].pinned = !list[idx].pinned;
  list[idx].updated_at = new Date().toISOString();
  save(list);
  return list[idx];
}
