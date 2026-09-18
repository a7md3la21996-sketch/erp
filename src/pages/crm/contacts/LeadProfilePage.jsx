import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User, Phone, Mail, Tag, DollarSign, MapPin, Calendar, Clock, Briefcase, FileText, MessageSquare, MessageCircle, Pencil, Building2, Hash, History, X, Plus, Activity as ActivityIcon, BarChart3, PhoneMissed, PhoneOff, CheckCheck, Check, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { PageSkeleton, EmptyState, Modal } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useSystemConfig } from '../../../contexts/SystemConfigContext';
import { useToast } from '../../../contexts/ToastContext';
import { P } from '../../../config/roles';
import { updateContact, fetchContactActivities } from '../../../services/contactsService';
import { logInteraction, ENGAGED_RESULTS } from '../../../services/interactionsService';
import { getAuditLogs } from '../../../services/auditService';
import EditContactModal from './EditContactModal';
import ResaleUnitsTab from './ResaleUnitsTab';
import TakeActionForm from './TakeActionForm';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { TYPE, TEMP, SOURCE_LABELS, SOURCE_EN, fmtBudget, initials, daysSince, CONTACT_STAGE, ResultBadge, OutcomeBadge, ACTIVITY_RESULTS_BY_TYPE, ACTIVITY_RESULT_BADGES } from './constants';
import { computeResponsiveness, RESP_LABELS } from './responsiveness';

// ── Full Lead Profile — the roomy, id-based home for a lead: presented as a
// CENTERED, routable overlay (over the Leads list) with tabs. The drawer stays
// the fast triage surface; this is where you go deep. Reached from the drawer's
// "Full profile" button (navigate `/crm/leads/:id`).

const STATUS_STYLES = {
  new:             { ar: 'جديد',       en: 'New',          color: '#2F6BD3' },
  following:       { ar: 'متابعة',     en: 'Following',    color: '#158A57' },
  contacted:       { ar: 'تم التواصل', en: 'Contacted',    color: '#C9860A' },
  has_opportunity: { ar: 'لديه فرصة',  en: 'Opportunity',  color: '#117049' },
  disqualified:    { ar: 'غير مؤهل',   en: 'Disqualified', color: '#6b7280' },
};
const CHANNEL_LABEL = {
  call: { ar: 'مكالمة', en: 'Call' }, whatsapp: { ar: 'واتساب', en: 'WhatsApp' },
  email: { ar: 'إيميل', en: 'Email' }, meeting: { ar: 'اجتماع', en: 'Meeting' },
  visit: { ar: 'زيارة', en: 'Visit' }, note: { ar: 'ملاحظة', en: 'Note' },
};

const deptLabel = (d, isRTL) =>
  (isRTL
    ? { sales: 'مبيعات', hr: 'HR', finance: 'مالية', marketing: 'تسويق', operations: 'عمليات' }
    : { sales: 'Sales', hr: 'HR', finance: 'Finance', marketing: 'Marketing', operations: 'Operations' }
  )[d] || d;

const propTypeLabel = (t, isRTL) =>
  ({ residential: isRTL ? 'سكني' : 'Residential', commercial: isRTL ? 'تجاري' : 'Commercial', administrative: isRTL ? 'إداري' : 'Administrative' }[t] || t);

const DEAL_COLOR = { new_deal: '#6B7280', reserved: '#5A63C4', contracted: '#0B5A53', won: '#158A57', lost: '#D6403B' };
const dealStatusLabel = (s, isRTL) =>
  (isRTL
    ? { new_deal: 'صفقة جديدة', reserved: 'محجوز', contracted: 'متعاقد', won: 'مكسوب', lost: 'خسران' }
    : { new_deal: 'New deal', reserved: 'Reserved', contracted: 'Contracted', won: 'Won', lost: 'Lost' }
  )[s] || s;
const fmtMoney = (n) => (n ? Number(n).toLocaleString() : '—');
const nextDayAt10 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString(); };

function Badge({ text, color, icon: Icon, rail }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ color, background: color + '18' }}>
      {rail && <span className="w-[3px] h-3 rounded-sm shrink-0" style={{ background: color }} />}
      {Icon && <Icon size={11} />}{text}
    </span>
  );
}
// State-specific icon (green = engaged, amber = not) — mirrors the mockup.
function stateIcon(type, result) {
  const eng = ENGAGED_RESULTS[type]?.has(result);
  if (type === 'call') return eng ? Phone : (result === 'no_answer' ? PhoneMissed : PhoneOff);
  if (type === 'whatsapp') return eng ? CheckCheck : Check;
  if (type === 'meeting') return eng ? UserCheck : UserX;
  return ActivityIcon;
}
function Field({ icon: Icon, label, value, ltr }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-edge/60 dark:border-edge-dark/60 last:border-b-0">
      {Icon && <Icon size={15} className="text-content-muted dark:text-content-muted-dark shrink-0 mt-0.5" aria-hidden="true" />}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{label}</div>
        <div className="text-sm font-semibold text-content dark:text-content-dark break-words" dir={ltr ? 'ltr' : undefined}>{value}</div>
      </div>
    </div>
  );
}
function Card({ title, icon: Icon, children }) {
  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl overflow-hidden mb-4">
      {title && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-edge dark:border-edge-dark">
          {Icon && <Icon size={16} className="text-brand-500 shrink-0" aria-hidden="true" />}
          <h2 className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-2 border-t border-edge/60 dark:border-edge-dark/60 first:border-t-0">
      <span className="text-xs text-content-muted dark:text-content-muted-dark w-32 shrink-0">{label}</span>
      <span className="flex items-center gap-2 flex-wrap">{children}</span>
    </div>
  );
}

// The overlay body — takes a contactId + onClose so it can be rendered EITHER
// as a route (/crm/leads/:id) OR, preferably, as an overlay on top of the Leads
// list (so clicking a name doesn't navigate away from the list).
export function LeadProfileOverlay({ contactId, onClose }) {
  const id = contactId;
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile, hasPermission } = useAuth();
  const { crmThresholds } = useSystemConfig();
  const toast = useToast();
  const canEdit = hasPermission(P.CONTACTS_EDIT) || hasPermission(P.CONTACTS_EDIT_OWN);
  const canViewAudit = hasPermission('audit.view');
  const windowDays = crmThresholds?.responsive_window_days || 7;

  const [contact, setContact] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | missing
  const [deals, setDeals] = useState([]);
  const [audit, setAudit] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tab, setTab] = useState('overview');
  const [showAction, setShowAction] = useState(false);
  const [actionType, setActionType] = useState('call');

  const close = onClose;

  useEffect(() => {
    let alive = true;
    setState('loading');
    supabase.from('contacts').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (!alive) return; setContact(data || null); setState(data ? 'ready' : 'missing'); })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [id]);

  const refreshContact = useCallback(async () => {
    const { data } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
    if (data) setContact(data);
  }, [id]);

  const refreshActivities = useCallback(async () => {
    try {
      const rows = await fetchContactActivities(id, { role: profile?.role, userId: profile?.id, teamId: profile?.team_id });
      setActivities(rows || []);
    } catch { /* leave as-is */ }
  }, [id, profile?.role, profile?.id, profile?.team_id]);

  useEffect(() => {
    let alive = true;
    supabase.from('deals')
      .select('id, deal_number, status, deal_value, down_payment, unit_code, agent_ar, agent_en, created_at')
      .eq('contact_id', id).order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setDeals(data || []); })
      .catch(() => { if (alive) setDeals([]); });
    if (canViewAudit) {
      getAuditLogs({ entity: 'contact', entityId: id, limit: 30 })
        .then(({ data }) => { if (alive) setAudit(data || []); })
        .catch(() => { if (alive) setAudit([]); });
    }
    refreshActivities();
    return () => { alive = false; };
  }, [id, canViewAudit, refreshActivities]);

  // ── Unified log path (quick bar + TakeActionForm both funnel here) ──
  const handleLog = useCallback(async (payload) => {
    try {
      await logInteraction(id, payload);
      await Promise.all([refreshActivities(), refreshContact()]);
    } catch (e) {
      if (e?.message === 'FOLLOWUP_REQUIRED') toast.error(isRTL ? 'لازم تحدد خطوة جاية' : 'A next step is required');
      else if (e?.message === 'NOTE_REQUIRED') toast.error(isRTL ? 'لازم تكتب ملاحظة' : 'A note is required');
      else toast.error(isRTL ? 'فشل التسجيل' : 'Failed to log');
      throw e;
    }
  }, [id, refreshActivities, refreshContact, toast, isRTL]);

  // No-engagement one-click: logs instantly with an auto retry follow-up (so it
  // satisfies enforcement and matches "no-engagement → only the next step moves").
  const quickNo = async (type, result, label) => {
    try {
      await handleLog({ type, result, followUp: { type: 'followup', title: isRTL ? 'إعادة محاولة' : 'Retry contact', dueAt: nextDayAt10(), contactName: contact?.full_name } });
      toast.success((isRTL ? 'تم التسجيل: ' : 'Logged: ') + label);
    } catch { /* toast shown in handleLog */ }
  };
  // Engaged: open the full form preset to that channel (outcome + note required).
  const quickEngaged = (type) => { setActionType(type); setShowAction(true); };

  const resp = useMemo(() => computeResponsiveness(activities, windowDays), [activities, windowDays]);

  // ---------------- render ----------------
  const body = () => {
    if (state === 'loading') return <PageSkeleton />;
    if (state === 'missing' || !contact) return <EmptyState message={isRTL ? 'العميل غير موجود' : 'Lead not found'} />;

    const tp = TYPE[contact.contact_type];
    const temp = TEMP[contact.temperature];
    const st = STATUS_STYLES[contact.contact_status];
    const stage = CONTACT_STAGE[contact.stage];
    const extraPhones = Array.isArray(contact.extra_phones) ? contact.extra_phones.filter(Boolean) : [];
    const respLabel = RESP_LABELS[resp.state] ? (isRTL ? RESP_LABELS[resp.state].ar : RESP_LABELS[resp.state].en) : resp.state;
    const respStat = `${resp.replies} ${isRTL ? 'رد' : 'replies'} · ${resp.attempts} ${isRTL ? 'محاولة' : 'attempts'}` + (resp.lastReplyDays != null ? ` · ${isRTL ? 'آخر رد' : 'last reply'} ${resp.lastReplyDays === 0 ? (isRTL ? 'اليوم' : 'today') : resp.lastReplyDays + (isRTL ? ' يوم' : 'd')}` : '');
    const meetings = activities.filter(a => a.type === 'meeting');

    const TABS = [
      { key: 'overview', ar: 'نظرة عامة', en: 'Overview', icon: User },
      { key: 'activity', ar: 'النشاط', en: 'Activity', icon: ActivityIcon },
      { key: 'deals', ar: 'الصفقات والاجتماعات', en: 'Deals & Meetings', icon: DollarSign },
      { key: 'documents', ar: 'المستندات', en: 'Documents', icon: FileText },
      { key: 'analysis', ar: 'التحليل', en: 'Analysis', icon: BarChart3 },
    ];

    return (
      <div>
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center text-base font-bold"
            style={tp?.color ? { background: `linear-gradient(135deg, ${tp.color}30, ${tp.color}15)`, color: tp.color } : { background: 'linear-gradient(135deg,#2B4C6F,#2F6BD3)', color: '#fff' }}>
            {initials(contact.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="m-0 text-lg font-bold text-content dark:text-content-dark leading-tight break-words">
              {contact.prefix && <span className="text-[#6B8DB5] font-medium me-1 text-sm">{contact.prefix}</span>}
              {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
            </h1>
            <div className="text-xs text-content-muted dark:text-content-muted-dark mt-1 flex items-center gap-2 flex-wrap">
              {contact.phone && <span dir="ltr" className="font-medium">{contact.phone}</span>}
              {contact.source && <span>· {isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source)}</span>}
              {contact.assigned_to_name && <span>· {contact.assigned_to_name}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {st && <Badge text={isRTL ? st.ar : st.en} color={st.color} rail />}
              {temp && <Badge text={isRTL ? temp.labelAr : temp.label} color={temp.color} icon={temp.Icon} />}
              <Badge text={respLabel} color={resp.color} />
              {contact.interested_in_type && <Badge text={propTypeLabel(contact.interested_in_type, isRTL)} color="#6B7684" />}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {contact.phone && <a href={`tel:${contact.phone}`} title={isRTL ? 'اتصال' : 'Call'} className="w-9 h-9 flex items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 no-underline"><Phone size={16} /></a>}
            {contact.phone && <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" title="WhatsApp" className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366] no-underline"><MessageCircle size={16} /></a>}
            {canEdit && <button onClick={() => setShowEdit(true)} title={isRTL ? 'تعديل' : 'Edit'} className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface-bg dark:bg-brand-500/10 border border-edge dark:border-edge-dark text-content dark:text-content-dark cursor-pointer"><Pencil size={15} /></button>}
            <button onClick={close} title={isRTL ? 'إغلاق' : 'Close'} className="w-9 h-9 flex items-center justify-center rounded-lg text-content-muted dark:text-content-muted-dark hover:bg-gray-100 dark:hover:bg-brand-500/10 cursor-pointer"><X size={18} /></button>
          </div>
        </div>

        {/* Quick-log bar — grouped by engagement, then channel (mockup layout).
            Engaged opens the full form (outcome + note); no-engagement logs in one click. */}
        <div className="mt-4 rounded-xl bg-surface-bg dark:bg-brand-500/[0.04] border border-edge dark:border-edge-dark p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: '#158A57' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#158A57' }} />{isRTL ? 'تفاعل' : 'Engaged'}</span>
            <button onClick={() => quickEngaged('call')} className="inline-flex items-center gap-1 text-xs font-bold text-brand-500 bg-transparent border border-dashed border-edge dark:border-edge-dark rounded-lg px-2.5 py-1 cursor-pointer"><Plus size={13} />{isRTL ? 'تسجيل كامل' : 'Full log'}</button>
          </div>
          {['call', 'whatsapp', 'meeting'].map(ch => {
            const items = (ACTIVITY_RESULTS_BY_TYPE[ch] || []).filter(r => ENGAGED_RESULTS[ch]?.has(r));
            if (!items.length) return null;
            return (
              <div key={'eng-' + ch} className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[11px] font-bold text-content-muted dark:text-content-muted-dark w-16 shrink-0">{isRTL ? CHANNEL_LABEL[ch].ar : CHANNEL_LABEL[ch].en}</span>
                {items.map(r => { const b = ACTIVITY_RESULT_BADGES[r]; const Ic = stateIcon(ch, r); return (
                  <button key={r} onClick={() => quickEngaged(ch)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface-card dark:bg-surface-card-dark border cursor-pointer hover:opacity-80" style={{ borderColor: '#158A5755', color: '#158A57' }}><Ic size={13} />{isRTL ? b.ar : b.en}</button>
                ); })}
              </div>
            );
          })}
          <div className="h-px bg-edge dark:bg-edge-dark my-2.5" />
          <div className="mb-2"><span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: '#C9860A' }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#C9860A' }} />{isRTL ? 'مفيش تفاعل' : 'No engagement'}</span></div>
          {['call', 'whatsapp', 'meeting'].map(ch => {
            const items = (ACTIVITY_RESULTS_BY_TYPE[ch] || []).filter(r => !ENGAGED_RESULTS[ch]?.has(r));
            if (!items.length) return null;
            return (
              <div key={'no-' + ch} className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-[11px] font-bold text-content-muted dark:text-content-muted-dark w-16 shrink-0">{isRTL ? CHANNEL_LABEL[ch].ar : CHANNEL_LABEL[ch].en}</span>
                {items.map(r => { const b = ACTIVITY_RESULT_BADGES[r]; const Ic = stateIcon(ch, r); return (
                  <button key={r} onClick={() => quickNo(ch, r, isRTL ? b.ar : b.en)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-surface-card dark:bg-surface-card-dark border cursor-pointer hover:opacity-80" style={{ borderColor: '#C9860A55', color: '#C9860A' }}><Ic size={13} />{isRTL ? b.ar : b.en}</button>
                ); })}
              </div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b border-edge dark:border-edge-dark overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-2.5 text-sm font-bold whitespace-nowrap border-0 border-b-2 bg-transparent cursor-pointer ${tab === t.key ? 'text-brand-500 border-brand-500' : 'text-content-muted dark:text-content-muted-dark border-transparent'}`}>
              {isRTL ? t.ar : t.en}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === 'overview' && (
            <>
              <Card title={isRTL ? 'البيانات' : 'Details'} icon={User}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <Field icon={Phone} label={isRTL ? 'الهاتف' : 'Phone'} value={contact.phone} ltr />
                  <Field icon={Phone} label={isRTL ? 'هاتف 2' : 'Phone 2'} value={contact.phone2} ltr />
                  {extraPhones.length > 0 && <Field icon={Phone} label={isRTL ? 'أرقام إضافية' : 'Extra phones'} value={extraPhones.join(' · ')} ltr />}
                  <Field icon={Mail} label={isRTL ? 'الإيميل' : 'Email'} value={contact.email} ltr />
                  <Field icon={Tag} label={isRTL ? 'المصدر' : 'Source'} value={contact.source ? (isRTL ? (SOURCE_LABELS[contact.source] || contact.source) : (SOURCE_EN[contact.source] || contact.source)) : null} />
                  <Field icon={Tag} label={isRTL ? 'الحملة' : 'Campaign'} value={contact.campaign_name} />
                  <Field icon={DollarSign} label={isRTL ? 'الميزانية' : 'Budget'} value={(contact.budget_min || contact.budget_max) ? fmtBudget(contact.budget_min, contact.budget_max, isRTL) : null} />
                  <Field icon={Building2} label={isRTL ? 'مهتم بـ' : 'Interested in'} value={contact.interested_in_type ? propTypeLabel(contact.interested_in_type, isRTL) : null} />
                  <Field icon={MapPin} label={isRTL ? 'الموقع المفضل' : 'Preferred location'} value={contact.preferred_location} />
                  <Field icon={User} label={isRTL ? 'المسؤول' : 'Owner'} value={contact.assigned_to_name} />
                  <Field icon={Briefcase} label={isRTL ? 'الشركة' : 'Company'} value={contact.company} />
                  <Field icon={Hash} label={isRTL ? 'الجنسية' : 'Nationality'} value={contact.nationality} />
                  <Field icon={Calendar} label={isRTL ? 'أُنشئ' : 'Created'} value={contact.created_at ? new Date(contact.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
                  <Field icon={Clock} label={isRTL ? 'آخر نشاط' : 'Last activity'} value={contact.last_activity_at ? `${new Date(contact.last_activity_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} · ${daysSince(contact.last_activity_at)}${isRTL ? ' يوم' : 'd'}` : null} />
                  <Field icon={User} label={isRTL ? 'أُنشئ بواسطة' : 'Created by'} value={contact.created_by_name} />
                </div>
                {contact.notes && (
                  <div className="mt-3 pt-3 border-t border-edge/60 dark:border-edge-dark/60">
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark mb-1">{isRTL ? 'ملاحظات' : 'Notes'}</div>
                    <p className="m-0 text-sm text-content dark:text-content-dark whitespace-pre-line leading-relaxed">{contact.notes}</p>
                  </div>
                )}
              </Card>

              <Card title={isRTL ? 'ملخّص الليد' : 'Lead summary'} icon={BarChart3}>
                <SummaryRow label={isRTL ? 'المرحلة' : 'Lead stage'}>{stage ? <Badge text={isRTL ? stage.ar : stage.en} color={stage.color} /> : <span className="text-content-muted dark:text-content-muted-dark text-xs">—</span>}</SummaryRow>
                <SummaryRow label={isRTL ? 'الحالة' : 'Lead status'}>{st ? <Badge text={isRTL ? st.ar : st.en} color={st.color} rail /> : <span className="text-content-muted dark:text-content-muted-dark text-xs">—</span>}</SummaryRow>
                <SummaryRow label={isRTL ? 'الحرارة' : 'Temperature'}>{temp ? <Badge text={isRTL ? temp.labelAr : temp.label} color={temp.color} icon={temp.Icon} /> : <span className="text-content-muted dark:text-content-muted-dark text-xs">—</span>}</SummaryRow>
                <SummaryRow label={isRTL ? 'التجاوب' : 'Responsiveness'}>
                  <Badge text={respLabel} color={resp.color} />
                  <span className="text-[11px] text-content-muted dark:text-content-muted-dark">{respStat}</span>
                </SummaryRow>
                <SummaryRow label={isRTL ? 'الخطوة الجاية' : 'Next step'}>{contact.next_follow_up_at ? <Badge text={new Date(contact.next_follow_up_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} color="#2F6BD3" /> : <span className="text-content-muted dark:text-content-muted-dark text-xs">—</span>}</SummaryRow>
              </Card>

              {canViewAudit && audit.length > 0 && (
                <Card title={isRTL ? 'سجل التغييرات' : 'Change history'} icon={History}>
                  <div className="flex flex-col">
                    {audit.map(a => {
                      const actor = a.users ? (isRTL ? (a.users.full_name_ar || a.users.full_name_en) : (a.users.full_name_en || a.users.full_name_ar)) : a.user_name;
                      return (
                        <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-edge/60 dark:border-edge-dark/60 last:border-b-0">
                          <History size={14} className="text-content-muted dark:text-content-muted-dark shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-content dark:text-content-dark break-words">{a.description || a.action}</div>
                            <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">{actor || '—'}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}

          {tab === 'activity' && (
            <Card title={isRTL ? 'السجل الزمني' : 'Timeline'} icon={ActivityIcon}>
              {activities.length === 0 ? (
                <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
              ) : (
                <div className="flex flex-col">
                  {activities.map(a => {
                    const ch = CHANNEL_LABEL[a.type];
                    return (
                      <div key={a.id} className="flex items-start gap-2.5 py-2.5 border-b border-edge/60 dark:border-edge-dark/60 last:border-b-0">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: a.result && ['answered', 'replied', 'attended', 'visited'].includes(a.result) ? '#158A57' : '#C9860A' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-content dark:text-content-dark">{ch ? (isRTL ? ch.ar : ch.en) : a.type}</span>
                            <ResultBadge result={a.result} isRTL={isRTL} />
                            <OutcomeBadge outcome={a.outcome} isRTL={isRTL} />
                          </div>
                          {a.description && <div className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5 break-words">{a.description}</div>}
                          <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">
                            {a.user_name || '—'}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} · ${new Date(a.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === 'deals' && (
            <>
              <Card title={isRTL ? 'الصفقات' : 'Deals'} icon={DollarSign}>
                {deals.length === 0 ? (
                  <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'مفيش صفقات لسه' : 'No deals yet'}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {deals.map(dr => (
                      <div key={dr.id} className="rounded-xl border border-edge dark:border-edge-dark p-3.5">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[11px] font-mono text-content-muted dark:text-content-muted-dark">{dr.deal_number}{dr.unit_code ? ` · ${dr.unit_code}` : ''}</span>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: DEAL_COLOR[dr.status] || '#6B7280', background: (DEAL_COLOR[dr.status] || '#6B7280') + '18' }}>{dealStatusLabel(dr.status, isRTL)}</span>
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'القيمة: ' : 'Value: '}</span><span className="font-bold text-content dark:text-content-dark">{fmtMoney(dr.deal_value)}</span></div>
                          <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المقدّم: ' : 'Down: '}</span><span className="font-bold text-content dark:text-content-dark">{fmtMoney(dr.down_payment)}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card title={isRTL ? 'الاجتماعات' : 'Meetings'} icon={Calendar}>
                {meetings.length === 0 ? (
                  <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'مفيش اجتماعات' : 'No meetings'}</p>
                ) : (
                  <div className="flex flex-col">
                    {meetings.map(mt => (
                      <div key={mt.id} className="flex items-center gap-2 py-2 border-b border-edge/60 dark:border-edge-dark/60 last:border-b-0 text-sm">
                        <Calendar size={14} className="text-content-muted dark:text-content-muted-dark shrink-0" />
                        <span className="text-content dark:text-content-dark">{mt.scheduled_date ? new Date(mt.scheduled_date).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (mt.created_at ? new Date(mt.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' }) : '—')}</span>
                        <ResultBadge result={mt.result} isRTL={isRTL} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
              <Card title={isRTL ? 'وحدات للبيع' : 'Resale units'} icon={Building2}>
                <ResaleUnitsTab contact={contact} isRTL={isRTL} />
              </Card>
            </>
          )}

          {tab === 'documents' && (
            <>
              <Card title={isRTL ? 'المستندات' : 'Documents'} icon={FileText}>
                <DocumentsSection entity="contact" entityId={contact.id} entityName={contact.full_name} />
              </Card>
              <Card title={isRTL ? 'التعليقات' : 'Comments'} icon={MessageSquare}>
                <CommentsSection entity="contact" entityId={contact.id} entityName={contact.full_name} />
              </Card>
            </>
          )}

          {tab === 'analysis' && (
            <Card title={isRTL ? 'تحليل الليد' : 'Lead analysis'} icon={BarChart3}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-bg dark:bg-brand-500/[0.04] border border-edge dark:border-edge-dark p-3">
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'التجاوب' : 'Responsiveness'}</div>
                  <div className="text-lg font-bold mt-1" style={{ color: resp.color }}>{respLabel}</div>
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">{respStat}</div>
                </div>
                <div className="rounded-xl bg-surface-bg dark:bg-brand-500/[0.04] border border-edge dark:border-edge-dark p-3">
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'إجمالي الأنشطة' : 'Total activities'}</div>
                  <div className="text-lg font-bold text-content dark:text-content-dark mt-1">{activities.length}</div>
                </div>
                <div className="rounded-xl bg-surface-bg dark:bg-brand-500/[0.04] border border-edge dark:border-edge-dark p-3">
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'ردود / محاولات' : 'Replies / attempts'}</div>
                  <div className="text-lg font-bold text-content dark:text-content-dark mt-1">{resp.replies} / {resp.attempts}</div>
                </div>
              </div>
              <p className="text-[11px] text-content-muted dark:text-content-muted-dark mt-3">{isRTL ? 'المزيد من التحليل من كل الزوايا (القمع، أفضل وقت للتواصل، توقّع النية) قادم لاحقاً.' : 'More full-angle analysis (funnel, best contact time, predicted intent) is coming later.'}</p>
            </Card>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Modal open onClose={close} width="max-w-5xl" ariaLabel={isRTL ? 'ملف العميل' : 'Lead profile'}>
        {body()}
      </Modal>

      {showAction && contact && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAction(false)} aria-hidden="true" />
          <div className="relative w-full max-w-lg z-[1]">
            <TakeActionForm
              contact={contact}
              initialType={actionType}
              onCancel={() => setShowAction(false)}
              onLogInteraction={handleLog}
            />
          </div>
        </div>
      )}

      {showEdit && contact && (
        <EditContactModal
          contact={contact}
          userRole={profile?.role}
          campaigns={[]}
          onClose={() => setShowEdit(false)}
          onSave={async (updated) => { await updateContact(contact.id, updated); setContact(c => ({ ...c, ...updated })); }}
        />
      )}
    </>
  );
}

// Route wrapper for /crm/leads/:id (direct links) — closes by going back.
export default function LeadProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <LeadProfileOverlay contactId={id} onClose={() => navigate(-1)} />;
}
// (QuickChip removed — the quick-log bar now renders its own channel-grouped chips.)
