import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  MessageCircle, Send, Search, X, Plus, ChevronDown, Phone,
  FileText, Trash2, ToggleLeft, ToggleRight, ExternalLink,
  Clock, CheckCheck, Check, AlertCircle, Download,
  Users, Pencil,
} from 'lucide-react';
import {
  logMessage, getMessages, getConversation, getRecentConversations,
  getTemplates, saveTemplate, deleteTemplate, toggleTemplate,
  getWhatsAppStats, generateWhatsAppLink, fillTemplate,
  TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES,
} from '../services/whatsappService';

// ── Helpers ────────────────────────────────────────────────────
function relativeTime(dateStr, isRTL) {
  if (!dateStr) return '';
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

function formatTime(dateStr, isRTL) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

function loadContacts() {
  try { return JSON.parse(localStorage.getItem('platform_contacts') || '[]'); } catch { return []; }
}

const STATUS_ICONS = {
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

// ── Main Component ─────────────────────────────────────────────
export default function WhatsAppPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const rawLang = i18n.language || 'ar';
  const lang = rawLang.startsWith('ar') ? 'ar' : 'en';
  const isRTL = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [stats, setStats] = useState({ total_messages: 0, today_count: 0, templates_count: 0, contacts_reached: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showLogIncoming, setShowLogIncoming] = useState(false);
  const [incomingText, setIncomingText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const messagesEndRef = useRef(null);

  const [allContacts, setAllContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    const load = async () => {
      try { const c = await loadContacts(); setAllContacts(Array.isArray(c) ? c : []); } catch { setAllContacts([]); }
      try { const t = await getTemplates(false); setTemplates(Array.isArray(t) ? t : []); } catch { setTemplates([]); }
    };
    load();
  }, [showTemplates]);
  const activeTemplates = useMemo(() => (Array.isArray(templates) ? templates : []).filter(t => t.is_active), [templates]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    const conv = conversations.find(c => c.contact_id === selectedContactId);
    if (conv) return conv;
    const contact = allContacts.find(c => String(c.id) === String(selectedContactId));
    if (contact) return { contact_id: contact.id, contact_name: contact.full_name, contact_phone: contact.phone };
    return null;
  }, [selectedContactId, conversations, allContacts]);

  const refresh = useCallback(() => {
    setConversations(getRecentConversations());
    setStats(getWhatsAppStats());
    if (selectedContactId) {
      setMessages(getConversation(selectedContactId));
    }
  }, [selectedContactId]);

  useEffect(() => { refresh(); setLoading(false); }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_whatsapp_changed', handler);
    return () => window.removeEventListener('platform_whatsapp_changed', handler);
  }, [refresh]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(c =>
      (c.contact_name || '').toLowerCase().includes(q) ||
      (c.contact_phone || '').toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return allContacts.filter(c => c.phone).slice(0, 20);
    const q = contactSearch.toLowerCase();
    return allContacts.filter(c =>
      c.phone && (
        (c.full_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      )
    ).slice(0, 20);
  }, [allContacts, contactSearch]);

  const handleSelectConversation = (conv) => {
    setSelectedContactId(conv.contact_id);
    setMessages(getConversation(conv.contact_id));
    setShowNewChat(false);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedContact) return;
    const phone = selectedContact.contact_phone;
    if (!phone || !/^\+?\d{7,15}$/.test(phone.replace(/[\s-]/g, ''))) {
      alert(isRTL ? 'رقم الهاتف غير صالح' : 'Invalid phone number');
      return;
    }
    // Log message
    logMessage({
      contact_id: selectedContact.contact_id,
      contact_name: selectedContact.contact_name,
      contact_phone: phone,
      direction: 'outgoing',
      message: messageText.trim(),
      type: 'text',
    });
    // Open WhatsApp
    const link = generateWhatsAppLink(phone, messageText.trim());
    if (!link || !link.startsWith('https://wa.me/')) {
      alert(isRTL ? 'تعذر إنشاء رابط واتساب' : 'Failed to generate WhatsApp link');
      return;
    }
    window.open(link, '_blank');
    setMessageText('');
    refresh();
  };

  const handleSendTemplate = (tpl) => {
    if (!selectedContact) return;
    const contact = allContacts.find(c => String(c.id) === String(selectedContact.contact_id));
    const vars = {
      name: contact?.full_name || selectedContact.contact_name || '',
      company: contact?.company || '',
      amount: '',
      date: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US'),
    };
    const body = fillTemplate(isRTL ? (tpl.body_ar || tpl.body) : tpl.body, vars);
    setMessageText(body);
    setShowTemplatePicker(false);
  };

  const handleLogIncoming = () => {
    if (!incomingText.trim() || !selectedContact) return;
    logMessage({
      contact_id: selectedContact.contact_id,
      contact_name: selectedContact.contact_name,
      contact_phone: selectedContact.contact_phone,
      direction: 'incoming',
      message: incomingText.trim(),
      type: 'text',
    });
    setIncomingText('');
    setShowLogIncoming(false);
    refresh();
  };

  const handleStartChat = (contact) => {
    setSelectedContactId(contact.id);
    setMessages(getConversation(contact.id));
    setShowNewChat(false);
  };

  const border = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? '#1e293b' : '#fff';
  const inputBg = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)';

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#25D366', borderRadius: '50%' }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MessageCircle size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'واتساب' : 'WhatsApp'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>
              {isRTL ? `${stats.today_count} رسالة اليوم • ${stats.contacts_reached} جهة اتصال` : `${stats.today_count} today • ${stats.contacts_reached} contacts reached`}
            </p>
          </div>
        </div>

        {/* Stats pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: isRTL ? 'إجمالي الرسائل' : 'Total', value: stats.total_messages, color: '#25D366' },
            { label: isRTL ? 'اليوم' : 'Today', value: stats.today_count, color: '#4A7AAB' },
            { label: isRTL ? 'القوالب' : 'Templates', value: stats.templates_count, color: '#8B5CF6' },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '6px 14px', borderRadius: 10,
              background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowTemplates(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)',
            color: '#8B5CF6', fontSize: 12, fontWeight: 600,
          }}>
            <FileText size={14} /> {isRTL ? 'القوالب' : 'Templates'}
          </button>
          <button onClick={() => setShowNewChat(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            color: '#fff', fontSize: 12, fontWeight: 600,
          }}>
            <Plus size={14} /> {isRTL ? 'محادثة جديدة' : 'New Chat'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Left Panel - Conversations */}
        <div style={{
          width: selectedContactId ? 320 : 360, flexShrink: 0,
          borderRight: isRTL ? 'none' : `1px solid ${border}`,
          borderLeft: isRTL ? `1px solid ${border}` : 'none',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '12px 16px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: inputBg, border: `1px solid ${border}`,
            }}>
              <Search size={16} style={{ color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={isRTL ? 'البحث في المحادثات...' : 'Search conversations...'}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
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

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredConversations.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: 60, gap: 12,
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: isDark ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MessageCircle size={24} style={{ color: '#25D366', opacity: 0.5 }} />
                </div>
                <p style={{ margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                  {isRTL ? 'لا توجد محادثات بعد\nابدأ محادثة جديدة' : 'No conversations yet\nStart a new chat'}
                </p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const active = selectedContactId === conv.contact_id;
                return (
                  <div
                    key={conv.contact_id || conv.contact_phone}
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', cursor: 'pointer',
                      background: active
                        ? (isDark ? 'rgba(37,211,102,0.12)' : 'rgba(37,211,102,0.06)')
                        : 'transparent',
                      borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #25D366, #128C7E)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff',
                    }}>
                      {(conv.contact_name || '?')[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 500,
                          color: isDark ? '#e2e8f0' : '#1e293b',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {conv.contact_name || conv.contact_phone}
                        </span>
                        <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8', flexShrink: 0 }}>
                          {relativeTime(conv.last_message_at, isRTL)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {conv.direction === 'outgoing' && (
                          <CheckCheck size={12} style={{ color: '#25D366', flexShrink: 0 }} />
                        )}
                        <p style={{
                          margin: 0, fontSize: 11,
                          color: isDark ? '#64748b' : '#94a3b8',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {conv.last_message?.slice(0, 60) || '...'}
                        </p>
                        {conv.unread > 0 && (
                          <span style={{
                            minWidth: 18, height: 18, borderRadius: 9,
                            background: '#25D366', color: '#fff',
                            fontSize: 10, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 5px', flexShrink: 0,
                          }}>
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Chat View */}
        {selectedContact ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Chat header */}
            <div style={{
              padding: '12px 20px', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: `1px solid ${border}`,
              background: isDark ? 'rgba(37,211,102,0.04)' : 'rgba(37,211,102,0.02)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg, #25D366, #128C7E)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {(selectedContact.contact_name || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {selectedContact.contact_name || selectedContact.contact_phone}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', direction: 'ltr', textAlign: isRTL ? 'right' : 'left' }}>
                  {selectedContact.contact_phone}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setShowLogIncoming(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  color: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 600,
                }}>
                  <Download size={13} /> {isRTL ? 'تسجيل وارد' : 'Log Incoming'}
                </button>
                <a
                  href={generateWhatsAppLink(selectedContact.contact_phone)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 8, textDecoration: 'none',
                    background: 'rgba(37,211,102,0.12)', color: '#25D366',
                    fontSize: 11, fontWeight: 600,
                  }}
                >
                  <ExternalLink size={13} /> {isRTL ? 'فتح واتساب' : 'Open WhatsApp'}
                </a>
                <button onClick={() => { setSelectedContactId(null); setMessages([]); }} style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <X size={15} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px',
              background: isDark
                ? 'repeating-linear-gradient(45deg, rgba(37,211,102,0.01), rgba(37,211,102,0.01) 10px, transparent 10px, transparent 20px)'
                : 'repeating-linear-gradient(45deg, rgba(37,211,102,0.015), rgba(37,211,102,0.015) 10px, transparent 10px, transparent 20px)',
            }}>
              {messages.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: 12,
                }}>
                  <MessageCircle size={40} style={{ color: '#25D366', opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                    {isRTL ? 'لا توجد رسائل بعد\nأرسل رسالة للبدء' : 'No messages yet\nSend a message to start'}
                  </p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOutgoing = msg.direction === 'outgoing';
                  const StatusIcon = STATUS_ICONS[msg.status] || Check;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        justifyContent: isOutgoing ? (isRTL ? 'flex-start' : 'flex-end') : (isRTL ? 'flex-end' : 'flex-start'),
                        marginBottom: 8,
                      }}
                    >
                      <div style={{
                        maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                        borderTopRightRadius: isOutgoing && !isRTL ? 4 : 12,
                        borderTopLeftRadius: isOutgoing && isRTL ? 4 : (!isOutgoing && !isRTL ? 4 : 12),
                        borderBottomRightRadius: !isOutgoing && isRTL ? 4 : 12,
                        background: isOutgoing
                          ? (isDark ? '#1a4a2e' : '#DCF8C6')
                          : (isDark ? '#334155' : '#fff'),
                        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      }}>
                        <p style={{
                          margin: 0, fontSize: 13, lineHeight: 1.5,
                          color: isDark ? '#e2e8f0' : '#1e293b',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.message}
                        </p>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          justifyContent: 'flex-end', marginTop: 4,
                        }}>
                          <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8' }}>
                            {formatTime(msg.sent_at, isRTL)}
                          </span>
                          {isOutgoing && (
                            <StatusIcon size={12} style={{
                              color: msg.status === 'read' ? '#53BDEB' : (isDark ? '#64748b' : '#94a3b8'),
                            }} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Log incoming inline */}
            {showLogIncoming && (
              <div style={{
                padding: '10px 20px', flexShrink: 0,
                background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.04)',
                borderTop: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#4A7AAB', flexShrink: 0 }}>
                  {isRTL ? 'رسالة واردة:' : 'Incoming:'}
                </span>
                <input
                  value={incomingText}
                  onChange={e => setIncomingText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogIncoming()}
                  placeholder={isRTL ? 'اكتب الرسالة الواردة...' : 'Type incoming message...'}
                  autoFocus
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
                  }}
                />
                <button onClick={handleLogIncoming} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#4A7AAB', color: '#fff', fontSize: 11, fontWeight: 600,
                }}>
                  {isRTL ? 'حفظ' : 'Save'}
                </button>
                <button onClick={() => { setShowLogIncoming(false); setIncomingText(''); }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
                }}>
                  <X size={14} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                </button>
              </div>
            )}

            {/* Input area */}
            <div style={{
              padding: '12px 20px', flexShrink: 0,
              borderTop: `1px solid ${border}`,
              display: 'flex', alignItems: 'flex-end', gap: 8,
            }}>
              {/* Template picker */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  style={{
                    width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: showTemplatePicker ? 'rgba(139,92,246,0.15)' : inputBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: showTemplatePicker ? '#8B5CF6' : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                  title={isRTL ? 'اختر قالب' : 'Pick template'}
                >
                  <FileText size={16} />
                </button>
                {showTemplatePicker && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%', [isRTL ? 'right' : 'left']: 0,
                    marginBottom: 8, width: 280, maxHeight: 300, overflowY: 'auto',
                    background: isDark ? '#334155' : '#fff',
                    borderRadius: 12, border: `1px solid ${border}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 10,
                  }}>
                    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {isRTL ? 'اختر قالب' : 'Pick Template'}
                      </span>
                    </div>
                    {activeTemplates.length === 0 ? (
                      <p style={{ padding: 16, margin: 0, fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                        {isRTL ? 'لا توجد قوالب' : 'No templates'}
                      </p>
                    ) : (
                      activeTemplates.map(tpl => {
                        const cat = TEMPLATE_CATEGORIES.find(c => c.id === tpl.category);
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => handleSendTemplate(tpl)}
                            style={{
                              padding: '10px 12px', cursor: 'pointer',
                              borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.03)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{
                                fontSize: 12, fontWeight: 600,
                                color: isDark ? '#e2e8f0' : '#1e293b',
                              }}>
                                {isRTL ? (tpl.name_ar || tpl.name) : tpl.name}
                              </span>
                              {cat && (
                                <span style={{
                                  fontSize: 9, padding: '1px 6px', borderRadius: 4,
                                  background: cat.color + '18', color: cat.color, fontWeight: 600,
                                }}>
                                  {isRTL ? cat.label_ar : cat.label}
                                </span>
                              )}
                            </div>
                            <p style={{
                              margin: 0, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {(isRTL ? (tpl.body_ar || tpl.body) : tpl.body).slice(0, 60)}...
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Text input */}
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center',
                padding: '8px 12px', borderRadius: 10,
                background: inputBg, border: `1px solid ${border}`,
                minHeight: 36,
              }}>
                <textarea
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                  rows={1}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
                    resize: 'none', fontFamily: 'inherit', lineHeight: 1.4,
                    maxHeight: 80, overflow: 'auto',
                  }}
                />
              </div>

              {/* Send */}
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: messageText.trim() ? '#25D366' : inputBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                  opacity: messageText.trim() ? 1 : 0.5,
                }}
              >
                <Send size={16} style={{
                  color: messageText.trim() ? '#fff' : (isDark ? '#64748b' : '#94a3b8'),
                  transform: isRTL ? 'scaleX(-1)' : 'none',
                }} />
              </button>
            </div>
          </div>
        ) : (
          /* Empty state when no conversation is selected */
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 24,
              background: isDark ? 'rgba(37,211,102,0.08)' : 'rgba(37,211,102,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageCircle size={36} style={{ color: '#25D366', opacity: 0.4 }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {isRTL ? 'واتساب' : 'WhatsApp Hub'}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', maxWidth: 300 }}>
                {isRTL ? 'اختر محادثة أو ابدأ محادثة جديدة للتواصل مع عملائك عبر واتساب' : 'Select a conversation or start a new chat to communicate with your contacts via WhatsApp'}
              </p>
            </div>
            <button onClick={() => setShowNewChat(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              <Plus size={15} /> {isRTL ? 'محادثة جديدة' : 'New Chat'}
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setShowNewChat(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{
            width: '100%', maxWidth: 440, maxHeight: '80vh',
            background: cardBg, borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${border}`,
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                {isRTL ? 'محادثة جديدة' : 'New Chat'}
              </h3>
              <button onClick={() => setShowNewChat(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={16} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
              </button>
            </div>
            <div style={{ padding: '12px 20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, background: inputBg, border: `1px solid ${border}`,
              }}>
                <Search size={16} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                <input
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder={isRTL ? 'بحث عن جهة اتصال...' : 'Search contacts...'}
                  autoFocus
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b',
                  }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
              {filteredContacts.length === 0 ? (
                <p style={{ padding: 20, margin: 0, fontSize: 12, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
                  {isRTL ? 'لا توجد جهات اتصال' : 'No contacts found'}
                </p>
              ) : (
                filteredContacts.map(c => (
                  <div
                    key={c.id}
                    onClick={() => handleStartChat(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 20px', cursor: 'pointer',
                      borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #25D366, #128C7E)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(c.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {c.full_name}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', direction: 'ltr', textAlign: isRTL ? 'right' : 'left' }}>
                        {c.phone}
                      </p>
                    </div>
                    <Phone size={14} style={{ color: '#25D366', flexShrink: 0 }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Templates Manager Modal */}
      {showTemplates && (
        <TemplatesManager
          isDark={isDark}
          isRTL={isRTL}
          lang={lang}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}

// ── Templates Manager Modal ────────────────────────────────────
function TemplatesManager({ isDark, isRTL, onClose }) {
  const [templates, setTemplates] = useState(() => getTemplates());
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const border = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)';
  const inputBg = isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)';

  const handleToggle = (id) => {
    setTemplates(toggleTemplate(id));
  };

  const handleDelete = (id) => {
    setTemplates(deleteTemplate(id));
  };

  const handleSave = (tpl) => {
    setTemplates(saveTemplate(tpl));
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleEdit = (tpl) => {
    setEditingTemplate(tpl);
    setShowForm(true);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 700, maxHeight: '90vh',
        background: isDark ? '#1e293b' : '#fff',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} style={{ color: '#8B5CF6' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {isRTL ? 'إدارة القوالب' : 'Templates Manager'}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setEditingTemplate(null); setShowForm(true); }} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              color: '#fff', fontSize: 12, fontWeight: 600,
            }}>
              <Plus size={14} /> {isRTL ? 'قالب جديد' : 'New Template'}
            </button>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={16} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
            </button>
          </div>
        </div>

        {/* Templates list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {templates.length === 0 ? (
            <p style={{ padding: 40, margin: 0, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', textAlign: 'center' }}>
              {isRTL ? 'لا توجد قوالب' : 'No templates yet'}
            </p>
          ) : (
            templates.map(tpl => {
              const cat = TEMPLATE_CATEGORIES.find(c => c.id === tpl.category);
              return (
                <div key={tpl.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 20px',
                  borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.06)' : 'rgba(0,0,0,0.04)'}`,
                  opacity: tpl.is_active ? 1 : 0.5,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {isRTL ? (tpl.name_ar || tpl.name) : tpl.name}
                      </span>
                      {cat && (
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 4,
                          background: cat.color + '18', color: cat.color, fontWeight: 600,
                        }}>
                          {isRTL ? cat.label_ar : cat.label}
                        </span>
                      )}
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: isDark ? '#94a3b8' : '#64748b',
                      lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {isRTL ? (tpl.body_ar || tpl.body) : tpl.body}
                    </p>
                    {tpl.variables?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {tpl.variables.map(v => (
                          <span key={v} style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 4,
                            background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.05)',
                            color: isDark ? '#94a3b8' : '#64748b',
                          }}>
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => handleEdit(tpl)} style={{
                      width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Pencil size={13} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                    </button>
                    <button onClick={() => handleToggle(tpl.id)} style={{
                      width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tpl.is_active
                        ? <ToggleRight size={15} style={{ color: '#25D366' }} />
                        : <ToggleLeft size={15} style={{ color: isDark ? '#64748b' : '#94a3b8' }} />
                      }
                    </button>
                    <button onClick={() => handleDelete(tpl.id)} style={{
                      width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: inputBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Trash2 size={13} style={{ color: '#EF4444' }} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Template Form */}
        {showForm && (
          <TemplateForm
            isDark={isDark}
            isRTL={isRTL}
            template={editingTemplate}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingTemplate(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ── Template Form ──────────────────────────────────────────────
function TemplateForm({ isDark, isRTL, template, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: template?.id || '',
    name: template?.name || '',
    name_ar: template?.name_ar || '',
    category: template?.category || 'custom',
    body: template?.body || '',
    body_ar: template?.body_ar || '',
    variables: template?.variables || [],
    is_active: template?.is_active !== false,
  });

  const border = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.08)';
  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
    background: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(0,0,0,0.02)',
    fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4 };

  const insertVariable = (field, variable) => {
    const tag = `{{${variable}}}`;
    setForm(f => ({ ...f, [field]: f[field] + tag }));
    if (!form.variables.includes(variable)) {
      setForm(f => ({ ...f, variables: [...f.variables, variable] }));
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim() && !form.name_ar.trim()) return;
    onSave(form);
  };

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: `1px solid ${border}`,
      background: isDark ? 'rgba(37,211,102,0.03)' : 'rgba(37,211,102,0.02)',
      maxHeight: '50vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
          {template ? (isRTL ? 'تعديل القالب' : 'Edit Template') : (isRTL ? 'قالب جديد' : 'New Template')}
        </h4>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isRTL ? 'الاسم (إنجليزي)' : 'Name (English)'}</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isRTL ? 'الاسم (عربي)' : 'Name (Arabic)'}</label>
          <input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} placeholder="اسم القالب" dir="rtl" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>{isRTL ? 'التصنيف' : 'Category'}</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          style={{ ...inputStyle, background: isDark ? '#1e293b' : '#fff' }}
        >
          {TEMPLATE_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{isRTL ? c.label_ar : c.label}</option>
          ))}
        </select>
      </div>

      {/* Variable insertion buttons */}
      <div style={{ marginBottom: 8 }}>
        <label style={labelStyle}>{isRTL ? 'إدراج متغير' : 'Insert Variable'}</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPLATE_VARIABLES.map(v => (
            <button
              key={v}
              onClick={() => insertVariable('body', v)}
              style={{
                padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isDark ? 'rgba(37,211,102,0.12)' : 'rgba(37,211,102,0.08)',
                color: '#25D366', fontSize: 11, fontWeight: 600,
              }}
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isRTL ? 'المحتوى (إنجليزي)' : 'Body (English)'}</label>
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Template body with {{variables}}..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>{isRTL ? 'المحتوى (عربي)' : 'Body (Arabic)'}</label>
          <textarea
            value={form.body_ar}
            onChange={e => setForm(f => ({ ...f, body_ar: e.target.value }))}
            placeholder="محتوى القالب مع {{المتغيرات}}..."
            rows={4}
            dir="rtl"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
          color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600,
        }}>
          {isRTL ? 'إلغاء' : 'Cancel'}
        </button>
        <button onClick={handleSubmit} style={{
          padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #25D366, #128C7E)',
          color: '#fff', fontSize: 12, fontWeight: 600,
        }}>
          {isRTL ? 'حفظ' : 'Save'}
        </button>
      </div>
    </div>
  );
}
