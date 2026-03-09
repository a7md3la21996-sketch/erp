import { useState, useMemo, useEffect, useCallback } from 'react';
import FollowUpReminder from '../components/ui/FollowUpReminder';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Phone, MessageCircle, Mail, Plus, Upload, Download, Search, Ban, X, Clock, Star, Flame, Wind, Snowflake, Thermometer, Users, UserCheck, PhoneOff, AlertOctagon, CheckCircle2, Calendar, FileDown, MoreVertical, Bell, PhoneMissed, CheckSquare, Check, Trash2 } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, checkDuplicate,
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../services/contactsService';
import { fetchTasks, createTask, TASK_PRIORITIES, TASK_TYPES, TASK_STATUSES } from '../services/tasksService';
import ImportModal from './ImportModal';

// ── Constants ──────────────────────────────────────────────────────────────
const SOURCE_LABELS = { facebook: 'فيسبوك', instagram: 'إنستجرام', google_ads: 'جوجل أدز', website: 'الموقع', call: 'اتصال وارد', walk_in: 'زيارة مباشرة', referral: 'ترشيح', developer: 'مطور', cold_call: 'كولد كول', other: 'أخرى' };
const SOURCE_EN = { facebook: 'Facebook', instagram: 'Instagram', google_ads: 'Google Ads', website: 'Website', call: 'Inbound Call', walk_in: 'Walk-in', referral: 'Referral', developer: 'Developer', cold_call: 'Cold Call', other: 'Other' };
const STAGE_LABELS = { new: 'جديد', contacted: 'تم التواصل', interested: 'مهتم', site_visit_scheduled: 'موعد معاينة', site_visited: 'زار الموقع', negotiation: 'تفاوض', reserved: 'محجوز', contracted: 'تعاقد', closed_won: 'فوز ✓', closed_lost: 'خسارة ✗', on_hold: 'معلق' };
const COLD_LABELS = { not_contacted: 'لم يُتصل به', no_answer: 'لا يرد', not_interested: 'غير مهتم', interested: 'مهتم', wrong_number: 'رقم خاطئ', call_back_later: 'اتصل لاحقاً' };
const ACTIVITY_TYPES = { call: { label: 'مكالمة', icon: 'phone' }, whatsapp: { label: 'واتساب', icon: 'message' }, email: { label: 'إيميل', icon: 'mail' }, meeting: { label: 'اجتماع', icon: 'users' }, site_visit: { label: 'زيارة موقع', icon: 'calendar' }, note: { label: 'ملاحظة', icon: 'note' }, status_change: { label: 'تغيير حالة', icon: 'refresh' } };
const TEMP = {
  hot:  { label: 'Hot', labelAr: 'حار',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  Icon: Flame },
  warm: { label: 'Warm', labelAr: 'دافئ', color: '#F97316', bg: 'rgba(249,115,22,0.10)', Icon: Thermometer },
  cool: { label: 'Cool', labelAr: 'فاتر', color: '#8BA8C8', bg: 'rgba(139,168,200,0.10)', Icon: Wind },
  cold: { label: 'Cold', labelAr: 'بارد', color: '#4A7AAB', bg: 'rgba(74,122,171,0.10)',  Icon: Snowflake },
};
const TYPE = {
  lead:   { label: 'ليد',   labelEn: 'Lead',   color: '#4A7AAB', bg: 'rgba(74,122,171,0.12)'  },
  cold:   { label: 'كولد',  labelEn: 'Cold',   color: '#6B8DB5', bg: 'rgba(107,141,181,0.12)' },
  client: { label: 'عميل',  labelEn: 'Client', color: '#2B4C6F', bg: 'rgba(43,76,111,0.15)'   },
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
const fmtBudget = (min, max) => {
  if (!min && !max) return '—';
  const f = n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}م` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}ك` : n;
  if (min && max) return `${f(min)} – ${f(max)}`;
  return min ? `من ${f(min)}` : `حتى ${f(max)}`;
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
  const color = score >= 75 ? '#4A7AAB' : score >= 50 ? '#6B8DB5' : score >= 25 ? '#8BA8C8' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(74,122,171,0.15)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 20 }}>{score}</span>
    </div>
  );
}

// ── Phone Cell ─────────────────────────────────────────────────────────────
function PhoneCell({ phone, small = false }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!phone) return null;
  const masked = phone.slice(0, 6) + '****';
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "3px 0" }}
      onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}>
      <span style={{ fontSize: small ? 11 : 13, color: small ? "#9ca3af" : "#374151", fontFamily: "monospace", letterSpacing: revealed ? 0 : 1 }}>
        {revealed ? phone : masked}
      </span>
      {revealed && (
        <button onClick={handleCopy} style={{ padding: "2px 8px", background: copied ? "rgba(16,185,129,0.15)" : "rgba(74,122,171,0.15)", border: copied ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(74,122,171,0.3)", borderRadius: 5, color: copied ? "#10B981" : "#6B8DB5", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {copied ? "✓ copied" : "copy"}
        </button>
      )}
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────
function AddContactModal({ onClose, onSave, checkDup, onOpenOpportunity }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: '', phone: '', phone2: '', email: '',
    contact_type: 'lead', source: 'facebook', campaign_name: '',
    budget_min: '', budget_max: '', preferred_location: '',
    interested_in_type: 'residential', notes: '',
  });
  const [dupWarning, setDupWarning] = useState(null);
  const [extraPhones, setExtraPhones] = useState([]);
  const [extraDups, setExtraDups] = useState([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const checkPhone = async () => {
    if (!form.phone || form.phone.length < 10) return;
    setChecking(true);
    try {
      const dup = await checkDup(form.phone);
      setDupWarning(dup || null);
    } catch { setDupWarning(null); }
    setChecking(false);
  };

  const handleSave = async () => {
    if (!form.phone || !validatePhone(form.phone)) { alert(isRTL ? 'رقم الهاتف الأساسي غير صحيح' : 'Invalid primary phone number'); return; }
    const invalidExtra = extraPhones.find(p => p && !validatePhone(p));
    if (invalidExtra) { alert(isRTL ? `الرقم ${invalidExtra} غير صحيح` : `Invalid number: ${invalidExtra}`); return; }
    setSaving(true);
    try {
      await onSave({
        ...form,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
      });
      onClose();
    } catch (err) {
      alert((isRTL ? 'خطأ في الحفظ: ' : 'Save error: ') + err.message);
    }
    setSaving(false);
  };

  const inp = { background: '#0F1E2D', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, padding: '9px 12px', color: '#E2EAF4', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const sel = { ...inp, cursor: 'pointer' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#1A2B3C', border: '1px solid rgba(74,122,171,0.3)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(74,122,171,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: '#E2EAF4', fontSize: 17, fontWeight: 700 }}>{i18n.language === 'ar' ? 'إضافة جهة اتصال' : 'Add Contact'}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#8BA8C8' }}>{isRTL ? `الخطوة ${step} من 2` : `Step ${step} of 2`}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8BA8C8', cursor: 'pointer', fontSize: 18 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {step === 1 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الاسم الكامل' : 'Full Name'}</label>
                <input style={inp} placeholder="محمد أحمد..." value={form.full_name} onChange={e => set('full_name', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'رقم الهاتف' : 'Phone'} <span style={{ color: '#EF4444' }}>*</span> {(() => { const v = form.phone; return (<>{v && !validatePhone(v) && <span style={{ fontSize: 11, color: '#F97316' }}>⚠️ {isRTL ? 'رقم غير صحيح' : 'Invalid number'}</span>}{v && validatePhone(v) && (() => { const info = getPhoneInfo(v); return info ? <span style={{ fontSize: 12, color: '#10B981' }}>{info.flag} {info.country} — {info.formatted}</span> : null; })()}</>); })()}</label>
                <input style={{ ...inp, borderColor: dupWarning ? '#EF4444' : 'rgba(74,122,171,0.25)' }}
                  placeholder="010xxxxxxxx" value={form.phone}
                  onChange={e => { const v = e.target.value.replace(/[^0-9+]/g, ''); set('phone', v); setDupWarning(null); if (validatePhone(v)) { checkDup(v).then(dup => setDupWarning(dup || null)).catch(() => {}); } }} />
                {checking && <p style={{ fontSize: 11, color: '#8BA8C8', margin: '4px 0 0' }}>{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div style={{ marginTop: 8, padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 12 }}>
                    <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 8 }}>⚠️ {isRTL ? 'هذا الرقم مسجل باسم' : 'This number belongs to'}: <strong>{dupWarning.full_name}</strong> <span style={{ fontSize: 11, color: '#6B8DB5', fontFamily: 'monospace' }}>— ID: {dupWarning.id}</span></div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { onOpenOpportunity(dupWarning); onClose(); }}
                        style={{ flex: 1, padding: '8px 12px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        ✨ {isRTL ? 'فتح فرصة جديدة لـ ' + dupWarning.full_name : 'New opportunity for ' + dupWarning.full_name}
                      </button>
                      <button onClick={onClose}
                        style={{ padding: '8px 12px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: '#8BA8C8', fontSize: 12, cursor: 'pointer' }}>
                        {isRTL ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 8 }}>{isRTL ? 'أرقام إضافية' : 'Additional Phones'}</label>
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
                        <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 4 }}>⚠️ {isRTL ? 'مسجل باسم' : 'Registered to'}: <strong>{extraDups[i].full_name}</strong> <span style={{ color: '#6B8DB5', fontFamily: 'monospace', fontSize: 11 }}>ID: {extraDups[i].id}</span></div>
                        <button type="button" onClick={() => { onOpenOpportunity(extraDups[i]); onClose(); }}
                          style={{ width: '100%', padding: '6px 10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          ✨ {isRTL ? 'فتح فرصة جديدة' : 'New Opportunity'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => { setExtraPhones([...extraPhones, '']); setExtraDups([...extraDups, null]); }}
                  style={{ padding: '6px 14px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, color: '#6B8DB5', fontSize: 12, cursor: 'pointer' }}>
                  + {isRTL ? 'إضافة رقم' : 'Add Phone'}
                </button>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</label>
                <input style={inp} type="email" placeholder="email@domain.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'النوع' : 'Type'}</label>
                <select style={sel} value={form.contact_type} onChange={e => set('contact_type', e.target.value)}>
                  <option value="lead">{isRTL ? 'ليد' : 'Lead'}</option>
                  <option value="cold">{isRTL ? 'كولد' : 'Cold'} كول</option>
                  <option value="client">{isRTL ? 'عميل' : 'Client'}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'المصدر' : 'Source'}</label>
                <select style={sel} value={form.source} onChange={e => set('source', e.target.value)}>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'اسم الحملة' : 'Campaign'}</label>
                <input style={inp} placeholder="مثال: حملة الشيخ زايد Q1" value={form.campaign_name} onChange={e => set('campaign_name', e.target.value)} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ميزانية من' : 'Budget From (EGP)'}</label>
                <input style={inp} type="number" placeholder="1500000" value={form.budget_min} onChange={e => set('budget_min', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ميزانية إلى' : 'Budget To (EGP)'}</label>
                <input style={inp} type="number" placeholder="3000000" value={form.budget_max} onChange={e => set('budget_max', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'الموقع المفضل' : 'Preferred Location'}</label>
                <input style={inp} placeholder="الشيخ زايد، التجمع..." value={form.preferred_location} onChange={e => set('preferred_location', e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'نوع العقار' : 'Property Type'}</label>
                <select style={sel} value={form.interested_in_type} onChange={e => set('interested_in_type', e.target.value)}>
                  <option value="residential">{isRTL ? 'سكني' : 'Residential'}</option>
                  <option value="commercial">{isRTL ? 'تجاري' : 'Commercial'}</option>
                  <option value="administrative">{isRTL ? 'إداري' : 'Administrative'}</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'ملاحظات' : 'Notes'}</label>
                <textarea style={{ ...inp, resize: 'vertical' }} rows={4} placeholder={isRTL ? "ملاحظات إضافية..." : "Additional notes..."} value={form.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(74,122,171,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: '#8BA8C8', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && <button onClick={() => setStep(1)} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: '#6B8DB5', fontSize: 13, cursor: 'pointer' }}>{isRTL ? '← السابق' : '← Back'}</button>}
            {step === 1
              ? <button onClick={() => setStep(2)} disabled={!validatePhone(form.phone) || !!dupWarning} style={{ padding: '9px 22px', background: (validatePhone(form.phone) && !dupWarning) ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.3)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: form.phone ? 'pointer' : 'not-allowed' }}>{isRTL ? 'التالي →' : 'Next →'}</button>
              : <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ' : 'Save')}</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Blacklist Modal ────────────────────────────────────────────────────────
function BlacklistModal({ contact, onClose, onConfirm }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [reason, setReason] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#1A2B3C', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Ban size={24} color="#EF4444" />
          </div>
          <h3 style={{ color: '#E2EAF4', margin: '0 0 6px', fontSize: 16 }}>{isRTL ? 'إضافة للقائمة السوداء' : 'Add to Blacklist'}</h3>
          <p style={{ color: '#8BA8C8', fontSize: 13, margin: 0 }}>{isRTL ? 'سيتم منع هذا الرقم من الإضافة مستقبلاً' : 'This number will be blocked from future additions'}</p>
        </div>
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#E2EAF4' }}>
          {contact?.full_name} — {contact?.phone}
        </div>
        <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 8 }}>{isRTL ? 'سبب الإضافة' : 'Reason'} <span style={{ color: '#EF4444' }}>*</span></label>
        <input type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="مثال: سلوك مسيء، احتيال، رقم خاطئ متكرر..."
          style={{ width: '100%', background: '#0F1E2D', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', color: '#E2EAF4', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 8, color: '#8BA8C8', fontSize: 13, cursor: 'pointer' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
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
  const inp = { background: '#0F1E2D', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, padding: '8px 12px', color: '#E2EAF4', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };

  // Auto timestamp
  const now = new Date().toLocaleString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSave = () => {
    onSave({ ...form, created_at: new Date().toISOString() });
  };

  return (
    <div style={{ background: 'rgba(74,122,171,0.07)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
      {/* Auto timestamp - read only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '5px 10px', background: 'rgba(74,122,171,0.08)', borderRadius: 6 }}>
        <Clock size={11} color="#6B8DB5" />
        <span style={{ fontSize: 11, color: '#6B8DB5' }}>{now}</span>
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
        <button onClick={onCancel} style={{ padding: '6px 14px', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.2)', borderRadius: 6, color: '#8BA8C8', fontSize: 12, cursor: 'pointer' }}>
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
function ContactDrawer({ contact, onClose, onBlacklist, onUpdate }) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [tab, setTab] = useState('info');
  const [activities, setActivities] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [addTaskForm, setAddTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', type: 'followup', priority: 'medium', due_date: '', notes: '' });
  const [savingTask, setSavingTask] = useState(false);
  const [loadingActs, setLoadingActs] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  useEffect(() => {
    if (tab === 'activities') {
      setLoadingActs(true);
      fetchContactActivities(contact.id)
        .then(data => setActivities(data))
        .catch(() => setActivities([]))
        .finally(() => setLoadingActs(false));
    }
    if (tab === 'tasks') {
      fetchTasks({ contactId: contact.id })
        .then(data => setTasks(data))
        .catch(() => setTasks([]));
    }
    if (tab === 'opportunities') {
      fetchContactOpportunities(contact.id)
        .then(data => setOpportunities(data))
        .catch(() => setOpportunities([]));
    }
  }, [tab, contact.id]);

  const handleSaveActivity = async (form) => {
    try {
      const { user_id, ...formData } = form;
      const act = await createActivity({ ...formData, contact_id: contact.id });
      setActivities(prev => [act, ...prev]);
      setShowActivityForm(false);
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  if (!contact) return null;
  const t = TEMP[contact.temperature];
  const tp = TYPE[contact.contact_type];

  const tabs = [['info', isRTL ? 'البيانات' : 'Info'], ['activities', isRTL ? 'الأنشطة' : 'Activities'], ['opportunities', isRTL ? 'الفرص' : 'Opportunities'], ['tasks', isRTL ? 'المهام' : 'Tasks']];

  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(74,122,171,0.08)', fontSize: 13 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', direction: 'rtl' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ width: 430, background: '#0F1E2D', borderRight: '1px solid rgba(74,122,171,0.2)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

        {/* Drawer Header */}
        <div style={{ padding: '20px 20px 0', background: 'linear-gradient(180deg, #1B3347 0%, #0F1E2D 100%)' }}>
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
                <div style={{ fontSize: 16, fontWeight: 700, color: contact.is_blacklisted ? '#EF4444' : '#E2EAF4' }}>{contact.full_name || 'بدون اسم'}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Chip label={tp?.label} color={tp?.color} bg={tp?.bg} />
                  {contact.is_blacklisted && <Chip label={isRTL ? "بلاك ليست" : "Blacklist"} color="#EF4444" bg="rgba(239,68,68,0.12)" />}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8BA8C8', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <a href={`tel:${contact.phone}`} style={{ flex: 1, padding: '8px 0', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, color: '#10B981', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Phone size={13} /> اتصال
            </a>
            <a href={`https://wa.me/2${contact.phone}`} target="_blank" rel="noreferrer" style={{ flex: 1, padding: '8px 0', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: 8, color: '#25D366', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <MessageCircle size={13} /> واتساب
            </a>
            {contact.email && (
              <a href={`mailto:${contact.email}`} style={{ flex: 1, padding: '8px 0', background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.25)', borderRadius: 8, color: '#6B8DB5', fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Mail size={13} /> إيميل
              </a>
            )}
            {!contact.is_blacklisted && (
              <button onClick={() => onBlacklist(contact)} style={{ flex: 1, padding: '8px 0', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Ban size={13} /> بلاك
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(74,122,171,0.15)' }}>
            {tabs.map(([k, v]) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 0', background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #4A7AAB' : '2px solid transparent', color: tab === k ? '#4A7AAB' : '#8BA8C8', fontSize: 12, fontWeight: tab === k ? 700 : 400, cursor: 'pointer' }}>{v}</button>
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
                  <div style={{ color: '#8BA8C8', fontSize: 11, marginBottom: 8 }}>Lead Score</div>
                  <ScorePill score={contact.lead_score} />
                </div>
                <div style={{ background: t?.bg, borderRadius: 10, padding: 12, border: `1px solid ${t?.color}30` }}>
                  <div style={{ color: '#8BA8C8', fontSize: 11, marginBottom: 4 }}>الحرارة</div>
                  {t?.Icon && <div style={{ display:'flex', alignItems:'center', gap:6 }}><t.Icon size={14} color={t.color} /><span style={{ color: t?.color, fontWeight: 700, fontSize: 14 }}>{t?.labelAr}</span></div>}
                </div>
              </div>

              {[
                { label: 'الهاتف الأول',   val: contact.phone },
                { label: 'الهاتف الثاني',  val: contact.phone2 || '—' },
                { label: 'الإيميل',         val: contact.email || '—' },
                { label: isRTL ? 'المصدر'   : 'Source',   val: i18n.language === "ar" ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
                { label: isRTL ? 'الحملة'   : 'Campaign', val: contact.campaign_name || '—' },
                { label: isRTL ? 'الميزانية': 'Budget',   val: fmtBudget(contact.budget_min, contact.budget_max) },
                { label: isRTL ? 'الموقع'   : 'Location', val: contact.preferred_location || '—' },
                { label: isRTL ? 'نوع العقار': 'Property', val: { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' }[contact.interested_in_type] || '—' },
                { label: isRTL ? 'المسؤول'  : 'Assigned', val: contact.assigned_to_name || '—' },
                { label: isRTL ? 'آخر نشاط' : 'Last Activity', val: `${daysSince(contact.last_activity_at)}d` },
              ].map(r => (
              <div key={r.label} style={rowStyle}>
                <span style={{ color: '#8BA8C8' }}>{r.label}</span>
                <span style={{ color: '#E2EAF4', fontWeight: 500, maxWidth: '55%', textAlign: 'left' }}>{r.val}</span>
              </div>
              ))}

              {contact.stage && (
                <div style={rowStyle}>
                  <span style={{ color: '#8BA8C8' }}>المرحلة</span>
                  <Chip label={STAGE_LABELS[contact.stage]} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                </div>
              )}
              {contact.cold_status && (
                <div style={rowStyle}>
                  <span style={{ color: '#8BA8C8' }}>حالة الكولد</span>
                  <Chip label={COLD_LABELS[contact.cold_status]} color="#6B8DB5" bg="rgba(107,141,181,0.1)" />
                </div>
              )}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#EF4444', display:'flex', gap:6, alignItems:'center' }}>
                  <Ban size={13} /> {isRTL ? 'سبب البلاك ليست:' : 'Blacklist Reason:'} {contact.blacklist_reason}
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <FollowUpReminder entityType="contact" entityId={contact.id} entityName={contact.full_name} />
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
                <div style={{ textAlign: 'center', padding: 30, color: '#8BA8C8', fontSize: 13 }}>جاري التحميل...</div>
              ) : activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#8BA8C8' }}>
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد أنشطة بعد' : 'No activities yet'}</p>
                </div>
              ) : activities.map(act => (
                <div key={act.id} style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: 13, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#E2EAF4', fontSize: 13, fontWeight: 600 }}>{act.description}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8BA8C8' }}>
                    <span>{act.users?.full_name_ar || 'مجهول'}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                  {act.next_action && (
                    <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(74,122,171,0.08)', borderRadius: 6, fontSize: 11, color: '#6B8DB5' }}>
                      › {act.next_action}{act.next_action_date ? ` — ${act.next_action_date}` : ''}
                    </div>
                  )}
                </div>
              ))}
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
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: 'rgba(15,30,45,0.6)', color: '#E2EAF4', fontSize: 12, outline: 'none', direction: isRTL ? 'rtl' : 'ltr' }} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={newTask.type} onChange={e => setNewTask(f => ({...f, type: e.target.value}))}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: 'rgba(15,30,45,0.6)', color: '#E2EAF4', fontSize: 11, outline: 'none' }}>
                        {Object.entries(TASK_TYPES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                      <select value={newTask.priority} onChange={e => setNewTask(f => ({...f, priority: e.target.value}))}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: 'rgba(15,30,45,0.6)', color: '#E2EAF4', fontSize: 11, outline: 'none' }}>
                        {Object.entries(TASK_PRIORITIES).map(([k,v]) => <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>)}
                      </select>
                    </div>
                    <input type="datetime-local" value={newTask.due_date} onChange={e => setNewTask(f => ({...f, due_date: e.target.value}))}
                      style={{ padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(74,122,171,0.2)', background: 'rgba(15,30,45,0.6)', color: '#E2EAF4', fontSize: 11, outline: 'none' }} />
                    <button onClick={async () => {
                      if (!newTask.title.trim() || !newTask.due_date) return;
                      setSavingTask(true);
                      try {
                        const t = await createTask({ ...newTask, contact_id: contact.id, contact_name: contact.full_name_ar || contact.full_name_en, dept: 'crm' });
                        setTasks(prev => [t, ...prev]);
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

              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#8BA8C8' }}>
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#E2EAF4', marginBottom: 4, textDecoration: task.status === 'done' ? 'line-through' : 'none', opacity: task.status === 'done' ? 0.6 : 1 }}>
                          {task.title}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, background: (pri?.color || '#4A7AAB') + '22', color: pri?.color || '#4A7AAB', fontWeight: 600 }}>
                            {isRTL ? pri?.ar : pri?.en}
                          </span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 5, background: (st?.color || '#4A7AAB') + '22', color: st?.color || '#4A7AAB' }}>
                            {isRTL ? st?.ar : st?.en}
                          </span>
                          <span style={{ fontSize: 10, color: overdue ? '#EF4444' : '#8BA8C8', display: 'flex', alignItems: 'center', gap: 2 }}>
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
              <button style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
                {isRTL ? '+ فتح فرصة جديدة' : '+ New Opportunity'}
              </button>
              {opportunities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#8BA8C8' }}>
                  <Star size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>{isRTL ? 'لا توجد فرص مرتبطة' : 'No opportunities linked'}</p>
                </div>
              ) : opportunities.map(opp => (
                <div key={opp.id} style={{ background: 'rgba(74,122,171,0.06)', border: '1px solid rgba(74,122,171,0.12)', borderRadius: 10, padding: 13, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: '#E2EAF4', fontSize: 13, fontWeight: 600 }}>فرصة #{opp.id.slice(-4)}</span>
                    <Chip label={STAGE_LABELS[opp.stage] || opp.stage} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                  </div>
                  <div style={{ fontSize: 11, color: '#8BA8C8', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {opp.projects?.name_ar && <span>{opp.projects.name_ar}</span>}
                    <span>{opp.users?.full_name_ar || '—'}</span>
                    {opp.next_follow_up && <span>متابعة: {opp.next_follow_up}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function ContactsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const c = {
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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
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
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const isAdmin = profile?.role === 'admin';

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(c => c.id));

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من الحذف؟' : 'Are you sure?')) return;
    const updated = contacts.filter(c => c.id !== id);
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
  };

  const handleDeleteSelected = () => {
    if (!window.confirm(isRTL ? `حذف ${selectedIds.length} عميل؟` : `Delete ${selectedIds.length} contacts?`)) return;
    const updated = contacts.filter(c => !selectedIds.includes(c.id));
    setContacts(updated);
    localStorage.setItem('platform_contacts', JSON.stringify(updated));
    setSelectedIds([]);
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
          setContacts(JSON.parse(cached));
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
  const stats = useMemo(() => ({
    total: contacts.length,
    leads: contacts.filter(c => c.contact_type === 'lead').length,
    cold: contacts.filter(c => c.contact_type === 'cold').length,
    clients: contacts.filter(c => c.contact_type === 'client').length,
    hot: contacts.filter(c => c.temperature === 'hot').length,
    blacklisted: contacts.filter(c => c.is_blacklisted).length,
  }), [contacts]);

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = contacts.filter(c => {
      if (!showBlacklisted && c.is_blacklisted) return false;
      if (filterType !== 'all' && c.contact_type !== filterType) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (filterTemp !== 'all' && c.temperature !== filterTemp) return false;
      if (search) {
        const q = search.toLowerCase();
        return (c.full_name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q) || c.campaign_name?.toLowerCase().includes(q));
      }
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === 'last_activity') return new Date(b.last_activity_at) - new Date(a.last_activity_at);
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '', 'ar');
      return 0;
    });
    return list;
  }, [contacts, filterType, filterSource, filterTemp, search, showBlacklisted, sortBy]);

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
      created_at: new Date().toISOString().slice(0, 10),
      last_activity_at: new Date().toISOString().slice(0, 10),
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
  const sel = { background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '8px 12px', color: c.text, fontSize: 12, outline: 'none', cursor: 'pointer' };
  const th = { fontSize: 11, color: '#6B8DB5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, padding: '11px 14px', background: c.thBg, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' };
  const td = { padding: '13px 14px', borderBottom: `1px solid ${c.border}`, verticalAlign: 'middle', fontSize: 13, color: c.text };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: c.text }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1B3347' }}>{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: c.textMuted }}>
            {loading ? (isRTL ? 'جاري التحميل...' : 'Loading...') : `${filtered.length} ${isRTL ? 'نتيجة' : 'results'}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> {isRTL ? 'تصدير' : 'Export'}
          </button>
          <button onClick={() => setShowImportModal(true)} style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> {isRTL ? 'إضافة جهة اتصال' : 'Add Contact'}
          </button>
          {isAdmin && selectedIds.length > 0 && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowBulkMenu(v => !v)} style={{ padding: "9px 14px", background: "linear-gradient(135deg,#2B4C6F,#4A7AAB)", border: "none", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {isRTL ? `إجراءات (${selectedIds.length})` : `Actions (${selectedIds.length})`} ▾
              </button>
              {showBulkMenu && (
                <div style={{ position: "absolute", top: "110%", left: 0, background: "#1A2B3C", border: "1px solid rgba(74,122,171,0.3)", borderRadius: 10, minWidth: 190, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", overflow: "hidden" }}>
                  {[
                    { label: isRTL ? "تصدير المحددين" : "Export Selected", action: () => {} },
                    { label: isRTL ? "إعادة تعيين" : "Reassign", action: () => {} },
                    { label: isRTL ? "تغيير المرحلة" : "Change Stage", action: () => {} },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#E2EAF4", fontSize: 13, cursor: "pointer", textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(74,122,171,0.15)"} onMouseLeave={e => e.currentTarget.style.background="none"}>
                      {item.label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: "rgba(239,68,68,0.2)", margin: "4px 0" }} />
                  <button onClick={handleDeleteSelected} style={{ width: "100%", padding: "10px 16px", background: "none", border: "none", color: "#EF4444", fontSize: 13, cursor: "pointer", textAlign: "right", display: "flex", alignItems: "center", gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.1)"} onMouseLeave={e => e.currentTarget.style.background="none"}>
                    {isRTL ? "حذف المحددين" : "Delete Selected"}
                  </button>
                </div>
              )}
            </div>
          )}
          {isAdmin && selectedIds.length > 0 && (
            <button onClick={handleDeleteSelected} style={{ padding: '9px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#EF4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isRTL ? `حذف (${selectedIds.length})` : `Delete (${selectedIds.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Type Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: i18n.language === 'ar' ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          { label: i18n.language === 'ar' ? 'ليدز' : 'Leads', value: 'lead', count: stats.leads, color: '#4A7AAB' },
          { label: i18n.language === 'ar' ? 'كولد' : 'Cold', value: 'cold', count: stats.cold, color: '#8BA8C8' },
          { label: i18n.language === 'ar' ? 'عملاء' : 'Clients', value: 'client', count: stats.clients, color: '#2B4C6F' },
        ].map(s => (
          <button key={s.value} onClick={() => setFilterType(s.value)} style={{
            padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === s.value ? s.color : '#e5e7eb'}`,
            background: filterType === s.value ? `${s.color}15` : '#fff',
            color: filterType === s.value ? s.color : '#6b7280', fontSize: 12, fontWeight: filterType === s.value ? 700 : 400, cursor: 'pointer',
          }}>
            {s.label} <span style={{ background: filterType === s.value ? s.color : '#e5e7eb', color: filterType === s.value ? '#fff' : '#6b7280', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginRight: 4 }}>{s.count}</span>
          </button>
        ))}
        <button onClick={() => setShowBlacklisted(v => !v)} style={{
          padding: '6px 14px', borderRadius: 20, border: `1px solid ${showBlacklisted ? '#EF4444' : '#e5e7eb'}`,
          background: showBlacklisted ? 'rgba(239,68,68,0.08)' : c.cardBg,
          color: showBlacklisted ? '#EF4444' : '#6b7280', fontSize: 12, fontWeight: showBlacklisted ? 700 : 400, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Ban size={11} /> {isRTL ? 'بلاك ليست' : 'Blacklist'} <span style={{ background: showBlacklisted ? '#EF4444' : '#e5e7eb', color: showBlacklisted ? '#fff' : '#6b7280', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginRight: 4 }}>{stats.blacklisted}</span>
        </button>
        <button onClick={() => setFilterTemp(filterTemp === 'hot' ? 'all' : 'hot')} style={{
          padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterTemp === 'hot' ? '#EF4444' : '#e5e7eb'}`,
          background: filterTemp === 'hot' ? 'rgba(239,68,68,0.08)' : c.cardBg,
          color: filterTemp === 'hot' ? '#EF4444' : '#6b7280', fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Flame size={11} /> {isRTL ? 'حار فقط' : 'Hot Only'} <span style={{ background: filterTemp === 'hot' ? '#EF4444' : '#e5e7eb', color: filterTemp === 'hot' ? '#fff' : '#6b7280', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginRight: 4 }}>{stats.hot}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', background: c.thBg, padding: '10px 14px', borderRadius: 12, border: `1px solid ${c.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder={i18n.language === 'ar' ? 'بحث بالاسم، الهاتف، الإيميل...' : 'Search by name, phone, email...'} value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...sel, width: '100%', paddingRight: 32, boxSizing: 'border-box', background: c.inputBg, color: c.text, border: `1px solid ${c.border}` }} />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterTemp} onChange={e => setFilterTemp(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل الدرجات' : 'All Temps'}</option>
          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{v.labelAr} ({v.label})</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="last_activity">{isRTL ? 'ترتيب: آخر نشاط' : 'Sort: Last Activity'}</option>
          <option value="score">{i18n.language === 'ar' ? 'ترتيب: Lead Score' : 'Sort: Lead Score'}</option>
          <option value="name">{i18n.language === 'ar' ? 'ترتيب: الاسم' : 'Sort: Name'}</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{...th, width: 36, padding: '10px 8px'}}><input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} /></th>
                <th style={{...th, width: 50}}>ID</th>
                {(isRTL
                  ? [t('common.actions'), 'Score', t('contacts.budget'), t('contacts.stage'), t('contacts.source'), t('contacts.temperature'), t('contacts.type'), t('contacts.phone'), t('contacts.fullName')]
                  : [t('contacts.fullName'), t('contacts.phone'), t('contacts.type'), t('contacts.temperature'), t('contacts.source'), t('contacts.stage'), t('contacts.budget'), 'Score', t('common.actions')]
                ).map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>جاري التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 0, border: 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,51,71,0.08), rgba(74,122,171,0.12))', border: '1.5px dashed rgba(74,122,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                      <Search size={28} color="#4A7AAB" strokeWidth={1.5} />
                    </div>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 15, color: c.text }}>{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
                    <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{isRTL ? 'جرّب البحث بكلمات مختلفة' : 'Try searching with different keywords'}</p>
                  </div>
                </td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id}
                  onClick={() => setSelected(c)}
                  style={{ cursor: 'pointer', background: selectedIds.includes(c.id) ? 'rgba(74,122,171,0.08)' : c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent' }}
                  onMouseEnter={e => { if (!selectedIds.includes(c.id)) e.currentTarget.style.background = c.rowHover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selectedIds.includes(c.id) ? 'rgba(74,122,171,0.08)' : c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent'; }}
                >
                  {/* Checkbox + ID - hidden in RTL */}
                  {!isRTL && <td style={{...td, padding: '12px 8px'}} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} /></td>}
                  {!isRTL && <td style={{ ...td, fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>#{String(c.id).slice(-4)}</td>}
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
                        <div style={{ fontWeight: 600, color: c.is_blacklisted ? '#EF4444' : '#1A2B3C' }}>{c.full_name || 'بدون اسم'}</div>
                        {c.email && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.email}</div>}
                        {c.last_activity_at && (() => { const d = Math.floor((Date.now() - new Date(c.last_activity_at)) / 86400000); return <div style={{ fontSize: 10, marginTop: 2, fontWeight: 600, color: d === 0 ? '#4A7AAB' : d <= 3 ? '#6B8DB5' : '#EF4444' }}>{d === 0 ? (isRTL ? '✓ اليوم' : '✓ Today') : (isRTL ? d + ' أيام' : d + 'd ago')}</div>; })()}
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <PhoneCell phone={c.phone} />
                    {c.phone2 && <PhoneCell phone={c.phone2} small />}
                  </td>
                  {/* Type */}
                  <td style={td}><Chip label={TYPE[c.contact_type]?.label} color={TYPE[c.contact_type]?.color} bg={TYPE[c.contact_type]?.bg} /></td>
                  {/* Temp */}
                  <td style={td}>
                    {(() => { const TempIcon = TEMP[c.temperature]?.Icon; return TempIcon ? <TempIcon size={15} color={TEMP[c.temperature]?.color} /> : '—'; })()}
                  </td>
                  {/* Source */}
                  <td style={td}><span style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#6b7280' }}>{i18n.language === "ar" ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)}</span></td>
                  {/* Stage */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    {isAdmin && c.contact_type === 'lead' ? (
                      <select value={c.stage || ''} onChange={e => handleStageChange(c.id, e.target.value)} style={{ fontSize: 11, background: 'transparent', border: '1px solid rgba(74,122,171,0.1)', borderRadius: 6, color: '#4A7AAB', padding: '3px 6px', cursor: 'pointer', outline: 'none' }}>
                        {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : c.stage ? <Chip label={STAGE_LABELS[c.stage]} color="#4A7AAB" bg="rgba(74,122,171,0.1)" />
                    : c.cold_status ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{COLD_LABELS[c.cold_status]}</span>
                    : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  {/* Budget */}
                  <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtBudget(c.budget_min, c.budget_max)}</td>
                  {/* ID + Checkbox - shown at end in RTL */}
                  {isRTL && <td style={{ ...td, fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>#{String(c.id).slice(-4)}</td>}
                  {isRTL && <td style={{...td, padding: '12px 8px'}} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} /></td>}
                  {/* Score */}
                  <td style={td}><ScorePill score={c.lead_score || 0} /></td>
                  {/* Actions */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <a href={"tel:" + c.phone} title={isRTL ? "اتصال" : "Call"} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 7, color: '#10B981', textDecoration: 'none' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.77-.77a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      </a>
                      <a href={"https://wa.me/2" + c.phone} target="_blank" rel="noreferrer" title="WhatsApp" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 7, color: '#25D366', textDecoration: 'none' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </a>
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                          style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: openMenuId === c.id ? '#4A7AAB' : '#fff', border: '1px solid ' + (openMenuId === c.id ? '#4A7AAB' : '#e5e7eb'), borderRadius: 7, color: openMenuId === c.id ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openMenuId === c.id && (
                          <div style={{ position: 'absolute', top: 32, left: 0, background: isDark ? '#1a2234' : '#fff', border: `1px solid ${c.border}`, borderRadius: 12, minWidth: 190, zIndex: 100, boxShadow: '0 8px 30px rgba(27,51,71,0.12)', overflow: 'hidden' }}>
                            <div style={{ padding: 6 }}>
                              <button onClick={() => { setLogCallTarget(c); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: isDark?'#E2EAF4':'#4A5568', fontFamily: 'inherit', textAlign: 'right' }} onMouseEnter={e => e.currentTarget.style.background=isDark?'rgba(74,122,171,0.1)':'#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/><path d="M8.09 8.91a16 16 0 0 0 6 6"/></svg>
                                {isRTL ? 'تسجيل مكالمة' : 'Log Call'}
                              </button>
                              <button onClick={() => { setReminderTarget(c); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: isDark?'#E2EAF4':'#4A5568', fontFamily: 'inherit', textAlign: 'right' }} onMouseEnter={e => e.currentTarget.style.background=isDark?'rgba(74,122,171,0.1)':'#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                {isRTL ? 'إضافة تذكير' : 'Add Reminder'}
                              </button>
                              <button onClick={() => { const data = [['الاسم','الهاتف','النوع','المصدر','الميزانية'],[c.full_name,c.phone,c.contact_type,c.source,(c.budget_min||'')+'–'+(c.budget_max||'')]]; const csv = data.map(r=>r.join(',')).join('\n'); const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,﻿'+csv; a.download = c.full_name+'.csv'; a.click(); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: isDark?'#E2EAF4':'#4A5568', fontFamily: 'inherit', textAlign: 'right' }} onMouseEnter={e => e.currentTarget.style.background=isDark?'rgba(74,122,171,0.1)':'#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                {isRTL ? 'تصدير بيانات العميل' : 'Export Contact'}
                              </button>
                            </div>
                            {!c.is_blacklisted && (<><div style={{ height: 1, background: '#E2E8F0' }} /><div style={{ padding: 6 }}>
                              <button onClick={() => { setBlacklistTarget(c); setOpenMenuId(null); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#EF4444', fontFamily: 'inherit', textAlign: 'right' }} onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.05)'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                {isRTL ? 'بلاك ليست' : 'Blacklist'}
                              </button>
                            </div></>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={(phone) => { const found = contacts.find(c => c.phone === phone || c.phone2 === phone || (c.extraPhones || []).includes(phone)); return Promise.resolve(found || null); }} onOpenOpportunity={(contact) => { setShowAddModal(false); setSelected(contact); }} />}
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))} />}
      {logCallTarget && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLogCallTarget(null)}>
        <div style={{ background: '#fff', borderRadius: 16, width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B3347', display:'flex', alignItems:'center', gap:6 }}><Phone size={14} /> {isRTL ? 'تسجيل مكالمة' : 'Log Call'} — {logCallTarget.full_name}</h3>
            <button onClick={() => setLogCallTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9CA3AF', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#4A5568', fontWeight: 600, marginBottom: 8 }}>{isRTL ? 'نتيجة المكالمة' : 'Call Result'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[isRTL?'رد':'Answered', isRTL?'لم يرد':'No Answer', isRTL?'مهتم':'Interested', isRTL?'غير مهتم':'Not Interested', isRTL?'اتصل لاحقاً':'Call Back'].map(r => (
                <button key={r} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: 'none', fontSize: 12, color: '#4A5568', cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.borderColor='#4A7AAB'; e.currentTarget.style.color='#4A7AAB'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#4A5568'; }}>{r}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#4A5568', fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'ملاحظات' : 'Notes'}</div>
            <textarea rows={3} style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', resize: 'none', marginBottom: 14 }} placeholder={isRTL ? 'ملاحظات المكالمة...' : 'Call notes...'} />
            <div style={{ fontSize: 12, color: '#4A5568', fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'تذكير متابعة' : 'Follow-up Reminder'}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[isRTL?'غداً':'Tomorrow', isRTL?'3 أيام':'3 Days', isRTL?'أسبوع':'Week', isRTL?'بدون':'None'].map(d => (
                <button key={d} style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #E2E8F0', background: 'none', fontSize: 12, color: '#4A5568', cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.borderColor='#4A7AAB'; e.currentTarget.style.color='#4A7AAB'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#4A5568'; }}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setLogCallTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button onClick={() => setLogCallTarget(null)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'حفظ المكالمة' : 'Save Call'}</button>
          </div>
        </div>
      </div>
    )}
    {reminderTarget && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setReminderTarget(null)}>
        <div style={{ background: '#fff', borderRadius: 16, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1B3347', display:'flex', alignItems:'center', gap:6 }}><Bell size={14} /> {isRTL ? 'إضافة تذكير' : 'Add Reminder'} — {reminderTarget.full_name}</h3>
            <button onClick={() => setReminderTarget(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9CA3AF', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 12, color: '#4A5568', fontWeight: 600, marginBottom: 8 }}>{isRTL ? 'متى؟' : 'When?'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {[isRTL?'غداً':'Tomorrow', isRTL?'3 أيام':'3 Days', isRTL?'أسبوع':'Week', isRTL?'تاريخ محدد':'Custom'].map(d => (
                <button key={d} style={{ padding: '5px 14px', borderRadius: 20, border: '1.5px solid #E2E8F0', background: 'none', fontSize: 12, color: '#4A5568', cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.borderColor='#4A7AAB'; e.currentTarget.style.color='#4A7AAB'; }} onMouseLeave={e => { e.currentTarget.style.borderColor='#E2E8F0'; e.currentTarget.style.color='#4A5568'; }}>{d}</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: '#4A5568', fontWeight: 600, marginBottom: 6 }}>{isRTL ? 'الرسالة' : 'Message'}</div>
            <input style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none' }} placeholder={isRTL ? 'متابعة العميل...' : 'Follow up with client...'} />
          </div>
          <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setReminderTarget(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, color: '#6B7280', cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'إلغاء' : 'Cancel'}</button>
            <button onClick={() => setReminderTarget(null)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', fontSize: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{isRTL ? 'حفظ التذكير' : 'Save Reminder'}</button>
          </div>
        </div>
      </div>
    )}
    {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} existingContacts={contacts} onImportDone={(newContacts) => { setContacts(prev => { const updated = [...prev, ...newContacts]; localStorage.setItem('platform_contacts', JSON.stringify(updated)); return updated; }); setShowImportModal(false); }} />}
    </div>
  );
}
