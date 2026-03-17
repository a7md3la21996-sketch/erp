import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Globe, Briefcase, FileText, Receipt, Activity, ChevronRight, Clock, DollarSign, AlertCircle, Phone, Mail, MapPin, Languages, Loader2 } from 'lucide-react';
import { getPortalData, getLinkByToken } from '../services/customerPortalService';

const STAGE_COLORS = {
  new: '#6366f1', contacted: '#8b5cf6', qualified: '#a855f7', proposal: '#f59e0b',
  negotiation: '#f97316', closed_won: '#22c55e', closed_lost: '#ef4444',
  meeting: '#3b82f6', site_visit: '#06b6d4', follow_up: '#8b5cf6',
  pending: '#f59e0b', under_review: '#3b82f6', approved: '#22c55e',
};

const STAGE_LABELS = {
  ar: { new: 'جديد', contacted: 'تم التواصل', qualified: 'مؤهل', proposal: 'عرض سعر', negotiation: 'تفاوض', closed_won: 'مكسوبة', closed_lost: 'خسارة', meeting: 'اجتماع', site_visit: 'زيارة', follow_up: 'متابعة', pending: 'معلق', under_review: 'قيد المراجعة', approved: 'معتمد' },
  en: { new: 'New', contacted: 'Contacted', qualified: 'Qualified', proposal: 'Proposal', negotiation: 'Negotiation', closed_won: 'Won', closed_lost: 'Lost', meeting: 'Meeting', site_visit: 'Site Visit', follow_up: 'Follow Up', pending: 'Pending', under_review: 'Under Review', approved: 'Approved' },
};

const INVOICE_STATUS_COLORS = { paid: '#22c55e', partial: '#f59e0b', overdue: '#ef4444', sent: '#3b82f6', draft: '#94a3b8', cancelled: '#6b7280' };

export default function CustomerPortalView() {
  const { token } = useParams();
  const [lang, setLang] = useState('ar');
  const isRTL = lang === 'ar';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState(null);

  // Get company info
  const companyInfo = useMemo(() => {
    try {
      const config = JSON.parse(localStorage.getItem('platform_system_config') || '{}');
      return config.companyInfo || { name_ar: 'الشركة', name_en: 'Company' };
    } catch { return { name_ar: 'الشركة', name_en: 'Company' }; }
  }, []);

  useEffect(() => {
    const result = getPortalData(token);
    if (result) {
      setData(result);
      // Set initial tab based on permissions
      const perms = result.permissions;
      if (perms.view_opportunities) setActiveTab('opportunities');
      else if (perms.view_quotes) setActiveTab('quotes');
      else if (perms.view_invoices) setActiveTab('invoices');
      else if (perms.view_activities) setActiveTab('activities');
    } else {
      setError(true);
    }
    setLoading(false);
  }, [token]);

  const t = {
    welcome: { ar: 'مرحباً', en: 'Welcome' },
    opportunities: { ar: 'الفرص', en: 'Opportunities' },
    quotes: { ar: 'العروض', en: 'Quotes' },
    invoices: { ar: 'الفواتير', en: 'Invoices' },
    activities: { ar: 'الأنشطة', en: 'Activities' },
    activeOpps: { ar: 'فرص نشطة', en: 'Active Opportunities' },
    pendingQuotes: { ar: 'عروض معلقة', en: 'Pending Quotes' },
    totalInvoices: { ar: 'الفواتير', en: 'Invoices' },
    noData: { ar: 'لا توجد بيانات', en: 'No data available' },
    stage: { ar: 'المرحلة', en: 'Stage' },
    budget: { ar: 'الميزانية', en: 'Budget' },
    lastUpdate: { ar: 'آخر تحديث', en: 'Last Update' },
    amount: { ar: 'المبلغ', en: 'Amount' },
    status: { ar: 'الحالة', en: 'Status' },
    dueDate: { ar: 'تاريخ الاستحقاق', en: 'Due Date' },
    invalidLink: { ar: 'هذا الرابط غير صالح أو منتهي الصلاحية', en: 'This link is invalid or expired' },
    invalidDesc: { ar: 'يرجى التواصل مع الشركة للحصول على رابط جديد', en: 'Please contact the company for a new link' },
    poweredBy: { ar: 'مدعوم من بلاتفورم', en: 'Powered by Platform' },
    currency: { ar: 'ج.م', en: 'EGP' },
  };

  // Light theme only for portal
  const bg = '#f8fafc';
  const cardBg = '#ffffff';
  const border = '#e2e8f0';
  const text = '#1e293b';
  const muted = '#64748b';
  const brandGradient = 'linear-gradient(135deg, #6366f1, #8b5cf6)';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          {/* Language toggle */}
          <button onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')} style={{ position: 'fixed', top: 16, right: 16, background: cardBg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: text, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Languages size={14} /> {lang === 'ar' ? 'EN' : 'AR'}
          </button>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: text }}>{t.invalidLink[lang]}</h2>
          <p style={{ margin: 0, fontSize: 14, color: muted }}>{t.invalidDesc[lang]}</p>
        </div>
      </div>
    );
  }

  const { permissions: perms, opportunities, quotes, invoices, activities, contact_name } = data;
  const activeOpps = opportunities.filter(o => o.stage !== 'closed_lost' && o.stage !== 'closed_won');
  const pendingQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'pending');

  const tabs = [];
  if (perms.view_opportunities) tabs.push({ id: 'opportunities', label: t.opportunities, icon: Briefcase });
  if (perms.view_quotes) tabs.push({ id: 'quotes', label: t.quotes, icon: FileText });
  if (perms.view_invoices) tabs.push({ id: 'invoices', label: t.invoices, icon: Receipt });
  if (perms.view_activities) tabs.push({ id: 'activities', label: t.activities, icon: Activity });

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : '-';
  const fmtAmount = (a) => {
    if (!a) return '-';
    return `${Number(a).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')} ${t.currency[lang]}`;
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: bg }}>
      {/* Header */}
      <div style={{ background: brandGradient, padding: '20px 24px', position: 'relative' }}>
        {/* Language toggle */}
        <button
          onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
          style={{
            position: 'absolute', top: 16, [isRTL ? 'left' : 'right']: 20,
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8,
            padding: '6px 12px', fontSize: 13, cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', gap: 6, backdropFilter: 'blur(8px)',
          }}
        >
          <Languages size={14} /> {lang === 'ar' ? 'EN' : 'AR'}
        </button>

        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Globe size={22} color="rgba(255,255,255,0.8)" />
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 600 }}>
              {companyInfo[`name_${lang}`] || companyInfo.name_en || 'Platform'}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>
            {t.welcome[lang]}, {contact_name}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
        {/* Dashboard cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {perms.view_opportunities && (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Briefcase size={16} color="#6366f1" />
                <span style={{ fontSize: 12, color: muted }}>{t.activeOpps[lang]}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{activeOpps.length}</div>
            </div>
          )}
          {perms.view_quotes && (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FileText size={16} color="#f59e0b" />
                <span style={{ fontSize: 12, color: muted }}>{t.pendingQuotes[lang]}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{pendingQuotes.length}</div>
            </div>
          )}
          {perms.view_invoices && (
            <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Receipt size={16} color="#22c55e" />
                <span style={{ fontSize: 12, color: muted }}>{t.totalInvoices[lang]}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{invoices.length}</div>
            </div>
          )}
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
                    borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                    background: isActive ? '#6366f1' : cardBg,
                    color: isActive ? '#fff' : muted,
                    boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
                    whiteSpace: 'nowrap', transition: 'all 0.2s',
                  }}
                >
                  <Icon size={15} />
                  {tab.label[lang]}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Content */}
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Opportunities */}
          {activeTab === 'opportunities' && (
            <div>
              {opportunities.length === 0 ? (
                <EmptySection text={t.noData[lang]} />
              ) : (
                <div style={{ display: 'grid', gap: 0 }}>
                  {opportunities.map(opp => {
                    const stageColor = STAGE_COLORS[opp.stage] || '#94a3b8';
                    const stageLabel = STAGE_LABELS[lang][opp.stage] || opp.stage;
                    return (
                      <div key={opp.id} style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 4 }}>
                            {opp.title || opp.name || `${t.opportunities[lang]} #${opp.id?.toString().slice(-4)}`}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Stage badge */}
                            <span style={{
                              padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                              background: `${stageColor}18`, color: stageColor,
                            }}>
                              {stageLabel}
                            </span>
                            {/* Stage stepper */}
                            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                              {['new', 'contacted', 'qualified', 'proposal', 'negotiation'].map((s, i) => {
                                const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
                                const currentIdx = stages.indexOf(opp.stage);
                                const isCompleted = i <= currentIdx && currentIdx >= 0;
                                return (
                                  <div key={s} style={{
                                    width: 24, height: 4, borderRadius: 2,
                                    background: isCompleted ? stageColor : '#e2e8f0',
                                  }} />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                          {opp.budget && (
                            <div style={{ fontSize: 14, fontWeight: 600, color: text }}>
                              {fmtAmount(opp.budget)}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: muted, display: 'flex', alignItems: 'center', gap: 4, justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                            <Clock size={11} /> {fmtDate(opp.updated_at || opp.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Quotes */}
          {activeTab === 'quotes' && (
            <div>
              {quotes.length === 0 ? (
                <EmptySection text={t.noData[lang]} />
              ) : (
                <div>
                  {quotes.map(q => (
                    <div key={q.id} style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 2 }}>
                          {q.deal_name || `${t.quotes[lang]} #${q.id?.toString().slice(-4)}`}
                        </div>
                        <span style={{
                          padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                          background: q.status === 'approved' ? '#dcfce7' : q.status === 'draft' ? '#f1f5f9' : '#fef9c3',
                          color: q.status === 'approved' ? '#16a34a' : q.status === 'draft' ? '#64748b' : '#ca8a04',
                        }}>
                          {q.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{fmtAmount(q.amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Invoices */}
          {activeTab === 'invoices' && (
            <div>
              {invoices.length === 0 ? (
                <EmptySection text={t.noData[lang]} />
              ) : (
                <div>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '10px 20px', background: '#f8fafc', borderBottom: `1px solid ${border}`, fontSize: 12, fontWeight: 600, color: muted }}>
                    <div>#</div>
                    <div>{t.amount[lang]}</div>
                    <div>{t.status[lang]}</div>
                    <div>{t.dueDate[lang]}</div>
                  </div>
                  {invoices.map(inv => {
                    const statusColor = INVOICE_STATUS_COLORS[inv.status] || '#94a3b8';
                    return (
                      <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: `1px solid ${border}`, alignItems: 'center', fontSize: 13 }}>
                        <div style={{ fontWeight: 500, color: text }}>
                          {inv.invoice_number || inv.entry_number || `INV-${inv.id?.toString().slice(-4)}`}
                        </div>
                        <div style={{ fontWeight: 600, color: text }}>{fmtAmount(inv.total || inv.amount)}</div>
                        <div>
                          <span style={{
                            padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                            background: `${statusColor}18`, color: statusColor,
                          }}>
                            {inv.status}
                          </span>
                        </div>
                        <div style={{ color: muted }}>{fmtDate(inv.due_date)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Activities */}
          {activeTab === 'activities' && (
            <div>
              {activities.length === 0 ? (
                <EmptySection text={t.noData[lang]} />
              ) : (
                <div style={{ padding: '16px 20px' }}>
                  {activities.map((act, i) => (
                    <div key={act.id || i} style={{ display: 'flex', gap: 12, marginBottom: i < activities.length - 1 ? 16 : 0 }}>
                      {/* Timeline line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                        {i < activities.length - 1 && <div style={{ width: 2, flex: 1, background: '#e2e8f0', marginTop: 4 }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{act.type || act.activity_type || 'Activity'}</div>
                        {act.notes && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{act.notes}</div>}
                        <div style={{ fontSize: 11, color: muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={11} /> {fmtDate(act.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${border}`, padding: '20px 24px', marginTop: 40, textAlign: 'center' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 8 }}>
            {companyInfo[`name_${lang}`] || companyInfo.name_en || 'Platform'}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap', fontSize: 13, color: muted }}>
            {companyInfo.phone && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Phone size={13} /> {companyInfo.phone}
              </span>
            )}
            {companyInfo.email && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={13} /> {companyInfo.email}
              </span>
            )}
            {(companyInfo[`address_${lang}`] || companyInfo.address_en) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MapPin size={13} /> {companyInfo[`address_${lang}`] || companyInfo.address_en}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 12 }}>{t.poweredBy[lang]}</div>
        </div>
      </div>
    </div>
  );
}

function EmptySection({ text }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      <AlertCircle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  );
}
