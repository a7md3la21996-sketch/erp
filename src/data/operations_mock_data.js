// ── Operations Module — Mock Data & Config ──────────────────────────────

// ── Status Configs ──────────────────────────────────────────────────────

export const DEAL_STATUS_CONFIG = {
  new_deal:        { ar: 'صفقة جديدة',     en: 'New Deal',         color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)',  step: 1 },
  under_review:    { ar: 'قيد المراجعة',    en: 'Under Review',     color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)', step: 2 },
  docs_collection: { ar: 'تجميع المستندات', en: 'Collecting Docs',  color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)',   step: 3 },
  contract_prep:   { ar: 'إعداد العقد',     en: 'Contract Prep',    color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)',   step: 4 },
  contract_signed: { ar: 'تم التوقيع',      en: 'Contract Signed',  color: '#1B3347', bg: 'rgba(27,51,71,0.12)',    step: 5 },
  completed:       { ar: 'مكتمل',          en: 'Completed',        color: '#1B3347', bg: 'rgba(27,51,71,0.18)',    step: 6 },
  cancelled:       { ar: 'ملغي',           en: 'Cancelled',        color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   step: 0 },
};

export const PAYMENT_STATUS_CONFIG = {
  upcoming: { ar: 'قادم',   en: 'Upcoming', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  due:      { ar: 'مستحق',  en: 'Due',      color: '#F97316', bg: 'rgba(249,115,22,0.10)'  },
  overdue:  { ar: 'متأخر',  en: 'Overdue',  color: '#EF4444', bg: 'rgba(239,68,68,0.08)'   },
  paid:     { ar: 'مدفوع',  en: 'Paid',     color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)'   },
  partial:  { ar: 'جزئي',   en: 'Partial',  color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
};

export const HANDOVER_STATUS_CONFIG = {
  reserved:            { ar: 'محجوز',        en: 'Reserved',           color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)' },
  developer_confirmed: { ar: 'تأكيد المطور', en: 'Developer Confirmed', color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  under_construction:  { ar: 'تحت الإنشاء',  en: 'Under Construction',  color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)' },
  finishing:           { ar: 'تشطيب',        en: 'Finishing',           color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)' },
  ready:               { ar: 'جاهز للتسليم', en: 'Ready',              color: '#1B3347', bg: 'rgba(27,51,71,0.15)' },
  handed_over:         { ar: 'تم التسليم',   en: 'Handed Over',        color: '#1B3347', bg: 'rgba(27,51,71,0.18)' },
};

export const TICKET_STATUS_CONFIG = {
  open:        { ar: 'مفتوح',       en: 'Open',        color: '#EF4444', bg: 'rgba(239,68,68,0.08)'  },
  in_progress: { ar: 'قيد المعالجة', en: 'In Progress', color: '#F97316', bg: 'rgba(249,115,22,0.10)' },
  waiting:     { ar: 'بانتظار رد',  en: 'Waiting',     color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  resolved:    { ar: 'تم الحل',     en: 'Resolved',    color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)' },
  closed:      { ar: 'مغلق',       en: 'Closed',      color: '#2B4C6F', bg: 'rgba(43,76,111,0.12)' },
};

export const TICKET_TYPE_CONFIG = {
  complaint:    { ar: 'شكوى',         en: 'Complaint',    color: '#EF4444' },
  maintenance:  { ar: 'صيانة',        en: 'Maintenance',  color: '#F97316' },
  inquiry:      { ar: 'استفسار',      en: 'Inquiry',      color: '#4A7AAB' },
  modification: { ar: 'تعديل بيانات', en: 'Modification', color: '#6B8DB5' },
};

export const PRIORITY_CONFIG = {
  urgent: { ar: 'عاجل',  en: 'Urgent', color: '#EF4444' },
  high:   { ar: 'عالي',  en: 'High',   color: '#2B4C6F' },
  medium: { ar: 'متوسط', en: 'Medium', color: '#6B8DB5' },
  low:    { ar: 'منخفض', en: 'Low',    color: '#8BA8C8' },
};

export const DOCUMENT_CHECKLIST = [
  { key: 'national_id',          ar: 'صورة البطاقة',   en: 'National ID',          required: true  },
  { key: 'reservation_form',     ar: 'استمارة الحجز',   en: 'Reservation Form',     required: true  },
  { key: 'down_payment_receipt', ar: 'إيصال المقدم',    en: 'Down Payment Receipt', required: true  },
  { key: 'contract',             ar: 'العقد',           en: 'Contract',             required: true  },
  { key: 'developer_receipt',    ar: 'إيصال المطور',    en: 'Developer Receipt',    required: true  },
  { key: 'power_of_attorney',    ar: 'توكيل',           en: 'Power of Attorney',    required: false },
  { key: 'unit_specs',           ar: 'مواصفات الوحدة',  en: 'Unit Specs',           required: false },
];

// ── Mock Deals ──────────────────────────────────────────────────────────

export const MOCK_OPS_DEALS = [];

// ── Mock Installments ───────────────────────────────────────────────────

export const MOCK_INSTALLMENTS = [];

// ── Mock Handovers ──────────────────────────────────────────────────────

export const MOCK_HANDOVERS = [];

// ── Mock Tickets ─────────────────────────────────────────────────────────

export const MOCK_TICKETS = [];

// ── Mock Activity Log (for Overview timeline) ───────────────────────────

export const MOCK_OPS_ACTIVITY = [];

// ── Helpers ──────────────────────────────────────────────────────────────

export const fmtMoney = (n) => {
  if (!n && n !== 0) return '-';
  return n.toLocaleString('en-US') + ' EGP';
};

export const fmtMoneyShort = (n) => {
  if (!n) return '-';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toLocaleString('en-US');
};

export const daysSince = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};
