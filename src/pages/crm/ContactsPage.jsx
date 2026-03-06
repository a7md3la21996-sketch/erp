import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Phone, MessageCircle, Mail, Plus, Upload, Download, Search, Filter, Ban, X, ChevronDown, ChevronRight, Clock, Star } from 'lucide-react';
import {
  fetchContacts, createContact, updateContact,
  blacklistContact, checkDuplicate,
  fetchContactActivities, createActivity,
  fetchContactOpportunities
} from '../../services/contactsService';

// ── Constants ──────────────────────────────────────────────────────────────
const SOURCE_LABELS = { facebook: 'فيسبوك', instagram: 'إنستجرام', google_ads: 'جوجل أدز', website: 'الموقع', call: 'اتصال وارد', walk_in: 'زيارة مباشرة', referral: 'ترشيح', developer: 'مطور', cold_call: 'كولد كول', other: 'أخرى' };
const SOURCE_EN = { facebook: 'Facebook', instagram: 'Instagram', google_ads: 'Google Ads', website: 'Website', call: 'Inbound Call', walk_in: 'Walk-in', referral: 'Referral', developer: 'Developer', cold_call: 'Cold Call', other: 'Other' };
const STAGE_LABELS = { new: 'جديد', contacted: 'تم التواصل', interested: 'مهتم', site_visit_scheduled: 'موعد معاينة', site_visited: 'زار الموقع', negotiation: 'تفاوض', reserved: 'محجوز', contracted: 'تعاقد', closed_won: 'فوز ✓', closed_lost: 'خسارة ✗', on_hold: 'معلق' };
const COLD_LABELS = { not_contacted: 'لم يُتصل به', no_answer: 'لا يرد', not_interested: 'غير مهتم', interested: 'مهتم', wrong_number: 'رقم خاطئ', call_back_later: 'اتصل لاحقاً' };
const ACTIVITY_TYPES = { call: { label: 'مكالمة', icon: '📞' }, whatsapp: { label: 'واتساب', icon: '💬' }, email: { label: 'إيميل', icon: '📧' }, meeting: { label: 'اجتماع', icon: '🤝' }, site_visit: { label: 'زيارة موقع', icon: '🏠' }, note: { label: 'ملاحظة', icon: '📝' }, status_change: { label: 'تغيير حالة', icon: '🔄' } };
const TEMP = {
  hot: { label: 'Hot', labelAr: 'حار', icon: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  warm: { label: 'Warm', labelAr: 'دافئ', icon: '🟠', color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  cool: { label: 'Cool', labelAr: 'فاتر', icon: '🟡', color: '#EAB308', bg: 'rgba(234,179,8,0.12)' },
  cold: { label: 'Cold', labelAr: 'بارد', icon: '🔵', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
};
const TYPE = {
  lead: { label: 'ليد', labelEn: 'Lead', color: '#4A7AAB', bg: 'rgba(74,122,171,0.13)' },
  cold: { label: 'كولد', labelEn: 'Cold', color: '#8BA8C8', bg: 'rgba(139,168,200,0.13)' },
  client: { label: 'عميل', labelEn: 'Client', color: '#10B981', bg: 'rgba(16,185,129,0.13)' },
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
  const color = score >= 75 ? '#10B981' : score >= 50 ? '#F59E0B' : score >= 25 ? '#F97316' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 }}>
      <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, minWidth: 20 }}>{score}</span>
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────
function AddContactModal({ onClose, onSave, checkDup }) {
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
    if (!form.phone) return;
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
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'رقم الهاتف' : 'Phone'} <span style={{ color: '#EF4444' }}>*</span></label>
                <input style={{ ...inp, borderColor: dupWarning ? '#EF4444' : 'rgba(74,122,171,0.25)' }}
                  placeholder="010xxxxxxxx" value={form.phone}
                  onChange={e => { set('phone', e.target.value); setDupWarning(null); }}
                  onBlur={checkPhone} />
                {checking && <p style={{ fontSize: 11, color: '#8BA8C8', margin: '4px 0 0' }}>{isRTL ? 'جاري التحقق...' : 'Checking...'}</p>}
                {dupWarning && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#EF4444' }}>
                    ⚠️ {isRTL ? 'هذا الرقم موجود مسبقاً باسم' : 'This number already exists for'}: <strong>{dupWarning.full_name}</strong>
                    <br /><span style={{ color: '#F97316', fontSize: 11 }}>{isRTL ? 'يمكنك الاستمرار لإضافة فرصة' : 'You can continue to add an opportunity'} جديدة للنفس العميل</span>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'رقم إضافي' : 'Secondary Phone'}</label>
                <input style={inp} placeholder="012xxxxxxxx" value={form.phone2} onChange={e => set('phone2', e.target.value)} />
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
                <label style={{ display: 'block', color: '#8BA8C8', fontSize: 12, marginBottom: 6 }}>{isRTL ? 'اسم {isRTL ? 'الحملة' : 'Campaign'}' : 'Campaign'}</label>
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
                <textarea style={{ ...inp, resize: 'vertical' }} rows={4} placeholder="{isRTL ? 'ملاحظات' : 'Notes'} إضافية..." value={form.notes} onChange={e => set('notes', e.target.value)} />
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
              ? <button onClick={() => setStep(2)} disabled={!form.phone} style={{ padding: '9px 22px', background: form.phone ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'rgba(74,122,171,0.3)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: form.phone ? 'pointer' : 'not-allowed' }}>{isRTL ? 'التالي →' : 'Next →'}</button>
              : <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? '💾 حفظ' : '💾 Save')}</button>
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
          <div style={{ fontSize: 44, marginBottom: 8 }}>⛔</div>
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
    { key: 'call', label: 'Call', labelAr: 'مكالمة', icon: '📞' },
    { key: 'whatsapp', label: 'WhatsApp', labelAr: 'واتساب', icon: '💬' },
    { key: 'email', label: 'Email', labelAr: 'إيميل', icon: '📧' },
    { key: 'meeting', label: 'Meeting', labelAr: 'اجتماع', icon: '🤝' },
    { key: 'site_visit', label: 'Site Visit', labelAr: 'زيارة موقع', icon: '🏠' },
    { key: 'note', label: 'Note', labelAr: 'ملاحظة', icon: '📝' },
    { key: 'status_change', label: 'Status Change', labelAr: 'تغيير حالة', icon: '🔄' },
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
        <span style={{ fontSize: 11 }}>🕐</span>
        <span style={{ fontSize: 11, color: '#6B8DB5' }}>{now}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => set('type', e.target.value)}>
          {activityTypes.map(v => (
            <option key={v.key} value={v.key}>{v.icon} {isRTL ? (v.labelAr || v.label) : v.label}</option>
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
    if (tab === 'opportunities') {
      fetchContactOpportunities(contact.id)
        .then(data => setOpportunities(data))
        .catch(() => setOpportunities([]));
    }
  }, [tab, contact.id]);

  const handleSaveActivity = async (form) => {
    try {
      const act = await createActivity({ ...form, contact_id: contact.id });
      setActivities(prev => [act, ...prev]);
      setShowActivityForm(false);
    } catch (err) {
      alert('خطأ: ' + err.message);
    }
  };

  if (!contact) return null;
  const t = TEMP[contact.temperature];
  const tp = TYPE[contact.contact_type];

  const tabs = [['info', isRTL ? 'البيانات' : 'Info'], ['activities', isRTL ? 'الأنشطة' : 'Activities'], ['opportunities', isRTL ? 'الفرص' : 'Opportunities']];

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
                {contact.is_blacklisted ? '⛔' : initials(contact.full_name)}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: contact.is_blacklisted ? '#EF4444' : '#E2EAF4' }}>{contact.full_name || 'بدون اسم'}</div>
                <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Chip label={tp?.label} color={tp?.color} bg={tp?.bg} />
                  {contact.is_blacklisted && <Chip label="{isRTL ? 'بلاك ليست' : 'Blacklist'}" color="#EF4444" bg="rgba(239,68,68,0.12)" />}
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
                  <span style={{ color: t?.color, fontWeight: 700, fontSize: 14 }}>{t?.icon} {t?.label}</span>
                </div>
              </div>

              {[
                { label: '📱 الهاتف الأول', val: contact.phone },
                { label: '📱 الهاتف الثاني', val: contact.phone2 || '—' },
                { label: '📧 الإيميل', val: contact.email || '—' },
                { label: '📣 {isRTL ? 'المصدر' : 'Source'}', val: i18n.language === "ar" ? SOURCE_LABELS[contact.source] : (SOURCE_EN[contact.source] || contact.source) },
                { label: '🎯 {isRTL ? 'الحملة' : 'Campaign'}', val: contact.campaign_name || '—' },
                { label: '💰 {isRTL ? 'الميزانية' : 'Budget'}', val: fmtBudget(contact.budget_min, contact.budget_max) },
                { label: '📍 {isRTL ? 'الموقع المفضل' : 'Preferred Location'}', val: contact.preferred_location || '—' },
                { label: '🏢 {isRTL ? 'نوع العقار' : 'Property Type'}', val: { residential: 'سكني', commercial: 'تجاري', administrative: 'إداري' }[contact.interested_in_type] || '—' },
                { label: '👤 {isRTL ? 'المسؤول' : 'Assigned To'}', val: contact.assigned_to_name || '—' },
                { label: '⏱️ {isRTL ? 'آخر نشاط' : 'Last Activity'}', val: ``${ daysSince(contact.last_activity_at)}d`` },
              ].map(r => (
              <div key={r.label} style={rowStyle}>
                <span style={{ color: '#8BA8C8' }}>{r.label}</span>
                <span style={{ color: '#E2EAF4', fontWeight: 500, maxWidth: '55%', textAlign: 'left' }}>{r.val}</span>
              </div>
              ))}

              {contact.stage && (
                <div style={rowStyle}>
                  <span style={{ color: '#8BA8C8' }}>🔄 المرحلة</span>
                  <Chip label={STAGE_LABELS[contact.stage]} color="#D4A853" bg="rgba(212,168,83,0.1)" />
                </div>
              )}
              {contact.cold_status && (
                <div style={rowStyle}>
                  <span style={{ color: '#8BA8C8' }}>📋 حالة الكولد</span>
                  <Chip label={COLD_LABELS[contact.cold_status]} color="#8BA8C8" bg="rgba(139,168,200,0.1)" />
                </div>
              )}
              {contact.is_blacklisted && contact.blacklist_reason && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 12, color: '#EF4444' }}>
                  {isRTL ? '⛔ سبب ال{isRTL ? 'بلاك ليست' : 'Blacklist'}:' : '⛔ Blacklist Reason:'} {contact.blacklist_reason}
                </div>
              )}
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
                    <span style={{ color: '#E2EAF4', fontSize: 13, fontWeight: 600 }}>{ACTIVITY_TYPES[act.type]?.icon} {act.description}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8BA8C8' }}>
                    <span>{act.users?.full_name_ar || 'مجهول'}</span>
                    <span>{act.created_at?.slice(0, 10)}</span>
                  </div>
                  {act.next_action && (
                    <div style={{ marginTop: 8, padding: '5px 10px', background: 'rgba(212,168,83,0.08)', borderRadius: 6, fontSize: 11, color: '#D4A853' }}>
                      ➡️ {act.next_action}{act.next_action_date ? ` — ${act.next_action_date}` : ''}
                    </div>
                  )}
                </div>
              ))}
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
                    <Chip label={STAGE_LABELS[opp.stage] || opp.stage} color="#D4A853" bg="rgba(212,168,83,0.1)" />
                  </div>
                  <div style={{ fontSize: 11, color: '#8BA8C8', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {opp.projects?.name_ar && <span>🏢 {opp.projects.name_ar}</span>}
                    <span>👤 {opp.users?.full_name_ar || '—'}</span>
                    {opp.next_follow_up && <span>📅 متابعة: {opp.next_follow_up}</span>}
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
    rowHover: isDark ? 'rgba(74,122,171,0.1)' : '#f9fafb',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    thBg: isDark ? 'rgba(74,122,171,0.08)' : '#f9fafb',
    chipBg: isDark ? 'rgba(74,122,171,0.12)' : '#f3f4f6',
    chipText: isDark ? '#8BA8C8' : '#6b7280',
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
      id: String(Date.now()),
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
  const th = { fontSize: 11, color: '#6B8DB5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '10px 12px', background: c.thBg, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' };
  const td = { padding: '12px', borderBottom: `1px solid ${c.border}`, verticalAlign: 'middle', fontSize: 13, color: c.text };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: c.text }}>
      {/* Page Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1B3347' }}>{isRTL ? 'جهات الاتصال' : 'Contacts'}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: c.textMuted }}>
            {loading ? loading ? t('common.loading') : `${filtered.length} ${t('contacts.results', { count: filtered.length, total: contacts.length })}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> {isRTL ? 'تصدير' : 'Export'}
          </button>
          <button style={{ padding: '9px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> {isRTL ? 'استيراد' : 'Import'}
          </button>
          <button onClick={() => setShowAddModal(true)} style={{ padding: '9px 18px', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> {isRTL ? "إضافة جهة اتصال" : "Add Contact"}
          </button>
        </div>
      </div>

      {/* Type Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: i18n.language === 'ar' ? 'الكل' : 'All', value: 'all', count: stats.total, color: '#4A7AAB' },
          { label: i18n.language === 'ar' ? 'ليدز' : 'Leads', value: 'lead', count: stats.leads, color: '#4A7AAB' },
          { label: i18n.language === 'ar' ? 'كولد' : 'Cold', value: 'cold', count: stats.cold, color: '#8BA8C8' },
          { label: i18n.language === 'ar' ? 'عملاء' : 'Clients', value: 'client', count: stats.clients, color: '#10B981' },
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
          background: showBlacklisted ? 'rgba(239,68,68,0.08)' : '#fff',
          color: showBlacklisted ? '#EF4444' : '#6b7280', fontSize: 12, fontWeight: showBlacklisted ? 700 : 400, cursor: 'pointer',
        }}>
          ⛔ {isRTL ? 'بلاك ليست' : 'Blacklist'} <span style={{ background: showBlacklisted ? '#EF4444' : '#e5e7eb', color: showBlacklisted ? '#fff' : '#6b7280', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginRight: 4 }}>{stats.blacklisted}</span>
        </button>
        <button onClick={() => setFilterTemp(filterTemp === 'hot' ? 'all' : 'hot')} style={{
          padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterTemp === 'hot' ? '#EF4444' : '#e5e7eb'}`,
          background: filterTemp === 'hot' ? 'rgba(239,68,68,0.08)' : '#fff',
          color: filterTemp === 'hot' ? '#EF4444' : '#6b7280', fontSize: 12, cursor: 'pointer',
        }}>
          🔴 {isRTL ? 'حار فقط' : 'Hot Only'} <span style={{ background: filterTemp === 'hot' ? '#EF4444' : '#e5e7eb', color: filterTemp === 'hot' ? '#fff' : '#6b7280', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginRight: 4 }}>{stats.hot}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <Search size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder={i18n.language === 'ar' ? 'بحث بالاسم، الهاتف، الإيميل...' : 'Search by name, phone, email...'} value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...sel, width: '100%', paddingRight: 32, boxSizing: 'border-box' }} />
        </div>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل المصادر' : 'All Sources'}</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterTemp} onChange={e => setFilterTemp(e.target.value)} style={sel}>
          <option value="all">{isRTL ? 'كل الدرجات' : 'All Temps'}</option>
          {Object.entries(TEMP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={sel}>
          <option value="last_activity">{i18n.language === 'ar' ? 'ترتيب: {isRTL ? 'آخر نشاط' : 'Last Activity'}' : 'Sort: Last Activity'}</option>
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
                {[t('contacts.fullName'), t('contacts.phone'), t('contacts.type'), t('contacts.temperature'), t('contacts.source'), t('contacts.stage'), t('contacts.budget'), 'Score', t('common.actions')].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>جاري التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  {isRTL ? 'لا توجد نتائج' : 'No results found'}
                </td></tr>
              ) : filtered.map((c) => (
                <tr key={c.id}
                  onClick={() => setSelected(c)}
                  style={{ cursor: 'pointer', background: c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = c.is_blacklisted ? 'rgba(239,68,68,0.03)' : 'transparent'}
                >
                  {/* Name */}
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: c.is_blacklisted ? 'rgba(239,68,68,0.15)' : 'linear-gradient(135deg,#D9E4EE,#4A7AAB)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: c.is_blacklisted ? '#EF4444' : '#2B4C6F',
                      }}>
                        {c.is_blacklisted ? '⛔' : initials(c.full_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: c.is_blacklisted ? '#EF4444' : c.text }}>{c.full_name || 'بدون اسم'}</div>
                        {c.email && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.email}</div>}
                      </div>
                    </div>
                  </td>
                  {/* Phone */}
                  <td style={td}>
                    <div style={{ color: '#374151' }}>{c.phone}</div>
                    {c.phone2 && <div style={{ fontSize: 11, color: '#9ca3af' }}>{c.phone2}</div>}
                  </td>
                  {/* Type */}
                  <td style={td}><Chip label={TYPE[c.contact_type]?.label} color={TYPE[c.contact_type]?.color} bg={TYPE[c.contact_type]?.bg} /></td>
                  {/* Temp */}
                  <td style={td}><span title={TEMP[c.temperature]?.label} style={{ fontSize: 16 }}>{TEMP[c.temperature]?.icon}</span></td>
                  {/* Source */}
                  <td style={td}><span style={{ fontSize: 11, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#6b7280' }}>{i18n.language === "ar" ? SOURCE_LABELS[c.source] : (SOURCE_EN[c.source] || c.source)}</span></td>
                  {/* Stage */}
                  <td style={td}>
                    {c.stage
                      ? <Chip label={STAGE_LABELS[c.stage]} color="#D4A853" bg="rgba(212,168,83,0.1)" />
                      : c.cold_status
                        ? <span style={{ fontSize: 11, color: '#9ca3af' }}>{COLD_LABELS[c.cold_status]}</span>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  {/* Budget */}
                  <td style={{ ...td, fontSize: 12, color: '#6b7280' }}>{fmtBudget(c.budget_min, c.budget_max)}</td>
                  {/* Score */}
                  <td style={td}><ScorePill score={c.lead_score || 0} /></td>
                  {/* Actions */}
                  <td style={td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <a href={`tel:${c.phone}`} title="اتصال" style={{ padding: '5px 8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6, color: '#10B981', fontSize: 13, textDecoration: 'none' }}>📞</a>
                      <a href={`https://wa.me/2${c.phone}`} target="_blank" rel="noreferrer" title="واتساب" style={{ padding: '5px 8px', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', borderRadius: 6, color: '#25D366', fontSize: 13, textDecoration: 'none' }}>💬</a>
                      {!c.is_blacklisted && (
                        <button title="{isRTL ? 'بلاك ليست' : 'Blacklist'}" onClick={() => setBlacklistTarget(c)}
                          style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#EF4444', fontSize: 13, cursor: 'pointer' }}>⛔</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAddModal && <AddContactModal onClose={() => setShowAddModal(false)} onSave={handleSave} checkDup={checkDuplicate} />}
      {selected && <ContactDrawer contact={selected} onClose={() => setSelected(null)} onBlacklist={c => { setBlacklistTarget(c); setSelected(null); }} onUpdate={updated => setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))} />}
      {blacklistTarget && <BlacklistModal contact={blacklistTarget} onClose={() => setBlacklistTarget(null)} onConfirm={handleBlacklist} />}
    </div>
  );
}
