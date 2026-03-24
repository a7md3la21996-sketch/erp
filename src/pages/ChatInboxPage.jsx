import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, AtSign, Filter, User, Briefcase, Target, Users } from 'lucide-react';
import { getRecentComments, getMentions, getTeamMembers } from '../services/chatService';
import Pagination from '../components/ui/Pagination';

const ENTITY_CONFIG = {
  contact:     { ar: 'جهة اتصال', en: 'Contact',     color: '#4A7AAB', icon: User },
  deal:        { ar: 'صفقة',      en: 'Deal',         color: '#10B981', icon: Briefcase },
  opportunity: { ar: 'فرصة',      en: 'Opportunity',  color: '#F59E0B', icon: Target },
  task:        { ar: 'مهمة',      en: 'Task',         color: '#8B5CF6', icon: Users },
};

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

function renderText(text, isDark) {
  if (!text) return null;
  const parts = text.split(/(@[\u0600-\u06FF\w\s]+?)(?=\s|@|$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} style={{ color: '#4A7AAB', fontWeight: 600 }}>{part}</span>;
    }
    return part;
  });
}

export default function ChatInboxPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const currentUserId = profile?.id || 'e1';

  const [activeTab, setActiveTab] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [allComments, setAllComments] = useState([]);
  const [mentionComments, setMentionComments] = useState([]);

  const refresh = () => {
    setAllComments(getRecentComments(500));
    setMentionComments(getMentions(currentUserId));
  };

  useEffect(() => {
    refresh();
  }, [currentUserId]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('platform_comment', handler);
    return () => window.removeEventListener('platform_comment', handler);
  }, []);

  const comments = activeTab === 'all' ? allComments : mentionComments;

  const filtered = useMemo(() => {
    if (filterEntity === 'all') return comments;
    return comments.filter(c => c.entity === filterEntity);
  }, [comments, filterEntity]);

  // Group by entity for "all" tab
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(c => {
      const key = `${c.entity}_${c.entity_id}`;
      if (!groups[key]) {
        groups[key] = {
          entity: c.entity,
          entityId: c.entity_id,
          entityName: c.entity_name,
          comments: [],
        };
      }
      groups[key].comments.push(c);
    });
    // Sort groups by most recent comment
    return Object.values(groups).sort((a, b) =>
      new Date(b.comments[0]?.created_at) - new Date(a.comments[0]?.created_at)
    );
  }, [filtered]);

  // Flatten for pagination
  const flatComments = useMemo(() => {
    const flat = [];
    grouped.forEach(g => {
      g.comments.forEach(c => flat.push({ ...c, _group: g }));
    });
    return flat;
  }, [grouped]);

  const totalItems = flatComments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const safePage = Math.min(page, totalPages || 1);
  const pagedComments = flatComments.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Group paged comments back
  const pagedGrouped = useMemo(() => {
    const groups = {};
    pagedComments.forEach(c => {
      const key = `${c.entity}_${c.entity_id}`;
      if (!groups[key]) {
        groups[key] = {
          entity: c.entity,
          entityId: c.entity_id,
          entityName: c.entity_name,
          comments: [],
        };
      }
      groups[key].comments.push(c);
    });
    return Object.values(groups);
  }, [pagedComments]);

  const entityTypes = ['all', 'contact', 'deal', 'opportunity', 'task'];

  // ── Styles ───────────────────────────────────────────────────
  const pageStyle = {
    padding: 24,
    maxWidth: 900,
    margin: '0 auto',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  const titleStyle = {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: isDark ? '#e2e8f0' : '#1e293b',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const subtitleStyle = {
    margin: '4px 0 0',
    fontSize: 13,
    color: isDark ? '#94a3b8' : '#64748b',
  };

  const tabBarStyle = {
    display: 'flex',
    gap: 0,
    marginTop: 20,
    marginBottom: 16,
    borderBottom: `2px solid ${isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)'}`,
  };

  const tabStyle = (active) => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? '#4A7AAB' : 'transparent'}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: -2,
    transition: 'color 0.15s',
  });

  const filterBarStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  };

  const filterBtnStyle = (active) => ({
    padding: '5px 14px',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 20,
    border: `1px solid ${active ? '#4A7AAB' : (isDark ? 'rgba(74,122,171,0.2)' : 'rgba(0,0,0,0.1)')}`,
    background: active ? 'rgba(74,122,171,0.12)' : 'transparent',
    color: active ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const groupHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
    borderRadius: '10px 10px 0 0',
    borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.1)' : 'rgba(0,0,0,0.06)'}`,
  };

  const entityBadgeStyle = (entity) => {
    const cfg = ENTITY_CONFIG[entity] || ENTITY_CONFIG.contact;
    return {
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 10,
      background: cfg.color + '18',
      color: cfg.color,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
    };
  };

  const entityNameStyle = {
    fontSize: 13,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const cardStyle = {
    background: isDark ? '#1a2332' : '#ffffff',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'rgba(74,122,171,0.12)' : 'rgba(0,0,0,0.08)'}`,
    marginBottom: 12,
    overflow: 'hidden',
  };

  const commentRowStyle = {
    display: 'flex',
    gap: 10,
    padding: '12px 16px',
    borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.06)' : 'rgba(0,0,0,0.04)'}`,
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

  const emptyStyle = {
    textAlign: 'center',
    padding: '60px 20px',
    color: isDark ? '#94a3b8' : '#64748b',
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div>
        <h1 style={titleStyle}>
          <MessageSquare size={22} color="#4A7AAB" />
          {isRTL ? 'المحادثات' : 'Chat Inbox'}
        </h1>
        <p style={subtitleStyle}>
          {isRTL ? 'جميع التعليقات والإشارات في مكان واحد' : 'All comments and mentions in one place'}
        </p>
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        <button style={tabStyle(activeTab === 'all')} onClick={() => { setActiveTab('all'); setPage(1); }}>
          <MessageSquare size={14} />
          {isRTL ? 'كل التعليقات' : 'All Comments'}
          <span style={{ fontSize: 10, background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, color: '#4A7AAB' }}>{allComments.length}</span>
        </button>
        <button style={tabStyle(activeTab === 'mentions')} onClick={() => { setActiveTab('mentions'); setPage(1); }}>
          <AtSign size={14} />
          {isRTL ? 'الإشارات' : 'Mentions'}
          <span style={{ fontSize: 10, background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)', padding: '1px 6px', borderRadius: 8, fontWeight: 700, color: '#4A7AAB' }}>{mentionComments.length}</span>
        </button>
      </div>

      {/* Filter */}
      <div style={filterBarStyle}>
        <Filter size={13} color={isDark ? '#94a3b8' : '#64748b'} />
        {entityTypes.map(et => {
          const label = et === 'all'
            ? (isRTL ? 'الكل' : 'All')
            : (isRTL ? ENTITY_CONFIG[et]?.ar : ENTITY_CONFIG[et]?.en) || et;
          return (
            <button
              key={et}
              style={filterBtnStyle(filterEntity === et)}
              onClick={() => { setFilterEntity(et); setPage(1); }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Comments List */}
      {pagedGrouped.length === 0 ? (
        <div style={emptyStyle}>
          <MessageSquare size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, margin: 0 }}>{isRTL ? 'لا توجد تعليقات' : 'No comments found'}</p>
        </div>
      ) : (
        pagedGrouped.map(group => {
          const cfg = ENTITY_CONFIG[group.entity] || ENTITY_CONFIG.contact;
          const Icon = cfg.icon;
          return (
            <div key={`${group.entity}_${group.entityId}`} style={cardStyle}>
              <div style={groupHeaderStyle}>
                <span style={entityBadgeStyle(group.entity)}>
                  <Icon size={10} />
                  {isRTL ? cfg.ar : cfg.en}
                </span>
                <span style={entityNameStyle}>{group.entityName || '—'}</span>
              </div>
              {group.comments.map(c => (
                <div key={c.id} style={commentRowStyle}>
                  <div style={avatarStyle(c.author_id)}>{initials(c.author_name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>{c.author_name}</span>
                      <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b' }}>{relativeTime(c.created_at, isRTL)}</span>
                      {c.edited_at && <span style={{ fontSize: 10, color: isDark ? '#94a3b8' : '#64748b', fontStyle: 'italic' }}>{isRTL ? '(معدل)' : '(edited)'}</span>}
                    </div>
                    <p style={{ fontSize: 13, color: isDark ? '#e2e8f0' : '#1e293b', lineHeight: 1.5, margin: '4px 0 0', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {renderText(c.text, isDark)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          );
        })
      )}

      {/* Pagination */}
      {totalItems > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={s => { setPageSize(s); setPage(1); }}
          totalItems={totalItems}
          safePage={safePage}
        />
      )}
    </div>
  );
}
