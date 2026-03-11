import { useState, useMemo, useEffect, useRef } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
// useTheme removed — dark mode handled via Tailwind dark: classes
import { useToast } from '../contexts/ToastContext';
import { Phone, MessageCircle, Mail, Plus, Upload, Download, Search, Ban, X, Clock, Star, Flame, Wind, Snowflake, Thermometer, Users, FileDown, MoreVertical, Bell, CheckSquare, Trash2, Pencil, Pin, PhoneCall, Merge, SkipForward } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact,
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../services/contactsService';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES, TASK_STATUSES } from '../services/tasksService';
import ImportModal from './crm/ImportModal';
import { Button, Input, Select, Textarea, Modal, ModalFooter, Table, Th, Td, Tr, Badge } from '../components/ui/';

// ── Hooks ──────────────────────────────────────────────────────────────────
function useEscClose(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);
}

// ── Constants ──────────────────────────────────────────────────────────────
const SOURCE_LABELS = { facebook: 'فيسبوك', instagram: 'إنستجرام', google_ads: 'جوجل أدز', website: 'الموقع', call: 'اتصال وارد', walk_in: 'زيارة مباشرة', referral: 'ترشيح', developer: 'مطور', cold_call: 'كولد كول', other: 'أخرى' };
const SOURCE_EN = { facebook: 'Facebook', instagram: 'Instagram', google_ads: 'Google Ads', website: 'Website', call: 'Inbound Call', walk_in: 'Walk-in', referral: 'Referral', developer: 'Developer', cold_call: 'Cold Call', other: 'Other' };
const STAGE_LABELS = { new: { ar: 'جديد', en: 'New' }, contacted: { ar: 'تم التواصل', en: 'Contacted' }, interested: { ar: 'مهتم', en: 'Interested' }, site_visit_scheduled: { ar: 'موعد معاينة', en: 'Visit Scheduled' }, site_visited: { ar: 'زار الموقع', en: 'Site Visited' }, negotiation: { ar: 'تفاوض', en: 'Negotiation' }, reserved: { ar: 'محجوز', en: 'Reserved' }, contracted: { ar: 'تعاقد', en: 'Contracted' }, closed_won: { ar: 'فوز ✓', en: 'Won ✓' }, closed_lost: { ar: 'خسارة ✗', en: 'Lost ✗' }, on_hold: { ar: 'معلق', en: 'On Hold' } };
const stageLabel = (key, isRTL) => { const s = STAGE_LABELS[key]; return s ? (isRTL ? s.ar : s.en) : key; };
const COLD_LABELS = { not_contacted: { ar: 'لم يُتصل به', en: 'Not Contacted' }, no_answer: { ar: 'لا يرد', en: 'No Answer' }, not_interested: { ar: 'غير مهتم', en: 'Not Interested' }, interested: { ar: 'مهتم', en: 'Interested' }, wrong_number: { ar: 'رقم خاطئ', en: 'Wrong Number' }, call_back_later: { ar: 'اتصل لاحقاً', en: 'Call Back Later' } };
const coldLabel = (key, isRTL) => { const s = COLD_LABELS[key]; return s ? (isRTL ? s.ar : s.en) : key; };
const TEMP = {
  hot:  { label: 'Hot', labelAr: 'حار',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  Icon: Flame },
  warm: { label: 'Warm', labelAr: 'دافئ', color: '#F97316', bg: 'rgba(249,115,22,0.10)', Icon: Thermometer },
  cool: { label: 'Cool', labelAr: 'فاتر', color: '#8BA8C8', bg: 'rgba(139,168,200,0.10)', Icon: Wind },
  cold: { label: 'Cold', labelAr: 'بارد', color: '#4A7AAB', bg: 'rgba(74,122,171,0.10)',  Icon: Snowflake },
};
const TYPE = {
  lead:      { label: 'ليد',       labelEn: 'Lead',       color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
  cold:      { label: 'كولد',      labelEn: 'Cold',       color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  client:    { label: 'عميل',      labelEn: 'Client',     color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)'   },
  supplier:  { label: 'مورد',      labelEn: 'Supplier',   color: '#0F766E', bg: 'rgba(15,118,110,0.12)'  },
  developer: { label: 'مطور',      labelEn: 'Developer',  color: '#B45309', bg: 'rgba(180,83,9,0.12)'    },
  applicant: { label: 'متقدم',     labelEn: 'Applicant',  color: '#6B21A8', bg: 'rgba(107,33,168,0.12)'  },
  partner:   { label: 'شريك',      labelEn: 'Partner',    color: '#1E40AF', bg: 'rgba(30,64,175,0.12)'   },
};

// ── MOCK DATA (used until Supabase is connected) ───────────────────────────
const MOCK = [
  { id: '1', full_name: 'أحمد محمد السيد', phone: '01012345678', phone2: '01198765432', email: 'ahmed@email.com', contact_type: 'lead', source: 'facebook', campaign_name: 'حملة الشيخ زايد Q1', lead_score: 85, temperature: 'hot', stage: 'interested', cold_status: null, budget_min: 1500000, budget_max: 2500000, preferred_location: 'الشيخ زايد', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2026-02-15', last_activity_at: '2026-03-04' },
  { id: '2', full_name: 'منى عبدالله حسن', phone: '01123456789', phone2: null, email: 'mona@email.com', contact_type: 'lead', source: 'google_ads', campaign_name: 'Google - التجمع', lead_score: 62, temperature: 'warm', stage: 'contacted', cold_status: null, budget_min: 3000000, budget_max: 5000000, preferred_location: 'التجمع الخامس', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2026-02-20', last_activity_at: '2026-03-02' },
  { id: '3', full_name: 'خالد إبراهيم عمر', phone: '01234567890', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 20, temperature: 'cold', stage: null, cold_status: 'no_answer', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-01-10', last_activity_at: '2026-01-12' },
  { id: '4', full_name: 'هدى محمود طه', phone: '01087654321', phone2: '01556789012', email: 'hoda@email.com', contact_type: 'client', source: 'referral', campaign_name: null, lead_score: 95, temperature: 'hot', stage: 'contracted', cold_status: null, budget_min: 4000000, budget_max: 7000000, preferred_location: 'مدينة نصر', interested_in_type: 'commercial', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2025-11-05', last_activity_at: '2026-03-01' },
  { id: '5', full_name: 'يوسف رمضان علي', phone: '01099887766', phone2: null, email: 'yousef@email.com', contact_type: 'lead', source: 'instagram', campaign_name: 'حملة أكتوبر سيتي', lead_score: 45, temperature: 'cool', stage: 'new', cold_status: null, budget_min: 800000, budget_max: 1200000, preferred_location: 'أكتوبر', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'ريم أحمد', created_at: '2026-03-01', last_activity_at: '2026-03-01' },
  { id: '6', full_name: 'نادية سامي عيسى', phone: '01144556677', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 10, temperature: 'cold', stage: null, cold_status: 'not_interested', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2026-01-20', last_activity_at: '2026-01-21' },
  { id: '7', full_name: 'طارق جمال حلمي', phone: '01277889900', phone2: '01366778899', email: 'tarek@email.com', contact_type: 'lead', source: 'website', campaign_name: null, lead_score: 78, temperature: 'warm', stage: 'site_visit_scheduled', cold_status: null, budget_min: 2000000, budget_max: 3500000, preferred_location: 'الشيخ زايد', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'ريم أحمد', created_at: '2026-02-25', last_activity_at: '2026-03-03' },
  { id: '8', full_name: 'إيمان حسين فوزي', phone: '01055443322', phone2: null, email: 'eman@email.com', contact_type: 'lead', source: 'walk_in', campaign_name: null, lead_score: 90, temperature: 'hot', stage: 'negotiation', cold_status: null, budget_min: 5000000, budget_max: 8000000, preferred_location: 'القاهرة الجديدة', interested_in_type: 'administrative', is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-02-10', last_activity_at: '2026-03-05' },
  { id: '9', full_name: 'سامح فريد منصور', phone: '01322334455', phone2: null, email: null, contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 5, temperature: 'cold', stage: null, cold_status: 'wrong_number', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: true, blacklist_reason: 'رقم خاطئ متكرر', assigned_to_name: 'ريم أحمد', created_at: '2026-02-01', last_activity_at: '2026-02-01' },
  { id: '10', full_name: 'رانيا وليد زكي', phone: '01511223344', phone2: '01622334455', email: 'rania@email.com', contact_type: 'client', source: 'facebook', campaign_name: 'حملة المحور Q4', lead_score: 99, temperature: 'hot', stage: 'closed_won', cold_status: null, budget_min: 3000000, budget_max: 5000000, preferred_location: 'محور المشير', interested_in_type: 'residential', is_blacklisted: false, assigned_to_name: 'محمد خالد', created_at: '2025-09-15', last_activity_at: '2026-02-28' },
  { id: '11', full_name: 'عمر صلاح الدين', phone: '01688776655', phone2: null, email: 'omar@email.com', contact_type: 'lead', source: 'google_ads', campaign_name: 'Google - وسط البلد', lead_score: 55, temperature: 'warm', stage: 'contacted', cold_status: null, budget_min: 1000000, budget_max: 1800000, preferred_location: 'وسط البلد', interested_in_type: 'commercial', is_blacklisted: false, assigned_to_name: 'سارة علي', created_at: '2026-02-28', last_activity_at: '2026-03-03' },
  { id: '12', full_name: 'دينا عصام بدر', phone: '01755664433', phone2: null, email: 'dina@email.com', contact_type: 'cold', source: 'cold_call', campaign_name: null, lead_score: 30, temperature: 'cool', stage: null, cold_status: 'call_back_later', budget_min: null, budget_max: null, preferred_location: null, interested_in_type: null, is_blacklisted: false, assigned_to_name: 'علي حسن', created_at: '2026-02-18', last_activity_at: '2026-03-02' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtBudget = (min, max, isRTL = true) => {
  if (!min && !max) return '—';
  const f = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}${isRTL ? 'م' : 'M'}` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}${isRTL ? 'ك' : 'K'}` : n;
  if (min && max) return `${f(min)} – ${f(max)}`;
  return min ? `${isRTL ? 'من' : 'From'} ${f(min)}` : `${isRTL ? 'حتى' : 'Up to'} ${f(max)}`;
};
const daysSince = d => Math.floor((Date.now() - new Date(d)) / 86400000);
const initials = name => name ? name.trim().charAt(0) : '?';
const AVATAR_COLORS = ['#2B4C6F','#4A7AAB','#065F46','#92400E','#1E40AF','#6B21A8','#B45309','#0F766E'];
const avatarColor = (id) => AVATAR_COLORS[parseInt(id) % AVATAR_COLORS.length];
const normalizePhone = (p) => {
  if (!p) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) {
    // Egyptian numbers must be exactly 11 digits starting with 01
    if (p.length === 11 && p.startsWith('01')) return '+20' + p.slice(1);
    return p; // return as-is so validation fails
  }
  return p;
};
const validatePhone = (p) => {
  if (!p) return false;
  const normalized = normalizePhone(p);
  if (normalized === p && p.startsWith('0')) return false; // Egyptian but wrong length
  try {
    const phone = parsePhoneNumberFromString(normalized);
    return phone ? phone.isValid() : false;
  } catch { return false; }
};
const getPhoneInfo = (p) => {
  if (!p) return null;
  const normalized = normalizePhone(p);
  try {
    const phone = parsePhoneNumberFromString(normalized);
    if (!phone || !phone.isValid()) return null;
    const flags = { EG: '🇪🇬', SA: '🇸🇦', AE: '🇦🇪', KW: '🇰🇼', QA: '🇶🇦', BH: '🇧🇭', OM: '🇴🇲', JO: '🇯🇴', LB: '🇱🇧', US: '🇺🇸', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷' };
    return { country: phone.country, flag: flags[phone.country] || '🌍', formatted: phone.formatInternational() };
  } catch { return null; }
};

// ── Sub-components ─────────────────────────────────────────────────────────
function Chip({ label, color, bg, size = 'sm' }) {
  return (
    <span
      className={`inline-block rounded-full font-bold whitespace-nowrap ${size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-[3px]'}`}
      style={{ color, background: bg }}
    >{label}</span>
  );
}

function ScorePill({ score }) {
  const s = score ?? 0;
  const color = s >= 75 ? '#4A7AAB' : s >= 50 ? '#6B8DB5' : s >= 25 ? '#8BA8C8' : '#EF4444';
  return (
    <div className="flex items-center gap-1.5 min-w-[70px]">
      <div className="flex-1 h-1 bg-brand-500/15 rounded-sm overflow-hidden">
        <div className="h-full rounded-sm" style={{ width: `${s}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold min-w-[20px]" style={{ color }}>{s}</span>
    </div>
  );
}

// ── Phone Cell ─────────────────────────────────────────────────────────────
function PhoneCell({ phone, small = false }) {
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
    }).catch(() => {});
  };
  return (
    <div className="flex items-center gap-1.5 cursor-pointer py-[3px]" style={{ direction: 'ltr' }}
      onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}>
      <span className={`font-mono whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-[150px] ${small ? 'text-[11px] text-gray-400' : 'text-[13px] text-content dark:text-content-dark'}`}
        style={{ letterSpacing: revealed ? 0 : 1 }}>
        {revealed ? phone : masked}
      </span>
      {revealed && (
        <button onClick={handleCopy}
          className={`px-2 py-0.5 rounded text-[11px] cursor-pointer font-semibold border ${copied ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-500' : 'bg-brand-500/15 border-brand-500/30 text-brand-400'}`}>
          {copied ? (isRTL ? '✓ تم' : '✓ copied') : (isRTL ? 'نسخ' : 'copy')}
        </button>
      )}
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────
function AddContactModal({ onClose, onSave, checkDup, onOpenOpportunity }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const dupTimer = useRef(null);
  const [step, setStep] = useState(1);
  const DEPT_TYPES = {
    sales: ['lead','cold','client','developer','partner'],
    hr: ['applicant'],
    finance: ['supplier'],
    marketing: ['lead','cold'],
    operations: ['partner','supplier'],
  };
  const [form, setForm] = useState({
    prefix: '', full_name: '', phone: '', phone2: '', email: '',
    contact_type: '', source: 'facebook', campaign_name: '',
    budget_min: '', budget_max: '', preferred_location: '',
    interested_in_type: 'residential', notes: '', department: '',
    gender: '', nationality: '', birth_date: '', company: '', job_title: '',
  });
  const [dupWarning, setDupWarning] = useState(null);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraDups, setExtraDups] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDept = (dept) => {
    const types = DEPT_TYPES[dept] || [];
    setForm(f => ({ ...f, department: dept, contact_type: types[0] || '' }));
  };
  const availableTypes = DEPT_TYPES[form.department] || [];

  const checkPhoneNumber = (phone) => {
    if (!phone || !validatePhone(phone)) return;
    clearTimeout(dupTimer.current);
    dupTimer.current = setTimeout(async () => {
      setChecking(true);
      try {
        const dup = await checkDup(phone);
        setDupWarning(dup || null);
      } catch { setDupWarning(null); }
      setChecking(false);
    }, 400);
  };

  const handleSave = async () => {
    if (!form.department) { toast.error(isRTL ? 'يرجى اختيار القسم' : 'Please select a department'); return; }
    if (!form.contact_type) { toast.error(isRTL ? 'يرجى اختيار نوع جهة الاتصال' : 'Please select contact type'); return; }
    if (!form.full_name.trim()) { toast.error(isRTL ? 'الاسم مطلوب' : 'Name is required'); return; }
    if (!form.phone || !validatePhone(form.phone)) { toast.error(isRTL ? 'رقم الهاتف الأساسي غير صحيح' : 'Invalid primary phone number'); return; }
    const invalidExtra = extraPhones.find(p => p && !validatePhone(p));
    if (invalidExtra) { toast.error(isRTL ? `الرقم ${invalidExtra} غير صحيح` : `Invalid number: ${invalidExtra}`); return; }
    setSaving(true);
    try {
      const validExtras = extraPhones.filter(p => p && validatePhone(p));
      await onSave({
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        extra_phones: validExtras.length > 0 ? validExtras : null,
      });
      onClose();
    } catch (err) {
      toast.error((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={e => e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[560px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <div>
            <h2 className="m-0 text-content dark:text-content-dark text-[17px] font-bold">
              {isRTL ? ({
                lead: 'إضافة ليد', cold: 'إضافة كولد كول', client: 'إضافة عميل',
                supplier: 'إضافة مورد', developer: 'إضافة مطور عقاري',
                applicant: 'إضافة متقدم لوظيفة', partner: 'إضافة شريك'
              }[form.contact_type] || 'إضافة جهة اتصال') : ({
                lead: 'Add Lead', cold: 'Add Cold Call', client: 'Add Client',
                supplier: 'Add Supplier', developer: 'Add Developer',
                applicant: 'Add Applicant', partner: 'Add Partner'
              }[form.contact_type] || 'Add Contact')}
            </h2>
            <p className="mt-[3px] mb-0 text-xs text-content-muted dark:text-content-muted-dark">
              {step === 1 ? (isRTL ? 'البيانات الأساسية' : 'Basic Info') : (isRTL ? 'البيانات الإضافية' : 'Additional Info')}
              {' '}<span className="text-brand-400/50">({isRTL ? `${step} من 2` : `${step} of 2`})</span>
            </p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg"><X size={18} /></button>
        </div>
        <div className="h-[3px] bg-brand-500/15 rounded-b-sm">
          <div className="h-full bg-gradient-to-r from-brand-900 to-brand-500 rounded-b-sm transition-[width] duration-300 ease-in-out" style={{ width: step === 1 ? '50%' : '100%' }} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 1 ? (
            <div className="modal-grid grid grid-cols-2 gap-3.5">
              {/* القسم والنوع - أول حاجة */}
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'القسم' : 'Department'} <span className="text-red-500">*</span></label>
                <Select value={form.department} onChange={e => setDept(e.target.value)}>
                  <option value="">{isRTL ? 'اختر القسم...' : 'Select department...'}</option>
                  <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                  <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                  <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                  <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                  <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'النوع' : 'Type'} <span className="text-red-500">*</span></label>
                <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)} disabled={!form.department}>
                  {!form.department && <option value="">{isRTL ? 'اختر القسم أولاً...' : 'Select department first...'}</option>}
                  {availableTypes.map(t => <option key={t} value={t}>{isRTL ? ({lead:'ليد',cold:'كولد كول',client:'عميل',supplier:'مورد',developer:'مطور عقاري',applicant:'متقدم لوظيفة',partner:'شريك'}[t]) : ({lead:'Lead',cold:'Cold Call',client:'Client',supplier:'Supplier',developer:'Developer',applicant:'Applicant',partner:'Partner'}[t])}</option>)}
                </Select>
              </div>

              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                <div className="flex gap-2">
                  <Select className="!w-[110px] shrink-0" value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                    <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                    <option value="Mr.">{isRTL ? 'السيد' : 'Mr.'}</option>
                    <option value="Mrs.">{isRTL ? 'السيدة' : 'Mrs.'}</option>
                    <option value="Dr.">{isRTL ? 'د.' : 'Dr.'}</option>
                    <option value="Eng.">{isRTL ? 'م.' : 'Eng.'}</option>
                    <option value="أستاذ">{isRTL ? 'أستاذ' : 'Prof.'}</option>
                  </Select>
                  <Input className="flex-1" placeholder={isRTL ? 'محمد أحمد...' : 'John Doe...'} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span> {(() => { const v = form.phone; return (<>{v && !validatePhone(v) && <span className="text-[11px] text-orange-500">⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}{v && validatePhone(v) && (() => { const info = getPhoneInfo(v); return info ? <span className="text-xs text-emerald-500">{info.flag} {info.country} — {info.formatted}</span> : null; })()}</>); })()}</label>
                <Input className={dupWarning ? '!border-red-500' : ''}
                  placeholder="010xxxxxxxx" value={form.phone}
                  onChange={e => { const v = e.target.value.replace(/[^0-9+]/g, ''); set('phone', v); setDupWarning(null); if (validatePhone(v)) { checkPhoneNumber(v); } }} />
                {checking && <p className="text-[11px] text-content-muted dark:text-content-muted-dark mt-1 mb-0">{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div className="mt-2 p-3 bg-red-500/[0.08] border border-red-500/30 rounded-[10px] text-xs">
                    <div className="text-red-500 font-bold mb-2">⚠️ {isRTL ? 'هذا الرقم مسجل باسم' : 'This number belongs to'}: <strong>{dupWarning.full_name}</strong> <span className="text-[11px] text-content-muted dark:text-content-muted-dark font-mono">— ID: {dupWarning.id}</span></div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { onOpenOpportunity(dupWarning); onClose(); }} className="flex-1">
                        ✨ {isRTL ? 'فتح فرصة جديدة لـ ' + dupWarning.full_name : 'New opportunity for ' + dupWarning.full_name}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={onClose}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-2">{isRTL ? 'أرقام إضافية' : 'Additional Phones'}</label>
                {extraPhones.map((ph, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex gap-1.5">
                      <Input className="flex-1" placeholder="012xxxxxxxx or +966..."
                        value={ph}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9+]/g, '');
                          const updated = [...extraPhones]; updated[i] = v; setExtraPhones(updated);
                          setExtraDups(d => { const nd = [...d]; nd[i] = null; return nd; });
                          if (validatePhone(v)) { checkDup(v).then(dup => { setExtraDups(d => { const nd = [...d]; nd[i] = dup || null; return nd; }); }).catch(() => {}); }
                        }} />
                      <button type="button" onClick={() => { setExtraPhones(extraPhones.filter((_, j) => j !== i)); setExtraDups(d => d.filter((_, j) => j !== i)); }}
                        className="px-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 cursor-pointer text-lg leading-none">×</button>
                    </div>
                    {ph && (<div className="mt-1">
                      {!validatePhone(ph) && <span className="text-[11px] text-orange-500">⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}
                      {validatePhone(ph) && (() => { const info = getPhoneInfo(ph); return info ? <span className="text-xs text-emerald-500">{info.flag} {info.country} — {info.formatted}</span> : null; })()}
                    </div>)}
                    {extraDups[i] && (
                      <div className="mt-1.5 p-2 bg-red-500/[0.08] border border-red-500/30 rounded-lg text-xs">
                        <div className="text-red-500 font-bold mb-1">⚠️ {isRTL ? 'مسجل باسم' : 'Registered to'}: <strong>{extraDups[i].full_name}</strong> <span className="text-content-muted dark:text-content-muted-dark font-mono text-[11px]">ID: {extraDups[i].id}</span></div>
                        <Button size="sm" onClick={() => { onOpenOpportunity(extraDups[i]); onClose(); }} className="w-full">
                          ✨ {isRTL ? 'فتح فرصة جديدة' : 'New Opportunity'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                <Button variant="secondary" size="sm" onClick={() => { setExtraPhones([...extraPhones, '']); setExtraDups([...extraDups, null]); }}>
                  + {isRTL ? 'إضافة رقم' : 'Add Phone'}
                </Button>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <Input type="email" placeholder="email@domain.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'اسم الحملة' : 'Campaign'}</label>
                <Input placeholder={isRTL ? 'مثال: حملة الشيخ زايد Q1' : 'e.g. Sheikh Zayed Q1 Campaign'} value={form.campaign_name} onChange={e => set('campaign_name', e.target.value)} />
              </div>
              </>)}
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الشركة / جهة العمل' : 'Company'}</label>
                <Input placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
                <Input placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
              </div>

            </div>
          ) : (
            <div className="modal-grid grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الجنس' : 'Gender'}</label>
                <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                  <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الجنسية' : 'Nationality'}</label>
                <Select value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  <option value="egyptian">{isRTL ? 'مصري' : 'Egyptian'}</option>
                  <option value="saudi">{isRTL ? 'سعودي' : 'Saudi'}</option>
                  <option value="emirati">{isRTL ? 'إماراتي' : 'Emirati'}</option>
                  <option value="kuwaiti">{isRTL ? 'كويتي' : 'Kuwaiti'}</option>
                  <option value="qatari">{isRTL ? 'قطري' : 'Qatari'}</option>
                  <option value="libyan">{isRTL ? 'ليبي' : 'Libyan'}</option>
                  <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
                </Select>
              </div>
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'تاريخ الميلاد' : 'Birth Date'}</label>
                <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ميزانية من' : 'Budget From (EGP)'}</label>
                <Input type="number" placeholder="1500000" value={form.budget_min} onChange={e => set('budget_min', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ميزانية إلى' : 'Budget To (EGP)'}</label>
                <Input type="number" placeholder="3000000" value={form.budget_max} onChange={e => set('budget_max', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'الموقع المفضل' : 'Preferred Location'}</label>
                <Input placeholder={isRTL ? 'الشيخ زايد، التجمع...' : 'Sheikh Zayed, New Cairo...'} value={form.preferred_location} onChange={e => set('preferred_location', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نوع العقار' : 'Property Type'}</label>
                <Select value={form.interested_in_type} onChange={e => set('interested_in_type', e.target.value)}>
                  <option value="residential">{isRTL ? 'سكني' : 'Residential'}</option>
                  <option value="commercial">{isRTL ? 'تجاري' : 'Commercial'}</option>
                  <option value="administrative">{isRTL ? 'إداري' : 'Administrative'}</option>
                </Select>
              </div>
              </>)}
              <div className="col-span-full">
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <Textarea rows={4} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge dark:border-edge-dark flex justify-between items-center">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <div className="flex gap-2.5">
            {step === 2 && <Button variant="secondary" onClick={() => setStep(1)}>{isRTL ? 'السابق →' : '← Back'}</Button>}
            {step === 1
              ? (() => { const canNext = form.department && form.contact_type && form.full_name.trim() && validatePhone(form.phone) && !dupWarning; return <Button onClick={() => setStep(2)} disabled={!canNext}>{isRTL ? '← التالي' : 'Next →'}</Button>; })()
              : <Button onClick={handleSave} disabled={saving}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</Button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Log Call Modal (Activity + Follow-up Task in one flow) ──────────────────
const CALL_RESULTS = [
  { key: 'answered', ar: 'رد', en: 'Answered', color: '#10B981' },
  { key: 'no_answer', ar: 'لم يرد', en: 'No Answer', color: '#F59E0B' },
  { key: 'busy', ar: 'مشغول', en: 'Busy', color: '#EF4444' },
  { key: 'interested', ar: 'مهتم', en: 'Interested', color: '#4A7AAB' },
  { key: 'not_interested', ar: 'غير مهتم', en: 'Not Interested', color: '#6b7280' },
  { key: 'call_back', ar: 'اتصل لاحقاً', en: 'Call Back', color: '#8B5CF6' },
];
const FOLLOWUP_PRESETS = [
  { key: 'tomorrow', ar: 'غداً', en: 'Tomorrow', days: 1 },
  { key: '3days', ar: '3 أيام', en: '3 Days', days: 3 },
  { key: 'week', ar: 'أسبوع', en: 'Week', days: 7 },
  { key: 'custom', ar: 'تاريخ محدد', en: 'Custom', days: 0 },
];
const FOLLOWUP_TYPES = [
  { value: 'call', ar: 'مكالمة', en: 'Call' },
  { value: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
  { value: 'meeting', ar: 'اجتماع', en: 'Meeting' },
  { value: 'email', ar: 'إيميل', en: 'Email' },
];

function LogCallModal({ contact, onClose }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  useEscClose(onClose);

  const [callResult, setCallResult] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // Follow-up task
  const [addFollowup, setAddFollowup] = useState(false);
  const [followupPreset, setFollowupPreset] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupType, setFollowupType] = useState('call');
  const [followupPriority, setFollowupPriority] = useState('medium');

  const handlePreset = (preset) => {
    setFollowupPreset(preset.key);
    if (preset.key !== 'custom') {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      d.setHours(10, 0, 0, 0);
      setFollowupDate(d.toISOString().slice(0, 16));
    } else {
      setFollowupDate('');
    }
  };

  // Auto-suggest follow-up based on call result
  useEffect(() => {
    if (['call_back', 'no_answer', 'busy', 'interested'].includes(callResult)) {
      setAddFollowup(true);
      if (!followupPreset) {
        const p = FOLLOWUP_PRESETS[0]; // tomorrow
        setFollowupPreset(p.key);
        const d = new Date();
        d.setDate(d.getDate() + p.days);
        d.setHours(10, 0, 0, 0);
        setFollowupDate(d.toISOString().slice(0, 16));
      }
    }
  }, [callResult, followupPreset]);

  const handleSave = async () => {
    if (!callResult) { toast.warning(isRTL ? 'اختر نتيجة المكالمة' : 'Select call result'); return; }
    if (addFollowup && !followupDate) { toast.warning(isRTL ? 'اختر موعد المتابعة' : 'Select follow-up date'); return; }
    setSaving(true);

    // 1. Save call activity
    const resultLabel = CALL_RESULTS.find(r => r.key === callResult)?.[isRTL ? 'ar' : 'en'] || callResult;
    const activity = {
      type: 'call',
      description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${callNotes ? ' — ' + callNotes : ''}`,
      next_action: addFollowup ? (isRTL ? 'متابعة' : 'Follow up') : '',
      next_action_date: addFollowup ? followupDate : '',
      contact_id: contact.id,
      created_at: new Date().toISOString(),
    };
    try { await createActivity(activity); } catch { /* saved optimistically */ }

    // 2. Create follow-up task if enabled
    if (addFollowup && followupDate) {
      const followupTypeLabel = FOLLOWUP_TYPES.find(t => t.value === followupType)?.[isRTL ? 'ar' : 'en'] || followupType;
      const task = {
        title: isRTL ? `${followupTypeLabel} - ${contact.full_name}` : `${followupTypeLabel} - ${contact.full_name}`,
        type: followupType,
        priority: followupPriority,
        status: 'pending',
        contact_id: contact.id,
        contact_name: contact.full_name,
        due_date: followupDate,
        dept: 'crm',
        notes: callNotes ? `${isRTL ? 'من مكالمة سابقة' : 'From previous call'}: ${callNotes}` : '',
        assigned_to_name_ar: profile?.full_name_ar || '',
        assigned_to_name_en: profile?.full_name_en || '',
      };
      try { await createTask(task); } catch { /* saved optimistically */ }
    }

    toast.success(isRTL
      ? `تم حفظ المكالمة${addFollowup ? ' + مهمة المتابعة' : ''}`
      : `Call saved${addFollowup ? ' + follow-up task' : ''}`
    );
    setSaving(false);
    onClose();
  };

  const priorities = [
    { value: 'high', ar: 'عالية', en: 'High', color: '#EF4444' },
    { value: 'medium', ar: 'متوسطة', en: 'Medium', color: '#F59E0B' },
    { value: 'low', ar: 'منخفضة', en: 'Low', color: '#10B981' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-2xl w-[420px] max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h3 className="text-[15px] font-bold text-content dark:text-content-dark flex items-center gap-1.5"><Phone size={14} /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'} — {contact.full_name}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-xl text-content-muted dark:text-content-muted-dark cursor-pointer">×</button>
        </div>
        <div className="px-5 py-[18px]">
          {/* Call Result */}
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-2">{isRTL ? 'نتيجة المكالمة' : 'Call Result'} <span className="text-red-500">*</span></div>
          <div className="flex gap-1.5 flex-wrap mb-3.5">
            {CALL_RESULTS.map(r => (
              <button key={r.key} onClick={() => setCallResult(r.key)} className="px-3 py-[5px] rounded-full text-xs cursor-pointer font-inherit transition-colors" style={{
                border: `1.5px solid ${callResult === r.key ? r.color : 'var(--border-edge, #E2E8F0)'}`,
                background: callResult === r.key ? r.color + '18' : 'none',
                color: callResult === r.key ? r.color : undefined,
                fontWeight: callResult === r.key ? 700 : 400,
              }}>{isRTL ? r.ar : r.en}</button>
            ))}
          </div>
          {/* Notes */}
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'ملاحظات' : 'Notes'}</div>
          <Textarea rows={2} value={callNotes} onChange={e => setCallNotes(e.target.value)} className="!resize-none mb-4" placeholder={isRTL ? 'ملاحظات المكالمة...' : 'Call notes...'} />

          {/* Follow-up Section */}
          <div className={`bg-brand-500/[0.06] dark:bg-brand-500/[0.06] rounded-[10px] p-3.5 transition-colors ${addFollowup ? 'border border-brand-500/25' : 'border border-edge dark:border-edge-dark'}`}>
            <label className={`flex items-center gap-2 cursor-pointer text-[13px] font-semibold ${addFollowup ? 'text-brand-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
              <input type="checkbox" checked={addFollowup} onChange={e => setAddFollowup(e.target.checked)} className="accent-brand-500 cursor-pointer" />
              <Clock size={14} /> {isRTL ? 'إنشاء مهمة متابعة' : 'Create follow-up task'}
            </label>
            {addFollowup && (
              <div className="mt-3">
                {/* When */}
                <div className="text-[11px] text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'متى؟' : 'When?'}</div>
                <div className="flex gap-[5px] flex-wrap mb-2.5">
                  {FOLLOWUP_PRESETS.map(p => (
                    <button key={p.key} onClick={() => handlePreset(p)} className="px-3 py-1 rounded-2xl text-[11px] cursor-pointer font-inherit transition-colors" style={{
                      border: `1.5px solid ${followupPreset === p.key ? '#4A7AAB' : 'var(--border-edge, #E2E8F0)'}`,
                      background: followupPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none',
                      color: followupPreset === p.key ? '#4A7AAB' : undefined,
                      fontWeight: followupPreset === p.key ? 700 : 400,
                    }}>{isRTL ? p.ar : p.en}</button>
                  ))}
                </div>
                {followupPreset === 'custom' && (
                  <Input type="datetime-local" value={followupDate} onChange={e => setFollowupDate(e.target.value)} size="sm" className="mb-2.5" />
                )}
                {/* Type + Priority */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark font-semibold mb-1">{isRTL ? 'نوع المتابعة' : 'Follow-up type'}</div>
                    <Select size="sm" value={followupType} onChange={e => setFollowupType(e.target.value)}>
                      {FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark font-semibold mb-1">{isRTL ? 'الأولوية' : 'Priority'}</div>
                    <div className="flex gap-[3px]">
                      {priorities.map(p => (
                        <button key={p.value} onClick={() => setFollowupPriority(p.value)} className="flex-1 py-[5px] rounded-[5px] text-[10px] cursor-pointer font-inherit" style={{
                          background: followupPriority === p.value ? p.color + '18' : 'transparent',
                          border: `1px solid ${followupPriority === p.value ? p.color : 'var(--border-edge, #E2E8F0)'}`,
                          color: followupPriority === p.value ? p.color : undefined,
                          fontWeight: followupPriority === p.value ? 700 : 400,
                        }}>{isRTL ? p.ar : p.en}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-edge dark:border-edge-dark flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !callResult}>
            {saving ? '...' : addFollowup ? (isRTL ? 'حفظ + إنشاء مهمة' : 'Save + Create Task') : (isRTL ? 'حفظ المكالمة' : 'Save Call')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Quick Task Modal (replaces ReminderModal) ─────────────────────────────────
const QUICK_TASK_PRESETS = [
  { key: 'tomorrow', ar: 'غداً', en: 'Tomorrow', days: 1 },
  { key: '3days', ar: '3 أيام', en: '3 Days', days: 3 },
  { key: 'week', ar: 'أسبوع', en: 'Week', days: 7 },
  { key: 'custom', ar: 'تاريخ محدد', en: 'Custom', days: 0 },
];

function QuickTaskModal({ contact, onClose }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  const { profile } = useAuth();
  useEscClose(onClose);

  const [selectedPreset, setSelectedPreset] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [title, setTitle] = useState('');
  const [taskType, setTaskType] = useState('followup');
  const [priority, setPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  const handlePreset = (preset) => {
    setSelectedPreset(preset.key);
    if (preset.key !== 'custom') {
      const d = new Date();
      d.setDate(d.getDate() + preset.days);
      setCustomDate(d.toISOString().slice(0, 16));
    } else {
      setCustomDate('');
    }
  };

  const handleSave = async () => {
    if (!customDate) { toast.warning(isRTL ? 'اختر الموعد' : 'Select a date'); return; }
    setSaving(true);
    const task = {
      title: title || (isRTL ? `متابعة ${contact.full_name}` : `Follow up with ${contact.full_name}`),
      type: taskType,
      priority,
      status: 'pending',
      contact_id: contact.id,
      contact_name: contact.full_name,
      due_date: customDate,
      dept: 'crm',
      notes: '',
      assigned_to_name_ar: profile?.full_name_ar || '',
      assigned_to_name_en: profile?.full_name_en || '',
    };
    try { await createTask(task); toast.success(isRTL ? 'تم إنشاء المهمة' : 'Task created'); } catch { toast.success(isRTL ? 'تم إنشاء المهمة محلياً' : 'Task created locally'); }
    setSaving(false);
    onClose();
  };

  const taskTypes = [
    { value: 'followup', ar: 'متابعة', en: 'Follow-up' },
    { value: 'call', ar: 'مكالمة', en: 'Call' },
    { value: 'meeting', ar: 'اجتماع', en: 'Meeting' },
    { value: 'email', ar: 'إيميل', en: 'Email' },
    { value: 'whatsapp', ar: 'واتساب', en: 'WhatsApp' },
  ];
  const priorities = [
    { value: 'high', ar: 'عالية', en: 'High', color: '#EF4444' },
    { value: 'medium', ar: 'متوسطة', en: 'Medium', color: '#F59E0B' },
    { value: 'low', ar: 'منخفضة', en: 'Low', color: '#10B981' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5" onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-2xl w-[400px] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center">
          <h3 className="text-[15px] font-bold text-content dark:text-content-dark flex items-center gap-1.5"><Clock size={14} /> {isRTL ? 'مهمة سريعة' : 'Quick Task'} — {contact.full_name}</h3>
          <button onClick={onClose} className="bg-transparent border-none text-xl text-content-muted dark:text-content-muted-dark cursor-pointer">×</button>
        </div>
        <div className="px-5 py-[18px]">
          {/* Title */}
          <Input value={title} onChange={e => setTitle(e.target.value)} className="mb-3.5" placeholder={isRTL ? `متابعة ${contact.full_name}` : `Follow up with ${contact.full_name}`} />
          {/* When */}
          <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-2">{isRTL ? 'متى؟' : 'When?'}</div>
          <div className="flex gap-1.5 flex-wrap mb-3.5">
            {QUICK_TASK_PRESETS.map(p => (
              <button key={p.key} onClick={() => handlePreset(p)} className="px-3.5 py-[5px] rounded-full text-xs cursor-pointer font-inherit transition-colors" style={{
                border: `1.5px solid ${selectedPreset === p.key ? '#4A7AAB' : 'var(--border-edge, #E2E8F0)'}`,
                background: selectedPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none',
                color: selectedPreset === p.key ? '#4A7AAB' : undefined,
                fontWeight: selectedPreset === p.key ? 700 : 400,
              }}>{isRTL ? p.ar : p.en}</button>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <Input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)} size="sm" className="mb-3.5" />
          )}
          {/* Type + Priority row */}
          <div className="flex gap-2.5 mb-1">
            <div className="flex-1">
              <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'النوع' : 'Type'}</div>
              <Select size="sm" value={taskType} onChange={e => setTaskType(e.target.value)}>
                {taskTypes.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
              </Select>
            </div>
            <div className="flex-1">
              <div className="text-xs text-content-muted dark:text-content-muted-dark font-semibold mb-1.5">{isRTL ? 'الأولوية' : 'Priority'}</div>
              <div className="flex gap-1">
                {priorities.map(p => (
                  <button key={p.value} onClick={() => setPriority(p.value)} className="flex-1 py-1.5 rounded-md text-[11px] cursor-pointer font-inherit" style={{
                    background: priority === p.value ? p.color + '18' : 'transparent',
                    border: `1px solid ${priority === p.value ? p.color : 'var(--border-edge, #E2E8F0)'}`,
                    color: priority === p.value ? p.color : undefined,
                    fontWeight: priority === p.value ? 700 : 400,
                  }}>{isRTL ? p.ar : p.en}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3.5 border-t border-edge dark:border-edge-dark flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving || !(selectedPreset && (selectedPreset !== 'custom' || customDate))}>{saving ? '...' : (isRTL ? 'إنشاء مهمة' : 'Create Task')}</Button>
        </div>
      </div>
    </div>
  );
}

function BlacklistModal({ contact, onClose, onConfirm }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  useEscClose(onClose);
  const [reason, setReason] = useState('');
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-5">
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/35 rounded-2xl p-7 w-full max-w-[420px]">
        <div className="text-center mb-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center mx-auto mb-3">
            <Ban size={24} color="#EF4444" />
          </div>
          <h3 className="text-content dark:text-content-dark m-0 mb-1.5 text-base">{isRTL ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}</h3>
          <p className="text-content-muted dark:text-content-muted-dark text-[13px] m-0">{isRTL ? 'سيتم منع هذا الرقم من الإضافة مستقبلاً' : 'This number will be blocked from future additions'}</p>
        </div>
        <div className="bg-red-500/[0.08] border border-red-500/20 rounded-[10px] px-3.5 py-2.5 mb-4 text-[13px] text-content dark:text-content-dark">
          {contact?.full_name} — {contact?.phone}
        </div>
        <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-2">{isRTL ? 'سبب الإضافة' : 'Reason'} <span className="text-red-500">*</span></label>
        <Input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder={isRTL ? 'مثال: سلوك مسيء، احتيال، رقم خاطئ متكرر...' : 'e.g. Abusive behavior, fraud, repeated wrong number...'}
          className="!border-red-500/30 mb-5" />
        <div className="flex gap-2.5 justify-end">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button variant="danger" onClick={() => { if (reason.trim()) { onConfirm(contact, reason); onClose(); } }} disabled={!reason.trim()}>
            {isRTL ? 'تأكيد الإضافة' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Form ─────────────────────────────────────────────────────────
function ActivityForm({ contactId, onSave, onCancel }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Load activity types from localStorage (managed by Admin in Settings)
  const defaultTypes = [
    { key: 'call',          label: 'Call',          labelAr: 'مكالمة',      lucide: 'Phone'          },
    { key: 'whatsapp',      label: 'WhatsApp',      labelAr: 'واتساب',      lucide: 'MessageCircle'  },
    { key: 'email',         label: 'Email',         labelAr: 'إيميل',       lucide: 'Mail'           },
    { key: 'meeting',       label: 'Meeting',       labelAr: 'اجتماع',      lucide: 'Users'          },
    { key: 'site_visit',    label: 'Site Visit',    labelAr: 'زيارة موقع',  lucide: 'Calendar'       },
    { key: 'note',          label: 'Note',          labelAr: 'ملاحظة',      lucide: 'Clock'          },
    { key: 'status_change', label: 'Status Change', labelAr: 'تغيير حالة',  lucide: 'CheckCircle2'   },
  ];
  const [activityTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('platform_activity_types');
      return saved ? JSON.parse(saved) : defaultTypes;
    } catch { return defaultTypes; }
  });

  const [form, setForm] = useState({ type: activityTypes[0]?.key || 'call', description: '', next_action: '', next_action_date: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto timestamp
  const now = new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSave = () => {
    onSave({ ...form, created_at: new Date().toISOString() });
  };

  return (
    <div className="bg-brand-500/[0.07] border border-brand-500/20 rounded-[10px] p-3.5 mb-3">
      {/* Auto timestamp - read only */}
      <div className="flex items-center gap-1.5 mb-2.5 px-2.5 py-[5px] bg-brand-500/[0.08] rounded-md">
        <Clock size={11} className="text-content-muted dark:text-content-muted-dark" />
        <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{now}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <Select size="sm" value={form.type} onChange={e => set('type', e.target.value)}>
          {activityTypes.map(v => (
            <option key={v.key} value={v.key}>{isRTL ? (v.labelAr || v.label) : v.label}</option>
          ))}
        </Select>
        <Input size="sm" type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)}
          placeholder={isRTL ? 'تاريخ المتابعة' : 'Follow-up date'} />
      </div>
      <Textarea size="sm" className="mb-2.5" rows={2}
        placeholder={isRTL ? 'وصف النشاط...' : 'Activity description...'}
        value={form.description} onChange={e => set('description', e.target.value)} />
      <Input size="sm" className="mb-3"
        placeholder={isRTL ? 'الإجراء التالي (اختياري)...' : 'Next action (optional)...'}
        value={form.next_action} onChange={e => set('next_action', e.target.value)} />
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </Button>
        <Button size="sm" onClick={handleSave}>
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ── Contact Drawer ─────────────────────────────────────────────────────────

function EditContactModal({ contact, onClose, onSave }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const [form, setForm] = useState({
    prefix: contact.prefix || '',
    full_name: contact.full_name || '',
    phone: contact.phone || '',
    phone2: contact.phone2 || '',
    email: contact.email || '',
    contact_type: contact.contact_type || 'lead',
    source: contact.source || 'facebook',
    campaign_name: contact.campaign_name || '',
    budget_min: contact.budget_min || '',
    budget_max: contact.budget_max || '',
    preferred_location: contact.preferred_location || '',
    interested_in_type: contact.interested_in_type || 'residential',
    notes: contact.notes || '',
    department: contact.department || 'sales',
    gender: contact.gender || '',
    nationality: contact.nationality || '',
    birth_date: contact.birth_date || '',
    company: contact.company || '',
    job_title: contact.job_title || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isSalesType = ['lead','cold','client'].includes(form.contact_type);

  const handleSave = async () => {
    if (!form.full_name.trim()) { toast.warning(isRTL ? 'الاسم مطلوب' : 'Name is required'); return; }
    setSaving(true);
    try {
      await onSave({ ...contact, ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      });
      onClose();
    } catch (err) {
      toast.error((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
      setSaving(false);
    }
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[950] flex items-center justify-center p-5">
      <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl w-full max-w-[580px] max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 pt-[18px] pb-3.5 border-b border-edge dark:border-edge-dark flex justify-between items-center shrink-0">
          <div>
            <h2 className="m-0 text-content dark:text-content-dark text-[17px] font-bold">{isRTL ? 'تعديل بيانات جهة الاتصال' : 'Edit Contact'}</h2>
            <p className="mt-[3px] mb-0 text-xs text-content-muted dark:text-content-muted-dark whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">{contact.full_name}</p>
          </div>
          <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 flex flex-col gap-3.5">

          {/* الاسم والـ prefix */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
            <div className="grid grid-cols-[120px_1fr] gap-2.5">
              <Select value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Dr.">Dr.</option>
                <option value="Eng.">Eng.</option>
                <option value="أستاذ">أستاذ</option>
              </Select>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder={isRTL ? 'الاسم الكامل...' : 'Full name...'} />
            </div>
          </div>

          {/* النوع والقسم */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'النوع' : 'Type'}</label>
              <Select value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
                <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
                <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
                <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
                <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
                <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
                <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
                <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'القسم' : 'Department'}</label>
              <Select value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
              </Select>
            </div>
          </div>

          {/* الهاتف والإيميل */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'رقم الهاتف' : 'Phone'} <span className="text-red-500">*</span></label>
              <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010xxxxxxxx" />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'هاتف 2' : 'Phone 2'}</label>
              <Input value={form.phone2} onChange={e => set('phone2', e.target.value)} placeholder="011xxxxxxxx" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
            <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
          </div>

          {/* الشركة والمسمى */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الشركة' : 'Company'}</label>
              <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} />
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
              <Input value={form.job_title} onChange={e => set('job_title', e.target.value)} placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} />
            </div>
          </div>

          {/* المصدر — للـ sales types فقط */}
          {isSalesType && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'المصدر' : 'Source'}</label>
                <Select value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الميزانية (من - إلى)' : 'Budget (min - max)'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <Input value={form.budget_min} onChange={e => set('budget_min', e.target.value)} placeholder={isRTL ? 'من' : 'Min'} type="number" />
                  <Input value={form.budget_max} onChange={e => set('budget_max', e.target.value)} placeholder={isRTL ? 'إلى' : 'Max'} type="number" />
                </div>
              </div>
            </div>
          )}

          {/* الجنس والجنسية */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الجنس' : 'Gender'}</label>
              <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <Select value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="egyptian">{isRTL ? 'مصري' : 'Egyptian'}</option>
                <option value="saudi">{isRTL ? 'سعودي' : 'Saudi'}</option>
                <option value="emirati">{isRTL ? 'إماراتي' : 'Emirati'}</option>
                <option value="kuwaiti">{isRTL ? 'كويتي' : 'Kuwaiti'}</option>
                <option value="qatari">{isRTL ? 'قطري' : 'Qatari'}</option>
                <option value="libyan">{isRTL ? 'ليبي' : 'Libyan'}</option>
                <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
              </Select>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-xs text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={isRTL ? 'أي ملاحظات...' : 'Any notes...'} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-edge dark:border-edge-dark flex justify-end gap-2.5 shrink-0">
          <Button variant="secondary" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isRTL ? 'جارى الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ContactDrawer({ contact, onClose, onBlacklist, onUpdate, onAddOpportunity }) {
  const [showEdit, setShowEdit] = useState(false);
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();
  useEscClose(onClose);
  const [tab, setTab] = useState('info');
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [addTaskForm, setAddTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [loadingActs, setLoadingActs] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showOppModal, setShowOppModal] = useState(false);
  const [newOpp, setNewOpp] = useState({ project:'', budget:'', stage:'new', temperature:'warm', priority:'medium', agent:'', notes:'' });

  useEffect(() => {
    let cancelled = false;
    if (tab === 'activities') {
      setLoadingActs(true);
      fetchContactActivities(contact.id)
        .then(data => { if (!cancelled) setActivities(data); })
        .catch(() => { if (!cancelled) { setActivities([]); toast.error(isRTL ? 'تعذر تحميل النشاطات' : 'Failed to load activities'); } })
        .finally(() => { if (!cancelled) setLoadingActs(false); });
    }
    if (tab === 'tasks') {
      setLoadingTasks(true);
      fetchTasks({ contactId: contact.id })
        .then(data => { if (!cancelled) setTasks(data); })
        .catch(() => { if (!cancelled) { setTasks([]); toast.error(isRTL ? 'تعذر تحميل المهام' : 'Failed to load tasks'); } })
        .finally(() => { if (!cancelled) setLoadingTasks(false); });
    }
    if (tab === 'opportunities') {
      setLoadingOpps(true);
      fetchContactOpportunities(contact.id)
        .then(data => { if (!cancelled) setOpportunities(data); })
        .catch(() => { if (!cancelled) setOpportunities([]); })
        .finally(() => { if (!cancelled) setLoadingOpps(false); });
    }
    return () => { cancelled = true; };
  }, [tab, contact.id]);

  // ESC to close opportunity modal
  useEffect(() => {
    if (!showOppModal) return;
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setShowOppModal(false); } };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [showOppModal]);

  const handleSaveActivity = async (form) => {
    try {
      const { user_id, ...formData } = form;
      const act = await createActivity({ ...formData, contact_id: contact.id });
      setActivities(prev => [act, ...prev]);
      setShowActivityForm(false);
      toast.success(isRTL ? 'تم حفظ النشاط' : 'Activity saved');
    } catch (err) {
      // Fallback: save locally
      const localAct = {
        id: String(Date.now()),
        ...form,
        contact_id: contact.id,
        users: { full_name_ar: 'أنت', full_name_en: 'You' },
      };
      setActivities(prev => [localAct, ...prev]);
      setShowActivityForm(false);
      toast.success(isRTL ? 'تم حفظ النشاط محلياً' : 'Activity saved locally');
    }
  };

  if (!contact) return null;
  const tempInfo = TEMP[contact.temperature];
  const tp = TYPE[contact.contact_type];

  const baseTabs = [['info', isRTL ? 'البيانات' : 'Info'], ['activities', isRTL ? 'الأنشطة' : 'Activities'], ['opportunities', isRTL ? 'الفرص' : 'Opportunities'], ['tasks', isRTL ? 'المهام' : 'Tasks']];
  const tabs = contact.contact_type === 'supplier' ? [...baseTabs, ['invoices', isRTL ? 'الفواتير' : 'Invoices']] : baseTabs;

  const rowCls = 'flex justify-between items-center py-2 border-b border-brand-500/[0.08] text-[13px]';

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); setShowEdit(false); }} />}
    <div className="fixed inset-0 z-[900] flex" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <div onClick={onClose} className="flex-1 bg-black/45" />
      <div className={`contact-drawer w-[430px] bg-surface-card dark:bg-surface-card-dark flex flex-col overflow-x-hidden ${isRTL ? 'border-l' : 'border-r'} border-edge dark:border-edge-dark`}>

        {/* Drawer Header */}
        <div className="px-5 pt-5 bg-gradient-to-b from-surface-bg to-surface-card dark:from-[#1B3347] dark:to-surface-card-dark">
          <div className="flex justify-between items-start mb-3.5">
            <div className="flex gap-3 items-center">
              <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-extrabold ${contact.is_blacklisted ? 'bg-red-500/20 text-red-500' : 'bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white'}`}>
                {contact.is_blacklisted ? <Ban size={18} /> : initials(contact.full_name)}
              </div>
              <div>
                <div className={`text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px] ${contact.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>
                  {contact.prefix ? <span className={`text-[#6B8DB5] dark:text-[#6B8DB5] ${isRTL ? 'ml-1' : 'mr-1'}`}>{contact.prefix}</span> : null}{contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                </div>
                <div className="mt-1 flex gap-1.5 items-center flex-wrap">
                  {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                  {contact.department && <Chip label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />}
                  {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
                </div>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button onClick={() => setShowEdit(true)} className="bg-brand-500/10 border border-brand-500/25 rounded-md text-brand-500 cursor-pointer px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1">
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </button>
              <button onClick={onClose} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer p-1"><X size={18} /></button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <a href={`tel:${contact.phone}`} className="flex-1 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-500 text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
              <Phone size={13} /> {isRTL ? 'اتصال' : 'Call'}
            </a>
            <a href={`https://wa.me/${normalizePhone(contact.phone).replace('+', '')}`} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-[#25D366]/10 border border-[#25D366]/25 rounded-lg text-[#25D366] text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
              <MessageCircle size={13} /> {isRTL ? 'واتساب' : 'WhatsApp'}
            </a>
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex-1 py-2 bg-brand-500/10 border border-brand-500/25 rounded-lg text-[#6B8DB5] dark:text-[#6B8DB5] text-xs font-semibold text-center no-underline flex items-center justify-center gap-1.5">
                <Mail size={13} /> {isRTL ? 'إيميل' : 'Email'}
              </a>
            )}
            {!contact.is_blacklisted && (
              <button onClick={() => onBlacklist(contact)} className="flex-1 py-2 bg-red-500/[0.08] border border-red-500/25 rounded-lg text-red-500 text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                <Ban size={13} /> {isRTL ? 'بلاك' : 'Block'}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-edge dark:border-edge-dark">
            {tabs.map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 bg-transparent border-0 border-b-2 border-solid text-xs cursor-pointer ${tab === k ? 'border-b-brand-500 text-brand-500 font-bold' : 'border-b-transparent text-content-muted dark:text-content-muted-dark font-normal'}`}>{v}</button>
            ))}
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-auto p-5">

          {/* INFO TAB */}
          {tab === 'info' && (
            <div>
              {/* Score + Temp Cards */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="bg-brand-500/[0.07] rounded-[10px] p-3 border border-brand-500/[0.12]">
                  <div className="text-content-muted dark:text-content-muted-dark text-[11px] mb-2">{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div className="rounded-[10px] p-3" style={{ background: tempInfo?.bg, border: `1px solid ${tempInfo?.color || 'transparent'}30` }}>
                  <div className="text-content-muted dark:text-content-muted-dark text-[11px] mb-1">{isRTL ? 'الحرارة' : 'Temperature'}</div>
                  {tempInfo?.Icon && <div className="flex items-center gap-1.5"><tempInfo.Icon size={14} color={tempInfo.color} /><span className="font-bold text-sm" style={{ color: tempInfo?.color }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span></div>}
                </div>
              </div>

              {[
                { label: isRTL ? 'الهاتف الأول' : 'Phone 1',   val: contact.phone },
                { label: isRTL ? 'الهاتف الثاني' : 'Phone 2',  val: contact.phone2 || '—' },
                { label: isRTL ? 'الإيميل' : 'Email',         val: contact.email || '—' },
                { label: isRTL ? 'المصدر'   : 'Source',   val: isRTL ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
                { label: isRTL ? 'الحملة'   : 'Campaign', val: contact.campaign_name || '—' },
                { label: isRTL ? 'الميزانية': 'Budget',   val: fmtBudget(contact.budget_min, contact.budget_max, isRTL) },
                { label: isRTL ? 'الموقع'   : 'Location', val: contact.preferred_location || '—' },
                { label: isRTL ? 'نوع العقار': 'Property', val: (isRTL ? { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' } : { residential: 'Residential', commercial: 'Commercial', administrative: 'Administrative' })[contact.interested_in_type] || '—' },
                { label: isRTL ? 'المسؤول'  : 'Assigned', val: contact.assigned_to_name || '—' },
                { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: contact.last_activity_at ? (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() : '—' },
                { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
                { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
                { label: isRTL ? 'الجنس' : 'Gender', val: contact.gender ? ((isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender) : '—' },
                { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality ? ((isRTL ? { egyptian: 'مصري', saudi: 'سعودي', emirati: 'إماراتي', kuwaiti: 'كويتي', qatari: 'قطري', libyan: 'ليبي', other: 'أخرى' } : { egyptian: 'Egyptian', saudi: 'Saudi', emirati: 'Emirati', kuwaiti: 'Kuwaiti', qatari: 'Qatari', libyan: 'Libyan', other: 'Other' })[contact.nationality] || contact.nationality) : '—' },
                { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: contact.birth_date || '—' },
              ].map(r => (
              <div key={r.label} className={rowCls}>
                <span className="text-content-muted dark:text-content-muted-dark">{r.label}</span>
                <span className={`text-content dark:text-content-dark font-medium max-w-[55%] ${isRTL ? 'text-left' : 'text-right'} whitespace-nowrap overflow-hidden text-ellipsis`}>{r.val}</span>
              </div>
              ))}
              {contact.notes && (
                <div className="mt-3 px-3.5 py-2.5 bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] text-xs text-content-muted dark:text-content-muted-dark">
                  <div className="font-semibold mb-1 text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'ملاحظات' : 'Notes'}</div>
                  {contact.notes}
                </div>
              )}

              {contact.stage && (
                <div className={rowCls}>
                  <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'المرحلة' : 'Stage'}</span>
                  <Chip label={stageLabel(contact.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                </div>
              )}
              {contact.cold_status && (
                <div className={rowCls}>
                  <span className="text-content-muted dark:text-content-muted-dark">{isRTL ? 'حالة الكولد' : 'Cold Status'}</span>
                  <Chip label={coldLabel(contact.cold_status, isRTL)} color="#6B8DB5" bg="rgba(107,141,181,0.1)" />
                </div>
              )}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div className="mt-3.5 px-3.5 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-[10px] text-xs text-red-500 flex gap-1.5 items-start">
                  <Ban size={13} className="shrink-0 mt-0.5" /> <span className="overflow-hidden text-ellipsis">{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                </div>
              )}
              {contact.contact_type === 'supplier' && (
                <button className="w-full mt-3 p-2.5 bg-brand-500/10 border border-brand-500/25 rounded-lg text-brand-500 text-[13px] font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                  <span>+</span> {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              )}
            </div>
          )}

          {/* INVOICES TAB */}
          {tab === 'invoices' && (
            <div>
              <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                <FileDown size={32} className="mb-3 opacity-40 text-content-muted dark:text-content-muted-dark" />
                <p className="m-0 text-sm font-semibold text-content dark:text-content-dark">{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                <p className="mt-1.5 mb-4 text-xs">{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                <button className="px-5 py-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-semibold cursor-pointer">
                  + {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {tab === 'activities' && (
            <div>
              {!showActivityForm && (
                <button onClick={() => setShowActivityForm(true)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5">
                  {isRTL ? '+ إضافة نشاط' : '+ Add Activity'}
                </button>
              )}
              {showActivityForm && <ActivityForm contactId={contact.id} onSave={handleSaveActivity} onCancel={() => setShowActivityForm(false)} />}

              {loadingActs ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : activities.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <Clock size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد أنشطة بعد' : 'No activities yet'}</p>
                </div>
              ) : activities.map(act => {
                const actIcon = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock, site_visit: Star }[act.type];
                const ActIcon = actIcon || Clock;
                return (
                <div key={act.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-2.5">
                  <div className="flex justify-between mb-1.5 items-start gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <div className="w-[26px] h-[26px] rounded-[7px] bg-brand-500/10 flex items-center justify-center shrink-0 mt-px">
                        <ActIcon size={13} color="#4A7AAB" />
                      </div>
                      <span className="text-content dark:text-content-dark text-[13px] font-semibold">{act.description}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-content-muted dark:text-content-muted-dark">
                    <span>{isRTL ? (act.users?.full_name_ar || 'مجهول') : (act.users?.full_name_en || act.users?.full_name_ar || 'Unknown')}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                  {act.next_action && (
                    <div className="mt-2 px-2.5 py-1.5 bg-brand-500/[0.08] rounded-md text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">
                      › {act.next_action}{act.next_action_date ? ` — ${act.next_action_date}` : ''}
                    </div>
                  )}
                </div>
              ); })}
            </div>
          )}


          {/* TASKS TAB */}
          {tab === 'tasks' && (
            <div>
              <button onClick={() => setAddTaskForm(f => !f)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5">
                {addTaskForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '+ مهمة جديدة' : '+ New Task')}
              </button>

              {addTaskForm && (
                <div className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-3.5">
                  <div className="flex flex-col gap-2">
                    <input value={newTask.title} onChange={e => setNewTask(f => ({...f, title: e.target.value}))}
                      placeholder={isRTL ? 'عنوان المهمة...' : 'Task title...'}
                      className="px-2.5 py-[7px] rounded-[7px] border border-brand-500/20 bg-[#f8fafc] dark:bg-[rgba(15,30,45,0.6)] text-content dark:text-content-dark text-xs outline-none"
                      style={{ direction: isRTL ? 'rtl' : 'ltr' }} />
                    <div className="flex gap-1.5">
                      <select value={newTask.type} onChange={e => setNewTask(f => ({...f, type: e.target.value}))}
                        className="flex-1 px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none">
                        {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                      <select value={newTask.priority} onChange={e => setNewTask(f => ({...f, priority: e.target.value}))}
                        className="flex-1 px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none">
                        {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    </div>
                    <input type="datetime-local" value={newTask.due_date} onChange={e => setNewTask(f => ({...f, due_date: e.target.value}))}
                      className="px-2 py-1.5 rounded-[7px] border border-brand-500/20 bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[11px] outline-none" />
                    <button onClick={async () => {
                      if (!newTask.title.trim() || !newTask.due_date) return;
                      setSavingTask(true);
                      try {
                        const savedTask = await createTask({ ...newTask, contact_id: contact.id, contact_name: contact.full_name, dept: 'crm' });
                        setTasks(prev => [savedTask, ...prev]);
                        setNewTask({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
                        setAddTaskForm(false);
                      } finally { setSavingTask(false); }
                    }} disabled={savingTask || !newTask.title.trim() || !newTask.due_date}
                      className="py-[7px] rounded-[7px] border-none bg-[#2B4C6F] text-white text-xs font-semibold cursor-pointer"
                      style={{ opacity: savingTask || !newTask.title.trim() || !newTask.due_date ? 0.5 : 1 }}>
                      {savingTask ? '...' : (isRTL ? 'حفظ' : 'Save')}
                    </button>
                  </div>
                </div>
              )}

              {loadingTasks ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : tasks.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <CheckSquare size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد مهام مرتبطة' : 'No tasks linked'}</p>
                </div>
              ) : tasks.map(task => {
                const pri = TASK_PRIORITIES[task.priority];
                const typ = TASK_TYPES[task.type];
                const st  = TASK_STATUSES[task.status];
                const due = new Date(task.due_date);
                const overdue = due < new Date() && task.status !== 'done';
                return (
                  <div key={task.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] px-3 py-2.5 mb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className={`text-[13px] font-semibold text-content dark:text-content-dark mb-1 ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                          {task.title}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-px rounded-[5px] font-semibold" style={{ background: (pri?.color || '#4A7AAB') + '22', color: pri?.color || '#4A7AAB' }}>
                            {isRTL ? pri?.ar : pri?.en}
                          </span>
                          <span className="text-[10px] px-1.5 py-px rounded-[5px]" style={{ background: (st?.color || '#4A7AAB') + '22', color: st?.color || '#4A7AAB' }}>
                            {isRTL ? st?.ar : st?.en}
                          </span>
                          <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-500' : 'text-content-muted dark:text-content-muted-dark'}`}>
                            <Clock size={9} />
                            {due.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* OPPORTUNITIES TAB */}
          {tab === 'opportunities' && (
            <div>
              <button onClick={()=>setShowOppModal(true)} className="w-full p-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer mb-3.5 font-inherit">
                {isRTL ? '+ فتح فرصة جديدة' : '+ New Opportunity'}
              </button>
              {showOppModal && (
                <div onClick={()=>setShowOppModal(false)} className="fixed inset-0 z-[1100] flex items-center justify-center p-5 bg-black/50">
                  <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e=>e.stopPropagation()} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[14px] p-6 w-full max-w-[420px] border border-edge dark:border-edge-dark">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="m-0 text-content dark:text-content-dark text-[15px] font-bold">{isRTL?'فرصة جديدة - ':'New Opportunity - '}{contact.full_name}</h3>
                      <button onClick={()=>setShowOppModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer text-lg">✕</button>
                    </div>
                    <div className="flex flex-col gap-3">
                      {[
                        { key:'project', label_ar:'المشروع', label_en:'Project', type:'text' },
                        { key:'budget',  label_ar:'الميزانية', label_en:'Budget', type:'number' },
                        { key:'notes',   label_ar:'ملاحظات', label_en:'Notes', type:'text' },
                      ].map(f => (
                        <div key={f.key}>
                          <label className={`text-xs text-content-muted dark:text-content-muted-dark block mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL?f.label_ar:f.label_en}</label>
                          <input type={f.type} value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[13px] outline-none box-border font-inherit"
                            style={{ textAlign:isRTL?'right':'left', direction:isRTL?'rtl':'ltr' }} />
                        </div>
                      ))}
                      {[
                        { key:'stage', label_ar:'المرحلة', label_en:'Stage', options:[{v:'new',ar:'جديد',en:'New'},{v:'contacted',ar:'تم التواصل',en:'Contacted'},{v:'interested',ar:'مهتم',en:'Interested'},{v:'negotiation',ar:'تفاوض',en:'Negotiation'},{v:'reserved',ar:'محجوز',en:'Reserved'}] },
                        { key:'temperature', label_ar:'الحرارة', label_en:'Temperature', options:[{v:'hot',ar:'ساخن',en:'Hot'},{v:'warm',ar:'دافئ',en:'Warm'},{v:'normal',ar:'عادي',en:'Normal'},{v:'cold',ar:'بارد',en:'Cold'}] },
                        { key:'priority', label_ar:'الأولوية', label_en:'Priority', options:[{v:'urgent',ar:'عاجل',en:'Urgent'},{v:'high',ar:'عالي',en:'High'},{v:'medium',ar:'متوسط',en:'Medium'},{v:'low',ar:'منخفض',en:'Low'}] },
                      ].map(f => (
                        <div key={f.key}>
                          <label className={`text-xs text-content-muted dark:text-content-muted-dark block mb-1 ${isRTL ? 'text-right' : 'text-left'}`}>{isRTL?f.label_ar:f.label_en}</label>
                          <select value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            className="w-full px-3 py-2.5 rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark text-[13px] outline-none cursor-pointer box-border font-inherit">
                            {f.options.map(o=><option key={o.v} value={o.v}>{isRTL?o.ar:o.en}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2.5 mt-5">
                      <button onClick={()=>{ if (!newOpp.project.trim()) { toast.warning(isRTL ? 'اسم المشروع مطلوب' : 'Project name is required'); return; } const opp = {...newOpp, contactName:contact.full_name, contactId:contact.id, contact_id:contact.id, budget:Number(newOpp.budget)||0, lastActivityDays:0, agent:'', id:String(Date.now()), created_at:new Date().toISOString(), projects:{name_ar:newOpp.project,name_en:newOpp.project}}; setOpportunities(prev=>[opp,...prev]); setShowOppModal(false); setNewOpp({project:'',budget:'',stage:'new',temperature:'warm',priority:'medium',agent:'',notes:''}); toast.success(isRTL ? 'تم إنشاء الفرصة' : 'Opportunity created'); }}
                        className="flex-1 py-2.5 rounded-lg bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white border-none text-[13px] font-bold cursor-pointer font-inherit">
                        {isRTL?'حفظ':'Save'}
                      </button>
                      <button onClick={()=>setShowOppModal(false)} className="px-4 py-2.5 rounded-lg bg-transparent text-content-muted dark:text-content-muted-dark border border-edge dark:border-edge-dark text-[13px] cursor-pointer font-inherit">
                        {isRTL?'إلغاء':'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {loadingOpps ? (
                <div className="text-center p-8 text-content-muted dark:text-content-muted-dark text-[13px]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : opportunities.length === 0 ? (
                <div className="text-center p-10 text-content-muted dark:text-content-muted-dark">
                  <Star size={32} className="opacity-30 mb-2" />
                  <p className="m-0 text-[13px]">{isRTL ? 'لا توجد فرص مرتبطة' : 'No opportunities linked'}</p>
                </div>
              ) : opportunities.map(opp => (
                <div key={opp.id} className="bg-brand-500/[0.06] border border-brand-500/[0.12] rounded-[10px] p-3 mb-2.5">
                  <div className="flex justify-between mb-2">
                    <span className="text-content dark:text-content-dark text-[13px] font-semibold">{isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}</span>
                    <Chip label={stageLabel(opp.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                  </div>
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark flex flex-col gap-1">
                    {opp.projects?.name_ar && <span>{isRTL ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar)}</span>}
                    <span>{isRTL ? (opp.users?.full_name_ar || '—') : (opp.users?.full_name_en || opp.users?.full_name_ar || '—')}</span>
                    {opp.next_follow_up && <span>{isRTL ? 'متابعة' : 'Follow-up'}: {opp.next_follow_up}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterTemp, setFilterTemp] = useState('all');
  const [showBlacklisted, setShowBlacklisted] = useState(false);
  const [sortBy, setSortBy] = useState('last_activity');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [blacklistTarget, setBlacklistTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [logCallTarget, setLogCallTarget] = useState(null);
  const [reminderTarget, setReminderTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { title, message, onConfirm }
  const [bulkStageModal, setBulkStageModal] = useState(false);
  const [bulkReassignModal, setBulkReassignModal] = useState(false);
  const [pinnedIds, setPinnedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('platform_pinned_contacts') || '[]'); } catch { return []; } });
  const [batchCallMode, setBatchCallMode] = useState(false);
  const [batchCallIndex, setBatchCallIndex] = useState(0);
  const [batchCallNotes, setBatchCallNotes] = useState('');
  const [batchCallResult, setBatchCallResult] = useState('');
  const [batchCallLog, setBatchCallLog] = useState([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeTargets, setMergeTargets] = useState([]);
  const [mergePreview, setMergePreview] = useState(null);
  const isAdmin = profile?.role === 'admin';

  const togglePin = (id) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('platform_pinned_contacts', JSON.stringify(next));
      return next;
    });
  };
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    const pageIds = paged.map(c => c.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter(id => !pageIds.includes(id)) : [...new Set([...selectedIds, ...pageIds])]);
  };

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // ESC to close inline modals
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (batchCallMode) { setBatchCallMode(false); return; }
      if (mergePreview) { setMergePreview(null); setMergeTargets([]); setMergeMode(false); return; }
      if (bulkStageModal) { setBulkStageModal(false); return; }
      if (bulkReassignModal) { setBulkReassignModal(false); return; }
      if (confirmAction) { setConfirmAction(null); return; }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [batchCallMode, mergePreview, bulkStageModal, bulkReassignModal, confirmAction]);

  const handleDelete = (id) => {
    const contact = contacts.find(c => c.id === id);
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: isRTL ? `هل أنت متأكد من حذف "${contact?.full_name || ''}"؟` : `Are you sure you want to delete "${contact?.full_name || ''}"?`,
      onConfirm: () => {
        const updated = contacts.filter(c => c.id !== id);
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
        toast.success(isRTL ? 'تم الحذف بنجاح' : 'Deleted successfully');
        setConfirmAction(null);
      }
    });
  };

  const handleDeleteSelected = () => {
    setConfirmAction({
      title: isRTL ? 'تأكيد الحذف' : 'Confirm Delete',
      message: isRTL ? `حذف ${selectedIds.length} جهة اتصال؟ لا يمكن التراجع.` : `Delete ${selectedIds.length} contacts? This cannot be undone.`,
      onConfirm: () => {
        const updated = contacts.filter(c => !selectedIds.includes(c.id));
        setContacts(updated);
        localStorage.setItem('platform_contacts', JSON.stringify(updated));
        setSelectedIds([]);
        toast.success(isRTL ? `تم حذف ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts deleted`);
        setConfirmAction(null);
      }
    });
  };

  const handleBulkStage = (stage) => {
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, stage } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    toast.success(isRTL ? `تم تغيير المرحلة لـ ${selectedIds.length} جهة اتصال` : `Stage updated for ${selectedIds.length} contacts`);
    setSelectedIds([]);
    setBulkStageModal(false);
    setShowBulkMenu(false);
  };

  const handleBulkReassign = (agentName) => {
    const updated = contacts.map(c => selectedIds.includes(c.id) ? { ...c, assigned_to_name: agentName } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    toast.success(isRTL ? `تم إعادة تعيين ${selectedIds.length} جهة اتصال` : `${selectedIds.length} contacts reassigned`);
    setSelectedIds([]);
    setBulkReassignModal(false);
    setShowBulkMenu(false);
  };

  const handleStageChange = (id, stage) => {
    const updated = contacts.map(c => c.id === id ? { ...c, stage } : c);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
  };

  // Load contacts — Supabase first, then localStorage, then MOCK
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchContacts({
          role: profile?.role,
          userId: profile?.id,
          teamId: profile?.team_id,
          filters: {},
        });
        if (data.length) {
          setContacts(data);
        } else {
          throw new Error('no data');
        }
      } catch {
        // Try localStorage first
        const cached = localStorage.getItem('platform_contacts');
        if (cached) {
          try { setContacts(JSON.parse(cached)); } catch { setContacts(MOCK); }
        } else {
          setContacts(MOCK);
        }
      } finally {
        setLoading(false);
      }
    };
    if (profile) load();
    else { setContacts(MOCK); setLoading(false); }
  }, [profile]);

  // Stats
  const stats = useMemo(() => {
    const counts = { total: contacts.length, hot: 0, blacklisted: 0 };
    Object.keys(TYPE).forEach(k => { counts[k] = 0; });
    contacts.forEach(c => {
      if (c.contact_type && counts[c.contact_type] !== undefined) counts[c.contact_type]++;
      if (c.temperature === 'hot') counts.hot++;
      if (c.is_blacklisted) counts.blacklisted++;
    });
    return counts;
  }, [contacts]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (!showBlacklisted && c.is_blacklisted) return false;
      if (filterType !== 'all' && c.contact_type !== filterType) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (filterTemp !== 'all' && c.temperature !== filterTemp) return false;
      if (filterDept !== 'all' && (c.department || 'sales') !== filterDept) return false;
      if (search) {
        const q = search.toLowerCase();
        return (c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.campaign_name?.toLowerCase().includes(q));
      }
      return true;
    });
    list.sort((a, b) => {
      // Pinned contacts always first
      const aPinned = pinnedIds.includes(a.id) ? 0 : 1;
      const bPinned = pinnedIds.includes(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      if (sortBy === 'last_activity') return new Date(b.last_activity_at || 0) - new Date(a.last_activity_at || 0);
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      if (sortBy === 'created') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'temperature') {
        const order = { hot: 0, warm: 1, cool: 2, cold: 3 };
        return (order[a.temperature] ?? 4) - (order[b.temperature] ?? 4);
      }
      if (sortBy === 'stale') {
        // Contacts with oldest last activity first (stale = needs attention)
        return new Date(a.last_activity_at || 0) - new Date(b.last_activity_at || 0);
      }
      return 0;
    });
    return list;
  }, [contacts, filterType, filterSource, filterTemp, filterDept, search, showBlacklisted, sortBy, pinnedIds]);

  // Reset page when filters change
  useEffect(() => { setPage(1); setSelectedIds([]); }, [filterType, filterSource, filterTemp, filterDept, search, showBlacklisted, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const exportCSV = (list) => {
    const headers = isRTL ? ['ID','الاسم','الهاتف','الإيميل','النوع','المصدر','القسم','الحرارة','المرحلة','الشركة','تاريخ الإنشاء'] : ['ID','Name','Phone','Email','Type','Source','Department','Temperature','Stage','Company','Created'];
    const rows = list.map(c => [c.id, c.full_name, c.phone, c.email || '', c.contact_type, c.source || '', c.department || '', c.temperature || '', c.stage || '', c.company || '', c.created_at || '']);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `contacts_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async (form) => {
    const newContact = {
      ...form,
      id: String(Math.max(0, ...contacts.map(c => parseInt(c.id) || 0)) + 1),
      lead_score: 0,
      temperature: 'hot',
      temperature_auto: true,
      cold_status: form.contact_type === 'cold' ? 'not_contacted' : null,
      stage: form.contact_type === 'lead' ? 'new' : null,
      is_blacklisted: false,
      assigned_to_name: profile?.full_name_ar || '—',
      created_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };
    try {
      const saved = await createContact(form);
      const updated = [saved, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
    } catch {
      const updated = [newContact, ...contacts];
      setContacts(updated);
      localStorage.setItem('platform_contacts', JSON.stringify(updated));
    }
  };

  const handleBlacklist = async (contact, reason) => {
    try { await blacklistContact(contact.id, reason); } catch { /* optimistic */ }
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_blacklisted: true, blacklist_reason: reason } : c));
    if (selected?.id === contact.id) setSelected(null);
  };

  const selCls = 'bg-surface-input dark:bg-surface-input-dark border border-edge dark:border-edge-dark rounded-lg px-3 py-2 text-content dark:text-content-dark text-xs outline-none cursor-pointer';
  const thCls = `text-[11px] text-[#6B8DB5] font-bold uppercase tracking-wide px-3.5 py-3 bg-gray-50 dark:bg-brand-500/[0.08] border-b border-edge dark:border-edge-dark whitespace-nowrap ${isRTL ? 'text-right' : 'text-left'}`;
  const tdCls = `px-3.5 py-3 border-b border-edge dark:border-edge-dark align-middle text-[13px] text-content dark:text-content-dark ${isRTL ? 'text-right' : 'text-left'}`;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="font-['Cairo','Tajawal',sans-serif] text-content dark:text-content-dark">
      {/* Page Header */}
      <div className="mb-5 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark">{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p className="mt-1 mb-0 text-[13px] text-content-muted dark:text-content-muted-dark">
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : 'results'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(filtered)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Download size={14} /> {isRTL ? 'تصدير' : 'Export'}
          </button>
          <button onClick={() => setShowImportModal(true)} className="px-3.5 py-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-xs cursor-pointer flex items-center gap-1.5">
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>
          <button onClick={() => setMergeMode(m => !m)} className={`px-3.5 py-2.5 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 ${mergeMode ? 'bg-blue-800/10 border border-blue-800 text-blue-800' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
            <Merge size={14} /> {isRTL ? 'دمج' : 'Merge'}
          </button>
          {selectedIds.length > 0 && (
            <button onClick={() => { setBatchCallMode(true); setBatchCallIndex(0); setBatchCallLog([]); setBatchCallNotes(''); setBatchCallResult(''); }} className="px-3.5 py-2.5 bg-gradient-to-br from-[#065F46] to-emerald-500 border-none rounded-lg text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <PhoneCall size={14} /> {isRTL ? `اتصال جماعي (${selectedIds.length})` : `Batch Call (${selectedIds.length})`}
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} className="px-4.5 py-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
            <Plus size={14} /> {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
          </button>
          {isAdmin && selectedIds.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowBulkMenu(v => !v)} className="px-3.5 py-2.5 bg-gradient-to-br from-[#2B4C6F] to-brand-500 border-none rounded-lg text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                {isRTL ? `إجراءات (${selectedIds.length})` : `Actions (${selectedIds.length})`} ▾
              </button>
              {showBulkMenu && (
                <div className={`absolute top-[110%] ${isRTL ? 'right-0' : 'left-0'} bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] min-w-[190px] z-[200] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden`}>
                  {[
                    { label: isRTL ? "تصدير المحددين" : "Export Selected", action: () => exportCSV(contacts.filter(c => selectedIds.includes(c.id))) },
                    { label: isRTL ? "إعادة تعيين" : "Reassign", action: () => setBulkReassignModal(true) },
                    { label: isRTL ? "تغيير المرحلة" : "Change Stage", action: () => setBulkStageModal(true) },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} className={`w-full px-4 py-2.5 bg-transparent border-none text-content dark:text-content-dark text-[13px] cursor-pointer ${isRTL ? 'text-right' : 'text-left'} flex items-center gap-2 hover:bg-brand-500/[0.15]`}>
                      {item.label}
                    </button>
                  ))}
                  <div className="h-px bg-red-500/20 my-1" />
                  <button onClick={handleDeleteSelected} className={`w-full px-4 py-2.5 bg-transparent border-none text-red-500 text-[13px] cursor-pointer ${isRTL ? 'text-right' : 'text-left'} flex items-center gap-2 hover:bg-red-500/10`}>
                    {isRTL ? "حذف المحددين" : "Delete Selected"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Type Chips */}
      <div className="flex gap-2 mb-3.5 flex-wrap">
        {[
          { label: isRTL ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          ...Object.entries(TYPE).filter(([k]) => stats[k] > 0).map(([k, v]) => ({
            label: isRTL ? v.label : v.labelEn, value: k, count: stats[k] || 0, color: v.color,
          })),
        ].map(s => {
          const active = filterType === s.value;
          return (
          <button key={s.value} onClick={() => setFilterType(s.value)}
            className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer ${active ? 'font-bold' : 'font-normal bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
            style={active ? { border: `1px solid ${s.color}`, background: `${s.color}15`, color: s.color } : undefined}>
            {s.label} <span
              className={`rounded-[10px] px-[7px] py-px text-[10px] mis-1 ${active ? '' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}
              style={active ? { background: s.color, color: '#fff' } : undefined}>{s.count}</span>
          </button>
          );
        })}
        <button onClick={() => setShowBlacklisted(v => !v)} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${showBlacklisted ? 'border border-red-500 bg-red-500/[0.08] text-red-500 font-bold' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark font-normal'}`}>
          <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklist'} <span className={`rounded-[10px] px-[7px] py-px text-[10px] mis-1 ${showBlacklisted ? 'bg-red-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.blacklisted}</span>
        </button>
        <button onClick={() => setFilterTemp(filterTemp === 'hot' ? 'all' : 'hot')} className={`px-3.5 py-1.5 rounded-full text-xs cursor-pointer flex items-center gap-1.5 ${filterTemp === 'hot' ? 'border border-red-500 bg-red-500/[0.08] text-red-500' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
          <Flame size={11} /> {isRTL ? 'حار فقط' : 'Hot Only'} <span className={`rounded-[10px] px-[7px] py-px text-[10px] mis-1 ${filterTemp === 'hot' ? 'bg-red-500 text-white' : 'bg-edge dark:bg-edge-dark text-content-muted dark:text-content-muted-dark'}`}>{stats.hot}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center bg-gray-50 dark:bg-brand-500/[0.08] px-3.5 py-2.5 rounded-xl border border-edge dark:border-edge-dark">
        <div className="relative flex-[1_1_220px]">
          <Search size={14} className={`absolute ${isRTL ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-[#6B8DB5] dark:text-[#6B8DB5]`} />
          <input type="text" placeholder={i18n.language === 'ar' ? 'بحث بالاسم، الهاتف، الإيميل...' : 'Search by name, phone, email...'} value={searchInput} onChange={e => setSearchInput(e.target.value)}
            className={`${selCls} w-full box-border ${isRTL ? 'pl-8' : 'pr-8'}`} />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={selCls}>
          <option value="all">{isRTL ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selCls}>
          <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
          <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
          <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
          <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
          <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
          <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
          <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
          <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className={selCls}>
          <option value="all">{isRTL ? 'كل الأقسام' : 'All Depts'}</option>
          <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
          <option value="hr">{isRTL ? 'HR' : 'HR'}</option>
          <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
          <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
          <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
        </select>
        <select value={filterTemp} onChange={e => setFilterTemp(e.target.value)} className={selCls}>
          <option value="all">{isRTL ? 'كل الدرجات' : 'All Temps'}</option>
          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.labelAr : v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={selCls}>
          <option value="last_activity">{isRTL ? 'ترتيب: آخر نشاط' : 'Sort: Last Activity'}</option>
          <option value="score">{isRTL ? 'ترتيب: Lead Score' : 'Sort: Lead Score'}</option>
          <option value="name">{isRTL ? 'ترتيب: الاسم' : 'Sort: Name'}</option>
          <option value="created">{isRTL ? 'ترتيب: تاريخ الإنشاء' : 'Sort: Created Date'}</option>
          <option value="temperature">{isRTL ? 'ترتيب: الحرارة' : 'Sort: Temperature'}</option>
          <option value="stale">{isRTL ? 'ترتيب: يحتاج متابعة' : 'Sort: Needs Follow-up'}</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl overflow-hidden">
        {mergeMode && (
          <div className="px-4 py-2.5 bg-blue-800/[0.06] dark:bg-blue-800/[0.12] border-b border-edge dark:border-edge-dark flex items-center gap-2.5 justify-between">
            <span className="text-[13px] font-semibold text-blue-800">
              <Merge size={14} className="align-middle me-1.5 inline" />
              {isRTL ? `اختر جهتي اتصال للدمج (${mergeTargets.length}/2)` : `Select 2 contacts to merge (${mergeTargets.length}/2)`}
            </span>
            <div className="flex gap-2">
              {mergeTargets.length === 2 && (
                <button onClick={() => setMergePreview(mergeTargets)} className="px-3.5 py-1.5 bg-gradient-to-br from-blue-800 to-blue-500 border-none rounded-md text-white text-xs font-semibold cursor-pointer">
                  {isRTL ? 'معاينة الدمج' : 'Preview Merge'}
                </button>
              )}
              <button onClick={() => { setMergeMode(false); setMergeTargets([]); }} className="px-3.5 py-1.5 bg-transparent border border-edge dark:border-edge-dark rounded-md text-content-muted dark:text-content-muted-dark text-xs cursor-pointer">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[800px]">
            <thead>
              <tr>
                <th className={`${thCls} w-9 !px-2 !py-2.5`}><input type="checkbox" checked={paged.length > 0 && paged.every(c => selectedIds.includes(c.id))} onChange={toggleSelectAll} className="cursor-pointer" /></th>
                <th className={`${thCls} w-[50px]`}>ID</th>
                <th className={thCls}>{t('contacts.fullName')}</th>
                <th className={thCls}>{t('contacts.phone')}</th>
                <th className={thCls}>{t('contacts.type')}</th>
                <th className={thCls}>{t('contacts.temperature')}</th>
                <th className={thCls}>{t('contacts.source')}</th>
                <th className={thCls}>{t('contacts.stage')}</th>
                <th className={thCls}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center p-10 text-[#6B8DB5] dark:text-[#6B8DB5]">{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="p-0 border-none">
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-[rgba(27,51,71,0.08)] to-brand-500/[0.12] border-[1.5px] border-dashed border-brand-500/30 flex items-center justify-center mb-4">
                      <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
                    </div>
                    <p className="m-0 mb-1.5 font-bold text-[15px] text-content dark:text-content-dark">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                    <p className="m-0 text-[13px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'جرّب البحث بكلمات مختلفة' : 'Try searching with different keywords'}</p>
                  </div>
                </td></tr>
              ) : paged.map((c) => {
                const isPinned = pinnedIds.includes(c.id);
                const isMergeSelected = mergeTargets.includes(c.id);
                return (
                <tr key={c.id}
                  onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev) : setSelected(c)}
                  className={`cursor-pointer transition-colors ${isMergeSelected ? 'bg-blue-800/[0.08]' : selectedIds.includes(c.id) ? 'bg-brand-500/[0.08]' : c.is_blacklisted ? 'bg-red-500/[0.03]' : 'hover:bg-surface-bg dark:hover:bg-brand-500/[0.06]'}`}
                >
                  <td className={`${tdCls} !px-2 !py-3`} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="cursor-pointer" /></td>
                  <td className={`${tdCls} text-[10px] text-[#6B8DB5] dark:text-[#6B8DB5] font-mono`}>
                    <div className="flex items-center gap-1">
                      {isPinned && <Pin size={10} color="#F59E0B" className="shrink-0" />}
                      #{String(c.id).slice(-4)}
                    </div>
                  </td>
                  {/* Name */}
                  <td className={tdCls}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-[34px] h-[34px] rounded-[10px] shrink-0 flex items-center justify-center text-[13px] font-bold"
                        style={{ background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id), color: c.is_blacklisted ? '#EF4444' : '#fff' }}>
                        {c.is_blacklisted ? <Ban size={14} /> : initials(c.full_name)}
                      </div>
                      <div>
                        <div className={`font-semibold whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] ${c.is_blacklisted ? 'text-red-500' : 'text-content dark:text-content-dark'}`}>{c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}</div>
                        {c.email && <div className="text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5] whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">{c.email}</div>}
                        {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <div className={`text-[10px] mt-0.5 font-semibold ${d === 0 ? 'text-brand-500' : d <= 3 ? 'text-[#6B8DB5]' : 'text-red-500'}`}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' أيام' : d + 'd ago')}</div>; })()}
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td className={tdCls} onClick={e => e.stopPropagation()}>
                    <PhoneCell phone={c.phone} />
                    {c.phone2 && <PhoneCell phone={c.phone2} small />}
                  </td>
                  {/* Type */}
                  <td className={tdCls}>{TYPE[c.contact_type] ? <Chip label={isRTL ? TYPE[c.contact_type].label : TYPE[c.contact_type].labelEn} color={TYPE[c.contact_type].color} bg={TYPE[c.contact_type].bg} /> : <span className="text-content-muted dark:text-content-muted-dark">—</span>}</td>
                  {/* Temp */}
                  <td className={tdCls}>
                    {(() => { const TempIcon = TEMP[c.temperature]?.Icon; return TempIcon ? <TempIcon size={15} color={TEMP[c.temperature]?.color} /> : '—'; })()}
                  </td>
                  {/* Source */}
                  <td className={tdCls}><span className="text-[11px] bg-gray-100 dark:bg-brand-500/[0.12] border border-edge dark:border-edge-dark rounded-md px-2 py-1 text-content-muted dark:text-content-muted-dark">{c.source ? (isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)) : '—'}</span></td>
                  {/* Stage */}
                  <td className={tdCls} onClick={e => e.stopPropagation()}>
                    {isAdmin && c.contact_type === 'lead' ? (
                      <select value={c.stage || ''} onChange={e => handleStageChange(c.id, e.target.value)} className="text-[11px] bg-transparent border border-brand-500/10 rounded-md text-brand-500 px-1.5 py-1 cursor-pointer outline-none">
                        {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    ) : c.stage ? <Chip label={stageLabel(c.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                    : c.cold_status ? <span className="text-[11px] text-[#6B8DB5] dark:text-[#6B8DB5]">{coldLabel(c.cold_status, isRTL)}</span>
                    : <span className="text-brand-500/30 dark:text-brand-500/30">—</span>}
                  </td>
                  {/* Actions - Quick access buttons */}
                  <td className={tdCls} onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 items-center">
                      <a href={"tel:" + c.phone} title={isRTL ? "اتصال" : "Call"} className="w-[26px] h-[26px] flex items-center justify-center bg-emerald-500/[0.06] border border-emerald-500/20 rounded-md text-emerald-500 no-underline">
                        <Phone size={12} />
                      </a>
                      <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-[26px] h-[26px] flex items-center justify-center bg-[#25D366]/[0.06] border border-[#25D366]/20 rounded-md text-[#25D366] no-underline">
                        <MessageCircle size={12} />
                      </a>
                      <button onClick={() => setLogCallTarget(c)} title={isRTL ? 'تسجيل مكالمة' : 'Log Call'} className="w-[26px] h-[26px] flex items-center justify-center bg-brand-500/[0.06] border border-brand-500/20 rounded-md text-brand-500 cursor-pointer">
                        <PhoneCall size={12} />
                      </button>
                      <button onClick={() => setReminderTarget(c)} title={isRTL ? 'تذكير' : 'Reminder'} className="w-[26px] h-[26px] flex items-center justify-center bg-amber-500/[0.06] border border-amber-500/20 rounded-md text-amber-500 cursor-pointer">
                        <Bell size={12} />
                      </button>
                      <button onClick={() => togglePin(c.id)} title={isRTL ? 'تثبيت' : 'Pin'} className={`w-[26px] h-[26px] flex items-center justify-center rounded-md cursor-pointer ${isPinned ? 'bg-amber-500/[0.12] border border-amber-500/30 text-amber-500' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                        <Pin size={12} />
                      </button>
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          className={`w-[26px] h-[26px] flex items-center justify-center rounded-md cursor-pointer ${openMenuId === c.id ? 'bg-brand-500 border border-brand-500 text-white' : 'bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
                          <MoreVertical size={12} />
                        </button>
                        {openMenuId === c.id && (
                          <div className={`absolute top-[30px] ${isRTL ? 'left-0' : 'right-0'} bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] min-w-[180px] z-[100] shadow-[0_8px_30px_rgba(27,51,71,0.12)] overflow-hidden`}>
                            <div className="p-1">
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر','الميزانية'] : ['Name','Phone','Type','Source','Budget']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <FileDown size={13} /> {isRTL ? 'تصدير' : 'Export'}
                              </button>
                              <button onClick={() => { handleDelete(c.id); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-content dark:text-content-dark font-inherit hover:bg-surface-bg dark:hover:bg-brand-500/10">
                                <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                            {!c.is_blacklisted && (<><div className="h-px bg-edge dark:bg-edge-dark" /><div className="p-1">
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md border-none bg-transparent cursor-pointer text-xs text-red-500 font-inherit hover:bg-red-500/[0.05]">
                                <Ban size={13} /> {isRTL ? 'بلاك ليست' : 'Blacklist'}
                              </button>
                            </div></>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${page === 1 ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? 'السابق →' : '← Prev'}
            </button>
            <span className="text-xs text-content-muted dark:text-content-muted-dark">
              {isRTL ? `${page} من ${totalPages}` : `${page} of ${totalPages}`}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className={`px-3.5 py-1.5 rounded-md border border-edge dark:border-edge-dark text-xs ${page === totalPages ? 'bg-transparent text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-50' : 'bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark cursor-pointer'}`}>
              {isRTL ? '← التالي' : 'Next →'}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const found = contacts.find(c => c.phone === phone || c.phone2 === phone || (c.extra_phones || []).includes(phone)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => { setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; }); setSelected(updated); updateContact(updated.id, updated).catch(() => { /* optimistic */ }) }} onAddOpportunity={() => {}} />}
      {logCallTarget && <LogCallModal contact={logCallTarget} onClose={() => setLogCallTarget(null)} />}
      {reminderTarget && <QuickTaskModal contact={reminderTarget} onClose={() => setReminderTarget(null)} />}
    {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={(newContacts) => { setContacts(prev => { const updated = [...prev, ...newContacts]; localStorage.setItem('platform_contacts', JSON.stringify(updated)); return updated; }); setShowImportModal(false); }} />}

      {/* Batch Call Mode */}
      {batchCallMode && (() => {
        const batchContacts = contacts.filter(c => selectedIds.includes(c.id));
        const current = batchContacts[batchCallIndex];
        if (!current) return null;
        const progress = batchCallLog.length;
        const total = batchContacts.length;
        return (
          <div className="fixed inset-0 bg-black/60 z-[1200] flex items-center justify-center p-5">
            <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark rounded-[20px] w-full max-w-[520px] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-br from-[#065F46] to-emerald-500 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <PhoneCall size={18} color="#fff" />
                  <span className="text-white font-bold text-[15px]">{isRTL ? 'وضع الاتصال' : 'Call Mode'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-xs">{progress}/{total}</span>
                  <button onClick={() => setBatchCallMode(false)} className="bg-white/15 border-none rounded-md w-7 h-7 flex items-center justify-center cursor-pointer text-white"><X size={14} /></button>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-[3px] bg-gray-200 dark:bg-gray-700">
                <div className="h-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(progress / total) * 100}%` }} />
              </div>
              {/* Contact info */}
              <div className="p-6">
                <div className="flex items-center gap-3.5 mb-5">
                  <div className="w-[50px] h-[50px] rounded-[14px] flex items-center justify-center text-lg font-bold text-white" style={{ background: avatarColor(current.id) }}>
                    {initials(current.full_name)}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-base text-content dark:text-content-dark">{current.full_name}</div>
                    <div className={`text-[13px] text-content-muted dark:text-content-muted-dark ${isRTL ? 'text-right' : 'text-left'}`} style={{ direction: 'ltr' }}>{current.phone}</div>
                    {current.company && <div className="text-xs text-content-muted dark:text-content-muted-dark">{current.company}</div>}
                  </div>
                  <div className="text-center">
                    <Chip label={isRTL ? TYPE[current.contact_type]?.label : TYPE[current.contact_type]?.labelEn} color={TYPE[current.contact_type]?.color} bg={TYPE[current.contact_type]?.bg} />
                    {current.stage && <div className="text-[10px] mt-1 text-brand-500">{stageLabel(current.stage, isRTL)}</div>}
                  </div>
                </div>
                {/* Call button */}
                <a href={"tel:" + current.phone} className="flex items-center justify-center gap-2 p-3 bg-gradient-to-br from-[#065F46] to-emerald-500 rounded-[10px] text-white font-bold text-sm no-underline mb-4">
                  <Phone size={16} /> {isRTL ? 'اتصل الآن' : 'Call Now'}
                </a>
                {/* Call result */}
                <div className="mb-3">
                  <div className="text-xs font-semibold text-content-muted dark:text-content-muted-dark mb-1.5">{isRTL ? 'نتيجة المكالمة' : 'Call Result'}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { value: 'answered', label: isRTL ? 'رد' : 'Answered', color: '#10B981' },
                      { value: 'no_answer', label: isRTL ? 'لم يرد' : 'No Answer', color: '#F59E0B' },
                      { value: 'busy', label: isRTL ? 'مشغول' : 'Busy', color: '#EF4444' },
                      { value: 'interested', label: isRTL ? 'مهتم' : 'Interested', color: '#4A7AAB' },
                      { value: 'not_interested', label: isRTL ? 'غير مهتم' : 'Not Interested', color: '#6b7280' },
                    ].map(r => (
                      <button key={r.value} onClick={() => setBatchCallResult(r.value)}
                        className={`px-3 py-1.5 rounded-2xl text-[11px] cursor-pointer ${batchCallResult === r.value ? 'font-bold' : 'font-normal bg-transparent border border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}
                        style={batchCallResult === r.value ? { background: r.color + '18', border: `1px solid ${r.color}`, color: r.color } : undefined}>{r.label}</button>
                    ))}
                  </div>
                </div>
                {/* Notes */}
                <textarea value={batchCallNotes} onChange={e => setBatchCallNotes(e.target.value)} placeholder={isRTL ? 'ملاحظات سريعة...' : 'Quick notes...'} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-xs resize-none box-border font-inherit mb-4" />
                {/* Navigation */}
                <div className="flex gap-2.5 justify-between">
                  <button disabled={batchCallIndex === 0} onClick={() => { setBatchCallIndex(i => i - 1); setBatchCallNotes(''); setBatchCallResult(''); }}
                    className={`flex-1 p-2.5 rounded-lg border border-edge dark:border-edge-dark bg-transparent text-xs ${batchCallIndex === 0 ? 'text-content-muted dark:text-content-muted-dark cursor-not-allowed opacity-40' : 'text-content dark:text-content-dark cursor-pointer'}`}>
                    {isRTL ? 'السابق' : 'Previous'}
                  </button>
                  <button onClick={async () => {
                    // Log current call as activity
                    if (batchCallResult) {
                      const resultLabel = { answered: isRTL?'رد':'Answered', no_answer: isRTL?'لم يرد':'No Answer', busy: isRTL?'مشغول':'Busy', interested: isRTL?'مهتم':'Interested', not_interested: isRTL?'غير مهتم':'Not Interested' }[batchCallResult] || batchCallResult;
                      const activity = { type: 'call', description: `${isRTL ? 'مكالمة' : 'Call'}: ${resultLabel}${batchCallNotes ? ' — ' + batchCallNotes : ''}`, contact_id: current.id, created_at: new Date().toISOString() };
                      try { await createActivity(activity); } catch { /* optimistic */ }
                      setBatchCallLog(prev => [...prev, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }]);
                    }
                    if (batchCallIndex < batchContacts.length - 1) {
                      setBatchCallIndex(i => i + 1);
                      setBatchCallNotes(''); setBatchCallResult('');
                    } else {
                      // Finished - show summary
                      const finalLog = batchCallResult ? [...batchCallLog, { id: current.id, name: current.full_name, result: batchCallResult, notes: batchCallNotes }] : batchCallLog;
                      toast.success(isRTL ? `تم الانتهاء من ${finalLog.length} مكالمة` : `Completed ${finalLog.length} calls`);
                      setBatchCallMode(false); setSelectedIds([]);
                    }
                  }} className="flex-[2] p-2.5 rounded-lg border-none bg-gradient-to-br from-[#2B4C6F] to-brand-500 text-white text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5">
                    {batchCallIndex < batchContacts.length - 1 ? (<>{isRTL ? 'التالي' : 'Next'} <SkipForward size={13} /></>) : (isRTL ? 'إنهاء' : 'Finish')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Merge Preview Modal */}
      {mergePreview && (() => {
        const [c1, c2] = mergePreview.map(id => contacts.find(c => c.id === id)).filter(Boolean);
        if (!c1 || !c2) return null;
        const merged = { ...c2, ...c1 };
        // Keep the richer data
        if (!c1.email && c2.email) merged.email = c2.email;
        if (!c1.phone2 && c2.phone2) merged.phone2 = c2.phone2;
        if (!c1.phone2 && c2.phone !== c1.phone) merged.phone2 = c2.phone;
        if ((c2.lead_score || 0) > (c1.lead_score || 0)) merged.lead_score = c2.lead_score;
        if (!c1.company && c2.company) merged.company = c2.company;
        if (!c1.preferred_location && c2.preferred_location) merged.preferred_location = c2.preferred_location;
        const fields = ['full_name','phone','phone2','email','contact_type','source','temperature','stage','company','preferred_location'];
        return (
          <div className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
            <div dir={isRTL ? 'rtl' : 'ltr'} className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[600px] max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-5">
                <h3 className="m-0 text-content dark:text-content-dark text-base font-bold flex items-center gap-2"><Merge size={18} color="#1E40AF" /> {isRTL ? 'معاينة الدمج' : 'Merge Preview'}</h3>
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={18} /></button>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className={`px-2.5 py-2 ${isRTL ? 'text-right' : 'text-left'} text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'الحقل' : 'Field'}</th>
                    <th className={`px-2.5 py-2 ${isRTL ? 'text-right' : 'text-left'} text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c1.full_name}</th>
                    <th className={`px-2.5 py-2 ${isRTL ? 'text-right' : 'text-left'} text-content-muted dark:text-content-muted-dark font-semibold border-b border-edge dark:border-edge-dark`}>{c2.full_name}</th>
                    <th className={`px-2.5 py-2 ${isRTL ? 'text-right' : 'text-left'} text-emerald-500 font-semibold border-b border-edge dark:border-edge-dark`}>{isRTL ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f} className="border-b border-edge dark:border-edge-dark">
                      <td className="px-2.5 py-2 font-semibold text-content-muted dark:text-content-muted-dark">{f}</td>
                      <td className={`px-2.5 py-2 ${merged[f] === c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c1[f] || '—'}</td>
                      <td className={`px-2.5 py-2 ${merged[f] === c2[f] && merged[f] !== c1[f] ? 'text-emerald-500' : 'text-content dark:text-content-dark'}`}>{c2[f] || '—'}</td>
                      <td className="px-2.5 py-2 font-semibold text-emerald-500">{merged[f] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-2.5 mt-5 justify-end">
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-[13px] cursor-pointer">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => {
                  // Perform merge: keep c1 with merged data, remove c2
                  const updatedContacts = contacts.map(c => c.id === c1.id ? { ...c, ...merged, id: c1.id } : c).filter(c => c.id !== c2.id);
                  setContacts(updatedContacts);
                  localStorage.setItem('platform_contacts', JSON.stringify(updatedContacts));
                  toast.success(isRTL ? 'تم دمج جهتي الاتصال بنجاح' : 'Contacts merged successfully');
                  setMergePreview(null); setMergeTargets([]); setMergeMode(false); setSelectedIds([]);
                }} className="px-5 py-2.5 bg-gradient-to-br from-blue-800 to-blue-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer">
                  {isRTL ? 'تأكيد الدمج' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm Modal */}
      {confirmAction && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
          <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-red-500/30 dark:border-red-500/30 rounded-2xl p-7 w-full max-w-[400px] text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 text-[22px]">⚠️</div>
            <h3 className="m-0 mb-2 text-content dark:text-content-dark text-base font-bold">{confirmAction.title}</h3>
            <p className="m-0 mb-5 text-content-muted dark:text-content-muted-dark text-[13px]">{confirmAction.message}</p>
            <div className="flex gap-2.5 justify-center">
              <button onClick={() => setConfirmAction(null)} className="px-5 py-2.5 bg-transparent border border-edge dark:border-edge-dark rounded-lg text-content-muted dark:text-content-muted-dark text-[13px] cursor-pointer">{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={confirmAction.onConfirm} className="px-5 py-2.5 bg-gradient-to-br from-red-900 to-red-500 border-none rounded-lg text-white text-[13px] font-bold cursor-pointer">{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Stage Modal */}
      {bulkStageModal && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
          <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[380px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-content dark:text-content-dark text-[15px] font-bold">{isRTL ? `تغيير المرحلة (${selectedIds.length})` : `Change Stage (${selectedIds.length})`}</h3>
              <button onClick={() => setBulkStageModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(STAGE_LABELS).map(([key, val]) => (
                <button key={key} onClick={() => handleBulkStage(key)}
                  className={`px-3.5 py-2.5 bg-gray-50 dark:bg-brand-500/[0.08] border border-edge dark:border-edge-dark rounded-lg text-content dark:text-content-dark text-[13px] cursor-pointer ${isRTL ? 'text-right' : 'text-left'} hover:bg-surface-bg dark:hover:bg-brand-500/[0.15]`}>
                  {isRTL ? val.ar : val.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {bulkReassignModal && (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed inset-0 bg-black/50 z-[1100] flex items-center justify-center p-5">
          <div className="modal-content bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-6 w-full max-w-[380px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="m-0 text-content dark:text-content-dark text-[15px] font-bold">{isRTL ? `إعادة تعيين (${selectedIds.length})` : `Reassign (${selectedIds.length})`}</h3>
              <button onClick={() => setBulkReassignModal(false)} className="bg-transparent border-none text-content-muted dark:text-content-muted-dark cursor-pointer"><X size={16} /></button>
            </div>
            <div className="flex flex-col gap-1.5">
              {[...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].map(agent => (
                <button key={agent} onClick={() => handleBulkReassign(agent)}
                  className={`px-3.5 py-2.5 bg-gray-50 dark:bg-brand-500/[0.08] border border-edge dark:border-edge-dark rounded-lg text-content dark:text-content-dark text-[13px] cursor-pointer ${isRTL ? 'text-right' : 'text-left'} hover:bg-surface-bg dark:hover:bg-brand-500/[0.15]`}>
                  {agent}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
