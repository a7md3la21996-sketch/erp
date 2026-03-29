import supabase from '../lib/supabase';

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

export async function sendEmail(data) {
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

  // Sync to Supabase
  try {
    await supabase.from('emails').insert([email]);
  } catch (err) {
    console.warn('Supabase insert (emails) failed, localStorage used as fallback:', err);
  }

  return email;
}

export async function getEmails(folder, filters = {}) {
  try {
    let query = supabase.from('emails').select('id, from_address, to_address, subject, status, folder, is_read, contact_id, created_at');
    if (folder) query = query.eq('folder', folder);
    if (filters.starred) query = query.eq('starred', true);
    if (filters.unread) query = query.eq('read', false);
    query = query.order('sent_at', { ascending: false });
    const { data, error } = await query.range(0, 199);
    if (error) throw error;
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
  } catch (err) {
    console.warn('Supabase fetch (emails) failed, falling back to localStorage:', err);
    // Existing localStorage logic
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
}

export async function getEmailsByContact(contactId) {
  try {
    const { data, error } = await supabase.from('emails').select('id, from_address, to_address, subject, status, folder, is_read, contact_id, created_at').eq('contact_id', contactId).order('sent_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Supabase fetch (emails by contact) failed, falling back to localStorage:', err);
    return load().filter(e => e.contact_id === contactId);
  }
}

export async function getEmailsByOpportunity(oppId) {
  try {
    const { data, error } = await supabase.from('emails').select('id, from_address, to_address, subject, status, folder, is_read, contact_id, created_at').eq('opportunity_id', oppId).order('sent_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Supabase fetch (emails by opportunity) failed, falling back to localStorage:', err);
    return load().filter(e => e.opportunity_id === oppId);
  }
}

export async function markAsRead(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  if (idx >= 0) {
    emails[idx].read = true;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }

  try {
    const { error } = await supabase.from('emails').update({ read: true }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase update (markAsRead) failed, localStorage used as fallback:', err);
  }
}

export async function toggleReadStatus(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  let newRead = false;
  if (idx >= 0) {
    emails[idx].read = !emails[idx].read;
    newRead = emails[idx].read;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }

  try {
    const { error } = await supabase.from('emails').update({ read: newRead }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase update (toggleReadStatus) failed, localStorage used as fallback:', err);
  }
}

export async function starEmail(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  let newStarred = false;
  if (idx >= 0) {
    emails[idx].starred = !emails[idx].starred;
    newStarred = emails[idx].starred;
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }

  try {
    const { error } = await supabase.from('emails').update({ starred: newStarred }).eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase update (starEmail) failed, localStorage used as fallback:', err);
  }
}

export async function moveToTrash(id) {
  const emails = load();
  const idx = emails.findIndex(e => e.id === id);
  let permanentDelete = false;
  if (idx >= 0) {
    if (emails[idx].folder === 'trash') {
      emails.splice(idx, 1); // permanent delete
      permanentDelete = true;
    } else {
      emails[idx].folder = 'trash';
    }
    save(emails);
    window.dispatchEvent(new Event('platform_emails_changed'));
  }

  try {
    if (permanentDelete) {
      const { error } = await supabase.from('emails').delete().eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('emails').update({ folder: 'trash' }).eq('id', id);
      if (error) throw error;
    }
  } catch (err) {
    console.warn('Supabase update (moveToTrash) failed, localStorage used as fallback:', err);
  }
}

export async function getDrafts() {
  try {
    const { data, error } = await supabase.from('emails').select('id, from_address, to_address, subject, status, folder, is_read, contact_id, created_at').eq('folder', 'draft').order('sent_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Supabase fetch (drafts) failed, falling back to localStorage:', err);
    return load().filter(e => e.folder === 'draft');
  }
}

export async function saveDraft(data) {
  const emails = load();
  // If updating existing draft
  if (data.id) {
    const idx = emails.findIndex(e => e.id === data.id);
    if (idx >= 0) {
      emails[idx] = { ...emails[idx], ...data, folder: 'draft' };
      save(emails);
      window.dispatchEvent(new Event('platform_emails_changed'));

      try {
        const { error } = await supabase.from('emails').update({ ...data, folder: 'draft' }).eq('id', data.id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase update (saveDraft) failed, localStorage used as fallback:', err);
      }

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

  try {
    await supabase.from('emails').insert([draft]);
  } catch (err) {
    console.warn('Supabase insert (saveDraft) failed, localStorage used as fallback:', err);
  }

  return draft;
}

export async function getEmailStats() {
  try {
    const { data, error } = await supabase.from('emails').select('folder, read');
    if (error) throw error;
    const emails = data || [];
    return {
      inbox: emails.filter(e => e.folder === 'inbox').length,
      unread: emails.filter(e => e.folder === 'inbox' && !e.read).length,
      sent: emails.filter(e => e.folder === 'sent').length,
      drafts: emails.filter(e => e.folder === 'draft').length,
    };
  } catch (err) {
    console.warn('Supabase fetch (emailStats) failed, falling back to localStorage:', err);
    const emails = load();
    return {
      inbox: emails.filter(e => e.folder === 'inbox').length,
      unread: emails.filter(e => e.folder === 'inbox' && !e.read).length,
      sent: emails.filter(e => e.folder === 'sent').length,
      drafts: emails.filter(e => e.folder === 'draft').length,
    };
  }
}

// ── Templates ──────────────────────────────────────────────────

export async function getTemplates() {
  try {
    const { data, error } = await supabase.from('email_templates').select('*');
    if (error) throw error;
    if (data && data.length > 0) return data;
    // If Supabase is empty, fall through to localStorage/seed logic
  } catch (err) {
    console.warn('Supabase fetch (email templates) failed, falling back to localStorage:', err);
  }

  // Existing localStorage logic
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

export async function saveTemplate(data) {
  const templates = loadTemplates();
  if (data.id) {
    const idx = templates.findIndex(t => t.id === data.id);
    if (idx >= 0) {
      templates[idx] = { ...templates[idx], ...data };
      saveTemplates(templates);

      try {
        const { error } = await supabase.from('email_templates').update(data).eq('id', data.id);
        if (error) throw error;
      } catch (err) {
        console.warn('Supabase update (email template) failed, localStorage used as fallback:', err);
      }

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

  try {
    await supabase.from('email_templates').insert([tpl]);
  } catch (err) {
    console.warn('Supabase insert (email template) failed, localStorage used as fallback:', err);
  }

  return tpl;
}

export async function deleteTemplate(id) {
  const templates = loadTemplates().filter(t => t.id !== id);
  saveTemplates(templates);

  try {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('Supabase delete (email template) failed, localStorage used as fallback:', err);
  }
}
