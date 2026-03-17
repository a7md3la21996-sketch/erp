import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Globe, Plus, Link2, Copy, Check, Eye, Trash2, X, Search, Ban, Clock, Users, ExternalLink, Shield } from 'lucide-react';
import { Button, Card, Input, Modal, ModalFooter, KpiCard, PageSkeleton } from '../components/ui';
import { getAllLinks, createPortalLink, deactivateLink, deleteLink } from '../services/customerPortalService';

export default function CustomerPortalPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ar').startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Generate modal state
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactResults, setContactResults] = useState([]);
  const [permissions, setPermissions] = useState({
    view_opportunities: true,
    view_quotes: true,
    view_invoices: true,
    view_activities: false,
  });
  const [expiryDays, setExpiryDays] = useState(30);
  const [generatedLink, setGeneratedLink] = useState(null);

  const loadLinks = useCallback(() => {
    setLinks(getAllLinks());
    setLoading(false);
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  // Search contacts from localStorage
  useEffect(() => {
    if (contactSearch.length < 2) { setContactResults([]); return; }
    try {
      const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      const q = contactSearch.toLowerCase();
      setContactResults(
        contacts.filter(c =>
          (c.full_name || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q)
        ).slice(0, 8)
      );
    } catch { setContactResults([]); }
  }, [contactSearch]);

  const now = new Date();
  const stats = useMemo(() => {
    const active = links.filter(l => l.is_active && new Date(l.expires_at) > now);
    const totalAccess = links.reduce((s, l) => s + (l.access_count || 0), 0);
    const sevenDays = new Date(now);
    sevenDays.setDate(sevenDays.getDate() + 7);
    const expiringSoon = links.filter(l => l.is_active && new Date(l.expires_at) > now && new Date(l.expires_at) <= sevenDays);
    return { active: active.length, totalAccess, expiringSoon: expiringSoon.length };
  }, [links]);

  const filtered = useMemo(() => {
    if (!searchQuery) return links;
    const q = searchQuery.toLowerCase();
    return links.filter(l =>
      (l.contact_name || '').toLowerCase().includes(q) ||
      (l.token || '').toLowerCase().includes(q)
    );
  }, [links, searchQuery]);

  const getStatus = (link) => {
    if (!link.is_active) return 'deactivated';
    if (new Date(link.expires_at) < now) return 'expired';
    return 'active';
  };

  const statusStyle = (status) => ({
    padding: '2px 10px',
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    display: 'inline-block',
    ...(status === 'active' ? { background: isDark ? 'rgba(34,197,94,0.15)' : '#dcfce7', color: '#16a34a' } :
      status === 'expired' ? { background: isDark ? 'rgba(234,179,8,0.15)' : '#fef9c3', color: '#ca8a04' } :
      { background: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2', color: '#dc2626' }),
  });

  const handleGenerate = () => {
    if (!selectedContact) return;
    const link = createPortalLink(selectedContact.id, selectedContact.full_name, permissions, expiryDays);
    const url = `${window.location.origin}/portal/${link.token}`;
    setGeneratedLink(url);
    loadLinks();
  };

  const handleCopyLink = (token) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(token);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDeactivate = (id) => {
    deactivateLink(id);
    loadLinks();
  };

  const handleDelete = (id) => {
    deleteLink(id);
    setConfirmDelete(null);
    loadLinks();
  };

  const handleOpenPortal = (token) => {
    window.open(`/portal/${token}`, '_blank');
  };

  const resetModal = () => {
    setShowModal(false);
    setContactSearch('');
    setSelectedContact(null);
    setContactResults([]);
    setGeneratedLink(null);
    setPermissions({ view_opportunities: true, view_quotes: true, view_invoices: true, view_activities: false });
    setExpiryDays(30);
  };

  const t = {
    title: { ar: 'إدارة بوابة العملاء', en: 'Customer Portal Management' },
    generate: { ar: 'إنشاء رابط', en: 'Generate Link' },
    activeLinks: { ar: 'روابط نشطة', en: 'Active Links' },
    totalAccess: { ar: 'إجمالي الوصول', en: 'Total Access' },
    expiringSoon: { ar: 'تنتهي قريباً', en: 'Expiring Soon' },
    contact: { ar: 'جهة الاتصال', en: 'Contact' },
    token: { ar: 'الرمز', en: 'Token' },
    created: { ar: 'تاريخ الإنشاء', en: 'Created' },
    expires: { ar: 'تاريخ الانتهاء', en: 'Expires' },
    status: { ar: 'الحالة', en: 'Status' },
    accesses: { ar: 'مرات الوصول', en: 'Accesses' },
    actions: { ar: 'الإجراءات', en: 'Actions' },
    searchContacts: { ar: 'ابحث عن جهة اتصال...', en: 'Search contacts...' },
    searchLinks: { ar: 'ابحث في الروابط...', en: 'Search links...' },
    permissions_title: { ar: 'الصلاحيات', en: 'Permissions' },
    viewOpps: { ar: 'عرض الفرص', en: 'View Opportunities' },
    viewQuotes: { ar: 'عرض العروض', en: 'View Quotes' },
    viewInvoices: { ar: 'عرض الفواتير', en: 'View Invoices' },
    viewActivities: { ar: 'عرض الأنشطة', en: 'View Activities' },
    expiry: { ar: 'مدة الصلاحية', en: 'Expiry Duration' },
    days: { ar: 'يوم', en: 'days' },
    generateBtn: { ar: 'إنشاء الرابط', en: 'Generate Link' },
    linkGenerated: { ar: 'تم إنشاء الرابط', en: 'Link Generated' },
    copyLink: { ar: 'نسخ الرابط', en: 'Copy Link' },
    copied: { ar: 'تم النسخ!', en: 'Copied!' },
    deactivate: { ar: 'تعطيل', en: 'Deactivate' },
    deleteConfirm: { ar: 'هل تريد حذف هذا الرابط؟', en: 'Delete this link?' },
    delete: { ar: 'حذف', en: 'Delete' },
    cancel: { ar: 'إلغاء', en: 'Cancel' },
    noLinks: { ar: 'لا توجد روابط بعد', en: 'No portal links yet' },
    active: { ar: 'نشط', en: 'Active' },
    expired: { ar: 'منتهي', en: 'Expired' },
    deactivated: { ar: 'معطل', en: 'Deactivated' },
    selectContact: { ar: 'اختر جهة اتصال أولاً', en: 'Select a contact first' },
    within7days: { ar: 'خلال 7 أيام', en: 'Within 7 days' },
  };

  if (loading) return <PageSkeleton hasKpis tableRows={5} tableCols={6} />;

  const bg = isDark ? '#1a1a2e' : '#f8fafc';
  const cardBg = isDark ? '#1e1e36' : '#ffffff';
  const border = isDark ? '#2a2a4a' : '#e2e8f0';
  const text = isDark ? '#e2e8f0' : '#1e293b';
  const muted = isDark ? '#94a3b8' : '#64748b';

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px', minHeight: '100vh', background: bg }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={20} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text }}>{t.title[lang]}</h1>
        </div>
        <Button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> {t.generate[lang]}
        </Button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Link2 size={18} color="#6366f1" />
            <span style={{ fontSize: 13, color: muted }}>{t.activeLinks[lang]}</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{stats.active}</div>
        </div>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Eye size={18} color="#22c55e" />
            <span style={{ fontSize: 13, color: muted }}>{t.totalAccess[lang]}</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{stats.totalAccess}</div>
        </div>
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Clock size={18} color="#f59e0b" />
            <span style={{ fontSize: 13, color: muted }}>{t.expiringSoon[lang]}</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{stats.expiringSoon}</div>
          <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{t.within7days[lang]}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16, maxWidth: 360 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 12, color: muted }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.searchLinks[lang]}
            style={{
              width: '100%', padding: '8px 12px', [isRTL ? 'paddingRight' : 'paddingLeft']: 36,
              borderRadius: 8, border: `1px solid ${border}`, background: cardBg, color: text,
              fontSize: 13, outline: 'none', direction: isRTL ? 'rtl' : 'ltr',
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: muted, fontSize: 14 }}>
            <Globe size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>{t.noLinks[lang]}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                {[t.contact, t.token, t.created, t.expires, t.status, t.accesses, t.actions].map((h, i) => (
                  <th key={i} style={{ padding: '12px 14px', textAlign: isRTL ? 'right' : 'left', color: muted, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {h[lang]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(link => {
                const status = getStatus(link);
                return (
                  <tr key={link.id} style={{ borderBottom: `1px solid ${border}` }}>
                    <td style={{ padding: '12px 14px', color: text, fontWeight: 500 }}>{link.contact_name}</td>
                    <td style={{ padding: '12px 14px', color: muted, fontFamily: 'monospace', fontSize: 12 }}>
                      {link.token.substring(0, 12)}...
                    </td>
                    <td style={{ padding: '12px 14px', color: muted, whiteSpace: 'nowrap' }}>
                      {new Date(link.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td style={{ padding: '12px 14px', color: muted, whiteSpace: 'nowrap' }}>
                      {new Date(link.expires_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={statusStyle(status)}>{t[status][lang]}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: text, textAlign: 'center' }}>{link.access_count || 0}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleOpenPortal(link.token)} title="View" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#6366f1' }}>
                          <ExternalLink size={15} />
                        </button>
                        <button onClick={() => handleCopyLink(link.token)} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: copiedId === link.token ? '#22c55e' : muted }}>
                          {copiedId === link.token ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        {status === 'active' && (
                          <button onClick={() => handleDeactivate(link.id)} title="Deactivate" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#f59e0b' }}>
                            <Ban size={15} />
                          </button>
                        )}
                        <button onClick={() => setConfirmDelete(link.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 6, color: '#ef4444' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Generate Link Modal */}
      {showModal && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={resetModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: cardBg, borderRadius: 16, width: '100%', maxWidth: 500,
              maxHeight: '90vh', overflow: 'auto', border: `1px solid ${border}`,
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${border}` }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: text }}>{t.generate[lang]}</h3>
              <button onClick={resetModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {generatedLink ? (
                /* Success state */
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Check size={28} color="#22c55e" />
                  </div>
                  <h4 style={{ margin: '0 0 16px', color: text }}>{t.linkGenerated[lang]}</h4>
                  <div style={{
                    background: isDark ? '#0f0f1e' : '#f1f5f9', borderRadius: 8, padding: '10px 14px',
                    fontSize: 12, fontFamily: 'monospace', color: muted, wordBreak: 'break-all', marginBottom: 16,
                    textAlign: 'left', direction: 'ltr',
                  }}>
                    {generatedLink}
                  </div>
                  <Button onClick={() => { navigator.clipboard.writeText(generatedLink); }} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }}>
                    <Copy size={14} /> {t.copyLink[lang]}
                  </Button>
                </div>
              ) : (
                /* Form */
                <>
                  {/* Contact search */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 6 }}>{t.contact[lang]}</label>
                    {selectedContact ? (
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff', borderRadius: 8, padding: '8px 12px',
                      }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{selectedContact.full_name}</div>
                          <div style={{ fontSize: 12, color: muted }}>{selectedContact.phone || selectedContact.email || ''}</div>
                        </div>
                        <button onClick={() => setSelectedContact(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', top: 10, [isRTL ? 'right' : 'left']: 10, color: muted }} />
                        <input
                          value={contactSearch}
                          onChange={e => setContactSearch(e.target.value)}
                          placeholder={t.searchContacts[lang]}
                          style={{
                            width: '100%', padding: '8px 12px', [isRTL ? 'paddingRight' : 'paddingLeft']: 32,
                            borderRadius: 8, border: `1px solid ${border}`, background: isDark ? '#0f0f1e' : '#fff',
                            color: text, fontSize: 13, outline: 'none', direction: isRTL ? 'rtl' : 'ltr',
                          }}
                        />
                        {contactResults.length > 0 && (
                          <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                            background: cardBg, border: `1px solid ${border}`, borderRadius: 8,
                            marginTop: 4, maxHeight: 200, overflow: 'auto',
                          }}>
                            {contactResults.map(c => (
                              <div
                                key={c.id}
                                onClick={() => { setSelectedContact(c); setContactSearch(''); setContactResults([]); }}
                                style={{
                                  padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${border}`,
                                  fontSize: 13, color: text,
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(99,102,241,0.1)' : '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 500 }}>{c.full_name}</div>
                                <div style={{ fontSize: 11, color: muted }}>{c.phone} {c.company ? `- ${c.company}` : ''}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Permissions */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>
                      <Shield size={14} /> {t.permissions_title[lang]}
                    </label>
                    {[
                      { key: 'view_opportunities', label: t.viewOpps },
                      { key: 'view_quotes', label: t.viewQuotes },
                      { key: 'view_invoices', label: t.viewInvoices },
                      { key: 'view_activities', label: t.viewActivities },
                    ].map(p => (
                      <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer', fontSize: 13, color: text }}>
                        <input
                          type="checkbox"
                          checked={permissions[p.key]}
                          onChange={e => setPermissions(prev => ({ ...prev, [p.key]: e.target.checked }))}
                          style={{ width: 16, height: 16, accentColor: '#6366f1' }}
                        />
                        {p.label[lang]}
                      </label>
                    ))}
                  </div>

                  {/* Expiry */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 6 }}>{t.expiry[lang]}</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[7, 14, 30, 60, 90].map(d => (
                        <button
                          key={d}
                          onClick={() => setExpiryDays(d)}
                          style={{
                            padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                            border: `1px solid ${expiryDays === d ? '#6366f1' : border}`,
                            background: expiryDays === d ? (isDark ? 'rgba(99,102,241,0.2)' : '#eef2ff') : 'transparent',
                            color: expiryDays === d ? '#6366f1' : text, fontWeight: expiryDays === d ? 600 : 400,
                          }}
                        >
                          {d} {t.days[lang]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleGenerate} disabled={!selectedContact} style={{ width: '100%', opacity: selectedContact ? 1 : 0.5 }}>
                    <Plus size={16} style={{ marginInlineEnd: 6 }} /> {t.generateBtn[lang]}
                  </Button>
                  {!selectedContact && (
                    <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 8, textAlign: 'center' }}>{t.selectContact[lang]}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setConfirmDelete(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: cardBg, borderRadius: 12, padding: 24, maxWidth: 360, width: '100%', border: `1px solid ${border}` }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 16, textAlign: 'center' }}>{t.deleteConfirm[lang]}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', color: text, fontSize: 13, cursor: 'pointer' }}>
                {t.cancel[lang]}
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                {t.delete[lang]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
