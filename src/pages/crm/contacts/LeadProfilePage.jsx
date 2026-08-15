import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, User, Phone, Mail, Tag, DollarSign, MapPin, Calendar, Clock, Briefcase, FileText, MessageSquare, MessageCircle, Pencil, Building2, Hash, History } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { PageSkeleton, EmptyState } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { P } from '../../../config/roles';
import { updateContact } from '../../../services/contactsService';
import { getAuditLogs } from '../../../services/auditService';
import EditContactModal from './EditContactModal';
import ResaleUnitsTab from './ResaleUnitsTab';
import DocumentsSection from '../../../components/ui/DocumentsSection';
import CommentsSection from '../../../components/ui/CommentsSection';
import { TYPE, TEMP, SOURCE_LABELS, SOURCE_EN, fmtBudget, initials, daysSince } from './constants';

// ── Full Lead Profile — the roomy, id-based home for a lead's DETAILS
// (all fields, units, documents, comments). Phase 1 of the drawer/profile
// split: the drawer stays the fast triage surface; this page is where you go
// deep. Reached from the drawer's "Full profile" button. Nothing was removed
// from the drawer — this is purely additive.

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

function Section({ title, icon: Icon, children }) {
  return (
    <section className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-sm overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-edge dark:border-edge-dark">
        {Icon && <Icon size={16} className="text-brand-500 shrink-0" aria-hidden="true" />}
        <h2 className="m-0 text-sm font-bold text-content dark:text-content-dark">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export default function LeadProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const { profile, hasPermission } = useAuth();
  const canEdit = hasPermission(P.CONTACTS_EDIT) || hasPermission(P.CONTACTS_EDIT_OWN);
  const canViewAudit = hasPermission('audit.view');

  const [contact, setContact] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [state, setState] = useState('loading'); // loading | ready | missing
  const [deals, setDeals] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    let alive = true;
    setState('loading');
    supabase.from('contacts').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setContact(data || null);
        setState(data ? 'ready' : 'missing');
      })
      .catch(() => { if (alive) setState('missing'); });
    return () => { alive = false; };
  }, [id]);

  // Deals (all of this lead's deals) + change history (admin-only) — the
  // details that used to live in the drawer's Deal / Audit tabs.
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
    return () => { alive = false; };
  }, [id, canViewAudit]);

  if (state === 'loading') {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh">
        <PageSkeleton />
      </div>
    );
  }

  if (state === 'missing' || !contact) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-brand-500 bg-transparent border-none cursor-pointer mb-4">
          <BackIcon size={16} /> {isRTL ? 'رجوع' : 'Back'}
        </button>
        <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl">
          <EmptyState message={isRTL ? 'العميل غير موجود' : 'Lead not found'} />
        </div>
      </div>
    );
  }

  const tp = TYPE[contact.contact_type];
  const temp = TEMP[contact.temperature];
  const extraPhones = Array.isArray(contact.extra_phones) ? contact.extra_phones.filter(Boolean) : [];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-[#F7F8FA] dark:bg-[#0A0D13] min-h-dvh pb-16 max-w-[900px] mx-auto">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-content-muted dark:text-content-muted-dark bg-transparent border-none cursor-pointer mb-4 hover:text-brand-500">
        <BackIcon size={16} /> {isRTL ? 'رجوع' : 'Back'}
      </button>

      {/* Header */}
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl shadow-sm p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center text-lg font-bold shadow-sm"
            style={tp?.color ? { background: `linear-gradient(135deg, ${tp.color}30, ${tp.color}15)`, color: tp.color, border: `1px solid ${tp.color}20` } : { background: 'linear-gradient(135deg,#2B4C6F,#2F6BD3)', color: '#fff' }}>
            {initials(contact.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark leading-tight break-words">
              {contact.prefix && <span className="text-[#6B8DB5] font-medium me-1 text-base">{contact.prefix}</span>}
              {contact.full_name || (isRTL ? 'بدون اسم' : 'No Name')}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              {tp && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: tp.color, background: tp.bg }}>{isRTL ? tp.label : tp.labelEn}</span>}
              {contact.department && <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-[#8BA8C8] bg-[#8BA8C8]/10">{deptLabel(contact.department, isRTL)}</span>}
              {temp && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: temp.color, background: temp.bg }}><temp.Icon size={11} />{isRTL ? temp.labelAr : temp.label}</span>}
              {contact.contact_number && <span className="text-[11px] font-mono font-medium text-content-muted dark:text-content-muted-dark bg-brand-500/[0.06] px-2 py-0.5 rounded-full">{contact.contact_number}</span>}
            </div>
          </div>
        </div>

        {/* Quick actions — act straight from the profile (call / whatsapp / edit)
            so it isn't a read-only viewer. */}
        {(contact.phone || canEdit) && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-brand-500/10 border border-brand-500/25 text-brand-600 dark:text-brand-400 text-sm font-semibold no-underline active:scale-95 transition-transform">
                <Phone size={15} /> {isRTL ? 'اتصال' : 'Call'}
              </a>
            )}
            {contact.phone && (
              <a href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-sm font-semibold no-underline active:scale-95 transition-transform">
                <MessageCircle size={15} /> {isRTL ? 'واتساب' : 'WhatsApp'}
              </a>
            )}
            {canEdit && (
              <button onClick={() => setShowEdit(true)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-surface-bg dark:bg-brand-500/10 border border-edge dark:border-edge-dark text-content dark:text-content-dark text-sm font-semibold cursor-pointer active:scale-95 transition-transform">
                <Pencil size={15} /> {isRTL ? 'تعديل' : 'Edit'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Data */}
      <Section title={isRTL ? 'البيانات' : 'Details'} icon={User}>
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
          <Field icon={Briefcase} label={isRTL ? 'المسمى الوظيفي' : 'Job title'} value={contact.job_title} />
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
      </Section>

      {/* Deals */}
      <Section title={isRTL ? 'الصفقات' : 'Deals'} icon={DollarSign}>
        {deals.length === 0 ? (
          <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'مفيش صفقات لسه' : 'No deals yet'}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {deals.map(dr => (
              <div key={dr.id} className="rounded-xl border border-edge dark:border-edge-dark p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-mono text-content-muted dark:text-content-muted-dark">{dr.deal_number}{dr.unit_code ? ` · ${dr.unit_code}` : ''}</span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: DEAL_COLOR[dr.status] || '#6B7280', background: (DEAL_COLOR[dr.status] || '#6B7280') + '18' }}>
                    {dealStatusLabel(dr.status, isRTL)}
                  </span>
                </div>
                <div className="flex gap-4 text-xs mb-1.5">
                  <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'القيمة: ' : 'Value: '}</span><span className="font-bold text-content dark:text-content-dark">{fmtMoney(dr.deal_value)}</span></div>
                  <div><span className="text-[10px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'المقدّم: ' : 'Down: '}</span><span className="font-bold text-content dark:text-content-dark">{fmtMoney(dr.down_payment)}</span></div>
                </div>
                <div className="text-[10px] text-content-muted dark:text-content-muted-dark">
                  {isRTL ? 'بواسطة: ' : 'By: '}{(isRTL ? (dr.agent_ar || dr.agent_en) : (dr.agent_en || dr.agent_ar)) || '—'}
                  {dr.created_at ? ` · ${new Date(dr.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Units for sale */}
      <Section title={isRTL ? 'وحدات للبيع' : 'Resale units'} icon={Building2}>
        <ResaleUnitsTab contact={contact} isRTL={isRTL} />
      </Section>

      {/* Documents */}
      <Section title={isRTL ? 'المستندات' : 'Documents'} icon={FileText}>
        <DocumentsSection entity="contact" entityId={contact.id} entityName={contact.full_name} />
      </Section>

      {/* Comments */}
      <Section title={isRTL ? 'التعليقات' : 'Comments'} icon={MessageSquare}>
        <CommentsSection entity="contact" entityId={contact.id} entityName={contact.full_name} />
      </Section>

      {/* Change history — admin/operations only (audit_logs is RLS-gated). */}
      {canViewAudit && (
        <Section title={isRTL ? 'سجل التغييرات' : 'Change history'} icon={History}>
          {audit.length === 0 ? (
            <p className="m-0 text-sm text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا يوجد تغييرات مسجّلة' : 'No recorded changes'}</p>
          ) : (
            <div className="flex flex-col">
              {audit.map(a => {
                const actor = a.users ? (isRTL ? (a.users.full_name_ar || a.users.full_name_en) : (a.users.full_name_en || a.users.full_name_ar)) : a.user_name;
                return (
                  <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-edge/60 dark:border-edge-dark/60 last:border-b-0">
                    <History size={14} className="text-content-muted dark:text-content-muted-dark shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-content dark:text-content-dark break-words">{a.description || a.action}</div>
                      <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-0.5">
                        {actor || '—'}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })} · ${new Date(a.created_at).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {showEdit && (
        <EditContactModal
          contact={contact}
          userRole={profile?.role}
          campaigns={[]}
          onClose={() => setShowEdit(false)}
          onSave={async (updated) => {
            await updateContact(contact.id, updated);
            setContact(c => ({ ...c, ...updated }));
          }}
        />
      )}
    </div>
  );
}
