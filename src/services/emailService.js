const STORAGE_KEY = 'platform_emails';
const TEMPLATES_KEY = 'platform_email_templates';
const MAX_EMAILS = 1000;

// ── localStorage helpers ───────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_EMAILS) list = list.slice(0, MAX_EMAILS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_EMAILS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function loadTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; }
}

function saveTemplates(list) {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

function genId() {
  return 'eml_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ── CRUD ───────────────────────────────────────────────────────

export function sendEmail(data) {
  const emails = load();
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
  emails.unshift(email);
  save(emails);
  window.dispatchEvent(new Event('platform_emails_changed'));
  return email;
}

export function getEmails(folder, filters = {}) {
  let emails = load();
  if (folder) emails = emails.filter(e => e.folder === folder);
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
  if (filters.starred) emails = emails.filter(e => e.starred);
  if (filters.unread) emails = emails.filter(e => !e.read);
  return emails;
}

export function getEmailsByContact(contactId) {
  return load().filter(e => e.contact_id === contactId);
}

export function getEmailsByOpportunity(oppId) {
  return load().filter(e => e.opportunity_id === oppId);
}

export function markAsRead(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  if (idx >= 0) {
    emails[idx].read = true;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }
}

export function toggleReadStatus(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  if (idx >= 0) {
    emails[idx].read = !emails[idx].read;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }
}

export function starEmail(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  if (idx >= 0) {
    emails[idx].starred = !emails[idx].starred;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }
}

export function moveToTrash(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  if (idx >= 0) {
    if (emails[idx].folder === 'trash') {
      emails.splice(idx, 1); // permanent delete
    } else {
      emails[idx].folder = 'trash';
    }
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }
}

export function getDrafts() {
  return load().filter(e => e.folder === 'draft');
}

export function saveDraft(data) {
  const emails = load();
  // If updating existing draft
  if (data.id) {
    const idx = emails.findIndex(e => e.id === data.id);
    if (idx >= 0) {
      emails[idx] = { ...emails[idx], ...data, folder: 'draft' };
      save(emails);
      window.dispatchEvent(new Event('platform_emails_changed'));
      return emails[idx];
    }
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
  emails.unshift(draft);
  save(emails);
  window.dispatchEvent(new Event('platform_emails_changed'));
  return draft;
}

export function getEmailStats() {
  const emails = load();
  return {
    inbox: emails.filter(e => e.folder === 'inbox').length,
    unread: emails.filter(e => e.folder === 'inbox' && !e.read).length,
    sent: emails.filter(e => e.folder === 'sent').length,
    drafts: emails.filter(e => e.folder === 'draft').length,
  };
}

// ── Templates ──────────────────────────────────────────────────

export function getTemplates() {
  const templates = loadTemplates();
  if (templates.length === 0) {
    // Seed default templates
    const defaults = [
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
    saveTemplates(defaults);
    return defaults;
  }
  return templates;
}

export function saveTemplate(data) {
  const templates = loadTemplates();
  if (data.id) {
    const idx = templates.findIndex(t => t.id === data.id);
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], ...data };
      saveTemplates(templates);
      return templates[idx];
    }
  }
  const tpl = {
    id: 'tpl_' + Date.now(),
    name: data.name || '',
    name_ar: data.name_ar || '',
    subject: data.subject || '',
    subject_ar: data.subject_ar || '',
    body: data.body || '',
    body_ar: data.body_ar || '',
    category: data.category || 'general',
  };
  templates.push(tpl);
  saveTemplates(templates);
  return tpl;
}

export function deleteTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  saveTemplates(templates);
}
