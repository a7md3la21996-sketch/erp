import { useState, useEffect, useRef } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { Flame, Wind, Snowflake, Thermometer } from 'lucide-react';

// ── Hooks (re-export from shared) ────────────────────────────────────────
export { useEscClose } from '../../../utils/hooks';

// ── Constants ──────────────────────────────────────────────────────────────
export const SOURCE_LABELS = { facebook: 'فيسبوك', instagram: 'إنستجرام', google_ads: 'جوجل أدز', website: 'الموقع', call: 'اتصال وارد', walk_in: 'زيارة مباشرة', referral: 'ترشيح', developer: 'مطور', cold_call: 'كولد كول', other: 'أخرى' };
export const SOURCE_EN = { facebook: 'Facebook', instagram: 'Instagram', google_ads: 'Google Ads', website: 'Website', call: 'Inbound Call', walk_in: 'Walk-in', referral: 'Referral', developer: 'Developer', cold_call: 'Cold Call', other: 'Other' };
export const SOURCE_PLATFORM = { facebook: 'meta', instagram: 'meta', google_ads: 'google', website: 'organic', call: 'direct', walk_in: 'direct', referral: 'direct', developer: 'direct', cold_call: 'direct', other: 'other' };
export const PLATFORM_LABELS = { meta: { ar: 'Meta', en: 'Meta' }, google: { ar: 'Google', en: 'Google' }, organic: { ar: 'أورجانيك', en: 'Organic' }, direct: { ar: 'مباشر', en: 'Direct' }, other: { ar: 'أخرى', en: 'Other' } };
export const AD_SOURCES = ['facebook', 'instagram', 'google_ads'];
export const STAGE_LABELS = { qualification: { ar: 'تأهيل', en: 'Qualification' }, site_visit_scheduled: { ar: 'موعد معاينة', en: 'Visit Scheduled' }, site_visited: { ar: 'زار الموقع', en: 'Site Visited' }, proposal: { ar: 'عرض سعر', en: 'Proposal' }, negotiation: { ar: 'تفاوض', en: 'Negotiation' }, reserved: { ar: 'محجوز', en: 'Reserved' }, contracted: { ar: 'تعاقد', en: 'Contracted' }, closed_won: { ar: 'فوز ✓', en: 'Won ✓' }, closed_lost: { ar: 'خسارة ✗', en: 'Lost ✗' }, on_hold: { ar: 'معلق', en: 'On Hold' } };
export const stageLabel = (key, isRTL) => { const s = STAGE_LABELS[key]; return s ? (isRTL ? s.ar : s.en) : key; };

// ── Department-specific Stages ────────────────────────────────────────────
export const DEPT_STAGES = {
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
};
export const getDeptStages = (dept) => DEPT_STAGES[dept] || DEPT_STAGES.sales;
export const deptStageLabel = (stageId, dept, isRTL) => {
  const stages = getDeptStages(dept);
  const s = stages.find(st => st.id === stageId);
  return s ? (isRTL ? s.label_ar : s.label_en) : stageId;
};
export const COLD_LABELS = { not_contacted: { ar: 'لم يُتصل به', en: 'Not Contacted' }, no_answer: { ar: 'لا يرد', en: 'No Answer' }, not_interested: { ar: 'غير مهتم', en: 'Not Interested' }, interested: { ar: 'مهتم', en: 'Interested' }, wrong_number: { ar: 'رقم خاطئ', en: 'Wrong Number' }, call_back_later: { ar: 'اتصل لاحقاً', en: 'Call Back Later' } };
export const coldLabel = (key, isRTL) => { const s = COLD_LABELS[key]; return s ? (isRTL ? s.ar : s.en) : key; };
export const TEMP = {
  hot:  { label: 'Hot', labelAr: 'حار',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  Icon: Flame },
  warm: { label: 'Warm', labelAr: 'دافئ', color: '#F97316', bg: 'rgba(249,115,22,0.10)', Icon: Thermometer },
  cool: { label: 'Cool', labelAr: 'فاتر', color: '#8BA8C8', bg: 'rgba(139,168,200,0.10)', Icon: Wind },
  cold: { label: 'Cold', labelAr: 'بارد', color: '#4A7AAB', bg: 'rgba(74,122,171,0.10)',  Icon: Snowflake },
};
export const TYPE = {
  lead:      { label: 'ليد',       labelEn: 'Lead',       color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
  cold:      { label: 'كولد',      labelEn: 'Cold',       color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  client:    { label: 'عميل',      labelEn: 'Client',     color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)'   },
  supplier:  { label: 'مورد',      labelEn: 'Supplier',   color: '#0F766E', bg: 'rgba(15,118,110,0.12)'  },
  developer: { label: 'مطور',      labelEn: 'Developer',  color: '#B45309', bg: 'rgba(180,83,9,0.12)'    },
  applicant: { label: 'متقدم',     labelEn: 'Applicant',  color: '#6B21A8', bg: 'rgba(107,33,168,0.12)'  },
  partner:   { label: 'شريك',      labelEn: 'Partner',    color: '#1E40AF', bg: 'rgba(30,64,175,0.12)'   },
};

// ── MOCK DATA ───────────────────────────────────────────────────────────────
export const MOCK = [
  { id: '1', full_name: 'أحمد محمد السيد', phone: '01012345678', phone2: '01198765432', email: 'ahmed@email.com', contact_type: 'lead', source: 'facebook', campaign_name: 'حملة الشيخ زايد Q1', lead_score: 85, temperature: 'hot', cold_status: null, department: 'sales', platform: 'meta', budget_min: 1500000, budget_max: 2500000, preferred_location: 'الشيخ زايد', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2026-02-15', last_activity_at: '2026-03-04' },
  { id: '2', full_name: 'منى عبدالله حسن', phone: '01123456789', phone2: null, email: 'mona@email.com', contact_type: 'lead', source: 'google_ads', campaign_name: 'Google - التجمع', lead_score: 62, temperature: 'warm', cold_status: null, department: 'sales', platform: 'google', budget_min: 3000000, budget_max: 5000000, preferred_location: 'التجمع الخامس', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2026-02-20', last_activity_at: '2026-03-02' },
  { id: '3', full_name: 'خالد إبراهيم عمر', phone: '01234567890', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 20, temperature: 'cold', cold_status: 'no_answer', department: 'sales', platform: 'direct', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-01-10', last_activity_at: '2026-01-12' },
  { id: '4', full_name: 'هدى محمود طه', phone: '01087654321', phone2: '01556789012', email: 'hoda@email.com', contact_type: 'client', source: 'referral', campaign_name: null, lead_score: 95, temperature: 'hot', cold_status: null, department: 'sales', platform: 'direct', budget_min: 4000000, budget_max: 7000000, preferred_location: 'مدينة نصر', interested_in_type: 'commercial', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2025-11-05', last_activity_at: '2026-03-01' },
  { id: '5', full_name: 'يوسف رمضان علي', phone: '01099887766', phone2: null, email: 'yousef@email.com', contact_type: 'lead', source: 'instagram', campaign_name: 'حملة أكتوبر سيتي', lead_score: 45, temperature: 'cool', cold_status: null, department: 'sales', platform: 'meta', budget_min: 800000, budget_max: 1200000, preferred_location: 'أكتوبر', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'ريم أحمد', created_at: '2026-03-01', last_activity_at: '2026-03-01' },
  { id: '6', full_name: 'نادية سامي عيسى', phone: '01144556677', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 10, temperature: 'cold', cold_status: 'not_interested', department: 'sales', platform: 'direct', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2026-01-20', last_activity_at: '2026-01-21' },
  { id: '7', full_name: 'طارق جمال حلمي', phone: '01277889900', phone2: '01366778899', email: 'tarek@email.com', contact_type: 'lead', source: 'website', campaign_name: null, lead_score: 78, temperature: 'warm', cold_status: null, department: 'sales', platform: 'organic', budget_min: 2000000, budget_max: 3500000, preferred_location: 'الشيخ زايد', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'ريم أحمد', created_at: '2026-02-25', last_activity_at: '2026-03-03' },
  { id: '8', full_name: 'إيمان حسين فوزي', phone: '01055443322', phone2: null, email: 'eman@email.com', contact_type: 'lead', source: 'walk_in', campaign_name: null, lead_score: 90, temperature: 'hot', cold_status: null, department: 'sales', platform: 'direct', budget_min: 5000000, budget_max: 8000000, preferred_location: 'القاهرة الجديدة', interested_in_type: 'administrative', is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-02-10', last_activity_at: '2026-03-05' },
  { id: '9', full_name: 'سامح فريد منصور', phone: '01322334455', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 5, temperature: 'cold', cold_status: 'wrong_number', department: 'sales', platform: 'direct', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: true, blacklist_reason: 'رقم خاطئ متكرر', assigned_to_name: 'ريم أحمد', created_at: '2026-02-01', last_activity_at: '2026-02-01' },
  { id: '10', full_name: 'رانيا وليد زكي', phone: '01511223344', phone2: '01622334455', email: 'rania@email.com', contact_type: 'client', source: 'facebook', campaign_name: 'حملة المحور Q4', lead_score: 99, temperature: 'hot', cold_status: null, department: 'sales', platform: 'meta', budget_min: 3000000, budget_max: 5000000, preferred_location: 'محور المشير', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2025-09-15', last_activity_at: '2026-02-28' },
  { id: '11', full_name: 'عمر صلاح الدين', phone: '01688776655', phone2: null, email: 'omar@email.com', contact_type: 'lead', source: 'google_ads', campaign_name: 'Google - وسط البلد', lead_score: 55, temperature: 'warm', cold_status: null, department: 'sales', platform: 'google', budget_min: 1000000, budget_max: 1800000, preferred_location: 'وسط البلد', interested_in_type: 'commercial', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2026-02-28', last_activity_at: '2026-03-03' },
  { id: '12', full_name: 'دينا عصام بدر', phone: '01755664433', phone2: null, email: 'dina@email.com', contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 30, temperature: 'cool', cold_status: 'call_back_later', department: 'sales', platform: 'direct', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-02-18', last_activity_at: '2026-03-02' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
export const fmtBudget = (min, max, isRTL = true) => {
  if (!min && !max) return '—';
  const f = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}${isRTL ? 'م' : 'M'}` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}${isRTL ? 'ك' : 'K'}` : n;
  if (min && max) return `${f(min)} – ${f(max)}`;
  return min ? `${isRTL ? 'من' : 'From'} ${f(min)}` : `${isRTL ? 'حتى' : 'Up to'} ${f(max)}`;
};
export const daysSince = d => Math.floor((Date.now() - new Date(d)) / 86400000);
export const initials = name => name ? name.trim().charAt(0) : '?';
export const AVATAR_COLORS = ['#2B4C6F','#4A7AAB','#065F46','#92400E','#1E40AF','#6B21A8','#B45309','#0F766E'];
export const avatarColor = (id) => {
  if (!id) return AVATAR_COLORS[0];
  const num = typeof id === 'number' ? id : [...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[num % AVATAR_COLORS.length];
};
export const normalizePhone = (p) => {
  if (!p) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) {
    if (p.length === 11 && p.startsWith('01')) return '+20' + p.slice(1);
    return p;
  }
  return p;
};
export const validatePhone = (p) => {
  if (!p) return false;
  const normalized = normalizePhone(p);
  if (normalized === p && p.startsWith('0')) return false;
  try {
    const phone = parsePhoneNumberFromString(normalized);
    return phone ? phone.isValid() : false;
  } catch { return false; }
};
export const getPhoneInfo = (p) => {
  if (!p) return null;
  const normalized = normalizePhone(p);
  try {
    const phone = parsePhoneNumberFromString(normalized);
    if (!phone || !phone.isValid()) return null;
    const flags = { EG: '🇪🇬', SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭', OM: '🇴🇲', JO: '🇯🇴', LB: '🇱🇧', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷' };
    return { country: phone.country, flag: flags[phone.country] || '🌍', formatted: phone.formatInternational() };
  } catch { return null; }
};

// ── Country Codes ─────────────────────────────────────────────────────────
export const COUNTRY_CODES = [
  // Arab countries
  { code: '+20', country: 'EG', flag: '🇪🇬', label: 'Egypt', labelAr: 'مصر' },
  { code: '+966', country: 'SA', flag: '🇸🇦', label: 'Saudi Arabia', labelAr: 'السعودية' },
  { code: '+971', country: 'AE', flag: '🇦🇪', label: 'UAE', labelAr: 'الإمارات' },
  { code: '+965', country: 'KW', flag: '🇰🇼', label: 'Kuwait', labelAr: 'الكويت' },
  { code: '+974', country: 'QA', flag: '🇶🇦', label: 'Qatar', labelAr: 'قطر' },
  { code: '+973', country: 'BH', flag: '🇧🇭', label: 'Bahrain', labelAr: 'البحرين' },
  { code: '+968', country: 'OM', flag: '🇴🇲', label: 'Oman', labelAr: 'عُمان' },
  { code: '+962', country: 'JO', flag: '🇯🇴', label: 'Jordan', labelAr: 'الأردن' },
  { code: '+961', country: 'LB', flag: '🇱🇧', label: 'Lebanon', labelAr: 'لبنان' },
  { code: '+964', country: 'IQ', flag: '🇮🇶', label: 'Iraq', labelAr: 'العراق' },
  { code: '+963', country: 'SY', flag: '🇸🇾', label: 'Syria', labelAr: 'سوريا' },
  { code: '+218', country: 'LY', flag: '🇱🇾', label: 'Libya', labelAr: 'ليبيا' },
  { code: '+216', country: 'TN', flag: '🇹🇳', label: 'Tunisia', labelAr: 'تونس' },
  { code: '+213', country: 'DZ', flag: '🇩🇿', label: 'Algeria', labelAr: 'الجزائر' },
  { code: '+212', country: 'MA', flag: '🇲🇦', label: 'Morocco', labelAr: 'المغرب' },
  { code: '+249', country: 'SD', flag: '🇸🇩', label: 'Sudan', labelAr: 'السودان' },
  { code: '+967', country: 'YE', flag: '🇾🇪', label: 'Yemen', labelAr: 'اليمن' },
  { code: '+970', country: 'PS', flag: '🇵🇸', label: 'Palestine', labelAr: 'فلسطين' },
  // International
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'UK', labelAr: 'بريطانيا' },
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'US/CA', labelAr: 'أمريكا/كندا' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany', labelAr: 'ألمانيا' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France', labelAr: 'فرنسا' },
  { code: '+39', country: 'IT', flag: '🇮🇹', label: 'Italy', labelAr: 'إيطاليا' },
  { code: '+34', country: 'ES', flag: '🇪🇸', label: 'Spain', labelAr: 'إسبانيا' },
  { code: '+90', country: 'TR', flag: '🇹🇷', label: 'Turkey', labelAr: 'تركيا' },
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India', labelAr: 'الهند' },
  { code: '+86', country: 'CN', flag: '🇨🇳', label: 'China', labelAr: 'الصين' },
  { code: '+7', country: 'RU', flag: '🇷🇺', label: 'Russia', labelAr: 'روسيا' },
];

export const getCountryFromPhone = (phone) => {
  if (!phone) return '+20';
  const normalized = normalizePhone(phone);
  const info = getPhoneInfo(normalized);
  if (info) {
    const found = COUNTRY_CODES.find(c => c.country === info.country);
    if (found) return found.code;
  }
  return '+20';
};

// ── Sub-components ─────────────────────────────────────────────────────────
export function Chip({ label, color, bg, size = 'sm' }) {
  return (
    <span
      className={`inline-block rounded-full font-bold whitespace-nowrap ${size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-xs px-3 py-[3px]'}`}
      style={{ color, background: bg }}
    >{label}</span>
  );
}

export function ScorePill({ score }) {
  const s = score ?? 0;
  const color = s >= 75 ? '#4A7AAB' : s >= 50 ? '#6B8DB5' : s >= 25 ? '#8BA8C8' : '#EF4444';
  return (
    <div className="flex items-center gap-1.5 min-w-[70px]">
      <div className="flex-1 h-1 bg-brand-500/15 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${s}%`, background: color }} />
      </div>
      <span className="text-xs font-bold min-w-[20px]" style={{ color }}>{s}</span>
    </div>
  );
}

// ── Phone Cell ─────────────────────────────────────────────────────────────
export function PhoneCell({ phone, small = false }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  if (!phone) return null;
  const masked = phone.slice(0, 6) + '****';
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => { setCopied(false); });
  };
  return (
    <div className="flex items-center gap-1.5 cursor-pointer py-[3px]" dir="ltr"
      onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}>
      <span className={`font-mono whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[150px] ${small ? 'text-xs text-gray-400 dark:text-gray-500' : 'text-xs text-content dark:text-content-dark'}`}
        style={{ letterSpacing: revealed ? 0 : 1 }}>
        {revealed ? phone : masked}
      </span>
      {revealed && (
        <button onClick={handleCopy}
          className={`px-2 py-0.5 rounded text-xs cursor-pointer font-semibold border ${copied ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-brand-500/15 border-brand-500/30 text-brand-400'}`}>
          {copied ? (isRTL ? '✓ تم' : '✓ copied') : (isRTL ? 'نسخ' : 'copy')}
        </button>
      )}
    </div>
  );
}
