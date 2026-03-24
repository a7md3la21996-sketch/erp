import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  Mail, Send, Star, Trash2, Inbox, FileText, Search,
  Paperclip, Link, Plus, X, MailOpen,
  CornerUpLeft,
} from 'lucide-react';
import {
  sendEmail, getEmails, markAsRead, starEmail, moveToTrash,
  saveDraft, getEmailStats, getTemplates, toggleReadStatus,
} from '../services/emailService';

// ── Helpers ────────────────────────────────────────────────────
function relativeTime(dateStr, isRTL) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

function loadContacts() {
  try { return JSON.parse(localStorage.getItem('platform_contacts') || '[]'); } catch { return []; }
}

function loadOpportunities() {
  try { return JSON.parse(localStorage.getItem('platform_opportunities') || '[]'); } catch { return []; }
}

// ── Folder Config ──────────────────────────────────────────────
const FOLDERS = [
  { id: 'inbox',  icon: Inbox,    label: { ar: 'الوارد', en: 'Inbox' },   color: '#4A7AAB' },
  { id: 'sent',   icon: Send,     label: { ar: 'المرسل', en: 'Sent' },    color: '#10B981' },
  { id: 'draft',  icon: FileText, label: { ar: 'المسودات', en: 'Drafts' }, color: '#F59E0B' },
  { id: 'trash',  icon: Trash2,   label: { ar: 'المحذوف', en: 'Trash' },  color: '#EF4444' },
];

// ── Main Component ─────────────────────────────────────────────
export default function EmailPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({ inbox: 0, unread: 0, sent: 0, drafts: 0 });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [editDraft, setEditDraft] = useState(null);

  const refresh = useCallback(async () => {
    const filtered = await getEmails(activeFolder, { search: searchQuery });
    setEmails(Array.isArray(filtered) ? filtered : []);
    const emailStats = await getEmailStats();
    setStats(emailStats && typeof emailStats === 'object' ? emailStats : { inbox: 0, unread: 0, sent: 0, drafts: 0 });
  }, [activeFolder, searchQuery]);

  useEffect(() => { refresh(); setLoading(false); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_emails_changed', handler);
    return () => window.removeEventListener('platform_emails_changed', handler);
  }, [refresh]);

  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    if (!email.read) await markAsRead(email.id);
  };

  const handleStar = async (e, id) => {
    e.stopPropagation();
    await starEmail(id);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await moveToTrash(id);
    if (selectedEmail?.id === id) setSelectedEmail(null);
  };

  const handleToggleRead = async (e, id) => {
    e.stopPropagation();
    await toggleReadStatus(id);
  };

  const handleOpenDraft = (draft) => {
    setEditDraft(draft);
    setShowCompose(true);
  };

  const folderCounts = {
    inbox: stats.inbox,
    sent: stats.sent,
    draft: stats.drafts,
    trash: 0,
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#4A7AAB', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'البريد الإلكتروني' : 'Email'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>
              {isRTL ? `${stats.unread} رسالة غير مقروءة` : `${stats.unread} unread messages`}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditDraft(null); setShowCompose(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
            color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} />
          {isRTL ? 'رسالة جديدة' : 'Compose'}
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Left sidebar - Folders */}
        <div style={{
          width: 220, flexShrink: 0,
          borderRight: isRTL ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}`,
          borderLeft: isRTL ? `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none',
          padding: '12px',
          overflowY: 'auto',
        }}>
          {FOLDERS.map(folder => {
            const active = activeFolder === folder.id;
            const Icon = folder.icon;
            const count = folderCounts[folder.id] || 0;
            const unread = folder.id === 'inbox' ? stats.unread : 0;
            return (
              <button
                key={folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedEmail(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: 'none', cursor: 'pointer',
                  background: active
                    ? (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)')
                    : 'transparent',
                  color: active
                    ? '#4A7AAB'
                    : (isDark ? '#94a3b8' : '#64748b'),
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  textAlign: isRTL ? 'right' : 'left',
                  marginBottom: 4,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{folder.label[lang]}</span>
                {count > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    background: unread > 0 ? '#4A7AAB' : (isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.06)'),
                    color: unread > 0 ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                    fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 6px',
                  }}>
                    {unread > 0 ? unread : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Email list */}
        <div style={{
          width: selectedEmail ? 340 : undefined,
          flex: selectedEmail ? 'none' : 1,
          borderRight: selectedEmail ? (isRTL ? 'none' : `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}`) : 'none',
          borderLeft: selectedEmail ? (isRTL ? `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}` : 'none') : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search bar */}
          <div style={{ padding: '12px 16px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}`,
            }}>
              <Search size={16} style={{ color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isRTL ? 'البحث في الرسائل...' : 'Search emails...'}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  background: 'transparent', fontSize: 13,
                  color: isDark ? '#e2e8f0' : '#1e293b',
                  direction: isRTL ? 'rtl' : 'ltr',
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={14} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {emails.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: 60, gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Mail size={24} style={{ color: '#4A7AAB', opacity: 0.5 }} />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8' }}>
                  {isRTL ? 'لا توجد رسائل' : 'No emails found'}
                </p>
              </div>
            ) : (
              emails.map(email => (
                <div
                  key={email.id}
                  onClick={() => activeFolder === 'draft' ? handleOpenDraft(email) : handleSelectEmail(email)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',
                    background: selectedEmail?.id === email.id
                      ? (isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.06)')
                      : !email.read
                        ? (isDark ? 'rgba(74,122,171,0.05)' : 'rgba(74,122,171,0.03)')
                        : 'transparent',
                    borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                    transition: 'background 0.15s',
                  }}
                >
                  {/* Unread dot */}
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                    background: !email.read ? '#4A7AAB' : 'transparent',
                  }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: email.read ? 500 : 700,
                        color: isDark ? '#e2e8f0' : '#1e293b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                      }}>
                        {activeFolder === 'sent' ? (email.to_name || email.to) : (email.from || email.to_name)}
                      </span>
                      <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
                        {relativeTime(email.sent_at, isRTL)}
                      </span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, fontWeight: email.read ? 400 : 600,
                      color: isDark ? '#cbd5e1' : '#334155',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {email.subject || (isRTL ? '(بدون موضوع)' : '(No subject)')}
                    </p>
                    <p style={{
                      margin: '2px 0 0', fontSize: 11,
                      color: isDark ? '#64748b' : '#94a3b8',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {email.body?.slice(0, 80)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                    <button onClick={(e) => handleStar(e, email.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                    }}>
                      <Star size={14} fill={email.starred ? '#F59E0B' : 'none'} style={{ color: email.starred ? '#F59E0B' : (isDark ? '#475569' : '#cbd5e1') }} />
                    </button>
                    <button onClick={(e) => handleDelete(e, email.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                    }}>
                      <Trash2 size={13} style={{ color: isDark ? '#475569' : '#cbd5e1' }} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Email viewer */}
        {selectedEmail && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Viewer header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{
                  margin: 0, fontSize: 18, fontWeight: 700,
                  color: isDark ? '#e2e8f0' : '#1e293b', lineHeight: 1.4,
                }}>
                  {selectedEmail.subject || (isRTL ? '(بدون موضوع)' : '(No subject)')}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {(selectedEmail.from || 'M')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {selectedEmail.from}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                      {isRTL ? 'إلى' : 'To'}: {selectedEmail.to_name || selectedEmail.to}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginInlineStart: 'auto' }}>
                    {new Date(selectedEmail.sent_at).toLocaleString(isRTL ? 'ar-EG' : 'en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleStar({ stopPropagation: () => {} }, selectedEmail.id)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Star size={15} fill={selectedEmail.starred ? '#F59E0B' : 'none'} style={{ color: selectedEmail.starred ? '#F59E0B' : (isDark ? '#64748b' : '#94a3b8') }} />
                </button>
                <button onClick={() => handleToggleRead({ stopPropagation: () => {} }, selectedEmail.id)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MailOpen size={15} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                </button>
                <button onClick={(e) => handleDelete(e, selectedEmail.id)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 size={15} style={{ color: '#EF4444' }} />
                </button>
                <button onClick={() => setSelectedEmail(null)} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={15} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)' }} />

            {/* Body */}
            <div style={{
              fontSize: 13, lineHeight: 1.8,
              color: isDark ? '#cbd5e1' : '#334155',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {selectedEmail.body}
            </div>

            {/* Attachments */}
            {selectedEmail.attachments?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>
                  <Paperclip size={13} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />
                  {isRTL ? 'المرفقات' : 'Attachments'}
                </p>
                {selectedEmail.attachments.map((a, i) => (
                  <span key={i} style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 11,
                    background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                    color: isDark ? '#94a3b8' : '#64748b', marginInlineEnd: 6, marginBottom: 4,
                  }}>
                    {a.name || a}
                  </span>
                ))}
              </div>
            )}

            {/* Quick reply area */}
            <div style={{
              marginTop: 'auto', padding: '16px 0 0',
              borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <button
                onClick={() => {
                  setEditDraft({
                    to: selectedEmail.from,
                    to_name: selectedEmail.from,
                    subject: `Re: ${selectedEmail.subject || ''}`,
                    contact_id: selectedEmail.contact_id,
                    opportunity_id: selectedEmail.opportunity_id,
                    thread_id: selectedEmail.thread_id,
                  });
                  setShowCompose(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)',
                  color: '#4A7AAB', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <CornerUpLeft size={15} />
                {isRTL ? 'رد' : 'Reply'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
          draft={editDraft}
          onClose={() => { setShowCompose(false); setEditDraft(null); }}
          onSent={() => { setShowCompose(false); setEditDraft(null); }}
        />
      )}
    </div>
  );
}

// ── Compose Modal ──────────────────────────────────────────────
function ComposeModal({ isDark, isRTL, lang, draft, onClose, onSent }) {
  const contacts = useMemo(() => loadContacts(), []);
  const opportunities = useMemo(() => loadOpportunities(), []);
  const templates = useMemo(() => getTemplates(), []);

  const [to, setTo] = useState(draft?.to || '');
  const [toName, setToName] = useState(draft?.to_name || '');
  const [subject, setSubject] = useState(draft?.subject || '');
  const [body, setBody] = useState(draft?.body || '');
  const [contactId, setContactId] = useState(draft?.contact_id || '');
  const [oppId, setOppId] = useState(draft?.opportunity_id || '');
  const [draftId] = useState(draft?.id || null);
  const [threadId] = useState(draft?.thread_id || null);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState({});
  const sendTimeoutRef = useRef(null);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts.slice(0, 10);
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [contacts, contactSearch]);

  const handleSelectContact = (c) => {
    setTo(c.email || c.phone || '');
    setToName(c.full_name || '');
    setContactId(c.id);
    setShowContactDropdown(false);
    setContactSearch('');
  };

  const handleTemplateSelect = (tplId) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    setSubject(isRTL ? (tpl.subject_ar || tpl.subject) : tpl.subject);
    setBody(isRTL ? (tpl.body_ar || tpl.body) : tpl.body);
  };

  const handleSend = () => {
    const errs = {};
    if (!to.trim()) errs.to = isRTL ? 'المستلم مطلوب' : 'Recipient is required';
    if (!subject.trim()) errs.subject = isRTL ? 'الموضوع مطلوب' : 'Subject is required';
    if (!body.trim()) errs.body = isRTL ? 'المحتوى مطلوب' : 'Body is required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setSending(true);
    sendTimeoutRef.current = setTimeout(() => {
      sendEmail({
        to, to_name: toName, subject, body,
        contact_id: contactId || null,
        opportunity_id: oppId || null,
        thread_id: threadId || undefined,
      });
      setSending(false);
      onSent();
    }, 300);
  };

  useEffect(() => {
    return () => { if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current); };
  }, []);

  const handleSaveDraft = () => {
    saveDraft({
      id: draftId, to, to_name: toName, subject, body,
      contact_id: contactId || null,
      opportunity_id: oppId || null,
      thread_id: threadId || undefined,
    });
    onClose();
  };

  // ESC to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640,
          background: isDark ? '#1e293b' : '#fff',
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
            {isRTL ? 'رسالة جديدة' : 'New Message'}
          </h3>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* To field with autocomplete */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
              {isRTL ? 'إلى' : 'To'}
            </label>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              border: errors.to ? '1.5px solid #ef4444' : `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
              background: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(0,0,0,0.02)',
            }}>
              {toName && (
                <span style={{
                  padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)',
                  color: '#4A7AAB', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  {toName}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => { setTo(''); setToName(''); setContactId(''); }} />
                </span>
              )}
              <input
                value={toName ? to : contactSearch || to}
                onChange={e => {
                  setErrors(p => ({ ...p, to: '' }));
                  if (toName) {
                    setTo(e.target.value);
                  } else {
                    setContactSearch(e.target.value);
                    setTo(e.target.value);
                    setShowContactDropdown(true);
                  }
                }}
                onFocus={() => { if (!toName) setShowContactDropdown(true); }}
                onBlur={() => setTimeout(() => setShowContactDropdown(false), 200)}
                placeholder={toName ? '' : (isRTL ? 'بحث عن جهة اتصال...' : 'Search contacts...')}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', minWidth: 100,
                }}
              />
            </div>
            {/* Contact dropdown */}
            {showContactDropdown && filteredContacts.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                marginTop: 4, borderRadius: 10, overflow: 'hidden',
                background: isDark ? '#334155' : '#fff',
                border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                {filteredContacts.map(c => (
                  <div
                    key={c.id}
                    onMouseDown={() => handleSelectContact(c)}
                    style={{
                      padding: '8px 12px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(c.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {c.full_name}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8' }}>
                        {c.email || c.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.to && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.to}</span>}
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
              {isRTL ? 'الموضوع' : 'Subject'}
            </label>
            <input
              value={subject}
              onChange={e => { setSubject(e.target.value); setErrors(p => ({ ...p, subject: '' })); }}
              placeholder={isRTL ? 'موضوع الرسالة' : 'Email subject'}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: errors.subject ? '1.5px solid #ef4444' : `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                background: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(0,0,0,0.02)',
                fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.subject && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.subject}</span>}
          </div>

          {/* Template selector + Opportunity link (row) */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
                <FileText size={11} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />
                {isRTL ? 'قالب' : 'Template'}
              </label>
              <select
                onChange={e => handleTemplateSelect(e.target.value)}
                defaultValue=""
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? '#1e293b' : '#fff',
                  fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">{isRTL ? 'اختر قالب...' : 'Select template...'}</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{isRTL ? (t.name_ar || t.name) : t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
                <Link size={11} style={{ verticalAlign: 'middle', marginInlineEnd: 4 }} />
                {isRTL ? 'ربط بفرصة' : 'Link to Opportunity'}
              </label>
              <select
                value={oppId}
                onChange={e => setOppId(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? '#1e293b' : '#fff',
                  fontSize: 12, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">{isRTL ? 'بدون ربط' : 'None'}</option>
                {opportunities.map(o => (
                  <option key={o.id} value={o.id}>{o.contact_name || o.id}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 }}>
              {isRTL ? 'المحتوى' : 'Body'}
            </label>
            <textarea
              value={body}
              onChange={e => { setBody(e.target.value); setErrors(p => ({ ...p, body: '' })); }}
              placeholder={isRTL ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
              style={{
                flex: 1, minHeight: 180, padding: '10px 12px', borderRadius: 8,
                border: errors.body ? '1.5px solid #ef4444' : `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
                background: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(0,0,0,0.02)',
                fontSize: 13, lineHeight: 1.6, color: isDark ? '#e2e8f0' : '#1e293b',
                outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {errors.body && <span style={{ color: '#ef4444', fontSize: 12, marginTop: 2, display: 'block' }}>{errors.body}</span>}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderTop: `1px solid ${isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)'}`,
        }}>
          <button onClick={handleSaveDraft} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
            color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600,
          }}>
            <FileText size={14} />
            {isRTL ? 'حفظ كمسودة' : 'Save Draft'}
          </button>
          <button onClick={handleSend} disabled={sending || !to.trim()} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: (!to.trim() || sending) ? (isDark ? '#334155' : '#e2e8f0') : 'linear-gradient(135deg, #4A7AAB, #2B4C6F)',
            color: (!to.trim() || sending) ? (isDark ? '#64748b' : '#94a3b8') : '#fff',
            fontSize: 13, fontWeight: 600,
            opacity: sending ? 0.7 : 1,
          }}>
            <Send size={15} />
            {sending ? (isRTL ? 'جاري الإرسال...' : 'Sending...') : (isRTL ? 'إرسال' : 'Send')}
          </button>
        </div>
      </div>
    </div>
  );
}
