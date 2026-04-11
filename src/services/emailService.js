import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from "../utils/sanitizeForSupabase";
import supabase from '../lib/supabase';

const MAX_EMAILS = 1000;

function genId() {
  return 'eml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ── CRUD ───────────────────────────────────────────────────────

export async function sendEmail(data) {
  const email = {
    id: genId(),
    from: data.from || 'me@platform.com',
    to: data.to || '',
    to_name: data.to_name || '',
    subject: data.subject || '',
    body: data.body || '',
    sent_at: new Date().toISOString(),
    read: true,
    starred: false,
    folder: 'sent',
    contact_id: data.contact_id || null,
    opportunity_id: data.opportunity_id || null,
    thread_id: data.thread_id || genId(),
    attachments: data.attachments || [],
  };

  const { error } = await supabase.from('emails').insert([stripInternalFields(email)]);
  if (error) {
    reportError('emailService', 'sendEmail', error);
    throw error;
  }

  window.dispatchEvent(new Event('platform_emails_changed'));
  return email;
}

export async function getEmails(folder, filters = {}) {
  let query = supabase.from('emails').select('*');
  if (folder) query = query.eq('folder', folder);
  if (filters.starred) query = query.eq('starred', true);
  if (filters.unread) query = query.eq('read', false);
  query = query.order('sent_at', { ascending: false });
  const { data, error } = await query.range(0, 199);
  if (error) {
    reportError('emailService', 'getEmails', error);
    throw error;
  }
  let emails = data || [];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    emails = emails.filter(e =>
      (e.subject || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q) ||
      (e.to || '').toLowerCase().includes(q) ||
      (e.to_name || '').toLowerCase().includes(q) ||
      (e.from || '').toLowerCase().includes(q)
    );
  }
  return emails;
}

export async function getEmailsByContact(contactId) {
  const { data, error } = await supabase.from('emails').select('*').eq('contact_id', contactId).order('sent_at', { ascending: false }).limit(100);
  if (error) {
    reportError('emailService', 'getEmailsByContact', error);
    throw error;
  }
  return data || [];
}

export async function getEmailsByOpportunity(oppId) {
  const { data, error } = await supabase.from('emails').select('*').eq('opportunity_id', oppId).order('sent_at', { ascending: false }).limit(100);
  if (error) {
    reportError('emailService', 'getEmailsByOpportunity', error);
    throw error;
  }
  return data || [];
}

export async function markAsRead(id) {
  const { error } = await supabase.from('emails').update({ read: true }).eq('id', id);
  if (error) {
    reportError('emailService', 'markAsRead', error);
    throw error;
  }
  window.dispatchEvent(new Event('platform_emails_changed'));
}

export async function toggleReadStatus(id) {
  // First fetch current state
  const { data: current, error: fetchErr } = await supabase.from('emails').select('read').eq('id', id).maybeSingle();
  if (fetchErr) {
    reportError('emailService', 'toggleReadStatus', fetchErr);
    throw fetchErr;
  }
  const newRead = !(current?.read);
  const { error } = await supabase.from('emails').update({ read: newRead }).eq('id', id);
  if (error) {
    reportError('emailService', 'toggleReadStatus', error);
    throw error;
  }
  window.dispatchEvent(new Event('platform_emails_changed'));
}

export async function starEmail(id) {
  // First fetch current state
  const { data: current, error: fetchErr } = await supabase.from('emails').select('starred').eq('id', id).maybeSingle();
  if (fetchErr) {
    reportError('emailService', 'starEmail', fetchErr);
    throw fetchErr;
  }
  const newStarred = !(current?.starred);
  const { error } = await supabase.from('emails').update({ starred: newStarred }).eq('id', id);
  if (error) {
    reportError('emailService', 'starEmail', error);
    throw error;
  }
  window.dispatchEvent(new Event('platform_emails_changed'));
}

export async function moveToTrash(id) {
  // First fetch current folder to decide delete vs move
  const { data: current, error: fetchErr } = await supabase.from('emails').select('folder').eq('id', id).maybeSingle();
  if (fetchErr) {
    reportError('emailService', 'moveToTrash', fetchErr);
    throw fetchErr;
  }

  if (current?.folder === 'trash') {
    // permanent delete
    const { error } = await supabase.from('emails').delete().eq('id', id);
    if (error) {
      reportError('emailService', 'moveToTrash', error);
      throw error;
    }
  } else {
    const { error } = await supabase.from('emails').update({ folder: 'trash' }).eq('id', id);
    if (error) {
      reportError('emailService', 'moveToTrash', error);
      throw error;
    }
  }
  window.dispatchEvent(new Event('platform_emails_changed'));
}

export async function getDrafts() {
  const { data, error } = await supabase.from('emails').select('*').eq('folder', 'draft').order('sent_at', { ascending: false }).limit(100);
  if (error) {
    reportError('emailService', 'getDrafts', error);
    throw error;
  }
  return data || [];
}

export async function saveDraft(data) {
  // If updating existing draft
  if (data.id) {
    const { error } = await supabase.from('emails').update({ ...stripInternalFields(data), folder: 'draft' }).eq('id', data.id);
    if (error) {
      reportError('emailService', 'saveDraft', error);
      throw error;
    }
    window.dispatchEvent(new Event('platform_emails_changed'));
    return { ...data, folder: 'draft' };
  }

  const draft = {
    id: genId(),
    from: data.from || 'me@platform.com',
    to: data.to || '',
    to_name: data.to_name || '',
    subject: data.subject || '',
    body: data.body || '',
    sent_at: new Date().toISOString(),
    read: true,
    starred: false,
    folder: 'draft',
    contact_id: data.contact_id || null,
    opportunity_id: data.opportunity_id || null,
    thread_id: data.thread_id || genId(),
    attachments: data.attachments || [],
  };

  const { error } = await supabase.from('emails').insert([stripInternalFields(draft)]);
  if (error) {
    reportError('emailService', 'saveDraft', error);
    throw error;
  }

  window.dispatchEvent(new Event('platform_emails_changed'));
  return draft;
}

export async function getEmailStats() {
  const { data, error } = await supabase.from('emails').select('folder, read').range(0, 499);
  if (error) {
    // Silent — emails table may not exist yet
    return { inbox: 0, unread: 0, sent: 0, draft: 0, total: 0 };
  }
  const emails = data || [];
  return {
    inbox: emails.filter(e => e.folder === 'inbox').length,
    unread: emails.filter(e => e.folder === 'inbox' && !e.read).length,
    sent: emails.filter(e => e.folder === 'sent').length,
    drafts: emails.filter(e => e.folder === 'draft').length,
  };
}

// ── Templates ──────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_1',
    name: 'Follow Up',
    name_ar: 'متابعة',
    subject: 'Following up on our conversation',
    subject_ar: 'متابعة محادثتنا',
    body: 'Dear {name},\n\nI wanted to follow up on our recent conversation regarding {opportunity}.\n\nPlease let me know if you have any questions.\n\nBest regards',
    body_ar: 'عزيزي {name}،\n\nأود متابعة محادثتنا الأخيرة بخصوص {opportunity}.\n\nيرجى إعلامي إذا كان لديك أي استفسارات.\n\nمع أطيب التحيات',
    category: 'follow_up',
  },
  {
    id: 'tpl_2',
    name: 'Introduction',
    name_ar: 'تعريف',
    subject: 'Introduction - Platform Real Estate',
    subject_ar: 'تعريف - بلاتفورم للعقارات',
    body: 'Dear {name},\n\nThank you for your interest in our properties. I would like to introduce myself and our available units.\n\nBest regards',
    body_ar: 'عزيزي {name}،\n\nشكراً لاهتمامك بعقاراتنا. أود أن أقدم نفسي والوحدات المتاحة لدينا.\n\nمع أطيب التحيات',
    category: 'introduction',
  },
  {
    id: 'tpl_3',
    name: 'Meeting Request',
    name_ar: 'طلب اجتماع',
    subject: 'Meeting Request',
    subject_ar: 'طلب اجتماع',
    body: 'Dear {name},\n\nI would like to schedule a meeting to discuss {opportunity} in more detail.\n\nPlease let me know your availability.\n\nBest regards',
    body_ar: 'عزيزي {name}،\n\nأود تحديد موعد لاجتماع لمناقشة {opportunity} بمزيد من التفصيل.\n\nيرجى إعلامي بأوقات تواجدك.\n\nمع أطيب التحيات',
    category: 'meeting',
  },
];

export async function getTemplates() {
  const { data, error } = await supabase.from('email_templates').select('*').limit(100);
  if (error) {
    reportError('emailService', 'getTemplates', error);
    throw error;
  }
  if (data && data.length > 0) return data;

  // Supabase is empty — seed default templates
  const { error: seedErr } = await supabase.from('email_templates').insert(DEFAULT_TEMPLATES.map(t => stripInternalFields(t)));
  if (seedErr) {
    reportError('emailService', 'getTemplates:seed', seedErr);
  }
  return DEFAULT_TEMPLATES;
}

export async function saveTemplate(data) {
  if (data.id) {
    // Check if template exists
    const { data: existing } = await supabase.from('email_templates').select('id').eq('id', data.id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('email_templates').update(stripInternalFields(data)).eq('id', data.id);
      if (error) {
        reportError('emailService', 'saveTemplate', error);
        throw error;
      }
      return data;
    }
  }

  const tpl = {
    id: data.id || 'tpl_' + Date.now(),
    name: data.name || '',
    name_ar: data.name_ar || '',
    subject: data.subject || '',
    subject_ar: data.subject_ar || '',
    body: data.body || '',
    body_ar: data.body_ar || '',
    category: data.category || 'general',
  };

  const { error } = await supabase.from('email_templates').insert([stripInternalFields(tpl)]);
  if (error) {
    reportError('emailService', 'saveTemplate', error);
    throw error;
  }
  return tpl;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('email_templates').delete().eq('id', id);
  if (error) {
    reportError('emailService', 'deleteTemplate', error);
    throw error;
  }
}
