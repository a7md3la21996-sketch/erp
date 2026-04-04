import { reportError } from '../utils/errorReporter';
import { createNotification } from './notificationsService';
import { logAction } from './auditService';
import supabase from '../lib/supabase';
import { stripInternalFields } from '../utils/sanitizeForSupabase';

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

  const { error } = await supabase.from('chat_messages').insert([stripInternalFields(comment)]);
  if (error) {
    reportError('chatService', 'addComment', error);
    throw error;
  }

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

  return comment;
}

// ── Get Comments for entity ────────────────────────────────────
export async function getComments(entity, entityId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('entity', entity)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false }).limit(200);
  if (error) {
    reportError('chatService', 'getComments', error);
    throw error;
  }
  return data || [];
}

// ── Get Recent Comments ────────────────────────────────────────
export async function getRecentComments(limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    reportError('chatService', 'getRecentComments', error);
    throw error;
  }
  return data || [];
}

// ── Get Mentions for user ──────────────────────────────────────
export async function getMentions(userId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .contains('mentions', [{ id: userId }])
    .order('created_at', { ascending: false }).limit(200);
  if (error) {
    reportError('chatService', 'getMentions', error);
    throw error;
  }
  return data || [];
}

// ── Delete Comment ─────────────────────────────────────────────
export async function deleteComment(commentId) {
  const { error } = await supabase.from('chat_messages').delete().eq('id', commentId);
  if (error) {
    reportError('chatService', 'deleteComment', error);
    throw error;
  }
  window.dispatchEvent(new CustomEvent('platform_comment', { detail: { id: commentId, deleted: true } }));
}

// ── Edit Comment ───────────────────────────────────────────────
export async function editComment(commentId, newText) {
  const editedAt = new Date().toISOString();
  const newMentions = parseMentions(newText, TEAM_MEMBERS);

  const { data, error } = await supabase.from('chat_messages').update({
    text: newText,
    edited_at: editedAt,
    mentions: newMentions,
  }).eq('id', commentId).select('*').single();

  if (error) {
    reportError('chatService', 'editComment', error);
    throw error;
  }

  if (data) {
    window.dispatchEvent(new CustomEvent('platform_comment', { detail: data }));
  }
  return data || null;
}
