import { stripInternalFields } from "../utils/sanitizeForSupabase";
// ── SMS Template Service ─────────────────────────────────────────────────
// localStorage-based with Supabase as primary, localStorage as fallback

import supabase from '../lib/supabase';

const TEMPLATES_KEY = 'platform_sms_templates';
const SMS_LOG_KEY = 'platform_sms_log';
const QUOTA_KEY = 'platform_sms_quota';

// ── Categories ──────────────────────────────────────────────────────────
export const CATEGORIES = [
  { id: 'welcome',      ar: 'ترحيب',       en: 'Welcome' },
  { id: 'followup',     ar: 'متابعة',      en: 'Follow Up' },
  { id: 'reminder',     ar: 'تذكير',       en: 'Reminder' },
  { id: 'promotion',    ar: 'ترويج',       en: 'Promotion' },
  { id: 'confirmation', ar: 'تأكيد',       en: 'Confirmation' },
  { id: 'custom',       ar: 'مخصص',        en: 'Custom' },
];

// ── Available Variables ────────────────────────────────────────────────
export const AVAILABLE_VARIABLES = [
  { key: 'client_name',   ar: 'اسم العميل',     en: 'Client Name' },
  { key: 'client_phone',  ar: 'هاتف العميل',    en: 'Client Phone' },
  { key: 'project_name',  ar: 'اسم المشروع',    en: 'Project Name' },
  { key: 'agent_name',    ar: 'اسم الموظف',     en: 'Agent Name' },
  { key: 'company_name',  ar: 'اسم الشركة',     en: 'Company Name' },
  { key: 'date',          ar: 'التاريخ',        en: 'Date' },
  { key: 'amount',        ar: 'المبلغ',         en: 'Amount' },
];

// ── Sample data for preview ────────────────────────────────────────────
export const SAMPLE_DATA = {
  client_name: 'Ahmed Ali',
  client_phone: '+201001234567',
  project_name: 'Sunset Gardens',
  agent_name: 'Mohamed Hassan',
  company_name: 'Platform Real Estate',
  date: new Date().toLocaleDateString('en-GB'),
  amount: '500,000 EGP',
};

// ── Helpers ────────────────────────────────────────────────────────────
function getAll() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; }
}
function saveAll(data) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(data)); } catch { /* quota */ }
}
function getLog() {
  try { return JSON.parse(localStorage.getItem(SMS_LOG_KEY) || '[]'); } catch { return []; }
}
function saveLog(logs) {
  try {
    if (logs.length > 1000) logs.length = 1000;
    localStorage.setItem(SMS_LOG_KEY, JSON.stringify(logs));
  } catch { /* quota */ }
}
function uid() {
  return 'sms_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ── CRUD ───────────────────────────────────────────────────────────────
export async function getTemplates(filters = {}) {
  try {
    let query = supabase.from('sms_templates').select('*').limit(100);
    if (filters.category) query = query.eq('category', filters.category);
    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    let templates = data || [];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      templates = templates.filter(t =>
        (t.name || '').toLowerCase().includes(q) ||
        (t.nameAr || '').toLowerCase().includes(q) ||
        (t.body || '').toLowerCase().includes(q) ||
        (t.bodyAr || '').toLowerCase().includes(q)
      );
    }
    if (templates.length > 0) return templates;
    // Fall through to localStorage if Supabase is empty
  } catch (err) {
    console.warn('Supabase fetch (sms_templates) failed, falling back to localStorage:', err);
  }

  // Existing localStorage logic
  let templates = getAll();
  if (filters.category) templates = templates.filter(t => t.category === filters.category);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    templates = templates.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.nameAr || '').toLowerCase().includes(q) ||
      (t.body || '').toLowerCase().includes(q) ||
      (t.bodyAr || '').toLowerCase().includes(q)
    );
  }
  return templates;
}

export async function getTemplateById(id) {
  try {
    const { data, error } = await supabase.from('sms_templates').select('*').limit(100).eq('id', id).single();
    if (error) throw error;
    if (data) return data;
  } catch (err) {
    console.warn('Supabase fetch (sms_template by id) failed, falling back to localStorage:', err);
  }

  return getAll().find(t => t.id === id) || null;
}

export async function createTemplate({ name, nameAr, body, bodyAr, category, variables = [] }) {
  const all = getAll();
  const now = new Date().toISOString();
  const template = {
    id: uid(), name, nameAr, body, bodyAr, category, variables,
    created_at: now, updated_at: now, send_count: 0,
  };
  all.unshift(template);
  saveAll(all);

  try {
    await supabase.from('sms_templates').insert([template]);
  } catch (err) {
    console.warn('Supabase insert (sms_templates) failed, localStorage used as fallback:', err);
  }

  return template;
}

export async function updateTemplate(id, updates) {
  const all = getAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
  saveAll(all);

  try {
    const { error } = await supabase.from('sms_templates').update({ ...stripInternalFields(updates), updated_at: all[idx].updated_at }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase update (sms_templates) failed, localStorage used as fallback:', err);
  }

  return all[idx];
}

export async function deleteTemplate(id) {
  const all = getAll();
  const filtered = all.filter(t => t.id !== id);
  saveAll(filtered);

  try {
    const { error } = await supabase.from('sms_templates').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase delete (sms_templates) failed, localStorage used as fallback:', err);
  }

  return true;
}

// ── Render / Send ──────────────────────────────────────────────────────
export async function renderTemplate(templateId, data = {}, lang = 'en') {
  const template = await getTemplateById(templateId);
  if (!template) return '';
  let text = lang === 'ar' ? (template.bodyAr || template.body) : template.body;
  Object.entries(data).forEach(([key, value]) => {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  });
  return text;
}

export function renderBody(body, data = {}) {
  let text = body || '';
  Object.entries(data).forEach(([key, value]) => {
    text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  });
  return text;
}

export async function sendSMS(phone, message, templateId = null, templateName = '') {
  const log = getLog();
  const entry = {
    id: uid(),
    phone,
    message,
    template_id: templateId,
    template_name: templateName,
    status: 'sent',
    sent_at: new Date().toISOString(),
  };
  log.unshift(entry);
  saveLog(log);

  // Increment template send_count
  if (templateId) {
    const all = getAll();
    const idx = all.findIndex(t => t.id === templateId);
    if (idx !== -1) {
      all[idx].send_count = (all[idx].send_count || 0) + 1;
      saveAll(all);
    }
  }

  // Create notification via service
  try {
    const { createNotification } = await import('./notificationsService');
    createNotification({
      type: 'sms_sent',
      title: 'SMS Sent',
      titleAr: 'تم إرسال الرسالة',
      message: `SMS sent to ${phone}`,
      messageAr: `تم إرسال رسالة إلى ${phone}`,
    });
  } catch { /* ignore */ }

  // Sync SMS log entry to Supabase
  try {
    await supabase.from('sms_log').insert([entry]);
    // Also update send_count in Supabase
    if (templateId) {
      await supabase.from('sms_templates').update({ send_count: (getAll().find(t => t.id === templateId)?.send_count || 1) }).eq('id', templateId);
    }
  } catch (err) {
    console.warn('Supabase insert (sms_log) failed, localStorage used as fallback:', err);
  }

  return entry;
}

export async function getSMSLog(filters = {}) {
  try {
    let query = supabase.from('sms_log').select('*').limit(200).order('sent_at', { ascending: false });
    if (filters.template_id) query = query.eq('template_id', filters.template_id);
    const { data, error } = await query;
    if (error) throw error;
    let log = data || [];
    if (filters.phone) {
      const q = filters.phone.toLowerCase();
      log = log.filter(l => (l.phone || '').toLowerCase().includes(q));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      log = log.filter(l =>
        (l.phone || '').toLowerCase().includes(q) ||
        (l.message || '').toLowerCase().includes(q) ||
        (l.template_name || '').toLowerCase().includes(q)
      );
    }
    if (log.length > 0) return log;
    // Fall through to localStorage if empty
  } catch (err) {
    console.warn('Supabase fetch (sms_log) failed, falling back to localStorage:', err);
  }

  // Existing localStorage logic
  let log = getLog();
  if (filters.phone) {
    const q = filters.phone.toLowerCase();
    log = log.filter(l => (l.phone || '').toLowerCase().includes(q));
  }
  if (filters.template_id) {
    log = log.filter(l => l.template_id === filters.template_id);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    log = log.filter(l =>
      (l.phone || '').toLowerCase().includes(q) ||
      (l.message || '').toLowerCase().includes(q) ||
      (l.template_name || '').toLowerCase().includes(q)
    );
  }
  return log;
}

export async function bulkSend(templateId, contacts = [], lang = 'en') {
  const results = [];
  for (const contact of contacts) {
    const data = {
      client_name: contact.full_name || contact.name || '',
      client_phone: contact.phone || '',
      project_name: contact.project || '',
      agent_name: contact.agent || '',
      company_name: contact.company || 'Platform',
      date: new Date().toLocaleDateString('en-GB'),
      amount: contact.amount || '',
    };
    const message = await renderTemplate(templateId, data, lang);
    const template = await getTemplateById(templateId);
    if (contact.phone && message) {
      const entry = await sendSMS(contact.phone, message, templateId, template?.name || '');
      results.push({ ...entry, contact_name: contact.full_name || contact.name });
    }
  }
  return results;
}

// ── Quota ──────────────────────────────────────────────────────────────
export function getQuota() {
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) || '{}');
    return { daily_limit: q.daily_limit || 100, used_today: q.used_today || 0, reset_date: q.reset_date || '' };
  } catch { return { daily_limit: 100, used_today: 0, reset_date: '' }; }
}

export function incrementQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const q = getQuota();
  if (q.reset_date !== today) {
    q.used_today = 0;
    q.reset_date = today;
  }
  q.used_today += 1;
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch { /* ignore */ }
  return q;
}
