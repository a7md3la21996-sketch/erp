import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
// Full library (not /mobile) so landlines also pass isValid() — office
// numbers and Cairo/Alex landlines are legitimate even if rare.
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { Flame, Wind, Snowflake, Thermometer } from 'lucide-react';

// ── Shared PropTypes ─────────────────────────────────────────────────────
export const contactPropType = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  full_name: PropTypes.string,
  phone: PropTypes.string,
  email: PropTypes.string,
  contact_type: PropTypes.string,
  source: PropTypes.string,
  department: PropTypes.string,
  is_blacklisted: PropTypes.bool,
});

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
// Allow SystemConfig to override stages at runtime
let _configStages = null;
export function setConfigStages(stages) { _configStages = stages; }
export const getDeptStages = (dept) => {
  if (_configStages && _configStages[dept]?.length) return _configStages[dept];
  return DEPT_STAGES[dept] || DEPT_STAGES.sales;
};

/**
 * Stage gates: required activity types before entering a stage.
 * If the contact/opportunity has no activity of the required type, the move is blocked with a warning.
 */
export const STAGE_GATES = {
  site_visited:  { required_activity: 'site_visit',  label_ar: 'يجب تسجيل زيارة موقع أولاً', label_en: 'A site visit must be logged first' },
  proposal:      { required_activity: 'call',         label_ar: 'يجب تسجيل مكالمة أولاً',     label_en: 'A call must be logged first' },
  reserved:      { required_activity: 'site_visit',   label_ar: 'يجب تسجيل زيارة موقع أولاً', label_en: 'A site visit must be logged first' },
};
export const getStageGate = (stageId) => STAGE_GATES[stageId] || null;
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
  lead:         { label: 'ليد',          labelEn: 'Lead',          color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
  nurturing:    { label: 'متابعة',      labelEn: 'Nurturing',     color: '#7C3AED', bg: 'rgba(124,58,237,0.12)'  },
  converted:    { label: 'محول',         labelEn: 'Converted',     color: '#059669', bg: 'rgba(5,150,105,0.12)'   },
  customer:     { label: 'عميل حالي',    labelEn: 'Customer',      color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
  repeat_buyer: { label: 'عميل متكرر',   labelEn: 'Repeat Buyer',  color: '#0D9488', bg: 'rgba(13,148,136,0.12)'  },
  vip:          { label: 'VIP',          labelEn: 'VIP',           color: '#DC2626', bg: 'rgba(220,38,38,0.12)'   },
  referrer:     { label: 'مُرشّح',       labelEn: 'Referrer',      color: '#D97706', bg: 'rgba(217,119,6,0.12)'   },
  cold:         { label: 'كولد كول',     labelEn: 'Cold Call',     color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  supplier:     { label: 'مورد',         labelEn: 'Supplier',      color: '#0F766E', bg: 'rgba(15,118,110,0.12)'  },
  developer:    { label: 'مطور',         labelEn: 'Developer',     color: '#B45309', bg: 'rgba(180,83,9,0.12)'    },
  applicant:    { label: 'متقدم',        labelEn: 'Applicant',     color: '#6B21A8', bg: 'rgba(107,33,168,0.12)'  },
  partner:      { label: 'شريك',         labelEn: 'Partner',       color: '#1E40AF', bg: 'rgba(30,64,175,0.12)'   },
};

// ── MOCK DATA (empty - real data comes from Supabase) ─────────────────────
export const MOCK = [];

// ── Helpers ────────────────────────────────────────────────────────────────
export const fmtBudget = (min, max, isRTL = true) => {
  if (!min && !max) return '—';
  const f = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}${isRTL ? 'م' : 'M'}` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}${isRTL ? 'ك' : 'K'}` : n;
  if (min && max) return `${f(min)} – ${f(max)}`;
  return min ? `${isRTL ? 'من' : 'From'} ${f(min)}` : `${isRTL ? 'حتى' : 'Up to'} ${f(max)}`;
};
export const daysSince = d => Math.floor((Date.now() - new Date(d)) / 86400000);

/**
 * Combine a local phone number with the user's selected country code into
 * an E.164-style string. Used by Add/Edit contact forms.
 *
 *   getFullPhone('01234', '+20')   → '+201234'
 *   getFullPhone('+20123', '+20')  → '+20123'   (already international)
 *   getFullPhone('00201', '+20')   → '+201'      (00 → +)
 */
export const getFullPhone = (phone, code) => {
  if (!phone) return '';
  if (phone.startsWith('+')) return phone;
  if (phone.startsWith('00')) return '+' + phone.slice(2);
  if (phone.startsWith('0')) return code + phone.slice(1);
  return code + phone;
};
export const initials = name => name ? name.trim().charAt(0) : '?';

/**
 * Short two-letter initials for an agent name. "Ahmed Adel" → "AA",
 * "Mariam" → "MA". Used by chips and avatars across the contacts UI.
 */
export const agentInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};
export const AVATAR_COLORS = ['#2B4C6F','#4A7AAB','#065F46','#92400E','#1E40AF','#6B21A8','#B45309','#0F766E'];
export const avatarColor = (id) => {
  if (!id) return AVATAR_COLORS[0];
  const num = typeof id === 'number' ? id : [...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[num % AVATAR_COLORS.length];
};
// Try to convert a local-format phone to E.164 using libphonenumber-js.
// Falls back to Egypt mobile pattern (01XXXXXXXXX) for legacy unprefixed data.
// If already international (+...) or can't be parsed, returns input unchanged.
export const normalizePhone = (p) => {
  if (!p) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('+')) return p;
  // Egypt mobile fallback — most common legacy pattern in this codebase
  if (p.startsWith('01') && p.length === 11) return '+20' + p.slice(1);
  // Best-effort parse with libphonenumber (no default country — only succeeds for unambiguous international formats)
  try {
    const parsed = parsePhoneNumberFromString(p);
    if (parsed?.isValid()) return parsed.format('E.164');
  } catch { /* noop */ }
  return p;
};
// Strict E.164 validation. libphonenumber is authoritative — its `isValid()`
// understands per-country prefix rules (e.g. Egyptian mobile must start with
// 01[0125], Saudi mobile with 5X). The earlier loose fallback that accepted
// any "+" + 8-15 digits is what let junk like +201111111944 and +999999999999
// into the DB. Removed deliberately; the DB CHECK constraint
// `contacts_phone_e164_format` is the final safety net.
export const validatePhone = (p) => {
  if (!p) return false;
  const normalized = normalizePhone(p);
  if (normalized === p && p.startsWith('0')) return false;
  // Must match E.164 shape before we even try libphonenumber — guards against
  // anything that wouldn't fit the DB constraint regardless of libphonenumber's opinion.
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) return false;
  try {
    const phone = parsePhoneNumberFromString(normalized);
    return Boolean(phone?.isValid());
  } catch { return false; }
};
export const getPhoneInfo = (p) => {
  if (!p) return null;
  const normalized = normalizePhone(p);
  try {
    const phone = parsePhoneNumberFromString(normalized);
    if (!phone || !phone.isValid()) return null;
    // Flag lookup synced with COUNTRY_CODES below. Anything missing falls
    // back to 🌍 so the badge still renders.
    const flags = {
      EG:'🇪🇬', SA:'🇸🇦', AE:'🇦🇪', KW:'🇰🇼', QA:'🇶🇦', BH:'🇧🇭', OM:'🇴🇲', JO:'🇯🇴', LB:'🇱🇧',
      IQ:'🇮🇶', SY:'🇸🇾', LY:'🇱🇾', TN:'🇹🇳', DZ:'🇩🇿', MA:'🇲🇦', SD:'🇸🇩', YE:'🇾🇪', PS:'🇵🇸',
      MR:'🇲🇷', DJ:'🇩🇯', SO:'🇸🇴', KM:'🇰🇲', IL:'🇵🇸',
      IN:'🇮🇳', PK:'🇵🇰', BD:'🇧🇩', PH:'🇵🇭', ID:'🇮🇩', LK:'🇱🇰', NP:'🇳🇵', IR:'🇮🇷', AF:'🇦🇫', TR:'🇹🇷',
      NG:'🇳🇬', KE:'🇰🇪', ET:'🇪🇹', GH:'🇬🇭', ZA:'🇿🇦',
      US:'🇺🇸', GB:'🇬🇧', DE:'🇩🇪', FR:'🇫🇷', IT:'🇮🇹', ES:'🇪🇸', PT:'🇵🇹', NL:'🇳🇱', BE:'🇧🇪',
      CH:'🇨🇭', AT:'🇦🇹', SE:'🇸🇪', NO:'🇳🇴', DK:'🇩🇰', FI:'🇫🇮', IE:'🇮🇪', GR:'🇬🇷', PL:'🇵🇱',
      CZ:'🇨🇿', RU:'🇷🇺', UA:'🇺🇦', CY:'🇨🇾', AU:'🇦🇺', NZ:'🇳🇿', BR:'🇧🇷', MX:'🇲🇽',
      CN:'🇨🇳', JP:'🇯🇵', KR:'🇰🇷', HK:'🇭🇰', SG:'🇸🇬', MY:'🇲🇾', TH:'🇹🇭',
    };
    return { country: phone.country, flag: flags[phone.country] || '🌍', formatted: phone.formatInternational() };
  } catch { return null; }
};

// ── Country Codes ─────────────────────────────────────────────────────────
export const COUNTRY_CODES = [
  // Arab countries — primary customer base
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
  // +972 is the dial code libphonenumber/ITU label as Israel; in this CRM
  // we surface it as Palestine per business policy. The country=IL key
  // stays so libphonenumber-detected numbers still match this entry on
  // lookup — the user-visible label is what changes.
  { code: '+972', country: 'IL', flag: '🇵🇸', label: 'Palestine', labelAr: 'فلسطين' },
  { code: '+222', country: 'MR', flag: '🇲🇷', label: 'Mauritania', labelAr: 'موريتانيا' },
  { code: '+253', country: 'DJ', flag: '🇩🇯', label: 'Djibouti', labelAr: 'جيبوتي' },
  { code: '+252', country: 'SO', flag: '🇸🇴', label: 'Somalia', labelAr: 'الصومال' },
  { code: '+269', country: 'KM', flag: '🇰🇲', label: 'Comoros', labelAr: 'القمر' },
  // Expat-origin countries (common for Gulf workers)
  { code: '+91', country: 'IN', flag: '🇮🇳', label: 'India', labelAr: 'الهند' },
  { code: '+92', country: 'PK', flag: '🇵🇰', label: 'Pakistan', labelAr: 'باكستان' },
  { code: '+880', country: 'BD', flag: '🇧🇩', label: 'Bangladesh', labelAr: 'بنغلاديش' },
  { code: '+63', country: 'PH', flag: '🇵🇭', label: 'Philippines', labelAr: 'الفلبين' },
  { code: '+62', country: 'ID', flag: '🇮🇩', label: 'Indonesia', labelAr: 'إندونيسيا' },
  { code: '+94', country: 'LK', flag: '🇱🇰', label: 'Sri Lanka', labelAr: 'سريلانكا' },
  { code: '+977', country: 'NP', flag: '🇳🇵', label: 'Nepal', labelAr: 'نيبال' },
  { code: '+98', country: 'IR', flag: '🇮🇷', label: 'Iran', labelAr: 'إيران' },
  { code: '+93', country: 'AF', flag: '🇦🇫', label: 'Afghanistan', labelAr: 'أفغانستان' },
  { code: '+90', country: 'TR', flag: '🇹🇷', label: 'Turkey', labelAr: 'تركيا' },
  { code: '+234', country: 'NG', flag: '🇳🇬', label: 'Nigeria', labelAr: 'نيجيريا' },
  { code: '+254', country: 'KE', flag: '🇰🇪', label: 'Kenya', labelAr: 'كينيا' },
  { code: '+251', country: 'ET', flag: '🇪🇹', label: 'Ethiopia', labelAr: 'إثيوبيا' },
  { code: '+233', country: 'GH', flag: '🇬🇭', label: 'Ghana', labelAr: 'غانا' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', label: 'South Africa', labelAr: 'جنوب أفريقيا' },
  // Major Western markets
  { code: '+1', country: 'US', flag: '🇺🇸', label: 'US/CA', labelAr: 'أمريكا/كندا' },
  { code: '+44', country: 'GB', flag: '🇬🇧', label: 'UK', labelAr: 'بريطانيا' },
  { code: '+49', country: 'DE', flag: '🇩🇪', label: 'Germany', labelAr: 'ألمانيا' },
  { code: '+33', country: 'FR', flag: '🇫🇷', label: 'France', labelAr: 'فرنسا' },
  { code: '+39', country: 'IT', flag: '🇮🇹', label: 'Italy', labelAr: 'إيطاليا' },
  { code: '+34', country: 'ES', flag: '🇪🇸', label: 'Spain', labelAr: 'إسبانيا' },
  { code: '+351', country: 'PT', flag: '🇵🇹', label: 'Portugal', labelAr: 'البرتغال' },
  { code: '+31', country: 'NL', flag: '🇳🇱', label: 'Netherlands', labelAr: 'هولندا' },
  { code: '+32', country: 'BE', flag: '🇧🇪', label: 'Belgium', labelAr: 'بلجيكا' },
  { code: '+41', country: 'CH', flag: '🇨🇭', label: 'Switzerland', labelAr: 'سويسرا' },
  { code: '+43', country: 'AT', flag: '🇦🇹', label: 'Austria', labelAr: 'النمسا' },
  { code: '+46', country: 'SE', flag: '🇸🇪', label: 'Sweden', labelAr: 'السويد' },
  { code: '+47', country: 'NO', flag: '🇳🇴', label: 'Norway', labelAr: 'النرويج' },
  { code: '+45', country: 'DK', flag: '🇩🇰', label: 'Denmark', labelAr: 'الدنمارك' },
  { code: '+358', country: 'FI', flag: '🇫🇮', label: 'Finland', labelAr: 'فنلندا' },
  { code: '+353', country: 'IE', flag: '🇮🇪', label: 'Ireland', labelAr: 'أيرلندا' },
  { code: '+30', country: 'GR', flag: '🇬🇷', label: 'Greece', labelAr: 'اليونان' },
  { code: '+48', country: 'PL', flag: '🇵🇱', label: 'Poland', labelAr: 'بولندا' },
  { code: '+420', country: 'CZ', flag: '🇨🇿', label: 'Czech Republic', labelAr: 'التشيك' },
  { code: '+7', country: 'RU', flag: '🇷🇺', label: 'Russia', labelAr: 'روسيا' },
  { code: '+380', country: 'UA', flag: '🇺🇦', label: 'Ukraine', labelAr: 'أوكرانيا' },
  { code: '+357', country: 'CY', flag: '🇨🇾', label: 'Cyprus', labelAr: 'قبرص' },
  { code: '+61', country: 'AU', flag: '🇦🇺', label: 'Australia', labelAr: 'أستراليا' },
  { code: '+64', country: 'NZ', flag: '🇳🇿', label: 'New Zealand', labelAr: 'نيوزيلندا' },
  { code: '+55', country: 'BR', flag: '🇧🇷', label: 'Brazil', labelAr: 'البرازيل' },
  { code: '+52', country: 'MX', flag: '🇲🇽', label: 'Mexico', labelAr: 'المكسيك' },
  // Asia-Pacific
  { code: '+86', country: 'CN', flag: '🇨🇳', label: 'China', labelAr: 'الصين' },
  { code: '+81', country: 'JP', flag: '🇯🇵', label: 'Japan', labelAr: 'اليابان' },
  { code: '+82', country: 'KR', flag: '🇰🇷', label: 'South Korea', labelAr: 'كوريا الجنوبية' },
  { code: '+852', country: 'HK', flag: '🇭🇰', label: 'Hong Kong', labelAr: 'هونغ كونغ' },
  { code: '+65', country: 'SG', flag: '🇸🇬', label: 'Singapore', labelAr: 'سنغافورة' },
  { code: '+60', country: 'MY', flag: '🇲🇾', label: 'Malaysia', labelAr: 'ماليزيا' },
  { code: '+66', country: 'TH', flag: '🇹🇭', label: 'Thailand', labelAr: 'تايلاند' },
];

export const getCountryFromPhone = (phone) => {
  const fallback = COUNTRY_CODES.find(c => c.code === '+20') || { code: '+20', country: 'EG' };
  if (!phone) return fallback;
  const normalized = normalizePhone(phone);
  const info = getPhoneInfo(normalized);
  if (info) {
    const found = COUNTRY_CODES.find(c => c.country === info.country);
    if (found) return found;
  }
  return fallback;
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
      {/* dir="ltr" forces fill direction even in RTL — without it the bar
          appears to grow from the right but text labels grow from the left,
          looking misaligned. Score is conceptually "% complete" which is
          consistently LTR worldwide. */}
      <div dir="ltr" className="flex-1 h-1 bg-brand-500/15 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${s}%`, background: color }} />
      </div>
      <span className="text-xs font-bold min-w-[20px]" style={{ color }}>{s}</span>
    </div>
  );
}

// ── Next Action badge ──────────────────────────────────────────────────────
// Renders the next pending follow-up for a lead from the `_nextFollowup`
// blob set by the get_next_followup_per_contact RPC:
//   { next_due, overdue_count, pending_count }
// Red = overdue, amber = due today, grey = upcoming, muted prompt = none.
// Clicking always opens the schedule/reminder flow (onClick).
export function NextActionBadge({ nextFollowup, isRTL, onClick }) {
  const nf = nextFollowup;
  const stop = (e) => { e.stopPropagation(); onClick?.(); };
  // No pending follow-up at all → nudge the rep to schedule one.
  if (!nf || (!nf.next_due && !nf.pending_count)) {
    return (
      <button onClick={stop} className="text-[11px] text-content-muted/70 dark:text-content-muted-dark/70 hover:text-brand-500 bg-transparent border-none cursor-pointer whitespace-nowrap p-0">
        {isRTL ? '— حدّد متابعة' : '— Set follow-up'}
      </button>
    );
  }
  const DAY = 86400000;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const startMs = startOfToday.getTime();
  const dueDayMs = nf.next_due ? new Date(nf.next_due).setHours(0, 0, 0, 0) : null;
  let cls, label;
  if (nf.overdue_count > 0 && dueDayMs != null) {
    const days = Math.max(1, Math.round((startMs - dueDayMs) / DAY));
    cls = 'bg-red-500/[0.1] text-red-600 dark:text-red-400 border border-red-500/30';
    label = isRTL ? `متأخرة (${days}ي)` : `Overdue (${days}d)`;
  } else if (dueDayMs != null && dueDayMs === startMs) {
    cls = 'bg-amber-500/[0.1] text-amber-600 dark:text-amber-400 border border-amber-500/30';
    label = isRTL ? 'النهاردة' : 'Today';
  } else if (dueDayMs != null) {
    const days = Math.max(1, Math.round((dueDayMs - startMs) / DAY));
    cls = 'bg-slate-500/[0.08] text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark';
    label = isRTL ? (days === 1 ? 'بكرة' : `بعد ${days}ي`) : (days === 1 ? 'Tomorrow' : `In ${days}d`);
  } else {
    // Pending task with no due date.
    cls = 'bg-slate-500/[0.08] text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark';
    label = isRTL ? 'متابعة' : 'Follow-up';
  }
  return (
    <button onClick={stop} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer whitespace-nowrap ${cls}`}>
      {label}
    </button>
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
  // Pad masked form so it has the same character count as the full phone —
  // avoids any width change on hover that would cause a flicker loop.
  const masked = phone.slice(0, 6) + '*'.repeat(Math.max(0, phone.length - 6));
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => { setCopied(false); });
  };
  // Tap to toggle on touch devices, hover on desktop. The click below also
  // catches touches that land on the row instead of the copy button.
  const toggleReveal = (e) => { e.stopPropagation(); setRevealed(v => !v); };
  return (
    <div className="flex items-center gap-1.5 cursor-pointer py-[3px]" dir="ltr"
      onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}
      onClick={toggleReveal}>
      <span className={`font-mono whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[150px] ${small ? 'text-xs text-gray-400 dark:text-gray-500' : 'text-xs text-content dark:text-content-dark'}`}>
        {revealed ? phone : masked}
      </span>
      {/* Always rendered — toggled via opacity so the row never changes width on hover */}
      <button
        onClick={handleCopy}
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        style={{ visibility: revealed ? 'visible' : 'hidden' }}
        className={`px-2 py-0.5 rounded text-xs cursor-pointer font-semibold border transition-opacity ${copied ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-brand-500/15 border-brand-500/30 text-brand-400'}`}
      >
        {copied ? (isRTL ? '✓ تم' : '✓ copied') : (isRTL ? 'نسخ' : 'copy')}
      </button>
    </div>
  );
}
