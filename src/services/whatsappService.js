import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';

const MESSAGES_KEY = 'platform_whatsapp_messages';
const TEMPLATES_KEY = 'platform_whatsapp_templates';
const MAX_MESSAGES = 1000;

// ── localStorage helpers ───────────────────────────────────────
function loadMessages() {
  try { return JSON.parse(localStorage.getItem(MESSAGES_KEY) || '[]'); } catch { return []; }
}

function saveMessages(list) {
  if (list.length > MAX_MESSAGES) list = list.slice(0, MAX_MESSAGES);
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_MESSAGES / 2));
      try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function loadTemplates() {
  try {
    const stored = JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    if (stored.length > 0) return stored;
    // Seed defaults
    const defaults = getDefaultTemplates();
    saveTemplates(defaults);
    return defaults;
  } catch (err) { reportError('whatsappService', 'query', err);
    const defaults = getDefaultTemplates();
    saveTemplates(defaults);
    return defaults;
  }
}

function saveTemplates(list) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

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
  const list = loadMessages();
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
  list.unshift(msg);
  saveMessages(list);
  window.dispatchEvent(new Event('platform_whatsapp_changed'));

  try {
    await supabase.from('whatsapp_messages').insert([msg]);
  } catch (err) {
    console.warn('Supabase insert (whatsapp_messages) failed, localStorage used as fallback:', err);
  }

  return msg;
}

export async function getMessages(filters = {}) {
  try {
    let query = supabase.from('whatsapp_messages').select('*');
    if (filters.direction) query = query.eq('direction', filters.direction);
    if (filters.contact_id) query = query.eq('contact_id', String(filters.contact_id));
    query = query.order('sent_at', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
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
  } catch (err) {
    console.warn('Supabase fetch (whatsapp_messages) failed, falling back to localStorage:', err);
    let list = loadMessages();
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(m =>
        (m.contact_name || '').toLowerCase().includes(q) ||
        (m.contact_phone || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q)
      );
    }
    if (filters.direction) list = list.filter(m => m.direction === filters.direction);
    if (filters.contact_id) list = list.filter(m => String(m.contact_id) === String(filters.contact_id));
    return list;
  }
}

export async function getMessagesByContact(contactId) {
  try {
    const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contact_id', String(contactId)).order('sent_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Supabase fetch (whatsapp by contact) failed, falling back to localStorage:', err);
    return loadMessages().filter(m => String(m.contact_id) === String(contactId));
  }
}

export async function getConversation(contactId) {
  try {
    const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('contact_id', String(contactId)).order('sent_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Supabase fetch (whatsapp conversation) failed, falling back to localStorage:', err);
    return loadMessages()
      .filter(m => String(m.contact_id) === String(contactId))
      .sort((a, b) => new Date(a.sent_at) - new Date(b.sent_at));
  }
}

export async function getRecentConversations() {
  try {
    const { data, error } = await supabase.from('whatsapp_messages').select('*').order('sent_at', { ascending: false });
    if (error) throw error;
    const list = data || [];
    return _buildConversations(list);
  } catch (err) {
    console.warn('Supabase fetch (recent conversations) failed, falling back to localStorage:', err);
    const list = loadMessages();
    return _buildConversations(list);
  }
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
  try {
    let query = supabase.from('whatsapp_templates').select('*');
    if (onlyActive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    if (data && data.length > 0) return data;
    // Fall through to localStorage if Supabase is empty
  } catch (err) {
    console.warn('Supabase fetch (whatsapp templates) failed, falling back to localStorage:', err);
  }

  const list = loadTemplates();
  return onlyActive ? list.filter(t => t.is_active) : list;
}

export async function saveTemplate(tpl) {
  const list = loadTemplates();
  const idx = list.findIndex(t => t.id === tpl.id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...tpl, updated_at: new Date().toISOString() };
  } else {
    list.push({ ...tpl, id: tpl.id || genId(), created_at: new Date().toISOString(), is_active: true });
  }
  saveTemplates(list);

  try {
    if (idx > -1) {
      const { error } = await supabase.from('whatsapp_templates').update({ ...tpl, updated_at: new Date().toISOString() }).eq('id', tpl.id);
      if (error) throw error;
    } else {
      const newTpl = list[list.length - 1];
      await supabase.from('whatsapp_templates').insert([newTpl]);
    }
  } catch (err) {
    console.warn('Supabase upsert (whatsapp template) failed, localStorage used as fallback:', err);
  }

  return list;
}

export async function deleteTemplate(id) {
  const list = loadTemplates().filter(t => t.id !== id);
  saveTemplates(list);

  try {
    const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase delete (whatsapp template) failed, localStorage used as fallback:', err);
  }

  return list;
}

export async function toggleTemplate(id) {
  const list = loadTemplates();
  const tpl = list.find(t => t.id === id);
  if (tpl) tpl.is_active = !tpl.is_active;
  saveTemplates(list);

  try {
    if (tpl) {
      const { error } = await supabase.from('whatsapp_templates').update({ is_active: tpl.is_active }).eq('id', id);
      if (error) throw error;
    }
  } catch (err) {
    console.warn('Supabase update (toggleTemplate) failed, localStorage used as fallback:', err);
  }

  return list;
}

// ── Stats ──────────────────────────────────────────────────────
export async function getWhatsAppStats() {
  try {
    const { data, error } = await supabase.from('whatsapp_messages').select('sent_at, contact_id');
    if (error) throw error;
    const list = data || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayMsgs = list.filter(m => m.sent_at?.slice(0, 10) === today);
    const contactIds = new Set(list.map(m => m.contact_id).filter(Boolean));

    // Templates from Supabase or localStorage
    let templatesCount = 0;
    try {
      const { data: tplData, error: tplErr } = await supabase.from('whatsapp_templates').select('is_active').eq('is_active', true);
      if (tplErr) throw tplErr;
      templatesCount = (tplData || []).length;
    } catch (err) { reportError('whatsappService', 'query', err);
      templatesCount = loadTemplates().filter(t => t.is_active).length;
    }

    return {
      total_messages: list.length,
      today_count: todayMsgs.length,
      templates_count: templatesCount,
      contacts_reached: contactIds.size,
    };
  } catch (err) {
    console.warn('Supabase fetch (whatsapp stats) failed, falling back to localStorage:', err);
    const list = loadMessages();
    const today = new Date().toISOString().slice(0, 10);
    const todayMsgs = list.filter(m => m.sent_at?.slice(0, 10) === today);
    const contactIds = new Set(list.map(m => m.contact_id).filter(Boolean));
    const templates = loadTemplates();
    return {
      total_messages: list.length,
      today_count: todayMsgs.length,
      templates_count: templates.filter(t => t.is_active).length,
      contacts_reached: contactIds.size,
    };
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
