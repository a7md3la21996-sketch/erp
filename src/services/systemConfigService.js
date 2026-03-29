const STORAGE_KEY = 'platform_system_config';

export const DEFAULT_CONFIG = {
  contactTypes: [
    { key: 'lead',       label_ar: 'ليد',        label_en: 'Lead',        color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)',  departments: ['sales', 'marketing'] },
    { key: 'qualified',  label_ar: 'مؤهل',       label_en: 'Qualified',   color: '#2563EB', bg: 'rgba(37,99,235,0.12)',   departments: ['sales', 'marketing'] },
    { key: 'nurturing',  label_ar: 'متابعة',     label_en: 'Nurturing',   color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  departments: ['sales', 'marketing'] },
    { key: 'converted',  label_ar: 'محول',        label_en: 'Converted',   color: '#059669', bg: 'rgba(5,150,105,0.12)',   departments: ['sales'] },
    { key: 'customer',      label_ar: 'عميل حالي',    label_en: 'Customer',      color: '#10B981', bg: 'rgba(16,185,129,0.12)',  departments: ['sales', 'operations'] },
    { key: 'repeat_buyer', label_ar: 'عميل متكرر',   label_en: 'Repeat Buyer',  color: '#0D9488', bg: 'rgba(13,148,136,0.12)',  departments: ['sales'] },
    { key: 'referrer',     label_ar: 'مُرشّح',       label_en: 'Referrer',      color: '#D97706', bg: 'rgba(217,119,6,0.12)',   departments: ['sales'] },
    { key: 'vip',          label_ar: 'VIP',          label_en: 'VIP',           color: '#DC2626', bg: 'rgba(220,38,38,0.12)',   departments: ['sales'] },
    { key: 'client',       label_ar: 'عميل',         label_en: 'Client',        color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)',   departments: [] },
    { key: 'supplier',   label_ar: 'مورد',       label_en: 'Supplier',    color: '#0F766E', bg: 'rgba(15,118,110,0.12)',  departments: ['finance', 'operations'] },
    { key: 'developer',  label_ar: 'مطور',       label_en: 'Developer',   color: '#B45309', bg: 'rgba(180,83,9,0.12)',    departments: ['sales'] },
    { key: 'applicant',  label_ar: 'متقدم',      label_en: 'Applicant',   color: '#6B21A8', bg: 'rgba(107,33,168,0.12)',  departments: ['hr'] },
    { key: 'partner',    label_ar: 'شريك',       label_en: 'Partner',     color: '#1E40AF', bg: 'rgba(30,64,175,0.12)',   departments: ['sales', 'operations'] },
  ],
  sources: [
    { key: 'facebook',   label_ar: 'فيسبوك',        label_en: 'Facebook',      platform: 'meta'    },
    { key: 'instagram',  label_ar: 'إنستجرام',      label_en: 'Instagram',     platform: 'meta'    },
    { key: 'google_ads', label_ar: 'جوجل أدز',      label_en: 'Google Ads',    platform: 'google'  },
    { key: 'website',    label_ar: 'الموقع',         label_en: 'Website',       platform: 'organic' },
    { key: 'call',       label_ar: 'اتصال وارد',     label_en: 'Inbound Call',  platform: 'direct'  },
    { key: 'walk_in',    label_ar: 'زيارة مباشرة',   label_en: 'Walk-in',       platform: 'direct'  },
    { key: 'referral',   label_ar: 'ترشيح',          label_en: 'Referral',      platform: 'direct'  },
    { key: 'developer',  label_ar: 'مطور',           label_en: 'Developer',     platform: 'direct'  },
    { key: 'cold_call',  label_ar: 'كولد كول',       label_en: 'Cold Call',     platform: 'direct'  },
    { key: 'other',      label_ar: 'أخرى',           label_en: 'Other',         platform: 'other'   },
  ],
  departments: [
    { key: 'sales',      label_ar: 'المبيعات',         label_en: 'Sales',       color: '#4A7AAB' },
    { key: 'hr',         label_ar: 'الموارد البشرية',   label_en: 'HR',          color: '#6B21A8' },
    { key: 'marketing',  label_ar: 'التسويق',          label_en: 'Marketing',   color: '#F59E0B' },
    { key: 'operations', label_ar: 'العمليات',          label_en: 'Operations',  color: '#6B8DB5' },
    { key: 'finance',    label_ar: 'المالية',           label_en: 'Finance',     color: '#0F766E' },
  ],
  pipelineStages: {
    sales: [
      { id: 'qualification',        label_ar: 'تأهيل',          label_en: 'Qualification',    color: '#4A7AAB' },
      { id: 'site_visit_scheduled', label_ar: 'موعد معاينة',    label_en: 'Visit Scheduled',  color: '#4A7AAB' },
      { id: 'site_visited',         label_ar: 'تمت المعاينة',   label_en: 'Site Visited',     color: '#2B4C6F' },
      { id: 'proposal',             label_ar: 'عرض سعر',        label_en: 'Proposal',         color: '#2B4C6F' },
      { id: 'negotiation',          label_ar: 'تفاوض',          label_en: 'Negotiation',      color: '#1B3347' },
      { id: 'reserved',             label_ar: 'محجوز',          label_en: 'Reserved',         color: '#1B3347' },
      { id: 'contracted',           label_ar: 'تعاقد',          label_en: 'Contracted',       color: '#10B981' },
      { id: 'closed_won',           label_ar: 'تم الإغلاق',     label_en: 'Closed Won',       color: '#10B981' },
      { id: 'closed_lost',          label_ar: 'خسارة',          label_en: 'Closed Lost',      color: '#EF4444' },
    ],
    hr: [
      { id: 'applied',              label_ar: 'تقديم',          label_en: 'Applied',          color: '#4A7AAB' },
      { id: 'screening',            label_ar: 'فرز',            label_en: 'Screening',        color: '#4A7AAB' },
      { id: 'interview_1',          label_ar: 'مقابلة أولى',    label_en: '1st Interview',    color: '#2B4C6F' },
      { id: 'interview_2',          label_ar: 'مقابلة ثانية',   label_en: '2nd Interview',    color: '#2B4C6F' },
      { id: 'assessment',           label_ar: 'تقييم',          label_en: 'Assessment',       color: '#1B3347' },
      { id: 'offer',                label_ar: 'عرض',            label_en: 'Offer',            color: '#1B3347' },
      { id: 'closed_won',           label_ar: 'قبول',           label_en: 'Accepted',         color: '#10B981' },
      { id: 'closed_lost',          label_ar: 'رفض',            label_en: 'Rejected',         color: '#EF4444' },
    ],
    marketing: [
      { id: 'new',                  label_ar: 'جديد',           label_en: 'New',              color: '#4A7AAB' },
      { id: 'qualified',            label_ar: 'مؤهل',           label_en: 'Qualified',        color: '#4A7AAB' },
      { id: 'nurturing',            label_ar: 'رعاية',          label_en: 'Nurturing',        color: '#2B4C6F' },
      { id: 'converted',            label_ar: 'محول للمبيعات',  label_en: 'Converted to Sales', color: '#10B981' },
      { id: 'closed_lost',          label_ar: 'غير مهتم',       label_en: 'Not Interested',   color: '#EF4444' },
    ],
    operations: [
      { id: 'request',              label_ar: 'طلب',            label_en: 'Request',          color: '#4A7AAB' },
      { id: 'evaluation',           label_ar: 'تقييم',          label_en: 'Evaluation',       color: '#4A7AAB' },
      { id: 'negotiation',          label_ar: 'تفاوض',          label_en: 'Negotiation',      color: '#2B4C6F' },
      { id: 'agreement',            label_ar: 'اتفاق',          label_en: 'Agreement',        color: '#1B3347' },
      { id: 'execution',            label_ar: 'تنفيذ',          label_en: 'Execution',        color: '#1B3347' },
      { id: 'closed_won',           label_ar: 'مكتمل',          label_en: 'Completed',        color: '#10B981' },
      { id: 'closed_lost',          label_ar: 'ملغي',           label_en: 'Cancelled',        color: '#EF4444' },
    ],
    finance: [
      { id: 'pending',              label_ar: 'معلق',           label_en: 'Pending',          color: '#4A7AAB' },
      { id: 'under_review',         label_ar: 'مراجعة',         label_en: 'Under Review',     color: '#2B4C6F' },
      { id: 'approved',             label_ar: 'موافق عليه',     label_en: 'Approved',         color: '#1B3347' },
      { id: 'closed_won',           label_ar: 'مكتمل',          label_en: 'Completed',        color: '#10B981' },
      { id: 'closed_lost',          label_ar: 'مرفوض',          label_en: 'Rejected',         color: '#EF4444' },
    ],
  },
  lostReasons: [
    { key: 'price_high',         label_ar: 'سعر عالي',             label_en: 'Price Too High' },
    { key: 'competitor',         label_ar: 'منافس',                label_en: 'Went With Competitor' },
    { key: 'no_budget',          label_ar: 'مفيش ميزانية',         label_en: 'No Budget' },
    { key: 'bad_timing',         label_ar: 'توقيت غلط',            label_en: 'Bad Timing' },
    { key: 'no_response',        label_ar: 'مفيش رد',              label_en: 'No Response' },
    { key: 'not_interested',     label_ar: 'غير مهتم',             label_en: 'Not Interested' },
    { key: 'location_mismatch',  label_ar: 'موقع غير مناسب',       label_en: 'Location Mismatch' },
    { key: 'requirements_unmet', label_ar: 'متطلبات غير متوفرة',   label_en: 'Requirements Not Met' },
  ],
  activityTypes: [
    { key: 'call',       label_ar: 'مكالمة',      label_en: 'Call',       icon: 'Phone' },
    { key: 'whatsapp',   label_ar: 'واتساب',      label_en: 'WhatsApp',   icon: 'MessageCircle' },
    { key: 'email',      label_ar: 'إيميل',       label_en: 'Email',      icon: 'Mail' },
    { key: 'meeting',    label_ar: 'اجتماع',      label_en: 'Meeting',    icon: 'Users' },
    { key: 'site_visit', label_ar: 'زيارة موقع',  label_en: 'Site Visit', icon: 'Star' },
    { key: 'note',       label_ar: 'ملاحظة',      label_en: 'Note',       icon: 'Clock' },
  ],
  activityResults: {
    call: [
      { value: 'answered',     label_ar: 'رد',          label_en: 'Answered',       color: '#10B981' },
      { value: 'no_answer',    label_ar: 'لم يرد',      label_en: 'No Answer',      color: '#F59E0B' },
      { value: 'busy',         label_ar: 'مشغول',       label_en: 'Busy',           color: '#EF4444' },
      { value: 'switched_off', label_ar: 'مغلق',        label_en: 'Switched Off',   color: '#6b7280' },
      { value: 'wrong_number', label_ar: 'رقم خاطئ',    label_en: 'Wrong Number',   color: '#9333EA' },
    ],
    whatsapp: [
      { value: 'replied',       label_ar: 'رد',         label_en: 'Replied',        color: '#10B981' },
      { value: 'seen',          label_ar: 'شاف',        label_en: 'Seen',           color: '#3B82F6' },
      { value: 'delivered',     label_ar: 'وصلت',       label_en: 'Delivered',      color: '#F59E0B' },
      { value: 'not_delivered', label_ar: 'لم تصل',     label_en: 'Not Delivered',  color: '#EF4444' },
      { value: 'blocked',       label_ar: 'محظور',      label_en: 'Blocked',        color: '#6b7280' },
    ],
    email: [
      { value: 'replied', label_ar: 'رد',           label_en: 'Replied', color: '#10B981' },
      { value: 'opened',  label_ar: 'فتح',          label_en: 'Opened',  color: '#3B82F6' },
      { value: 'sent',    label_ar: 'تم الإرسال',   label_en: 'Sent',    color: '#F59E0B' },
      { value: 'bounced', label_ar: 'ارتد',          label_en: 'Bounced', color: '#EF4444' },
    ],
    meeting: [
      { value: 'attended',    label_ar: 'حضر',      label_en: 'Attended',    color: '#10B981' },
      { value: 'cancelled',   label_ar: 'ألغى',     label_en: 'Cancelled',   color: '#EF4444' },
      { value: 'rescheduled', label_ar: 'أُجّل',    label_en: 'Rescheduled', color: '#F59E0B' },
      { value: 'no_show',     label_ar: 'لم يحضر',  label_en: 'No Show',     color: '#6b7280' },
    ],
    site_visit: [
      { value: 'visited',     label_ar: 'زار',      label_en: 'Visited',     color: '#10B981' },
      { value: 'cancelled',   label_ar: 'ألغى',     label_en: 'Cancelled',   color: '#EF4444' },
      { value: 'rescheduled', label_ar: 'أُجّل',    label_en: 'Rescheduled', color: '#F59E0B' },
      { value: 'no_show',     label_ar: 'لم يحضر',  label_en: 'No Show',     color: '#6b7280' },
    ],
  },
  contactsSettings: {
    mergeLimit: 2,
    maxPins: 5,
  },
  stageWinRates: {
    sales: {
      qualification: 10, site_visit_scheduled: 20, site_visited: 30, proposal: 50, negotiation: 60, reserved: 75, contracted: 90, closed_won: 100, closed_lost: 0,
    },
    hr: {
      applied: 10, screening: 20, interview_1: 35, interview_2: 50, assessment: 65, offer: 80, closed_won: 100, closed_lost: 0,
    },
    marketing: {
      new: 5, qualified: 20, nurturing: 40, converted: 80, closed_lost: 0,
    },
    operations: {
      request: 10, evaluation: 25, negotiation: 40, agreement: 60, execution: 80, closed_won: 100, closed_lost: 0,
    },
    finance: {
      pending: 15, under_review: 40, approved: 75, closed_won: 100, closed_lost: 0,
    },
  },
  companyInfo: {
    name_ar: 'بلاتفورم للعقارات',
    name_en: 'Platform Real Estate',
    phone: '',
    email: '',
    address_ar: '',
    address_en: '',
    logo_url: '',
    currency: 'EGP',
    timezone: 'Africa/Cairo',
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const saved = JSON.parse(raw);
    return deepMerge(DEFAULT_CONFIG, saved);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Async load from Supabase (called on app init), falls back to localStorage
 */
export async function loadConfigFromServer() {
  try {
    const { default: supabase } = await import('../lib/supabase');
    const { data, error } = await supabase.from('system_config').select('key, value');
    if (error) throw error;
    if (data?.length) {
      const serverConfig = {};
      data.forEach(row => { serverConfig[row.key] = row.value; });
      const merged = deepMerge(DEFAULT_CONFIG, serverConfig);
      // Sync to localStorage as cache
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
      return merged;
    }
  } catch { /* fall through to localStorage */ }
  return loadConfig();
}

export function saveConfig(config) {
  // Save to localStorage immediately
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save system config:', e);
  }
  // Also persist to Supabase (non-blocking)
  import('../lib/supabase').then(({ default: supabase }) => {
    Object.entries(config).forEach(([key, value]) => {
      supabase.from('system_config')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .then(() => {}).catch(() => {});
    });
  }).catch(() => {});
}

export function saveSection(key, data) {
  const current = loadConfig();
  current[key] = data;
  saveConfig(current);
}

export function resetConfig() {
  localStorage.removeItem(STORAGE_KEY);
  return { ...DEFAULT_CONFIG };
}

export function exportConfig() {
  return JSON.stringify(loadConfig(), null, 2);
}

export function importConfig(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    const merged = deepMerge(DEFAULT_CONFIG, parsed);
    saveConfig(merged);
    return merged;
  } catch (e) {
    console.error('Failed to import config:', e);
    throw new Error('Invalid configuration JSON');
  }
}
