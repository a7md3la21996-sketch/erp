import { createNotification } from './notificationsService';
import { logAction } from './auditService';
import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_comments';
const MAX_COMMENTS = 500;

// ── Team Members (mock) ────────────────────────────────────────
const TEAM_MEMBERS = [
  { id: 'e1', name: 'أحمد محمد', nameEn: 'Ahmed Mohamed' },
  { id: 'e2', name: 'سارة أحمد', nameEn: 'Sara Ahmed' },
  { id: 'e3', name: 'محمد علي', nameEn: 'Mohamed Ali' },
  { id: 'e4', name: 'فاطمة حسن', nameEn: 'Fatma Hassan' },
  { id: 'e5', name: 'خالد إبراهيم', nameEn: 'Khaled Ibrahim' },
  { id: 'e6', name: 'نورا سعيد', nameEn: 'Noura Said' },
  { id: 'e7', name: 'عمر طارق', nameEn: 'Omar Tarek' },
  { id: 'e8', name: 'ياسمين كمال', nameEn: 'Yasmin Kamal' },
];

export function getTeamMembers() {
  return TEAM_MEMBERS;
}

// ── localStorage helpers ───────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_COMMENTS) list = list.slice(0, MAX_COMMENTS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_COMMENTS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── Parse @mentions ────────────────────────────────────────────
export function parseMentions(text, teamMembers) {
  if (!text) return [];
  const mentions = [];
  const members = teamMembers || TEAM_MEMBERS;
  members.forEach(m => {
    if (text.includes('@' + m.name) || text.includes('@' + m.nameEn)) {
      mentions.push({ id: m.id, name: m.name });
    }
  });
  return mentions;
}

// ── Add Comment ────────────────────────────────────────────────
export async function addComment({ entity, entityId, entityName, text, authorId, authorName, mentions }) {
  const resolvedMentions = mentions || parseMentions(text, TEAM_MEMBERS);
  const comment = {
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    entity,
    entity_id: entityId,
    entity_name: entityName || '',
    text,
    author_id: authorId,
    author_name: authorName,
    mentions: resolvedMentions,
    created_at: new Date().toISOString(),
    edited_at: null,
  };

  const list = load();
  list.unshift(comment);
  save(list);

  // Create notifications for mentioned users
  resolvedMentions.forEach(m => {
    if (m.id !== authorId) {
      createNotification({
        type: 'system',
        title_ar: 'تم ذكرك في تعليق',
        title_en: 'You were mentioned in a comment',
        body_ar: `${authorName} ذكرك في تعليق على ${entityName || entity}`,
        body_en: `${authorName} mentioned you in a comment on ${entityName || entity}`,
        for_user_id: m.id,
        entity_type: entity,
        entity_id: entityId,
        from_user: authorName,
      });
    }
  });

  // Audit log
  logAction({
    action: 'create',
    entity: 'comment',
    entityId: comment.id,
    entityName: entityName,
    description: `Comment on ${entity}: ${text.slice(0, 80)}`,
    userName: authorName,
  });

  // Dispatch custom event for real-time UI update
  window.dispatchEvent(new CustomEvent('platform_comment', { detail: comment }));

  // Sync to Supabase
  try {
    await supabase.from('chat_messages').insert([comment]);
  } catch (err) {
    console.warn('Supabase insert (chat_messages) failed, localStorage used as fallback:', err);
  }

  return comment;
}

// ── Get Comments for entity ────────────────────────────────────
export async function getComments(entity, entityId) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('entity', entity)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) return data;
    // Fall through to localStorage if Supabase returns empty
  } catch (err) {
    console.warn('Supabase fetch (chat_messages by entity) failed, falling back to localStorage:', err);
  }

  initMockComments();
  return load().filter(c => c.entity === entity && c.entity_id === entityId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Get Recent Comments ────────────────────────────────────────
export async function getRecentComments(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('Supabase fetch (recent chat_messages) failed, falling back to localStorage:', err);
  }

  initMockComments();
  return load()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

// ── Get Mentions for user ──────────────────────────────────────
export async function getMentions(userId) {
  try {
    // Supabase: filter mentions containing the userId (jsonb contains)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .contains('mentions', [{ id: userId }])
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data && data.length > 0) return data;
  } catch (err) {
    console.warn('Supabase fetch (mentions) failed, falling back to localStorage:', err);
  }

  initMockComments();
  return load()
    .filter(c => c.mentions?.some(m => m.id === userId))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Delete Comment ─────────────────────────────────────────────
export async function deleteComment(commentId) {
  const list = load().filter(c => c.id !== commentId);
  save(list);
  window.dispatchEvent(new CustomEvent('platform_comment', { detail: { id: commentId, deleted: true } }));

  try {
    const { error } = await supabase.from('chat_messages').delete().eq('id', commentId);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase delete (chat_messages) failed, localStorage used as fallback:', err);
  }
}

// ── Edit Comment ───────────────────────────────────────────────
export async function editComment(commentId, newText) {
  const list = load();
  const idx = list.findIndex(c => c.id === commentId);
  if (idx !== -1) {
    list[idx].text = newText;
    list[idx].edited_at = new Date().toISOString();
    list[idx].mentions = parseMentions(newText, TEAM_MEMBERS);
    save(list);
    window.dispatchEvent(new CustomEvent('platform_comment', { detail: list[idx] }));

    try {
      const { error } = await supabase.from('chat_messages').update({
        text: newText,
        edited_at: list[idx].edited_at,
        mentions: list[idx].mentions,
      }).eq('id', commentId);
      if (error) throw error;
    } catch (err) {
      console.warn('Supabase update (chat_messages) failed, localStorage used as fallback:', err);
    }

    return list[idx];
  }
  return null;
}

// ── Mock / Seed Comments ───────────────────────────────────────
let _mockInitDone = false;
export function initMockComments() {
  if (_mockInitDone) return;
  _mockInitDone = true;
  const existing = load();
  if (existing.length > 0) return;

  const now = Date.now();
  const hour = 3600000;
  const seeds = [
    {
      id: 'cmt_seed_1',
      entity: 'contact',
      entity_id: 'c1',
      entity_name: 'علي حسن',
      text: 'تم التواصل مع العميل وابدى اهتمام بالمشروع الجديد @سارة أحمد تابعي معاه',
      author_id: 'e1',
      author_name: 'أحمد محمد',
      mentions: [{ id: 'e2', name: 'سارة أحمد' }],
      created_at: new Date(now - hour * 2).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_2',
      entity: 'contact',
      entity_id: 'c1',
      entity_name: 'علي حسن',
      text: 'تمام، هتواصل معاه النهاردة وأبلغك بالنتيجة',
      author_id: 'e2',
      author_name: 'سارة أحمد',
      mentions: [],
      created_at: new Date(now - hour * 1.5).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_3',
      entity: 'opportunity',
      entity_id: 'opp1',
      entity_name: 'فرصة - محمد أحمد',
      text: 'الفرصة دي محتاجة متابعة عاجلة @محمد علي @خالد إبراهيم',
      author_id: 'e1',
      author_name: 'أحمد محمد',
      mentions: [{ id: 'e3', name: 'محمد علي' }, { id: 'e5', name: 'خالد إبراهيم' }],
      created_at: new Date(now - hour * 5).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_4',
      entity: 'deal',
      entity_id: 'd1',
      entity_name: 'صفقة #1042',
      text: 'العقد جاهز للتوقيع، محتاجين موافقة الإدارة @فاطمة حسن',
      author_id: 'e3',
      author_name: 'محمد علي',
      mentions: [{ id: 'e4', name: 'فاطمة حسن' }],
      created_at: new Date(now - hour * 8).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_5',
      entity: 'deal',
      entity_id: 'd1',
      entity_name: 'صفقة #1042',
      text: 'تمت الموافقة. ممكن تكملوا إجراءات التوقيع',
      author_id: 'e4',
      author_name: 'فاطمة حسن',
      mentions: [],
      created_at: new Date(now - hour * 6).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_6',
      entity: 'opportunity',
      entity_id: 'opp2',
      entity_name: 'فرصة - سامي خالد',
      text: 'العميل طلب عرض سعر جديد بخصم 10% @نورا سعيد جهزي العرض',
      author_id: 'e7',
      author_name: 'عمر طارق',
      mentions: [{ id: 'e6', name: 'نورا سعيد' }],
      created_at: new Date(now - hour * 12).toISOString(),
      edited_at: null,
    },
    {
      id: 'cmt_seed_7',
      entity: 'contact',
      entity_id: 'c2',
      entity_name: 'منى عبدالله',
      text: 'تم إضافة بيانات العميلة الجديدة. @أحمد محمد رجاءً راجع البيانات',
      author_id: 'e8',
      author_name: 'ياسمين كمال',
      mentions: [{ id: 'e1', name: 'أحمد محمد' }],
      created_at: new Date(now - hour * 24).toISOString(),
      edited_at: null,
    },
  ];

  save(seeds);
}
