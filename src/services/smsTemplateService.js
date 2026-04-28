import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from "../utils/sanitizeForSupabase";
// ── SMS Template Service ─────────────────────────────────────────────────
// Supabase as single source of truth

import supabase from '../lib/supabase';
import { requireAnyPerm, requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

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
function uid() {
  return 'sms_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ── CRUD ───────────────────────────────────────────────────────────────
export async function getTemplates(filters = {}) {
  let query = supabase.from('sms_templates').select('*').limit(100);
  if (filters.category) query = query.eq('category', filters.category);
  query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) {
    reportError('smsTemplateService', 'getTemplates', error);
    throw error;
  }
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
  return templates;
}

export async function getTemplateById(id) {
  const { data, error } = await supabase.from('sms_templates').select('*').eq('id', id).single();
  if (error) {
    reportError('smsTemplateService', 'getTemplateById', error);
    throw error;
  }
  return data || null;
}

export async function createTemplate({ name, nameAr, body, bodyAr, category, variables = [] }) {
  // Templates are reusable bodies — admin/marketing controls them.
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to create SMS templates');
  const now = new Date().toISOString();
  const template = {
    id: uid(), name, nameAr, body, bodyAr, category, variables,
    created_at: now, updated_at: now, send_count: 0,
  };

  const { error } = await supabase.from('sms_templates').insert([template]);
  if (error) {
    reportError('smsTemplateService', 'createTemplate', error);
    throw error;
  }

  return template;
}

export async function updateTemplate(id, updates) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to update SMS templates');
  const updatedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('sms_templates')
    .update({ ...stripInternalFields(updates), updated_at: updatedAt })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    reportError('smsTemplateService', 'updateTemplate', error);
    throw error;
  }
  return data;
}

export async function deleteTemplate(id) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to delete SMS templates');
  const { error } = await supabase.from('sms_templates').delete().eq('id', id);
  if (error) {
    reportError('smsTemplateService', 'deleteTemplate', error);
    throw error;
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
  // Sales agents send SMS to their own contacts — gate with the broader
  // CONTACTS_EDIT_OWN/EDIT permission so the contact drawer's send works.
  // Pure templates/campaign management still requires SETTINGS_MANAGE.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN, P.CAMPAIGNS_VIEW], 'Not allowed to send SMS');
  const entry = {
    id: uid(),
    phone,
    message,
    template_id: templateId,
    template_name: templateName,
    status: 'sent',
    sent_at: new Date().toISOString(),
  };

  // Insert SMS log entry to Supabase
  const { error: logErr } = await supabase.from('sms_log').insert([entry]);
  if (logErr) {
    reportError('smsTemplateService', 'sendSMS', logErr);
    throw logErr;
  }

  // Increment template send_count in Supabase
  if (templateId) {
    const { data: tpl } = await supabase.from('sms_templates').select('send_count').eq('id', templateId).maybeSingle();
    if (tpl) {
      await supabase.from('sms_templates').update({ send_count: (tpl.send_count || 0) + 1 }).eq('id', templateId);
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

  return entry;
}

export async function getSMSLog(filters = {}) {
  let query = supabase.from('sms_log').select('*').limit(200).order('sent_at', { ascending: false });
  if (filters.template_id) query = query.eq('template_id', filters.template_id);
  const { data, error } = await query;
  if (error) {
    reportError('smsTemplateService', 'getSMSLog', error);
    throw error;
  }
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
  return log;
}

export async function bulkSend(templateId, contacts = [], lang = 'en') {
  // Bulk SMS is a real-money / spam vector — gate stricter than single send.
  // Sales need CONTACTS_BULK to do anything in bulk against contacts.
  requireAnyPerm([P.SETTINGS_MANAGE, P.CONTACTS_BULK, P.CAMPAIGNS_VIEW], 'Not allowed to bulk-send SMS');
  // Fetch template ONCE before loop
  const template = await getTemplateById(templateId);
  if (!template) return [];
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
    const body = lang === 'ar' ? (template.body_ar || template.body) : template.body;
    const message = renderBody(body, data);
    if (contact.phone && message) {
      const entry = await sendSMS(contact.phone, message, templateId, template.name || '');
      results.push({ ...entry, contact_name: contact.full_name || contact.name });
    }
  }
  return results;
}

// ── Quota ──────────────────────────────────────────────────────────────
// TODO: Migrate quota tracking to Supabase
export async function getQuota() {
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', 'sms_quota').maybeSingle();
    if (data?.value) return data.value;
  } catch (err) {
    reportError('smsTemplateService', 'getQuota', err);
  }
  return { daily_limit: 100, used_today: 0, reset_date: '' };
}

export async function incrementQuota() {
  const today = new Date().toISOString().slice(0, 10);
  const q = await getQuota();
  if (q.reset_date !== today) {
    q.used_today = 0;
    q.reset_date = today;
  }
  q.used_today += 1;
  try {
    await supabase.from('system_config').upsert({ key: 'sms_quota', value: q, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (err) {
    reportError('smsTemplateService', 'incrementQuota', err);
  }
  return q;
}
