import supabase from '../lib/supabase';
import { logCreate, logDelete } from './auditService';
import { enqueue } from '../lib/offlineQueue';

// ── Activity Types ─────────────────────────────────────────────────────────
export const ACTIVITY_TYPES = {
  call:          { ar: 'مكالمة',        en: 'Call',          icon: 'Phone',        color: '#4A7AAB', dept: ['crm','sales','finance'] },
  whatsapp:      { ar: 'واتساب',        en: 'WhatsApp',      icon: 'MessageCircle',color: '#2B4C6F', dept: ['crm','sales'] },
  email:         { ar: 'إيميل',         en: 'Email',         icon: 'Mail',         color: '#6B8DB5', dept: ['crm','sales','hr','finance'] },
  meeting:       { ar: 'اجتماع',        en: 'Meeting',       icon: 'Users',        color: '#2B4C6F', dept: ['crm','sales','hr','finance'] },
  site_visit:    { ar: 'زيارة موقع',    en: 'Site Visit',    icon: 'MapPin',       color: '#4A7AAB', dept: ['crm','sales'] },
  note:          { ar: 'ملاحظة',        en: 'Note',          icon: 'FileText',     color: '#8BA8C8', dept: ['crm','sales','hr','finance'] },
  interview:     { ar: 'مقابلة',        en: 'Interview',     icon: 'UserCheck',    color: '#4A7AAB', dept: ['hr'] },
  warning:       { ar: 'إنذار',         en: 'Warning',       icon: 'AlertTriangle',color: '#EF4444', dept: ['hr'] },
  evaluation:    { ar: 'تقييم',         en: 'Evaluation',    icon: 'Star',         color: '#6B8DB5', dept: ['hr'] },
  invoice:       { ar: 'فاتورة',        en: 'Invoice',       icon: 'Receipt',      color: '#4A7AAB', dept: ['finance'] },
  payment:       { ar: 'دفعة',          en: 'Payment',       icon: 'Banknote',     color: '#2B4C6F', dept: ['finance'] },
  status_change: { ar: 'تغيير حالة',    en: 'Status Change', icon: 'RefreshCw',   color: '#8BA8C8', dept: ['crm','sales','hr','finance'] },
  task:          { ar: 'مهمة',          en: 'Task',          icon: 'CheckSquare',  color: '#6B8DB5', dept: ['crm','sales','hr','finance'] },
};

// ── SEED DATA ──────────────────────────────────────────────────────────────
const SEED_ACTIVITIES = [
  { id: '1', type: 'call', notes: 'العميل مهتم بوحدة في الشيخ زايد، طلب موعد معاينة', contact_id: '1', entity_type: 'contact', user_name_ar: 'سارة علي', user_name_en: 'Sara Ali', dept: 'crm', created_at: new Date(Date.now() - 2*60*60*1000).toISOString() },
  { id: '2', type: 'whatsapp', notes: 'تم إرسال بروشور المشروع', contact_id: '1', entity_type: 'contact', user_name_ar: 'سارة علي', user_name_en: 'Sara Ali', dept: 'crm', created_at: new Date(Date.now() - 5*60*60*1000).toISOString() },
  { id: '3', type: 'meeting', notes: 'اجتماع مراجعة الأداء الشهري مع الفريق', entity_type: 'internal', user_name_ar: 'أحمد علاء', user_name_en: 'Ahmed Alaa', dept: 'hr', created_at: new Date(Date.now() - 24*60*60*1000).toISOString() },
  { id: '4', type: 'call', notes: 'لا يرد — سيتم التواصل غداً', contact_id: '2', entity_type: 'contact', user_name_ar: 'محمد خالد', user_name_en: 'Mohamed Khaled', dept: 'crm', created_at: new Date(Date.now() - 3*60*60*1000).toISOString() },
  { id: '5', type: 'note', notes: 'العميل طلب تأجيل حتى نهاية الشهر', contact_id: '7', entity_type: 'contact', user_name_ar: 'ريم أحمد', user_name_en: 'Reem Ahmed', dept: 'crm', created_at: new Date(Date.now() - 48*60*60*1000).toISOString() },
  { id: '6', type: 'invoice', notes: 'فاتورة مورد الكهرباء — 15,000 جنيه', entity_type: 'internal', user_name_ar: 'نورا أحمد', user_name_en: 'Noura Ahmed', dept: 'finance', created_at: new Date(Date.now() - 6*60*60*1000).toISOString() },
  { id: '7', type: 'interview', notes: 'مقابلة مرشح لوظيفة سيلز — مستوى جيد', entity_type: 'internal', user_name_ar: 'أحمد علاء', user_name_en: 'Ahmed Alaa', dept: 'hr', created_at: new Date(Date.now() - 72*60*60*1000).toISOString() },
  { id: '8', type: 'site_visit', notes: 'العميل زار موقع مشروع جرين سكوير وأعجبه', contact_id: '8', entity_type: 'contact', user_name_ar: 'علي حسن', user_name_en: 'Ali Hassan', dept: 'crm', created_at: new Date(Date.now() - 30*60*1000).toISOString() },
  { id: '9', type: 'email', notes: 'تم إرسال عرض السعر الرسمي للعميل', contact_id: '4', entity_type: 'contact', user_name_ar: 'سارة علي', user_name_en: 'Sara Ali', dept: 'crm', created_at: new Date(Date.now() - 90*60*60*1000).toISOString() },
  { id: '10', type: 'status_change', notes: 'تم تحويل الليد من "مهتم" إلى "موعد معاينة"', contact_id: '7', entity_type: 'contact', user_name_ar: 'ريم أحمد', user_name_en: 'Reem Ahmed', dept: 'crm', created_at: new Date(Date.now() - 4*60*60*1000).toISOString() },
];

// ── localStorage helpers (shared key with contactsService) ──
function getLocalActivities() {
  try {
    const saved = localStorage.getItem('platform_activities');
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  localStorage.setItem('platform_activities', JSON.stringify(SEED_ACTIVITIES));
  return [...SEED_ACTIVITIES];
}
function saveLocalActivities(acts) {
  try { localStorage.setItem('platform_activities', JSON.stringify(acts)); } catch { /* ignore */ }
}

// ── Service Functions ───────────────────────────────────────────────────────
export async function fetchActivities({ entityType, entityId, dept, limit = 50 } = {}) {
  let supaData = [];
  try {
    let query = supabase
      .from('activities')
      .select(`*, users!activities_user_id_fkey (full_name_ar, full_name_en)`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (entityId)   query = query.eq(`${entityType}_id`, entityId);
    if (entityType && !entityId) query = query.eq('entity_type', entityType);
    if (dept)       query = query.eq('dept', dept);

    const { data, error } = await query;
    if (!error && data?.length) supaData = data.map(a => ({
      ...a,
      user_name_ar: a.users?.full_name_ar || a.user_name_ar,
      user_name_en: a.users?.full_name_en || a.user_name_en,
    }));
  } catch { /* ignore */ }

  // Always merge with localStorage
  let local = getLocalActivities();
  if (entityId)   local = local.filter(a => String(a[`${entityType}_id`]) === String(entityId));
  if (dept)       local = local.filter(a => a.dept === dept);
  local = local.filter(a => !supaData.some(s => String(s.id) === String(a.id)));
  return [...supaData, ...local]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}

export async function createActivity({ type, notes, entityType, entityId, dept, userId, status = 'completed', scheduled_date }) {
  const payload = {
    type, notes, dept,
    entity_type: entityType,
    [`${entityType}_id`]: entityId,
    user_id: userId,
    status,
    ...(scheduled_date ? { scheduled_date } : {}),
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([payload])
      .select('*')
      .single();
    if (error) throw error;

    logCreate('activity', data.id, data);
    if (entityType === 'contact' && entityId) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', entityId);
    }
    return data;
  } catch {
    if (!navigator.onLine) {
      const tempId = 'temp_' + Date.now();
      const tempActivity = { ...payload, id: tempId, user_name_ar: 'أنت', user_name_en: 'You', _offline: true };
      enqueue('activity', 'create', tempActivity);
      return tempActivity;
    }
    const mock = { ...payload, id: Date.now().toString(), user_name_ar: 'أنت', user_name_en: 'You' };
    const all = getLocalActivities();
    all.unshift(mock);
    saveLocalActivities(all);
    return mock;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await supabase
      .from('activities')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch {
    // Fallback: update in localStorage
    const all = getLocalActivities();
    const idx = all.findIndex(a => String(a.id) === String(id));
    if (idx > -1) {
      Object.assign(all[idx], updates);
      saveLocalActivities(all);
      return all[idx];
    }
    return { id, ...updates };
  }
}

export async function deleteActivity(id) {
  try {
    const { data: oldData } = await supabase.from('activities').select('*').eq('id', id).single();
    const { error } = await supabase.from('activities').delete().eq('id', id);
    if (error) throw error;
    logDelete('activity', id, oldData);
  } catch {
    if (!navigator.onLine) {
      enqueue('activity', 'delete', { id });
      return;
    }
    const filtered = getLocalActivities().filter(a => String(a.id) !== String(id));
    saveLocalActivities(filtered);
  }
}
