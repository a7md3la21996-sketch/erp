// ── SMS Template Service ─────────────────────────────────────────────────
// localStorage-based with Supabase-ready structure

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

// ── Seed default templates ─────────────────────────────────────────────
function seedDefaults() {
  const existing = getAll();
  if (existing.length > 0) return existing;

  const now = new Date().toISOString();
  const defaults = [
    {
      id: uid(), name: 'Welcome Message', nameAr: 'رسالة ترحيب',
      body: 'Welcome {client_name}! Thank you for choosing {company_name}. We are excited to assist you with {project_name}.',
      bodyAr: 'أهلاً {client_name}! شكراً لاختيارك {company_name}. نحن متحمسون لمساعدتك في {project_name}.',
      category: 'welcome', variables: ['client_name', 'company_name', 'project_name'],
      created_at: now, updated_at: now, send_count: 12,
    },
    {
      id: uid(), name: 'Follow Up', nameAr: 'متابعة',
      body: 'Hi {client_name}, this is {agent_name} from {company_name}. I wanted to follow up on your interest in {project_name}. Please let me know if you have any questions!',
      bodyAr: 'مرحباً {client_name}، معك {agent_name} من {company_name}. أردت المتابعة معك بخصوص اهتمامك بـ {project_name}. لا تتردد في التواصل معنا!',
      category: 'followup', variables: ['client_name', 'agent_name', 'company_name', 'project_name'],
      created_at: now, updated_at: now, send_count: 28,
    },
    {
      id: uid(), name: 'Appointment Reminder', nameAr: 'تذكير بالموعد',
      body: 'Reminder: Dear {client_name}, your appointment with {agent_name} is scheduled for {date}. See you at {project_name}!',
      bodyAr: 'تذكير: عزيزي {client_name}، موعدك مع {agent_name} في {date}. نراك في {project_name}!',
      category: 'reminder', variables: ['client_name', 'agent_name', 'date', 'project_name'],
      created_at: now, updated_at: now, send_count: 45,
    },
    {
      id: uid(), name: 'Payment Confirmation', nameAr: 'تأكيد دفعة',
      body: 'Dear {client_name}, we confirm receiving your payment of {amount} for {project_name}. Thank you! — {company_name}',
      bodyAr: 'عزيزي {client_name}، نؤكد استلام دفعتكم بقيمة {amount} لمشروع {project_name}. شكراً لكم! — {company_name}',
      category: 'confirmation', variables: ['client_name', 'amount', 'project_name', 'company_name'],
      created_at: now, updated_at: now, send_count: 8,
    },
    {
      id: uid(), name: 'Special Offer', nameAr: 'عرض خاص',
      body: 'Exclusive for you, {client_name}! Limited-time offer on {project_name}. Contact {agent_name} at {company_name} for details.',
      bodyAr: 'حصرياً لك {client_name}! عرض لفترة محدودة على {project_name}. تواصل مع {agent_name} في {company_name} للتفاصيل.',
      category: 'promotion', variables: ['client_name', 'project_name', 'agent_name', 'company_name'],
      created_at: now, updated_at: now, send_count: 19,
    },
  ];

  saveAll(defaults);
  return defaults;
}

// ── CRUD ───────────────────────────────────────────────────────────────
export function getTemplates(filters = {}) {
  let templates = getAll();
  if (templates.length === 0) templates = seedDefaults();
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

export function getTemplateById(id) {
  const all = getAll().length ? getAll() : seedDefaults();
  return all.find(t => t.id === id) || null;
}

export function createTemplate({ name, nameAr, body, bodyAr, category, variables = [] }) {
  const all = getAll().length ? getAll() : seedDefaults();
  const now = new Date().toISOString();
  const template = {
    id: uid(), name, nameAr, body, bodyAr, category, variables,
    created_at: now, updated_at: now, send_count: 0,
  };
  all.unshift(template);
  saveAll(all);
  return template;
}

export function updateTemplate(id, updates) {
  const all = getAll();
  const idx = all.findIndex(t => t.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates, updated_at: new Date().toISOString() };
  saveAll(all);
  return all[idx];
}

export function deleteTemplate(id) {
  const all = getAll();
  const filtered = all.filter(t => t.id !== id);
  saveAll(filtered);
  return true;
}

// ── Render / Send ──────────────────────────────────────────────────────
export function renderTemplate(templateId, data = {}, lang = 'en') {
  const template = getTemplateById(templateId);
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

export function sendSMS(phone, message, templateId = null, templateName = '') {
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

  // Create notification in localStorage
  try {
    const notifs = JSON.parse(localStorage.getItem('platform_notifications') || '[]');
    notifs.unshift({
      id: uid(),
      type: 'sms_sent',
      title: 'SMS Sent',
      titleAr: 'تم إرسال الرسالة',
      message: `SMS sent to ${phone}`,
      messageAr: `تم إرسال رسالة إلى ${phone}`,
      read: false,
      created_at: new Date().toISOString(),
    });
    if (notifs.length > 200) notifs.length = 200;
    localStorage.setItem('platform_notifications', JSON.stringify(notifs));
  } catch { /* ignore */ }

  return entry;
}

export function getSMSLog(filters = {}) {
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

export function bulkSend(templateId, contacts = [], lang = 'en') {
  const results = [];
  contacts.forEach(contact => {
    const data = {
      client_name: contact.full_name || contact.name || '',
      client_phone: contact.phone || '',
      project_name: contact.project || '',
      agent_name: contact.agent || '',
      company_name: contact.company || 'Platform',
      date: new Date().toLocaleDateString('en-GB'),
      amount: contact.amount || '',
    };
    const message = renderTemplate(templateId, data, lang);
    const template = getTemplateById(templateId);
    if (contact.phone && message) {
      const entry = sendSMS(contact.phone, message, templateId, template?.name || '');
      results.push({ ...entry, contact_name: contact.full_name || contact.name });
    }
  });
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
