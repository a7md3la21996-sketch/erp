import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle, Send, Pencil, Trash2, X, Check } from 'lucide-react';
import {
  getComments, addComment, editComment, deleteComment,
  getTeamMembers, parseMentions,
} from '../../services/chatService';

// ── Relative time formatter ────────────────────────────────────
function relativeTime(dateStr, isRTL) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isRTL ? 'الآن' : 'Just now';
  if (mins < 60) return isRTL ? `منذ ${mins} دقيقة` : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isRTL ? `منذ ${hrs} ساعة` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
}

// ── Highlight @mentions in text ────────────────────────────────
function renderText(text, isDark) {
  if (!text) return null;
  const parts = text.split(/(@[\u0600-\u06FF\w\s]+?)(?=\s|@|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} style={{ color: '#4A7AAB', fontWeight: 600 }}>{part}</span>
      );
    }
    return part;
  });
}

// ── Avatar initials ────────────────────────────────────────────
const AVATAR_COLORS = ['#4A7AAB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6', '#F97316'];
function avatarColor(id) {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  return words.length >= 2 ? (words[0][0] + words[1][0]) : words[0].slice(0, 2);
}

export default function CommentsSection({ entity, entityId, entityName, onCommentAdded }) {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const CURRENT_USER = {
    id: profile?.id || '',
    name: profile?.full_name_ar || profile?.full_name_en || 'مستخدم',
  };

  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const textareaRef = useRef(null);
  const mentionRef = useRef(null);

  const teamMembers = getTeamMembers();

  const refreshComments = useCallback(async () => {
    if (entity && entityId) {
      try {
        const result = await getComments(entity, entityId);
        setComments(Array.isArray(result) ? result : []);
      } catch { setComments([]); }
    }
  }, [entity, entityId]);

  useEffect(() => {
    refreshComments();
  }, [refreshComments]);

  // Listen for platform_comment events
  useEffect(() => {
    const handler = () => refreshComments();
    window.addEventListener('platform_comment', handler);
    return () => window.removeEventListener('platform_comment', handler);
  }, [refreshComments]);

  // Auto-resize textarea
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  // Handle text input with @ detection
  const handleInput = (e) => {
    const val = e.target.value;
    setText(val);
    autoResize(e.target);

    // Detect @ for mentions
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');
    if (atIdx !== -1 && (atIdx === 0 || textBefore[atIdx - 1] === ' ' || textBefore[atIdx - 1] === '\n')) {
      const query = textBefore.slice(atIdx + 1);
      if (!query.includes(' ') || query.length < 20) {
        setShowMentions(true);
        setMentionFilter(query.toLowerCase());
        setMentionCursorPos(atIdx);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (member) => {
    const name = isRTL ? member.name : member.nameEn;
    const before = text.slice(0, mentionCursorPos);
    const after = text.slice(textareaRef.current?.selectionStart || mentionCursorPos);
    const newText = before + '@' + name + ' ' + after;
    setText(newText);
    setShowMentions(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = before.length + name.length + 2;
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
        autoResize(textareaRef.current);
      }
    }, 0);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mentions = parseMentions(trimmed, teamMembers);
    addComment({
      entity,
      entityId,
      entityName,
      text: trimmed,
      authorId: CURRENT_USER.id,
      authorName: CURRENT_USER.name,
      mentions,
    });
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    if (onCommentAdded) onCommentAdded();
    // Comments refresh via event listener
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEdit = (comment) => {
    setEditingId(comment.id);
    setEditText(comment.text);
  };

  const handleEditSave = (id) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    editComment(id, trimmed);
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = (id) => {
    deleteComment(id);
    // refresh via event
  };

  const filteredMembers = teamMembers.filter(m => {
    if (!mentionFilter) return true;
    return m.name.toLowerCase().includes(mentionFilter) ||
           m.nameEn.toLowerCase().includes(mentionFilter);
  });

  // ── Styles ───────────────────────────────────────────────────
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  };

  const headerTextStyle = {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const countStyle = {
    fontSize: 10,
    color: isDark ? '#94a3b8' : '#64748b',
    background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
    padding: '2px 8px',
    borderRadius: 10,
    fontWeight: 600,
  };

  const emptyStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: 8,
  };

  const emptyIconStyle = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4A7AAB',
  };

  const emptyTextStyle = {
    fontSize: 12,
    color: isDark ? '#94a3b8' : '#64748b',
    margin: 0,
  };

  const commentStyle = {
    display: 'flex',
    gap: 10,
    padding: '10px 0',
    borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.1)' : 'rgba(0,0,0,0.06)'}`,
  };

  const avatarStyle = (authorId) => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: avatarColor(authorId),
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
  });

  const nameStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
    margin: 0,
  };

  const timeStyle = {
    fontSize: 10,
    color: isDark ? '#94a3b8' : '#64748b',
  };

  const textStyle = {
    fontSize: 13,
    color: isDark ? '#e2e8f0' : '#1e293b',
    lineHeight: 1.5,
    margin: '4px 0 0',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  };

  const actionBtnStyle = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 4px',
    borderRadius: 4,
    color: isDark ? '#94a3b8' : '#64748b',
    display: 'flex',
    alignItems: 'center',
  };

  const inputAreaStyle = {
    position: 'relative',
    marginTop: 12,
    borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)'}`,
    paddingTop: 12,
  };

  const textareaStyle = {
    width: '100%',
    minHeight: 36,
    maxHeight: 120,
    padding: '8px 40px 8px 12px',
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.12)'}`,
    background: isDark ? '#132337' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  const sendBtnStyle = {
    position: 'absolute',
    [isRTL ? 'left' : 'right']: 8,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: text.trim() ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)'),
    border: 'none',
    color: text.trim() ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
    cursor: text.trim() ? 'pointer' : 'default',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const mentionDropdownStyle = {
    position: 'absolute',
    bottom: '100%',
    [isRTL ? 'right' : 'left']: 0,
    width: '100%',
    maxHeight: 180,
    overflowY: 'auto',
    background: isDark ? '#1a2332' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : 'rgba(0,0,0,0.12)'}`,
    borderRadius: 10,
    boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
    zIndex: 10,
    marginBottom: 4,
  };

  const mentionItemStyle = (hovered) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    cursor: 'pointer',
    background: hovered ? (isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.06)') : 'transparent',
    borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.08)' : 'rgba(0,0,0,0.04)'}`,
  });

  const editInputStyle = {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 6,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.25)' : 'rgba(0,0,0,0.12)'}`,
    background: isDark ? '#132337' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 12,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'none',
  };

  return (
    <div style={containerStyle} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={headerStyle}>
        <MessageCircle size={14} color="#4A7AAB" />
        <span style={headerTextStyle}>{isRTL ? 'التعليقات' : 'Comments'}</span>
        <span style={countStyle}>{comments.length}</span>
      </div>

      {/* Comments List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {comments.length === 0 ? (
          <div style={emptyStyle}>
            <div style={emptyIconStyle}>
              <MessageCircle size={18} />
            </div>
            <p style={emptyTextStyle}>{isRTL ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
            <p style={{ ...emptyTextStyle, fontSize: 11 }}>{isRTL ? 'اكتب أول تعليق...' : 'Write the first comment...'}</p>
          </div>
        ) : (
          comments.map(c => (
            <div key={c.id} style={commentStyle}>
              <div style={avatarStyle(c.author_id)}>{initials(c.author_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={nameStyle}>{c.author_name}</span>
                  <span style={timeStyle}>{relativeTime(c.created_at, isRTL)}</span>
                  {c.edited_at && <span style={{ ...timeStyle, fontStyle: 'italic' }}>{isRTL ? '(معدل)' : '(edited)'}</span>}
                </div>
                {editingId === c.id ? (
                  <div style={{ marginTop: 4, display: 'flex', gap: 4, alignItems: 'flex-end' }}>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      style={editInputStyle}
                      rows={2}
                      autoFocus
                    />
                    <button onClick={() => handleEditSave(c.id)} style={{ ...actionBtnStyle, color: '#10B981' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ ...actionBtnStyle, color: '#EF4444' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <p style={textStyle}>{renderText(c.text, isDark)}</p>
                )}
                {c.author_id === CURRENT_USER.id && editingId !== c.id && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <button onClick={() => handleEdit(c)} style={actionBtnStyle} title={isRTL ? 'تعديل' : 'Edit'}>
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} style={{ ...actionBtnStyle, color: '#EF4444' }} title={isRTL ? 'حذف' : 'Delete'}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div style={inputAreaStyle}>
        {showMentions && filteredMembers.length > 0 && (
          <div style={mentionDropdownStyle} ref={mentionRef}>
            {filteredMembers.map(m => (
              <div
                key={m.id}
                style={mentionItemStyle(false)}
                onClick={() => insertMention(m)}
                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={avatarStyle(m.id)}>{initials(m.name)}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>{m.name}</div>
                  <div style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>{m.nameEn}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isRTL ? 'اكتب تعليق... استخدم @ للإشارة' : 'Write a comment... Use @ to mention'}
            style={textareaStyle}
            rows={1}
          />
          <button onClick={handleSend} style={sendBtnStyle} disabled={!text.trim()}>
            <Send size={14} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
