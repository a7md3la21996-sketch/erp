import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Phone, MessageCircle, Mail, Plus, Upload, Download, Search, Ban, X, Clock, Star, Flame, Wind, Snowflake, Thermometer, Users, UserCheck, PhoneOff, AlertOctagon, CheckCircle2, Calendar, FileDown, MoreVertical, Bell, PhoneMissed, CheckSquare, Check, Trash2, Pencil, Pin, PhoneCall, Merge, SkipForward } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, checkDuplicate,
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../services/contactsService';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES, TASK_STATUSES } from '../services/tasksService';
import ImportModal from './crm/ImportModal';

// ── Hooks ──────────────────────────────────────────────────────────────────
function useEscClose(onClose) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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
    <span style={{
      color, background: bg, padding: size === 'sm' ? '2px 9px' : '3px 12px',
      borderRadius: 20, fontSize: size === 'sm' ? 11 : 12, fontWeight: 700, whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>{label}</span>
  );
}

function ScorePill({ score }) {
  const s = score ?? 0;
  const color = s >= 75 ? '#4A7AAB' : s >= 50 ? '#6B8DB5' : s >= 25 ? '#8BA8C8' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(74,122,171,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${s}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 20 }}>{s}</span>
    </div>
  );
}

// ── Phone Cell ─────────────────────────────────────────────────────────────
function PhoneCell({ phone, small = false }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "3px 0", direction: 'ltr' }}
      onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}>
      <span style={{ fontSize: small ? 11 : 13, color: small ? "#9ca3af" : (isDark ? '#E2EAF4' : '#374151'), fontFamily: "monospace", letterSpacing: revealed ? 0 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150, display: 'inline-block' }}>
        {revealed ? phone : masked}
      </span>
      {revealed && (
        <button onClick={handleCopy} style={{ padding: "2px 8px", background: copied ? "rgba(16,185,129,0.15)" : "rgba(74,122,171,0.15)", border: copied ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(74,122,171,0.3)", borderRadius: 5, color: copied ? "#10B981" : "#6B8DB5", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {copied ? (isRTL ? '✓ تم' : '✓ copied') : (isRTL ? 'نسخ' : 'copy')}
        </button>
      )}
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────
function AddContactModal({ onClose, onSave, checkDup, onOpenOpportunity }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    }
    setSaving(false);
  };

  const inp = { background: isDark ? '#0F1E2D' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : '#d1d5db'}`, borderRadius: 8, padding: '9px 12px', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const sel = { ...inp, cursor: 'pointer' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div onClick={e => e.stopPropagation()} className="modal-content" style={{ background: isDark ? '#1a2234' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 17, fontWeight: 700 }}>
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
            <p style={{ margin: '3px 0 0', fontSize: 12, color: isDark ? '#8BA8C8' : '#64748B' }}>
              {step === 1 ? (isRTL ? 'البيانات الأساسية' : 'Basic Info') : (isRTL ? 'البيانات الإضافية' : 'Additional Info')}
              {' '}<span style={{ color: 'rgba(139,168,200,0.5)' }}>({isRTL ? `${step} من 2` : `${step} of 2`})</span>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: isDark ? '#8BA8C8' : '#64748B', cursor: 'pointer', fontSize: 18 }}><X size={18} /></button>
        </div>
        <div style={{ height: 3, background: 'rgba(74,122,171,0.15)', borderRadius: '0 0 2px 2px' }}>
          <div style={{ height: '100%', width: step === 1 ? '50%' : '100%', background: 'linear-gradient(90deg,#2B4C6F,#4A7AAB)', borderRadius: '0 0 2px 2px', transition: 'width 0.3s ease' }} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {step === 1 ? (
            <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* القسم والنوع - أول حاجة */}
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'القسم' : 'Department'} <span style={{ color: '#EF4444' }}>*</span></label>
                <select style={{ ...sel, borderColor: !form.department ? (isDark ? 'rgba(74,122,171,0.5)' : '#9ca3af') : undefined }} value={form.department} onChange={e => setDept(e.target.value)}>
                  <option value="">{isRTL ? 'اختر القسم...' : 'Select department...'}</option>
                  <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                  <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                  <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                  <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                  <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'النوع' : 'Type'} <span style={{ color: '#EF4444' }}>*</span></label>
                <select style={sel} value={form.contact_type} onChange={e => set('contact_type', e.target.value)} disabled={!form.department}>
                  {!form.department && <option value="">{isRTL ? 'اختر القسم أولاً...' : 'Select department first...'}</option>}
                  {availableTypes.map(t => <option key={t} value={t}>{isRTL ? ({lead:'ليد',cold:'كولد كول',client:'عميل',supplier:'مورد',developer:'مطور عقاري',applicant:'متقدم لوظيفة',partner:'شريك'}[t]) : ({lead:'Lead',cold:'Cold Call',client:'Client',supplier:'Supplier',developer:'Developer',applicant:'Applicant',partner:'Partner'}[t])}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select style={{ ...sel, width: 110, flexShrink: 0 }} value={form.prefix} onChange={e => set('prefix', e.target.value)}>
                    <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                    <option value="Mr.">{isRTL ? 'السيد' : 'Mr.'}</option>
                    <option value="Mrs.">{isRTL ? 'السيدة' : 'Mrs.'}</option>
                    <option value="Dr.">{isRTL ? 'د.' : 'Dr.'}</option>
                    <option value="Eng.">{isRTL ? 'م.' : 'Eng.'}</option>
                    <option value="أستاذ">{isRTL ? 'أستاذ' : 'Prof.'}</option>
                  </select>
                  <input style={{ ...inp, flex: 1 }} placeholder={isRTL ? 'محمد أحمد...' : 'John Doe...'} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'رقم الهاتف' : 'Phone'} <span style={{ color: '#EF4444' }}>*</span> {(() => { const v = form.phone; return (<>{v && !validatePhone(v) && <span style={{ fontSize: 11, color: '#F97316' }}>⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}{v && validatePhone(v) && (() => { const info = getPhoneInfo(v); return info ? <span style={{ fontSize: 12, color: '#10B981' }}>{info.flag} {info.country} — {info.formatted}</span> : null; })()}</>); })()}</label>
                <input style={{ ...inp, borderColor: dupWarning ? '#EF4444' : 'rgba(74,122,171,0.25)' }}
                  placeholder="010xxxxxxxx" value={form.phone}
                  onChange={e => { const v = e.target.value.replace(/[^0-9+]/g, ''); set('phone', v); setDupWarning(null); if (validatePhone(v)) { checkPhoneNumber(v); } }} />
                {checking && <p style={{ fontSize: 11, color: isDark ? '#8BA8C8' : '#64748B', margin: '4px 0 0' }}>{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div style={{ marginTop: 8, padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 12 }}>
                    <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 8 }}>⚠️ {isRTL ? 'هذا الرقم مسجل باسم' : 'This number belongs to'}: <strong>{dupWarning.full_name}</strong> <span style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#6b7280', fontFamily: 'monospace' }}>— ID: {dupWarning.id}</span></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { onOpenOpportunity(dupWarning); onClose(); }}
                        style={{ flex: 1, padding: '8px 12px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        ✨ {isRTL ? 'فتح فرصة جديدة لـ ' + dupWarning.full_name : 'New opportunity for ' + dupWarning.full_name}
                      </button>
                      <button onClick={onClose}
                        style={{ padding: '8px 12px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, cursor: 'pointer' }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 8 }}>{isRTL ? 'أرقام إضافية' : 'Additional Phones'}</label>
                {extraPhones.map((ph, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input style={{ ...inp, flex: 1 }} placeholder="012xxxxxxxx or +966..."
                        value={ph}
                        onChange={e => {
                          const v = e.target.value.replace(/[^0-9+]/g, '');
                          const updated = [...extraPhones]; updated[i] = v; setExtraPhones(updated);
                          setExtraDups(d => { const nd = [...d]; nd[i] = null; return nd; });
                          if (validatePhone(v)) { checkDup(v).then(dup => { setExtraDups(d => { const nd = [...d]; nd[i] = dup || null; return nd; }); }).catch(() => {}); }
                        }} />
                      <button type="button" onClick={() => { setExtraPhones(extraPhones.filter((_, j) => j !== i)); setExtraDups(d => d.filter((_, j) => j !== i)); }}
                        style={{ padding: '0 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#EF4444', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                    </div>
                    {ph && (<div style={{ marginTop: 4 }}>
                      {!validatePhone(ph) && <span style={{ fontSize: 11, color: '#F97316' }}>⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}
                      {validatePhone(ph) && (() => { const info = getPhoneInfo(ph); return info ? <span style={{ fontSize: 12, color: '#10B981' }}>{info.flag} {info.country} — {info.formatted}</span> : null; })()}
                    </div>)}
                    {extraDups[i] && (
                      <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12 }}>
                        <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 4 }}>⚠️ {isRTL ? 'مسجل باسم' : 'Registered to'}: <strong>{extraDups[i].full_name}</strong> <span style={{ color: isDark ? '#6B8DB5' : '#6b7280', fontFamily: 'monospace', fontSize: 11 }}>ID: {extraDups[i].id}</span></div>
                        <button type="button" onClick={() => { onOpenOpportunity(extraDups[i]); onClose(); }}
                          style={{ width: '100%', padding: '6px 10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✨ {isRTL ? 'فتح فرصة جديدة' : 'New Opportunity'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => { setExtraPhones([...extraPhones, '']); setExtraDups([...extraDups, null]); }}
                  style={{ padding: '6px 14px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, color: isDark ? '#6B8DB5' : '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                  + {isRTL ? 'إضافة رقم' : 'Add Phone'}
                </button>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input style={inp} type="email" placeholder="email@domain.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'المصدر' : 'Source'}</label>
                <select style={sel} value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'اسم الحملة' : 'Campaign'}</label>
                <input style={inp} placeholder={isRTL ? 'مثال: حملة الشيخ زايد Q1' : 'e.g. Sheikh Zayed Q1 Campaign'} value={form.campaign_name} onChange={e => set('campaign_name', e.target.value)} />
              </div>
              </>)}
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الشركة / جهة العمل' : 'Company'}</label>
                <input style={inp} placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} value={form.company} onChange={e => set('company', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
                <input style={inp} placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} value={form.job_title} onChange={e => set('job_title', e.target.value)} />
              </div>

            </div>
          ) : (
            <div className="modal-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الجنس' : 'Gender'}</label>
                <select style={sel} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                  <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الجنسية' : 'Nationality'}</label>
                <select style={sel} value={form.nationality} onChange={e => set('nationality', e.target.value)}>
                  <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                  <option value="egyptian">{isRTL ? 'مصري' : 'Egyptian'}</option>
                  <option value="saudi">{isRTL ? 'سعودي' : 'Saudi'}</option>
                  <option value="emirati">{isRTL ? 'إماراتي' : 'Emirati'}</option>
                  <option value="kuwaiti">{isRTL ? 'كويتي' : 'Kuwaiti'}</option>
                  <option value="qatari">{isRTL ? 'قطري' : 'Qatari'}</option>
                  <option value="libyan">{isRTL ? 'ليبي' : 'Libyan'}</option>
                  <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'تاريخ الميلاد' : 'Birth Date'}</label>
                <input style={inp} type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
              </div>
              {['lead','cold','client'].includes(form.contact_type) && (<>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ميزانية من' : 'Budget From (EGP)'}</label>
                <input style={inp} type="number" placeholder="1500000" value={form.budget_min} onChange={e => set('budget_min', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ميزانية إلى' : 'Budget To (EGP)'}</label>
                <input style={inp} type="number" placeholder="3000000" value={form.budget_max} onChange={e => set('budget_max', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الموقع المفضل' : 'Preferred Location'}</label>
                <input style={inp} placeholder={isRTL ? 'الشيخ زايد، التجمع...' : 'Sheikh Zayed, New Cairo...'} value={form.preferred_location} onChange={e => set('preferred_location', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'نوع العقار' : 'Property Type'}</label>
                <select style={sel} value={form.interested_in_type} onChange={e => set('interested_in_type', e.target.value)}>
                  <option value="residential">{isRTL ? 'سكني' : 'Residential'}</option>
                  <option value="commercial">{isRTL ? 'تجاري' : 'Commercial'}</option>
                  <option value="administrative">{isRTL ? 'إداري' : 'Administrative'}</option>
                </select>
              </div>
              </>)}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={4} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && <button onClick={() => setStep(1)} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: isDark ? '#6B8DB5' : '#6b7280', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'السابق →' : '← Back'}</button>}
            {step === 1
              ? (() => { const canNext = form.department && form.contact_type && form.full_name.trim() && validatePhone(form.phone) && !dupWarning; return <button onClick={() => setStep(2)} disabled={!canNext} style={{ padding: '9px 22px', background: canNext ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.3)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: canNext ? 'pointer' : 'not-allowed' }}>{isRTL ? '← التالي' : 'Next →'}</button>; })()
              : <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', background: saving ? 'rgba(74,122,171,0.3)' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</button>
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const btnBorder = isDark ? 'rgba(74,122,171,0.2)' : '#E2E8F0';
  const lblColor = isDark ? '#8BA8C8' : '#4A5568';
  const priorities = [
    { value: 'high', ar: 'عالية', en: 'High', color: '#EF4444' },
    { value: 'medium', ar: 'متوسطة', en: 'Medium', color: '#F59E0B' },
    { value: 'low', ar: 'منخفضة', en: 'Low', color: '#10B981' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: isDark ? '#1a2234' : '#fff', borderRadius: 16, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#E2EAF4' : '#1B3347', display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'} — {contact.full_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: isDark ? '#8BA8C8' : '#9CA3AF', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          {/* Call Result */}
          <div style={{ fontSize: 12, color: lblColor, fontWeight: 600, marginBottom: 8 }}>{isRTL ? 'نتيجة المكالمة' : 'Call Result'} <span style={{ color: '#EF4444' }}>*</span></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {CALL_RESULTS.map(r => (
              <button key={r.key} onClick={() => setCallResult(r.key)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${callResult === r.key ? r.color : btnBorder}`,
                background: callResult === r.key ? r.color + '18' : 'none',
                color: callResult === r.key ? r.color : (isDark ? '#E2EAF4' : '#4A5568'),
                fontWeight: callResult === r.key ? 700 : 400,
              }}>{isRTL ? r.ar : r.en}</button>
            ))}
          </div>
          {/* Notes */}
          <div style={{ fontSize: 12, color: lblColor, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'ملاحظات' : 'Notes'}</div>
          <textarea rows={2} value={callNotes} onChange={e => setCallNotes(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${btnBorder}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'none', marginBottom: 16, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', boxSizing: 'border-box' }} placeholder={isRTL ? 'ملاحظات المكالمة...' : 'Call notes...'} />

          {/* Follow-up Section */}
          <div style={{ background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', border: `1px solid ${addFollowup ? (isDark ? 'rgba(74,122,171,0.25)' : '#4A7AAB30') : btnBorder}`, borderRadius: 10, padding: 14, transition: 'border-color 0.2s' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: addFollowup ? '#4A7AAB' : lblColor }}>
              <input type="checkbox" checked={addFollowup} onChange={e => setAddFollowup(e.target.checked)} style={{ accentColor: '#4A7AAB', cursor: 'pointer' }} />
              <Clock size={14} /> {isRTL ? 'إنشاء مهمة متابعة' : 'Create follow-up task'}
            </label>
            {addFollowup && (
              <div style={{ marginTop: 12 }}>
                {/* When */}
                <div style={{ fontSize: 11, color: lblColor, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'متى؟' : 'When?'}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                  {FOLLOWUP_PRESETS.map(p => (
                    <button key={p.key} onClick={() => handlePreset(p)} style={{
                      padding: '4px 12px', borderRadius: 16, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${followupPreset === p.key ? '#4A7AAB' : btnBorder}`,
                      background: followupPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none',
                      color: followupPreset === p.key ? '#4A7AAB' : (isDark ? '#E2EAF4' : '#4A5568'),
                      fontWeight: followupPreset === p.key ? 700 : 400,
                    }}>{isRTL ? p.ar : p.en}</button>
                  ))}
                </div>
                {followupPreset === 'custom' && (
                  <input type="datetime-local" value={followupDate} onChange={e => setFollowupDate(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${btnBorder}`, borderRadius: 8, fontSize: 12, outline: 'none', marginBottom: 10, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', boxSizing: 'border-box' }} />
                )}
                {/* Type + Priority */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: lblColor, fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'نوع المتابعة' : 'Follow-up type'}</div>
                    <select value={followupType} onChange={e => setFollowupType(e.target.value)} style={{ width: '100%', padding: '6px 8px', border: `1px solid ${btnBorder}`, borderRadius: 6, fontSize: 11, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', outline: 'none', cursor: 'pointer' }}>
                      {FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: lblColor, fontWeight: 600, marginBottom: 4 }}>{isRTL ? 'الأولوية' : 'Priority'}</div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {priorities.map(p => (
                        <button key={p.value} onClick={() => setFollowupPriority(p.value)} style={{
                          flex: 1, padding: '5px 0', borderRadius: 5, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit',
                          background: followupPriority === p.value ? p.color + '18' : 'transparent',
                          border: `1px solid ${followupPriority === p.value ? p.color : btnBorder}`,
                          color: followupPriority === p.value ? p.color : (isDark ? '#8BA8C8' : '#6B7280'),
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
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0'}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${btnBorder}`, background: isDark ? '#152232' : '#F8FAFC', fontSize: 13, color: isDark ? '#8BA8C8' : '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: callResult ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.3)', fontSize: 13, color: '#fff', fontWeight: 700, cursor: callResult ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? '...' : addFollowup ? (isRTL ? 'حفظ + إنشاء مهمة' : 'Save + Create Task') : (isRTL ? 'حفظ المكالمة' : 'Save Call')}
          </button>
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const btnBorder = isDark ? 'rgba(74,122,171,0.2)' : '#E2E8F0';
  const lblColor = isDark ? '#8BA8C8' : '#4A5568';
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: isDark ? '#1a2234' : '#fff', borderRadius: 16, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '18px 20px 14px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: isDark ? '#E2EAF4' : '#1B3347', display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> {isRTL ? 'مهمة سريعة' : 'Quick Task'} — {contact.full_name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: isDark ? '#8BA8C8' : '#9CA3AF', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          {/* Title */}
          <input value={title} onChange={e => setTitle(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${btnBorder}`, borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', boxSizing: 'border-box', marginBottom: 14 }} placeholder={isRTL ? `متابعة ${contact.full_name}` : `Follow up with ${contact.full_name}`} />
          {/* When */}
          <div style={{ fontSize: 12, color: lblColor, fontWeight: 600, marginBottom: 8 }}>{isRTL ? 'متى؟' : 'When?'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {QUICK_TASK_PRESETS.map(p => (
              <button key={p.key} onClick={() => handlePreset(p)} style={{ padding: '5px 14px', borderRadius: 20, border: `1.5px solid ${selectedPreset === p.key ? '#4A7AAB' : btnBorder}`, background: selectedPreset === p.key ? 'rgba(74,122,171,0.12)' : 'none', fontSize: 12, color: selectedPreset === p.key ? '#4A7AAB' : (isDark ? '#E2EAF4' : '#4A5568'), cursor: 'pointer', fontFamily: 'inherit', fontWeight: selectedPreset === p.key ? 700 : 400 }}>{isRTL ? p.ar : p.en}</button>
            ))}
          </div>
          {selectedPreset === 'custom' && (
            <input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${btnBorder}`, borderRadius: 8, fontSize: 12, outline: 'none', marginBottom: 14, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', boxSizing: 'border-box' }} />
          )}
          {/* Type + Priority row */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: lblColor, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'النوع' : 'Type'}</div>
              <select value={taskType} onChange={e => setTaskType(e.target.value)} style={{ width: '100%', padding: '7px 10px', border: `1px solid ${btnBorder}`, borderRadius: 8, fontSize: 12, background: isDark ? '#0F1E2D' : '#fff', color: isDark ? '#E2EAF4' : '#1A2B3C', outline: 'none', cursor: 'pointer' }}>
                {taskTypes.map(t => <option key={t.value} value={t.value}>{isRTL ? t.ar : t.en}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: lblColor, fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'الأولوية' : 'Priority'}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {priorities.map(p => (
                  <button key={p.value} onClick={() => setPriority(p.value)} style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: priority === p.value ? 700 : 400, cursor: 'pointer', fontFamily: 'inherit',
                    background: priority === p.value ? p.color + '18' : 'transparent',
                    border: `1px solid ${priority === p.value ? p.color : btnBorder}`,
                    color: priority === p.value ? p.color : (isDark ? '#8BA8C8' : '#6B7280'),
                  }}>{isRTL ? p.ar : p.en}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0'}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${btnBorder}`, background: isDark ? '#152232' : '#F8FAFC', fontSize: 13, color: isDark ? '#8BA8C8' : '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: (selectedPreset && (selectedPreset !== 'custom' || customDate)) ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.3)', fontSize: 13, color: '#fff', fontWeight: 700, cursor: (selectedPreset && (selectedPreset !== 'custom' || customDate)) ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? '...' : (isRTL ? 'إنشاء مهمة' : 'Create Task')}</button>
        </div>
      </div>
    </div>
  );
}

function BlacklistModal({ contact, onClose, onConfirm }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  useEscClose(onClose);
  const [reason, setReason] = useState('');
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ background: isDark ? '#1a2234' : '#ffffff', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Ban size={24} color="#EF4444" />
          </div>
          <h3 style={{ color: isDark ? '#E2EAF4' : '#1A2B3C', margin: '0 0 6px', fontSize: 16 }}>{isRTL ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}</h3>
          <p style={{ color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13, margin: 0 }}>{isRTL ? 'سيتم منع هذا الرقم من الإضافة مستقبلاً' : 'This number will be blocked from future additions'}</p>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: isDark ? '#E2EAF4' : '#1A2B3C' }}>
          {contact?.full_name} — {contact?.phone}
        </div>
        <label style={{ display: 'block', color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, marginBottom: 8 }}>{isRTL ? 'سبب الإضافة' : 'Reason'} <span style={{ color: '#EF4444' }}>*</span></label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder={isRTL ? 'مثال: سلوك مسيء، احتيال، رقم خاطئ متكرر...' : 'e.g. Abusive behavior, fraud, repeated wrong number...'}
          style={{ width: '100%', background: isDark ? '#0F1E2D' : '#ffffff', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={() => { if (reason.trim()) { onConfirm(contact, reason); onClose(); } }}
            style={{ padding: '9px 18px', background: reason.trim() ? 'linear-gradient(135deg,#7f1d1d,#EF4444)' : 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>
            {isRTL ? 'تأكيد الإضافة' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Activity Form ─────────────────────────────────────────────────────────
function ActivityForm({ contactId, onSave, onCancel }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
  const inp = { background: isDark ? '#0F1E2D' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : '#d1d5db'}`, borderRadius: 8, padding: '8px 12px', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };

  // Auto timestamp
  const now = new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSave = () => {
    onSave({ ...form, created_at: new Date().toISOString() });
  };

  return (
    <div style={{ background: 'rgba(74,122,171,0.07)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      {/* Auto timestamp - read only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 10px', background: 'rgba(74,122,171,0.08)', borderRadius: 6 }}>
        <Clock size={11} color={isDark ? '#6B8DB5' : '#6b7280'} />
        <span style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#6b7280' }}>{now}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
          {activityTypes.map(v => (
            <option key={v.key} value={v.key}>{isRTL ? (v.labelAr || v.label) : v.label}</option>
          ))}
        </select>
        <input style={inp} type="date" value={form.next_action_date} onChange={e => set('next_action_date', e.target.value)}
          placeholder={isRTL ? 'تاريخ المتابعة' : 'Follow-up date'} />
      </div>
      <textarea style={{ ...inp, resize: 'vertical', marginBottom: 10 }} rows={2}
        placeholder={isRTL ? 'وصف النشاط...' : 'Activity description...'}
        value={form.description} onChange={e => set('description', e.target.value)} />
      <input style={{ ...inp, marginBottom: 12 }}
        placeholder={isRTL ? 'الإجراء التالي (اختياري)...' : 'Next action (optional)...'}
        value={form.next_action} onChange={e => set('next_action', e.target.value)} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 6, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 12, cursor: 'pointer' }}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </button>
        <button onClick={handleSave} style={{ padding: '6px 16px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {isRTL ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Contact Drawer ─────────────────────────────────────────────────────────

function EditContactModal({ contact, onClose, onSave }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
    }
    setSaving(false);
  };

  const inp = { background: isDark ? '#0F1E2D' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : '#d1d5db'}`, borderRadius: 8, padding: '9px 12px', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const sel = { ...inp, cursor: 'pointer' };
  const lbl = { fontSize: 12, color: isDark ? '#8BA8C8' : '#64748B', marginBottom: 4, display: 'block' };
  const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="modal-content" style={{ background: isDark ? '#1a2234' : '#ffffff', border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`, borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 17, fontWeight: 700 }}>{isRTL ? 'تعديل بيانات جهة الاتصال' : 'Edit Contact'}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: isDark ? '#8BA8C8' : '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>{contact.full_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: isDark ? '#8BA8C8' : '#64748B', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* الاسم والـ prefix */}
          <div>
            <label style={lbl}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
              <select value={form.prefix} onChange={e => set('prefix', e.target.value)} style={sel}>
                <option value="">{isRTL ? 'اللقب' : 'Prefix'}</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Dr.">Dr.</option>
                <option value="Eng.">Eng.</option>
                <option value="أستاذ">أستاذ</option>
              </select>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inp} placeholder={isRTL ? 'الاسم الكامل...' : 'Full name...'} />
            </div>
          </div>

          {/* النوع والقسم */}
          <div style={row}>
            <div>
              <label style={lbl}>{isRTL ? 'النوع' : 'Type'}</label>
              <select value={form.contact_type} onChange={e => set('contact_type', e.target.value)} style={sel}>
                <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
                <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
                <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
                <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
                <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
                <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
                <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
              </select>
            </div>
            <div>
              <label style={lbl}>{isRTL ? 'القسم' : 'Department'}</label>
              <select value={form.department} onChange={e => set('department', e.target.value)} style={sel}>
                <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
                <option value="hr">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
                <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
                <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
                <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
              </select>
            </div>
          </div>

          {/* الهاتف والإيميل */}
          <div style={row}>
            <div>
              <label style={lbl}>{isRTL ? 'رقم الهاتف' : 'Phone'} <span style={{ color: '#EF4444' }}>*</span></label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} placeholder="010xxxxxxxx" />
            </div>
            <div>
              <label style={lbl}>{isRTL ? 'هاتف 2' : 'Phone 2'}</label>
              <input value={form.phone2} onChange={e => set('phone2', e.target.value)} style={inp} placeholder="011xxxxxxxx" />
            </div>
          </div>

          <div>
            <label style={lbl}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} style={inp} placeholder="email@domain.com" />
          </div>

          {/* الشركة والمسمى */}
          <div style={row}>
            <div>
              <label style={lbl}>{isRTL ? 'الشركة' : 'Company'}</label>
              <input value={form.company} onChange={e => set('company', e.target.value)} style={inp} placeholder={isRTL ? 'اسم الشركة...' : 'Company name...'} />
            </div>
            <div>
              <label style={lbl}>{isRTL ? 'المسمى الوظيفي' : 'Job Title'}</label>
              <input value={form.job_title} onChange={e => set('job_title', e.target.value)} style={inp} placeholder={isRTL ? 'مدير / مهندس...' : 'Manager / Engineer...'} />
            </div>
          </div>

          {/* المصدر — للـ sales types فقط */}
          {isSalesType && (
            <div style={row}>
              <div>
                <label style={lbl}>{isRTL ? 'المصدر' : 'Source'}</label>
                <select value={form.source} onChange={e => set('source', e.target.value)} style={sel}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{isRTL ? 'الميزانية (من - إلى)' : 'Budget (min - max)'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <input value={form.budget_min} onChange={e => set('budget_min', e.target.value)} style={inp} placeholder={isRTL ? 'من' : 'Min'} type="number" />
                  <input value={form.budget_max} onChange={e => set('budget_max', e.target.value)} style={inp} placeholder={isRTL ? 'إلى' : 'Max'} type="number" />
                </div>
              </div>
            </div>
          )}

          {/* الجنس والجنسية */}
          <div style={row}>
            <div>
              <label style={lbl}>{isRTL ? 'الجنس' : 'Gender'}</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)} style={sel}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="male">{isRTL ? 'ذكر' : 'Male'}</option>
                <option value="female">{isRTL ? 'أنثى' : 'Female'}</option>
              </select>
            </div>
            <div>
              <label style={lbl}>{isRTL ? 'الجنسية' : 'Nationality'}</label>
              <select value={form.nationality} onChange={e => set('nationality', e.target.value)} style={sel}>
                <option value="">{isRTL ? 'اختر...' : 'Select...'}</option>
                <option value="egyptian">{isRTL ? 'مصري' : 'Egyptian'}</option>
                <option value="saudi">{isRTL ? 'سعودي' : 'Saudi'}</option>
                <option value="emirati">{isRTL ? 'إماراتي' : 'Emirati'}</option>
                <option value="kuwaiti">{isRTL ? 'كويتي' : 'Kuwaiti'}</option>
                <option value="qatari">{isRTL ? 'قطري' : 'Qatari'}</option>
                <option value="libyan">{isRTL ? 'ليبي' : 'Libyan'}</option>
                <option value="other">{isRTL ? 'أخرى' : 'Other'}</option>
              </select>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label style={lbl}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder={isRTL ? 'أي ملاحظات...' : 'Any notes...'} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`, borderRadius: 8, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '9px 24px', background: saving ? '#2B4C6F' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? (isRTL ? 'جارى الحفظ...' : 'Saving...') : (isRTL ? 'حفظ التعديلات' : 'Save Changes')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContactDrawer({ contact, onClose, onBlacklist, onUpdate, onAddOpportunity }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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

  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(74,122,171,0.08)', fontSize: 13 };

  return (
    <>
    {showEdit && <EditContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={async (updated) => { onUpdate(updated); setShowEdit(false); }} />}
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', direction: isRTL ? 'rtl' : 'ltr' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.45)' }} />
      <div className="contact-drawer" style={{ width: 430, background: isDark ? '#0F1E2D' : '#ffffff', [`border${isRTL ? 'Left' : 'Right'}`]: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`, display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

        {/* Drawer Header */}
        <div style={{ padding: '20px 20px 0', background: isDark ? 'linear-gradient(180deg, #1B3347 0%, #0F1E2D 100%)' : 'linear-gradient(180deg, #f0f4f8 0%, #ffffff 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                background: contact.is_blacklisted ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: contact.is_blacklisted ? '#EF4444' : '#fff',
              }}>
                {contact.is_blacklisted ? <Ban size={18} /> : initials(contact.full_name)}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: contact.is_blacklisted ? '#EF4444' : (isDark ? '#E2EAF4' : '#1A2B3C'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>
                  {contact.prefix ? <span style={{ color: isDark ? '#6B8DB5' : '#6b7280', [`margin${isRTL ? 'Left' : 'Right'}`]: 4 }}>{contact.prefix}</span> : null}{contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
                </div>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {tp && <Chip label={isRTL ? tp.label : tp.labelEn} color={tp.color} bg={tp.bg} />}
                  {contact.department && <Chip label={(isRTL ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' } : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' })[contact.department] || contact.department} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />}
                  {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setShowEdit(true)} style={{ background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 6, color: '#4A7AAB', cursor: 'pointer', padding: '4px 10px', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Pencil size={12} /> {isRTL ? 'تعديل' : 'Edit'}
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: isDark ? '#8BA8C8' : '#64748B', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <a href={`tel:${contact.phone}`} style={{ flex: 1, padding: '8px 0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, color: '#10B981', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Phone size={13} /> {isRTL ? 'اتصال' : 'Call'}
            </a>
            <a href={`https://wa.me/${normalizePhone(contact.phone).replace('+', '')}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '8px 0', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, color: '#25D366', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <MessageCircle size={13} /> {isRTL ? 'واتساب' : 'WhatsApp'}
            </a>
            {contact.email && (
              <a href={`mailto:${contact.email}`} style={{ flex: 1, padding: '8px 0', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, color: isDark ? '#6B8DB5' : '#6b7280', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Mail size={13} /> {isRTL ? 'إيميل' : 'Email'}
              </a>
            )}
            {!contact.is_blacklisted && (
              <button onClick={() => onBlacklist(contact)} style={{ flex: 1, padding: '8px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Ban size={13} /> {isRTL ? 'بلاك' : 'Block'}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}` }}>
            {tabs.map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #4A7AAB' : '2px solid transparent', color: tab === k ? '#4A7AAB' : (isDark ? '#8BA8C8' : '#64748B'), fontSize: 12, fontWeight: tab === k ? 700 : 400, cursor: 'pointer' }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Drawer Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

          {/* INFO TAB */}
          {tab === 'info' && (
            <div>
              {/* Score + Temp Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'rgba(74,122,171,0.07)', borderRadius: 10, padding: 12, border: '1px solid rgba(74,122,171,0.12)' }}>
                  <div style={{ color: isDark ? '#8BA8C8' : '#64748B', fontSize: 11, marginBottom: 8 }}>{isRTL ? 'نقاط التقييم' : 'Lead Score'}</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div style={{ background: tempInfo?.bg, borderRadius: 10, padding: 12, border: `1px solid ${tempInfo?.color || 'transparent'}30` }}>
                  <div style={{ color: isDark ? '#8BA8C8' : '#64748B', fontSize: 11, marginBottom: 4 }}>{isRTL ? 'الحرارة' : 'Temperature'}</div>
                  {tempInfo?.Icon && <div style={{ display:'flex', alignItems:'center', gap:6 }}><tempInfo.Icon size={14} color={tempInfo.color} /><span style={{ color: tempInfo?.color, fontWeight: 700, fontSize: 14 }}>{isRTL ? tempInfo?.labelAr : tempInfo?.label}</span></div>}
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
                { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: (() => { const d = daysSince(contact.last_activity_at); return d === 0 ? (isRTL ? 'اليوم' : 'Today') : isRTL ? `منذ ${d} يوم` : `${d} days ago`; })() },
                { label: isRTL ? 'تاريخ الإنشاء' : 'Created', val: contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'تاريخ التوزيع' : 'Assigned Date', val: contact.assigned_at ? new Date(contact.assigned_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—' },
                { label: isRTL ? 'الشركة' : 'Company', val: contact.company || '—' },
                { label: isRTL ? 'المسمى الوظيفي' : 'Job Title', val: contact.job_title || '—' },
                { label: isRTL ? 'الجنس' : 'Gender', val: contact.gender ? ((isRTL ? { male: 'ذكر', female: 'أنثى' } : { male: 'Male', female: 'Female' })[contact.gender] || contact.gender) : '—' },
                { label: isRTL ? 'الجنسية' : 'Nationality', val: contact.nationality ? ((isRTL ? { egyptian: 'مصري', saudi: 'سعودي', emirati: 'إماراتي', kuwaiti: 'كويتي', qatari: 'قطري', libyan: 'ليبي', other: 'أخرى' } : { egyptian: 'Egyptian', saudi: 'Saudi', emirati: 'Emirati', kuwaiti: 'Kuwaiti', qatari: 'Qatari', libyan: 'Libyan', other: 'Other' })[contact.nationality] || contact.nationality) : '—' },
                { label: isRTL ? 'تاريخ الميلاد' : 'Birth Date', val: contact.birth_date || '—' },
              ].map(r => (
              <div key={r.label} style={rowStyle}>
                <span style={{ color: isDark ? '#8BA8C8' : '#64748B' }}>{r.label}</span>
                <span style={{ color: isDark ? '#E2EAF4' : '#1A2B3C', fontWeight: 500, maxWidth: '55%', textAlign: isRTL ? 'left' : 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.val}</span>
              </div>
              ))}
              {contact.notes && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, fontSize: 12, color: isDark ? '#8BA8C8' : '#64748B' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af' }}>{isRTL ? 'ملاحظات' : 'Notes'}</div>
                  {contact.notes}
                </div>
              )}

              {contact.stage && (
                <div style={rowStyle}>
                  <span style={{ color: isDark ? '#8BA8C8' : '#64748B' }}>{isRTL ? 'المرحلة' : 'Stage'}</span>
                  <Chip label={stageLabel(contact.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                </div>
              )}
              {contact.cold_status && (
                <div style={rowStyle}>
                  <span style={{ color: isDark ? '#8BA8C8' : '#64748B' }}>{isRTL ? 'حالة الكولد' : 'Cold Status'}</span>
                  <Chip label={coldLabel(contact.cold_status, isRTL)} color="#6B8DB5" bg="rgba(107,141,181,0.1)" />
                </div>
              )}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#EF4444', display:'flex', gap:6, alignItems:'flex-start' }}>
                  <Ban size={13} style={{ flexShrink: 0, marginTop: 2 }} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}</span>
                </div>
              )}
              {contact.contact_type === 'supplier' && (
                <button style={{ width: '100%', marginTop: 12, padding: '10px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, color: '#4A7AAB', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <span>+</span> {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              )}
            </div>
          )}

          {/* INVOICES TAB */}
          {tab === 'invoices' && (
            <div>
              <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#8BA8C8' : '#64748B' }}>
                <FileDown size={32} style={{ marginBottom: 12, opacity: 0.4, color: isDark ? '#8BA8C8' : '#64748B' }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#E2EAF4' : '#1A2B3C' }}>{isRTL ? 'لا توجد فواتير بعد' : 'No invoices yet'}</p>
                <p style={{ margin: '6px 0 16px', fontSize: 12 }}>{isRTL ? 'أضف فاتورة لهذا المورد' : 'Add an invoice for this supplier'}</p>
                <button style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + {isRTL ? 'إضافة فاتورة' : 'Add Invoice'}
                </button>
              </div>
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {tab === 'activities' && (
            <div>
              {!showActivityForm && (
                <button onClick={() => setShowActivityForm(true)} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
                  {isRTL ? '+ إضافة نشاط' : '+ Add Activity'}
                </button>
              )}
              {showActivityForm && <ActivityForm contactId={contact.id} onSave={handleSaveActivity} onCancel={() => setShowActivityForm(false)} />}

              {loadingActs ? (
                <div style={{ textAlign: 'center', padding: 30, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13 }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#8BA8C8' : '#64748B' }}>
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد أنشطة بعد' : 'No activities yet'}</p>
                </div>
              ) : activities.map(act => {
                const actIcon = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: Clock, site_visit: Star }[act.type];
                const ActIcon = actIcon || Clock;
                return (
                <div key={act.id} style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: 13, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(74,122,171,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <ActIcon size={13} color="#4A7AAB" />
                      </div>
                      <span style={{ color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 13, fontWeight: 600 }}>{act.description}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: isDark ? '#8BA8C8' : '#64748B' }}>
                    <span>{isRTL ? (act.users?.full_name_ar || 'مجهول') : (act.users?.full_name_en || act.users?.full_name_ar || 'Unknown')}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                  {act.next_action && (
                    <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(74,122,171,0.08)', borderRadius: 6, fontSize: 11, color: isDark ? '#6B8DB5' : '#6b7280' }}>
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
              <button onClick={() => setAddTaskForm(f => !f)} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
                {addTaskForm ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? '+ مهمة جديدة' : '+ New Task')}
              </button>

              {addTaskForm && (
                <div style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input value={newTask.title} onChange={e => setNewTask(f => ({...f, title: e.target.value}))}
                      placeholder={isRTL ? 'عنوان المهمة...' : 'Task title...'}
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: isDark ? 'rgba(15,30,45,0.6)' : '#f8fafc', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 12, outline: 'none', direction: isRTL ? 'rtl' : 'ltr' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={newTask.type} onChange={e => setNewTask(f => ({...f, type: e.target.value}))}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: isDark ? 'rgba(15,30,45,0.6)' : '#f8fafc', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 11, outline: 'none' }}>
                        {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                      <select value={newTask.priority} onChange={e => setNewTask(f => ({...f, priority: e.target.value}))}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: isDark ? 'rgba(15,30,45,0.6)' : '#f8fafc', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 11, outline: 'none' }}>
                        {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    </div>
                    <input type="datetime-local" value={newTask.due_date} onChange={e => setNewTask(f => ({...f, due_date: e.target.value}))}
                      style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: isDark ? 'rgba(15,30,45,0.6)' : '#f8fafc', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 11, outline: 'none' }} />
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
                      style={{ padding: '7px', borderRadius: 7, border: 'none', background: '#2B4C6F', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingTask || !newTask.title.trim() || !newTask.due_date ? 0.5 : 1 }}>
                      {savingTask ? '...' : (isRTL ? 'حفظ' : 'Save')}
                    </button>
                  </div>
                </div>
              )}

              {loadingTasks ? (
                <div style={{ textAlign: 'center', padding: 30, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13 }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#8BA8C8' : '#64748B' }}>
                  <CheckSquare size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد مهام مرتبطة' : 'No tasks linked'}</p>
                </div>
              ) : tasks.map(task => {
                const pri = TASK_PRIORITIES[task.priority];
                const typ = TASK_TYPES[task.type];
                const st  = TASK_STATUSES[task.status];
                const due = new Date(task.due_date);
                const overdue = due < new Date() && task.status !== 'done';
                return (
                  <div key={task.id} style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#E2EAF4' : '#1A2B3C', marginBottom: 4, textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, background: (pri?.color || '#4A7AAB') + '22', color: pri?.color || '#4A7AAB', fontWeight: 600 }}>
                            {isRTL ? pri?.ar : pri?.en}
                          </span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, background: (st?.color || '#4A7AAB') + '22', color: st?.color || '#4A7AAB' }}>
                            {isRTL ? st?.ar : st?.en}
                          </span>
                          <span style={{ fontSize: 10, color: overdue ? '#EF4444' : (isDark ? '#8BA8C8' : '#64748B'), display: 'flex', alignItems: 'center', gap: 2 }}>
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
              <button onClick={()=>setShowOppModal(true)} style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14, fontFamily:'inherit' }}>
                {isRTL ? '+ فتح فرصة جديدة' : '+ New Opportunity'}
              </button>
              {showOppModal && (
                <div onClick={()=>setShowOppModal(false)} style={{ position:'fixed', inset:0, zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'rgba(0,0,0,0.6)' }}>
                  <div dir={isRTL ? 'rtl' : 'ltr'} onClick={e=>e.stopPropagation()} className="modal-content" style={{ background: isDark ? '#1a2234' : '#ffffff', borderRadius:14, padding:24, width:'100%', maxWidth:420, border:`1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#d1d5db'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                      <h3 style={{ margin:0, color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize:15, fontWeight:700 }}>{isRTL?'فرصة جديدة - ':'New Opportunity - '}{contact.full_name}</h3>
                      <button onClick={()=>setShowOppModal(false)} style={{ background:'none', border:'none', color: isDark ? '#8BA8C8' : '#64748B', cursor:'pointer', fontSize:18 }}>✕</button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      {[
                        { key:'project', label_ar:'المشروع', label_en:'Project', type:'text' },
                        { key:'budget',  label_ar:'الميزانية', label_en:'Budget', type:'number' },
                        { key:'notes',   label_ar:'ملاحظات', label_en:'Notes', type:'text' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize:12, color: isDark ? '#8BA8C8' : '#64748B', display:'block', marginBottom:4, textAlign:isRTL?'right':'left' }}>{isRTL?f.label_ar:f.label_en}</label>
                          <input type={f.type} value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#d1d5db'}`, background: isDark ? '#0F1E2D' : '#ffffff', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize:13, outline:'none', boxSizing:'border-box', textAlign:isRTL?'right':'left', direction:isRTL?'rtl':'ltr', fontFamily:'inherit' }} />
                        </div>
                      ))}
                      {[
                        { key:'stage', label_ar:'المرحلة', label_en:'Stage', options:[{v:'new',ar:'جديد',en:'New'},{v:'contacted',ar:'تم التواصل',en:'Contacted'},{v:'interested',ar:'مهتم',en:'Interested'},{v:'negotiation',ar:'تفاوض',en:'Negotiation'},{v:'reserved',ar:'محجوز',en:'Reserved'}] },
                        { key:'temperature', label_ar:'الحرارة', label_en:'Temperature', options:[{v:'hot',ar:'ساخن',en:'Hot'},{v:'warm',ar:'دافئ',en:'Warm'},{v:'normal',ar:'عادي',en:'Normal'},{v:'cold',ar:'بارد',en:'Cold'}] },
                        { key:'priority', label_ar:'الأولوية', label_en:'Priority', options:[{v:'urgent',ar:'عاجل',en:'Urgent'},{v:'high',ar:'عالي',en:'High'},{v:'medium',ar:'متوسط',en:'Medium'},{v:'low',ar:'منخفض',en:'Low'}] },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize:12, color: isDark ? '#8BA8C8' : '#64748B', display:'block', marginBottom:4, textAlign:isRTL?'right':'left' }}>{isRTL?f.label_ar:f.label_en}</label>
                          <select value={newOpp[f.key]} onChange={e=>setNewOpp(p=>({...p,[f.key]:e.target.value}))}
                            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#d1d5db'}`, background: isDark ? '#0F1E2D' : '#ffffff', color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize:13, outline:'none', cursor:'pointer', boxSizing:'border-box', fontFamily:'inherit' }}>
                            {f.options.map(o=><option key={o.v} value={o.v}>{isRTL?o.ar:o.en}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:'flex', gap:10, marginTop:20 }}>
                      <button onClick={()=>{ if (!newOpp.project.trim()) { toast.warning(isRTL ? 'اسم المشروع مطلوب' : 'Project name is required'); return; } onAddOpportunity&&onAddOpportunity({...newOpp, contactName:contact.full_name, contactId:contact.id, budget:Number(newOpp.budget)||0, lastActivityDays:0, agent:'', id:Date.now()}); setShowOppModal(false); setNewOpp({project:'',budget:'',stage:'new',temperature:'warm',priority:'medium',agent:'',notes:''}); }}
                        style={{ flex:1, padding:'10px 0', borderRadius:8, background:'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                        {isRTL?'حفظ':'Save'}
                      </button>
                      <button onClick={()=>setShowOppModal(false)} style={{ padding:'10px 16px', borderRadius:8, background:'transparent', color: isDark ? '#8BA8C8' : '#64748B', border:`1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#d1d5db'}`, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                        {isRTL?'إلغاء':'Cancel'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {loadingOpps ? (
                <div style={{ textAlign: 'center', padding: 30, color: isDark ? '#8BA8C8' : '#64748B', fontSize: 13 }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
              ) : opportunities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: isDark ? '#8BA8C8' : '#64748B' }}>
                  <Star size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد فرص مرتبطة' : 'No opportunities linked'}</p>
                </div>
              ) : opportunities.map(opp => (
                <div key={opp.id} style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: 13, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: isDark ? '#E2EAF4' : '#1A2B3C', fontSize: 13, fontWeight: 600 }}>{isRTL ? 'فرصة' : 'Opp'} #{String(opp.id).slice(-4)}</span>
                    <Chip label={stageLabel(opp.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                  </div>
                  <div style={{ fontSize: 11, color: isDark ? '#8BA8C8' : '#64748B', display: 'flex', flexDirection: 'column', gap: 3 }}>
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const toast = useToast();

  const colors = {
    cardBg: isDark ? '#152232' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text: isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    rowHover: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    thBg: isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb',
    chipBg: isDark ? 'rgba(74,122,171,0.12)' : '#f3f4f6',
    chipText: isDark ? '#8BA8C8' : '#6b7280',
    surface: isDark ? '#0F1E2D' : '#F8FAFC',
  };

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

  // Styles — theme aware
  const sel = { background: colors.inputBg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 12px', color: colors.text, fontSize: 12, outline: 'none', cursor: 'pointer' };
  const th = { fontSize: 11, color: '#6B8DB5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, padding: '11px 14px', background: colors.thBg, borderBottom: `1px solid ${colors.border}`, whiteSpace: 'nowrap', textAlign: isRTL ? 'right' : 'left' };
  const td = { padding: '13px 14px', borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle', fontSize: 13, color: colors.text, textAlign: isRTL ? 'right' : 'left' };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: colors.text }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: isDark ? '#E2EAF4' : '#1B3347' }}>{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textMuted }}>
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : 'results'}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => exportCSV(filtered)} style={{ padding: '9px 14px', background: colors.cardBg, border: '1px solid ' + colors.border, borderRadius: 8, color: colors.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> {isRTL ? 'تصدير' : 'Export'}
          </button>
          <button onClick={() => setShowImportModal(true)} style={{ padding: '9px 14px', background: colors.cardBg, border: '1px solid ' + colors.border, borderRadius: 8, color: colors.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>
          <button onClick={() => setMergeMode(m => !m)} style={{ padding: '9px 14px', background: mergeMode ? 'rgba(30,64,175,0.1)' : colors.cardBg, border: '1px solid ' + (mergeMode ? '#1E40AF' : colors.border), borderRadius: 8, color: mergeMode ? '#1E40AF' : colors.textMuted, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Merge size={14} /> {isRTL ? 'دمج' : 'Merge'}
          </button>
          {selectedIds.length > 0 && (
            <button onClick={() => { setBatchCallMode(true); setBatchCallIndex(0); setBatchCallLog([]); setBatchCallNotes(''); setBatchCallResult(''); }} style={{ padding: '9px 14px', background: 'linear-gradient(135deg,#065F46,#10B981)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PhoneCall size={14} /> {isRTL ? `اتصال جماعي (${selectedIds.length})` : `Batch Call (${selectedIds.length})`}
            </button>
          )}
          <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
          </button>
          {isAdmin && selectedIds.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowBulkMenu(v => !v)} style={{ padding: "9px 14px", background: "linear-gradient(135deg,#2B4C6F,#4A7AAB)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {isRTL ? `إجراءات (${selectedIds.length})` : `Actions (${selectedIds.length})`} ▾
              </button>
              {showBulkMenu && (
                <div style={{ position: "absolute", top: "110%", [isRTL ? 'right' : 'left']: 0, background: isDark ? '#1a2234' : '#fff', border: '1px solid ' + colors.border, borderRadius: 10, minWidth: 190, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {[
                    { label: isRTL ? "تصدير المحددين" : "Export Selected", action: () => exportCSV(contacts.filter(c => selectedIds.includes(c.id))) },
                    { label: isRTL ? "إعادة تعيين" : "Reassign", action: () => setBulkReassignModal(true) },
                    { label: isRTL ? "تغيير المرحلة" : "Change Stage", action: () => setBulkStageModal(true) },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: isDark ? '#E2EAF4' : '#4A5568', fontSize: 13, cursor: "pointer", textAlign: isRTL ? "right" : "left", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(74,122,171,0.15)"} onMouseLeave={e => e.currentTarget.style.background="none"}>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "rgba(239,68,68,0.2)", margin: "4px 0" }} />
                  <button onClick={handleDeleteSelected} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#EF4444", fontSize: 13, cursor: "pointer", textAlign: isRTL ? "right" : "left", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.1)"} onMouseLeave={e => e.currentTarget.style.background="none"}>
                    {isRTL ? "حذف المحددين" : "Delete Selected"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Type Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: isRTL ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          ...Object.entries(TYPE).filter(([k]) => stats[k] > 0).map(([k, v]) => ({
            label: isRTL ? v.label : v.labelEn, value: k, count: stats[k] || 0, color: v.color,
          })),
        ].map(s => (
          <button key={s.value} onClick={() => setFilterType(s.value)} style={{
            padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === s.value ? s.color : colors.border}`,
            background: filterType === s.value ? `${s.color}15` : colors.cardBg,
            color: filterType === s.value ? s.color : colors.textMuted, fontSize: 12, fontWeight: filterType === s.value ? 700 : 400, cursor: 'pointer',
          }}>
            {s.label} <span style={{ background: filterType === s.value ? s.color : colors.border, color: filterType === s.value ? '#fff' : colors.textMuted, borderRadius: 10, padding: '1px 7px', fontSize: 10, marginInlineStart: 4 }}>{s.count}</span>
          </button>
        ))}
        <button onClick={() => setShowBlacklisted(v => !v)} style={{
          padding: '6px 14px', borderRadius: 20, border: `1px solid ${showBlacklisted ? '#EF4444' : colors.border}`,
          background: showBlacklisted ? 'rgba(239,68,68,0.08)' : colors.cardBg,
          color: showBlacklisted ? '#EF4444' : colors.textMuted, fontSize: 12, fontWeight: showBlacklisted ? 700 : 400, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklist'} <span style={{ background: showBlacklisted ? '#EF4444' : colors.border, color: showBlacklisted ? '#fff' : colors.textMuted, borderRadius: 10, padding: '1px 7px', fontSize: 10, marginInlineStart: 4 }}>{stats.blacklisted}</span>
        </button>
        <button onClick={() => setFilterTemp(filterTemp === 'hot' ? 'all' : 'hot')} style={{
          padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterTemp === 'hot' ? '#EF4444' : colors.border}`,
          background: filterTemp === 'hot' ? 'rgba(239,68,68,0.08)' : colors.cardBg,
          color: filterTemp === 'hot' ? '#EF4444' : colors.textMuted, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Flame size={11} /> {isRTL ? 'حار فقط' : 'Hot Only'} <span style={{ background: filterTemp === 'hot' ? '#EF4444' : colors.border, color: filterTemp === 'hot' ? '#fff' : colors.textMuted, borderRadius: 10, padding: '1px 7px', fontSize: 10, marginInlineStart: 4 }}>{stats.hot}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', background: colors.thBg, padding: '10px 14px', borderRadius: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', [isRTL ? 'left' : 'right']: 10, top: '50%', transform: 'translateY(-50%)', color: isDark ? '#6B8DB5' : '#9ca3af' }} />
          <input type="text" placeholder={i18n.language === 'ar' ? 'بحث بالاسم، الهاتف، الإيميل...' : 'Search by name, phone, email...'} value={searchInput} onChange={e => setSearchInput(e.target.value)}
            style={{ ...sel, width: '100%', [`padding${isRTL ? 'Left' : 'Right'}`]: 32, boxSizing: 'border-box', background: colors.inputBg, color: colors.text, border: `1px solid ${colors.border}` }} />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v : (SOURCE_EN[k] || v)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
          <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
          <option value="cold">{isRTL ? 'كولد كول' : 'Cold Call'}</option>
          <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
          <option value="supplier">{isRTL ? 'مورد' : 'Supplier'}</option>
          <option value="developer">{isRTL ? 'مطور عقاري' : 'Developer'}</option>
          <option value="applicant">{isRTL ? 'متقدم لوظيفة' : 'Applicant'}</option>
          <option value="partner">{isRTL ? 'شريك' : 'Partner'}</option>
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل الأقسام' : 'All Depts'}</option>
          <option value="sales">{isRTL ? 'المبيعات' : 'Sales'}</option>
          <option value="hr">{isRTL ? 'HR' : 'HR'}</option>
          <option value="finance">{isRTL ? 'المالية' : 'Finance'}</option>
          <option value="marketing">{isRTL ? 'التسويق' : 'Marketing'}</option>
          <option value="operations">{isRTL ? 'العمليات' : 'Operations'}</option>
        </select>
        <select value={filterTemp} onChange={e => setFilterTemp(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل الدرجات' : 'All Temps'}</option>
          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.labelAr : v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="last_activity">{isRTL ? 'ترتيب: آخر نشاط' : 'Sort: Last Activity'}</option>
          <option value="score">{isRTL ? 'ترتيب: Lead Score' : 'Sort: Lead Score'}</option>
          <option value="name">{isRTL ? 'ترتيب: الاسم' : 'Sort: Name'}</option>
          <option value="created">{isRTL ? 'ترتيب: تاريخ الإنشاء' : 'Sort: Created Date'}</option>
          <option value="temperature">{isRTL ? 'ترتيب: الحرارة' : 'Sort: Temperature'}</option>
          <option value="stale">{isRTL ? 'ترتيب: يحتاج متابعة' : 'Sort: Needs Follow-up'}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {mergeMode && (
          <div style={{ padding: '10px 16px', background: isDark ? 'rgba(30,64,175,0.12)' : 'rgba(30,64,175,0.06)', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF' }}>
              <Merge size={14} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
              {isRTL ? `اختر جهتي اتصال للدمج (${mergeTargets.length}/2)` : `Select 2 contacts to merge (${mergeTargets.length}/2)`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {mergeTargets.length === 2 && (
                <button onClick={() => setMergePreview(mergeTargets)} style={{ padding: '5px 14px', background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {isRTL ? 'معاينة الدمج' : 'Preview Merge'}
                </button>
              )}
              <button onClick={() => { setMergeMode(false); setMergeTargets([]); }} style={{ padding: '5px 14px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textMuted, fontSize: 12, cursor: 'pointer' }}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table dir={isRTL ? 'rtl' : 'ltr'} style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{...th, width: 36, padding: '10px 8px'}}><input type="checkbox" checked={paged.length > 0 && paged.every(c => selectedIds.includes(c.id))} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} /></th>
                <th style={{...th, width: 50}}>ID</th>
                <th style={th}>{t('contacts.fullName')}</th>
                <th style={th}>{t('contacts.phone')}</th>
                <th style={th}>{t('contacts.type')}</th>
                <th style={th}>{t('contacts.temperature')}</th>
                <th style={th}>{t('contacts.source')}</th>
                <th style={th}>{t('contacts.stage')}</th>
                <th style={th}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: isDark ? '#6B8DB5' : '#9ca3af' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 0, border: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,51,71,0.08), rgba(74,122,171,0.12))', border: '1.5px dashed rgba(74,122,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: colors.text }}>{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                    <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>{isRTL ? 'جرّب البحث بكلمات مختلفة' : 'Try searching with different keywords'}</p>
                  </div>
                </td></tr>
              ) : paged.map((c) => {
                const isPinned = pinnedIds.includes(c.id);
                const isMergeSelected = mergeTargets.includes(c.id);
                return (
                <tr key={c.id}
                  onClick={() => mergeMode ? setMergeTargets(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : prev.length < 2 ? [...prev, c.id] : prev) : setSelected(c)}
                  style={{ cursor: 'pointer', background: isMergeSelected ? 'rgba(30,64,175,0.08)' : selectedIds.includes(c.id) ? 'rgba(74,122,171,0.08)' : c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent' }}
                  onMouseEnter={e => { if (!selectedIds.includes(c.id) && !isMergeSelected) e.currentTarget.style.background = colors.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isMergeSelected ? 'rgba(30,64,175,0.08)' : selectedIds.includes(c.id) ? 'rgba(74,122,171,0.08)' : c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent'; }}
                >
                  <td style={{...td, padding: '12px 8px'}} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} /></td>
                  <td style={{ ...td, fontSize: 10, color: isDark ? '#6B8DB5' : '#9ca3af', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {isPinned && <Pin size={10} color="#F59E0B" style={{ flexShrink: 0 }} />}
                      #{String(c.id).slice(-4)}
                    </div>
                  </td>
                  {/* Name */}
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : avatarColor(c.id),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: c.is_blacklisted ? '#EF4444' : '#fff',
                      }}>
                        {c.is_blacklisted ? <Ban size={14} /> : initials(c.full_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: c.is_blacklisted ? '#EF4444' : (isDark ? '#E2EAF4' : '#1A2B3C'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.full_name || (isRTL ? 'بدون اسم' : 'No Name')}</div>
                        {c.email && <div style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.email}</div>}
                        {c.last_activity_at && (() => { const d = daysSince(c.last_activity_at); return <div style={{ fontSize: 10, marginTop: 2, fontWeight: 600, color: d === 0 ? '#4A7AAB' : d <= 3 ? '#6B8DB5' : '#EF4444' }}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' أيام' : d + 'd ago')}</div>; })()}
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <PhoneCell phone={c.phone} />
                    {c.phone2 && <PhoneCell phone={c.phone2} small />}
                  </td>
                  {/* Type */}
                  <td style={td}><Chip label={isRTL ? TYPE[c.contact_type]?.label : TYPE[c.contact_type]?.labelEn} color={TYPE[c.contact_type]?.color} bg={TYPE[c.contact_type]?.bg} /></td>
                  {/* Temp */}
                  <td style={td}>
                    {(() => { const TempIcon = TEMP[c.temperature]?.Icon; return TempIcon ? <TempIcon size={15} color={TEMP[c.temperature]?.color} /> : '—'; })()}
                  </td>
                  {/* Source */}
                  <td style={td}><span style={{ fontSize: 11, background: colors.chipBg, border: '1px solid ' + colors.border, borderRadius: 6, padding: '3px 8px', color: colors.chipText }}>{isRTL ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)}</span></td>
                  {/* Stage */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    {isAdmin && c.contact_type === 'lead' ? (
                      <select value={c.stage || ''} onChange={e => handleStageChange(c.id, e.target.value)} style={{ fontSize: 11, background: 'transparent', border: '1px solid rgba(74,122,171,0.1)', borderRadius: 6, color: '#4A7AAB', padding: '3px 6px', cursor: 'pointer', outline: 'none' }}>
                        {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    ) : c.stage ? <Chip label={stageLabel(c.stage, isRTL)} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                    : c.cold_status ? <span style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af' }}>{coldLabel(c.cold_status, isRTL)}</span>
                    : <span style={{ color: isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db' }}>—</span>}
                  </td>
                  {/* Actions - Quick access buttons */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <a href={"tel:" + c.phone} title={isRTL ? "اتصال" : "Call"} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, color: '#10B981', textDecoration: 'none' }}>
                        <Phone size={12} />
                      </a>
                      <a href={`https://wa.me/${normalizePhone(c.phone).replace('+', '')}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 6, color: '#25D366', textDecoration: 'none' }}>
                        <MessageCircle size={12} />
                      </a>
                      <button onClick={() => setLogCallTarget(c)} title={isRTL ? 'تسجيل مكالمة' : 'Log Call'} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 6, color: '#4A7AAB', cursor: 'pointer' }}>
                        <PhoneCall size={12} />
                      </button>
                      <button onClick={() => setReminderTarget(c)} title={isRTL ? 'تذكير' : 'Reminder'} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, color: '#F59E0B', cursor: 'pointer' }}>
                        <Bell size={12} />
                      </button>
                      <button onClick={() => togglePin(c.id)} title={isRTL ? 'تثبيت' : 'Pin'} style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isPinned ? 'rgba(245,158,11,0.12)' : 'transparent', border: '1px solid ' + (isPinned ? 'rgba(245,158,11,0.3)' : colors.border), borderRadius: 6, color: isPinned ? '#F59E0B' : colors.textMuted, cursor: 'pointer' }}>
                        <Pin size={12} />
                      </button>
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: openMenuId === c.id ? '#4A7AAB' : 'transparent', border: '1px solid ' + (openMenuId === c.id ? '#4A7AAB' : colors.border), borderRadius: 6, color: openMenuId === c.id ? '#fff' : colors.textMuted, cursor: 'pointer' }}>
                          <MoreVertical size={12} />
                        </button>
                        {openMenuId === c.id && (
                          <div style={{ position: 'absolute', top: 30, [isRTL ? 'left' : 'right']: 0, background: isDark ? '#1a2234' : '#fff', border: `1px solid ${colors.border}`, borderRadius: 10, minWidth: 180, zIndex: 100, boxShadow: '0 8px 30px rgba(27,51,71,0.12)', overflow: 'hidden' }}>
                            <div style={{ padding: 4 }}>
                              <button onClick={() => { const hdr = isRTL ? ['الاسم','الهاتف','النوع','المصدر','الميزانية'] : ['Name','Phone','Type','Source','Budget']; const data = [hdr,[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = '\uFEFF'+data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv); a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: isDark?'#E2EAF4':'#4A5568', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.background=isDark?'rgba(74,122,171,0.1)':'#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <FileDown size={13} /> {isRTL ? 'تصدير' : 'Export'}
                              </button>
                              <button onClick={() => { handleDelete(c.id); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: isDark?'#E2EAF4':'#4A5568', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.background=isDark?'rgba(74,122,171,0.1)':'#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <Trash2 size={13} /> {isRTL ? 'حذف' : 'Delete'}
                              </button>
                            </div>
                            {!c.is_blacklisted && (<><div style={{ height: 1, background: colors.border }} /><div style={{ padding: 4 }}>
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#EF4444', fontFamily: 'inherit' }} onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.05)'} onMouseLeave={e => e.currentTarget.style.background='none'}>
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '16px 0' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${colors.border}`, background: page === 1 ? 'transparent' : colors.cardBg, color: page === 1 ? colors.textMuted : colors.text, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
              {isRTL ? 'السابق →' : '← Prev'}
            </button>
            <span style={{ fontSize: 12, color: colors.textMuted }}>
              {isRTL ? `${page} من ${totalPages}` : `${page} of ${totalPages}`}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${colors.border}`, background: page === totalPages ? 'transparent' : colors.cardBg, color: page === totalPages ? colors.textMuted : colors.text, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.5 : 1 }}>
              {isRTL ? '← التالي' : 'Next →'}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const found = contacts.find(c => c.phone === phone || c.phone2 === phone || (c.extra_phones || []).includes(phone)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => { setContacts(prev => { const next = prev.map(c => c.id === updated.id ? updated : c); localStorage.setItem('platform_contacts', JSON.stringify(next)); return next; }); setSelected(updated); try { updateContact(updated.id, updated); } catch { /* optimistic */ } }} onAddOpportunity={(opp) => { setSelected(null); }} />}
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: isDark ? '#1A2B3C' : '#fff', borderRadius: 20, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg,#065F46,#10B981)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PhoneCall size={18} color="#fff" />
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{isRTL ? 'وضع الاتصال' : 'Call Mode'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{progress}/{total}</span>
                  <button onClick={() => setBatchCallMode(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><X size={14} /></button>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{ height: 3, background: isDark ? '#2d3748' : '#e5e7eb' }}>
                <div style={{ height: '100%', background: '#10B981', width: `${(progress / total) * 100}%`, transition: 'width 0.3s' }} />
              </div>
              {/* Contact info */}
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: avatarColor(current.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                    {initials(current.full_name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: colors.text }}>{current.full_name}</div>
                    <div style={{ fontSize: 13, color: colors.textMuted, direction: 'ltr', textAlign: isRTL ? 'right' : 'left' }}>{current.phone}</div>
                    {current.company && <div style={{ fontSize: 12, color: colors.textMuted }}>{current.company}</div>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <Chip label={isRTL ? TYPE[current.contact_type]?.label : TYPE[current.contact_type]?.labelEn} color={TYPE[current.contact_type]?.color} bg={TYPE[current.contact_type]?.bg} />
                    {current.stage && <div style={{ fontSize: 10, marginTop: 4, color: '#4A7AAB' }}>{stageLabel(current.stage, isRTL)}</div>}
                  </div>
                </div>
                {/* Call button */}
                <a href={"tel:" + current.phone} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', background: 'linear-gradient(135deg,#065F46,#10B981)', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 16 }}>
                  <Phone size={16} /> {isRTL ? 'اتصل الآن' : 'Call Now'}
                </a>
                {/* Call result */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>{isRTL ? 'نتيجة المكالمة' : 'Call Result'}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { value: 'answered', label: isRTL ? 'رد' : 'Answered', color: '#10B981' },
                      { value: 'no_answer', label: isRTL ? 'لم يرد' : 'No Answer', color: '#F59E0B' },
                      { value: 'busy', label: isRTL ? 'مشغول' : 'Busy', color: '#EF4444' },
                      { value: 'interested', label: isRTL ? 'مهتم' : 'Interested', color: '#4A7AAB' },
                      { value: 'not_interested', label: isRTL ? 'غير مهتم' : 'Not Interested', color: '#6b7280' },
                    ].map(r => (
                      <button key={r.value} onClick={() => setBatchCallResult(r.value)} style={{
                        padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: batchCallResult === r.value ? 700 : 400, cursor: 'pointer',
                        background: batchCallResult === r.value ? r.color + '18' : 'transparent',
                        border: `1px solid ${batchCallResult === r.value ? r.color : colors.border}`,
                        color: batchCallResult === r.value ? r.color : colors.textMuted,
                      }}>{r.label}</button>
                    ))}
                  </div>
                </div>
                {/* Notes */}
                <textarea value={batchCallNotes} onChange={e => setBatchCallNotes(e.target.value)} placeholder={isRTL ? 'ملاحظات سريعة...' : 'Quick notes...'} rows={2}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.inputBg, color: colors.text, fontSize: 12, resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 16 }} />
                {/* Navigation */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                  <button disabled={batchCallIndex === 0} onClick={() => { setBatchCallIndex(i => i - 1); setBatchCallNotes(''); setBatchCallResult(''); }}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: 'transparent', color: batchCallIndex === 0 ? colors.textMuted : colors.text, fontSize: 12, cursor: batchCallIndex === 0 ? 'not-allowed' : 'pointer', opacity: batchCallIndex === 0 ? 0.4 : 1 }}>
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
                  }} style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div dir={isRTL ? 'rtl' : 'ltr'} style={{ background: isDark ? '#1A2B3C' : '#fff', border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><Merge size={18} color="#1E40AF" /> {isRTL ? 'معاينة الدمج' : 'Merge Preview'}</h3>
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', color: colors.textMuted, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>{isRTL ? 'الحقل' : 'Field'}</th>
                    <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', color: colors.textMuted, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>{c1.full_name}</th>
                    <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', color: colors.textMuted, fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>{c2.full_name}</th>
                    <th style={{ padding: '8px 10px', textAlign: isRTL ? 'right' : 'left', color: '#10B981', fontWeight: 600, borderBottom: `1px solid ${colors.border}` }}>{isRTL ? 'النتيجة' : 'Result'}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr key={f} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: colors.textMuted }}>{f}</td>
                      <td style={{ padding: '8px 10px', color: merged[f] === c1[f] ? '#10B981' : colors.text }}>{c1[f] || '—'}</td>
                      <td style={{ padding: '8px 10px', color: merged[f] === c2[f] && merged[f] !== c1[f] ? '#10B981' : colors.text }}>{c2[f] || '—'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#10B981' }}>{merged[f] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => { setMergePreview(null); setMergeTargets([]); setMergeMode(false); }} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textMuted, fontSize: 13, cursor: 'pointer' }}>
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={() => {
                  // Perform merge: keep c1 with merged data, remove c2
                  const updatedContacts = contacts.map(c => c.id === c1.id ? { ...c, ...merged, id: c1.id } : c).filter(c => c.id !== c2.id);
                  setContacts(updatedContacts);
                  localStorage.setItem('platform_contacts', JSON.stringify(updatedContacts));
                  toast.success(isRTL ? 'تم دمج جهتي الاتصال بنجاح' : 'Contacts merged successfully');
                  setMergePreview(null); setMergeTargets([]); setMergeMode(false); setSelectedIds([]);
                }} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#1E40AF,#3B82F6)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {isRTL ? 'تأكيد الدمج' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirm Modal */}
      {confirmAction && (
        <div dir={isRTL ? 'rtl' : 'ltr'} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="modal-content" style={{ background: isDark ? '#1A2B3C' : '#fff', border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#e5e7eb'}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 400, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: colors.text, fontSize: 16, fontWeight: 700 }}>{confirmAction.title}</h3>
            <p style={{ margin: '0 0 20px', color: colors.textMuted, fontSize: 13 }}>{confirmAction.message}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmAction(null)} style={{ padding: '9px 20px', background: 'transparent', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.textMuted, fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={confirmAction.onConfirm} style={{ padding: '9px 20px', background: 'linear-gradient(135deg,#7f1d1d,#EF4444)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Stage Modal */}
      {bulkStageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: isDark ? '#1A2B3C' : '#fff', border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: 15, fontWeight: 700 }}>{isRTL ? `تغيير المرحلة (${selectedIds.length})` : `Change Stage (${selectedIds.length})`}</h3>
              <button onClick={() => setBulkStageModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(STAGE_LABELS).map(([key, val]) => (
                <button key={key} onClick={() => handleBulkStage(key)}
                  style={{ padding: '10px 14px', background: isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.15)' : '#f0f4f8'}
                  onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb'}>
                  {isRTL ? val.ar : val.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {bulkReassignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: isDark ? '#1A2B3C' : '#fff', border: `1px solid ${colors.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: 15, fontWeight: 700 }}>{isRTL ? `إعادة تعيين (${selectedIds.length})` : `Reassign (${selectedIds.length})`}</h3>
              <button onClick={() => setBulkReassignModal(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...new Set(contacts.map(ct => ct.assigned_to_name?.trim()).filter(Boolean))].map(agent => (
                <button key={agent} onClick={() => handleBulkReassign(agent)}
                  style={{ padding: '10px 14px', background: isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb', border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 13, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.15)' : '#f0f4f8'}
                  onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb'}>
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
