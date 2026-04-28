import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import supabase from '../lib/supabase';
import { requireAnyPerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ── Default Templates ──────────────────────────────────────────
function getDefaultTemplates() {
  return [
    {
      id: 'tpl_greeting',
      name: 'Greeting',
      name_ar: 'ترحيب',
      category: 'greeting',
      body: 'Hello {{name}}! Welcome to our company. We are glad to have you as a valued contact. How can we assist you today?',
      body_ar: 'مرحباً {{name}}! أهلاً بك في شركتنا. يسعدنا تواصلك معنا. كيف يمكننا مساعدتك اليوم؟',
      variables: ['name'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'tpl_followup',
      name: 'Follow-up After Meeting',
      name_ar: 'متابعة بعد الاجتماع',
      category: 'follow_up',
      body: 'Hi {{name}}, it was great meeting with you today. As discussed, I will send you the details about {{company}} offerings. Please don\'t hesitate to reach out if you have any questions.',
      body_ar: 'مرحباً {{name}}، سعدت بالاجتماع معك اليوم. كما تم الاتفاق، سأرسل لك تفاصيل عروض {{company}}. لا تتردد في التواصل معنا لأي استفسار.',
      variables: ['name', 'company'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'tpl_appointment',
      name: 'Appointment Reminder',
      name_ar: 'تذكير بموعد',
      category: 'appointment',
      body: 'Hi {{name}}, this is a friendly reminder about your appointment on {{date}}. Please let us know if you need to reschedule. We look forward to seeing you!',
      body_ar: 'مرحباً {{name}}، نود تذكيرك بموعدك يوم {{date}}. يرجى إعلامنا إذا كنت بحاجة لإعادة الجدولة. نتطلع لرؤيتك!',
      variables: ['name', 'date'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'tpl_payment',
      name: 'Payment Reminder',
      name_ar: 'تذكير بالدفع',
      category: 'payment',
      body: 'Hello {{name}}, this is a reminder regarding your pending payment of {{amount}}. Please complete the payment at your earliest convenience. Contact us if you have any questions.',
      body_ar: 'مرحباً {{name}}، نود تذكيرك بالمبلغ المستحق {{amount}}. يرجى إتمام الدفع في أقرب وقت ممكن. تواصل معنا لأي استفسار.',
      variables: ['name', 'amount'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'tpl_thankyou',
      name: 'Thank You',
      name_ar: 'شكراً لك',
      category: 'custom',
      body: 'Dear {{name}}, thank you for choosing {{company}}. We truly appreciate your trust in us and look forward to serving you again. Have a wonderful day!',
      body_ar: 'عزيزي {{name}}، شكراً لاختيارك {{company}}. نقدر ثقتك بنا ونتطلع لخدمتك مجدداً. نتمنى لك يوماً سعيداً!',
      variables: ['name', 'company'],
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];
}

// ── Message CRUD ───────────────────────────────────────────────
export async function logMessage({ contact_id, contact_name, contact_phone, direction = 'outgoing', message, template_id = null, type = 'text' }) {
  // Logging WhatsApp messages requires the same scope as editing the
  // contact — otherwise an unrelated user could fake conversation history.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN, P.CAMPAIGNS_VIEW], 'Not allowed to log WhatsApp messages');
  const msg = {
    id: genId(),
    contact_id: contact_id || null,
    contact_name: contact_name || '',
    contact_phone: contact_phone || '',
    direction,
    message: message || '',
    template_id,
    sent_at: new Date().toISOString(),
    status: direction === 'outgoing' ? 'sent' : 'delivered',
    type,
  };

  const { error } = await supabase.from('whatsapp_messages').insert([stripInternalFields(msg)]);
  if (error) {
    reportError('whatsappService', 'logMessage', error);
    throw error;
  }

  window.dispatchEvent(new Event('platform_whatsapp_changed'));
  return msg;
}

export async function getMessages(filters = {}) {
  let query = supabase.from('whatsapp_messages').select('*');
  if (filters.direction) query = query.eq('direction', filters.direction);
  if (filters.contact_id) query = query.eq('contact_id', String(filters.contact_id));
  query = query.order('sent_at', { ascending: false });
  const { data, error } = await query.range(0, 199);
  if (error) {
    reportError('whatsappService', 'getMessages', error);
    throw error;
  }
  let list = data || [];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(m =>
      (m.contact_name || '').toLowerCase().includes(q) ||
      (m.contact_phone || '').toLowerCase().includes(q) ||
      (m.message || '').toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getMessagesByContact(contactId) {
  const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contact_id', String(contactId)).order('sent_at', { ascending: false }).limit(100);
  if (error) {
    reportError('whatsappService', 'getMessagesByContact', error);
    throw error;
  }
  return data || [];
}

export async function getConversation(contactId) {
  const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contact_id', String(contactId)).order('sent_at', { ascending: true }).limit(100);
  if (error) {
    reportError('whatsappService', 'getConversation', error);
    throw error;
  }
  return data || [];
}

export async function getRecentConversations() {
  const { data, error } = await supabase.from('whatsapp_messages').select('*').order('sent_at', { ascending: false }).range(0, 499);
  if (error) {
    reportError('whatsappService', 'getRecentConversations', error);
    throw error;
  }
  return _buildConversations(data || []);
}

function _buildConversations(list) {
  const byContact = {};
  list.forEach(m => {
    const key = m.contact_id || m.contact_phone;
    if (!key) return;
    if (!byContact[key]) {
      byContact[key] = {
        contact_id: m.contact_id,
        contact_name: m.contact_name,
        contact_phone: m.contact_phone,
        last_message: m.message,
        last_message_at: m.sent_at,
        direction: m.direction,
        unread: 0,
        message_count: 0,
      };
    }
    byContact[key].message_count++;
    if (m.direction === 'incoming' && m.status !== 'read') byContact[key].unread++;
  });
  return Object.values(byContact).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
}

// ── Template CRUD ──────────────────────────────────────────────
export async function getTemplates(onlyActive = false) {
  let query = supabase.from('whatsapp_templates').select('*');
  if (onlyActive) query = query.eq('is_active', true);
  const { data, error } = await query.range(0, 199);
  if (error) {
    reportError('whatsappService', 'getTemplates', error);
    throw error;
  }
  if (data && data.length > 0) return data;

  // Supabase is empty — seed default templates (upsert to avoid race condition)
  const defaults = getDefaultTemplates();
  const { error: seedErr } = await supabase.from('whatsapp_templates').upsert(defaults.map(t => stripInternalFields(t)), { onConflict: 'id' });
  if (seedErr) {
    reportError('whatsappService', 'getTemplates:seed', seedErr);
  }
  return onlyActive ? defaults.filter(t => t.is_active) : defaults;
}

export async function saveTemplate(tpl) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to save WhatsApp templates');
  // Check if updating existing
  const { data: existing } = await supabase.from('whatsapp_templates').select('id').eq('id', tpl.id).maybeSingle();
  if (existing) {
    const { error } = await supabase.from('whatsapp_templates').update(stripInternalFields({ ...tpl, updated_at: new Date().toISOString() })).eq('id', tpl.id);
    if (error) {
      reportError('whatsappService', 'saveTemplate', error);
      throw error;
    }
  } else {
    const newTpl = { ...tpl, id: tpl.id || genId(), created_at: new Date().toISOString(), is_active: true };
    const { error } = await supabase.from('whatsapp_templates').insert([stripInternalFields(newTpl)]);
    if (error) {
      reportError('whatsappService', 'saveTemplate', error);
      throw error;
    }
  }

  // Return updated list
  const { data } = await supabase.from('whatsapp_templates').select('*').range(0, 199);
  return data || [];
}

export async function deleteTemplate(id) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to delete WhatsApp templates');
  const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
  if (error) {
    reportError('whatsappService', 'deleteTemplate', error);
    throw error;
  }
  const { data } = await supabase.from('whatsapp_templates').select('*').range(0, 199);
  return data || [];
}

export async function toggleTemplate(id) {
  // Fetch current state
  const { data: tpl, error: fetchErr } = await supabase.from('whatsapp_templates').select('is_active').eq('id', id).maybeSingle();
  if (fetchErr) {
    reportError('whatsappService', 'toggleTemplate', fetchErr);
    throw fetchErr;
  }
  if (tpl) {
    const { error } = await supabase.from('whatsapp_templates').update({ is_active: !tpl.is_active }).eq('id', id);
    if (error) {
      reportError('whatsappService', 'toggleTemplate', error);
      throw error;
    }
  }
  const { data } = await supabase.from('whatsapp_templates').select('*').range(0, 199);
  return data || [];
}

// ── Stats ──────────────────────────────────────────────────────
export async function getWhatsAppStats() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [totalRes, todayRes, tplRes] = await Promise.allSettled([
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }),
      supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).gte('sent_at', today + 'T00:00:00'),
      supabase.from('whatsapp_templates').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    return {
      total_messages: totalRes.status === 'fulfilled' ? (totalRes.value.count || 0) : 0,
      today_count: todayRes.status === 'fulfilled' ? (todayRes.value.count || 0) : 0,
      templates_count: tplRes.status === 'fulfilled' ? (tplRes.value.count || 0) : 0,
      contacts_reached: 0,
    };
  } catch (err) {
    reportError('whatsappService', 'getWhatsAppStats', err);
    return { total_messages: 0, today_count: 0, templates_count: 0, contacts_reached: 0 };
  }
}

// ── WhatsApp Link Generator ────────────────────────────────────
export function generateWhatsAppLink(phone, message = '') {
  const clean = (phone || '').replace(/[^0-9]/g, '');
  const encoded = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${clean}${encoded ? '?text=' + encoded : ''}`;
}

// ── Template Variable Filler ───────────────────────────────────
export function fillTemplate(template, variables = {}) {
  let text = template || '';
  Object.entries(variables).forEach(([key, value]) => {
    text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  });
  return text;
}

// ── Category helpers ───────────────────────────────────────────
export const TEMPLATE_CATEGORIES = [
  { id: 'greeting', label: 'Greeting', label_ar: 'ترحيب', color: '#10B981' },
  { id: 'follow_up', label: 'Follow Up', label_ar: 'متابعة', color: '#4A7AAB' },
  { id: 'appointment', label: 'Appointment', label_ar: 'موعد', color: '#8B5CF6' },
  { id: 'payment', label: 'Payment', label_ar: 'دفع', color: '#F59E0B' },
  { id: 'promotion', label: 'Promotion', label_ar: 'ترويج', color: '#EC4899' },
  { id: 'custom', label: 'Custom', label_ar: 'مخصص', color: '#6B7280' },
];

export const TEMPLATE_VARIABLES = ['name', 'company', 'amount', 'date'];
