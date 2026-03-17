import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  BookOpen, Search, Plus, Pin, Eye, Tag, Edit2, Trash2,
  X, ChevronDown, Check, PinOff,
} from 'lucide-react';
import {
  getAll, create, update, remove, searchArticles, getByCategory,
  incrementViews, togglePin, CATEGORIES,
} from '../services/knowledgeBaseService';

// ── Simple markdown-like renderer ──────────────────────────────────────
function renderMarkdown(text, colors) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];
  let listType = 'ul';

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType;
      elements.push(
        <ListTag key={`list-${elements.length}`} style={{
          margin: '8px 0', paddingInlineStart: 24,
          listStyleType: listType === 'ol' ? 'decimal' : 'disc',
        }}>
          {listItems.map((item, i) => (
            <li key={i} style={{ fontSize: 14, lineHeight: 1.8, color: colors.text, marginBottom: 2 }}>{item}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={i} style={{ margin: '16px 0 6px', fontSize: 15, fontWeight: 600, color: colors.text }}>{trimmed.slice(4)}</h4>);
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={i} style={{ margin: '20px 0 8px', fontSize: 17, fontWeight: 700, color: colors.text }}>{trimmed.slice(3)}</h3>);
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={i} style={{ margin: '24px 0 10px', fontSize: 20, fontWeight: 700, color: colors.text }}>{trimmed.slice(2)}</h2>);
    } else if (trimmed.match(/^[-*] \[[ x]\] /)) {
      flushList();
      const checked = trimmed.match(/^[-*] \[x\] /);
      const label = trimmed.replace(/^[-*] \[[ x]\] /, '');
      elements.push(
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0', fontSize: 14, color: colors.text }}>
          <div style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
            border: `2px solid ${checked ? colors.accent : colors.border}`,
            background: checked ? colors.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {checked && <Check size={10} color="#fff" />}
          </div>
          <span style={{ textDecoration: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 }}>{label}</span>
        </div>
      );
    } else if (trimmed.match(/^[-*] /)) {
      if (!inList || listType !== 'ul') { flushList(); inList = true; listType = 'ul'; }
      listItems.push(trimmed.slice(2));
    } else if (trimmed.match(/^\d+\. /)) {
      if (!inList || listType !== 'ol') { flushList(); inList = true; listType = 'ol'; }
      listItems.push(trimmed.replace(/^\d+\. /, ''));
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      elements.push(<p key={i} style={{ margin: '6px 0', fontSize: 14, lineHeight: 1.8, color: colors.text }}>{trimmed}</p>);
    }
  });
  flushList();
  return elements;
}

// ── Main Component ─────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = isRTL ? 'ar' : 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [viewingArticle, setViewingArticle] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Editor state
  const [formData, setFormData] = useState({
    title: '', title_ar: '', content: '', content_ar: '',
    category: 'faq', tags: '', pinned: false,
  });

  const refresh = () => setRefreshKey(k => k + 1);

  // Colors
  const c = {
    bg: isDark ? '#0f172a' : '#f8fafc',
    cardBg: isDark ? '#1e293b' : '#ffffff',
    border: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#e2e8f0' : '#1e293b',
    textMuted: isDark ? '#94a3b8' : '#64748b',
    accent: '#4A7AAB',
    accentLight: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)',
    inputBg: isDark ? '#0f172a' : '#f1f5f9',
    hoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    danger: '#EF4444',
    pinColor: '#F59E0B',
  };

  // Fetch articles
  const articles = useMemo(() => {
    void refreshKey; // dependency trigger
    if (searchQuery.trim()) return searchArticles(searchQuery);
    if (activeCategory !== 'all') return getByCategory(activeCategory);
    return getAll();
  }, [searchQuery, activeCategory, refreshKey]);

  // Group by category
  const grouped = useMemo(() => {
    if (activeCategory !== 'all') return { [activeCategory]: articles };
    const g = {};
    articles.forEach(a => {
      if (!g[a.category]) g[a.category] = [];
      g[a.category].push(a);
    });
    return g;
  }, [articles, activeCategory]);

  const categoryList = [
    { id: 'all', label: { ar: 'الكل', en: 'All' } },
    ...Object.entries(CATEGORIES).map(([id, cat]) => ({ id, label: { ar: cat.ar, en: cat.en } })),
  ];

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleView = useCallback((article) => {
    incrementViews(article.id);
    setViewingArticle({ ...article, views: (article.views || 0) + 1 });
    refresh();
  }, []);

  const handleEdit = useCallback((article) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      title_ar: article.title_ar,
      content: article.content,
      content_ar: article.content_ar,
      category: article.category,
      tags: (article.tags || []).join(', '),
      pinned: article.pinned || false,
    });
    setShowEditor(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditingArticle(null);
    setFormData({ title: '', title_ar: '', content: '', content_ar: '', category: 'faq', tags: '', pinned: false });
    setShowEditor(true);
  }, []);

  const handleSave = useCallback(() => {
    const data = {
      ...formData,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      author: profile?.full_name_en || profile?.full_name_ar || 'Unknown',
    };
    if (editingArticle) {
      update(editingArticle.id, data);
    } else {
      create(data);
    }
    setShowEditor(false);
    setEditingArticle(null);
    refresh();
  }, [formData, editingArticle, profile]);

  const handleDelete = useCallback((id) => {
    remove(id);
    setDeleteConfirm(null);
    if (viewingArticle?.id === id) setViewingArticle(null);
    refresh();
  }, [viewingArticle]);

  const handleTogglePin = useCallback((id) => {
    togglePin(id);
    refresh();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, fontFamily: 'inherit',
    }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
        borderBottom: `1px solid ${c.border}`, background: c.cardBg,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: c.text }}>
              {isRTL ? 'قاعدة المعرفة' : 'Knowledge Base'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: c.textMuted }}>
              {isRTL ? 'مقالات وأدلة ووثائق الفريق' : 'Articles, guides & team documentation'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{
          flex: 1, minWidth: 200, maxWidth: 480, position: 'relative',
          ...(isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }),
        }}>
          <Search size={16} style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            ...(isRTL ? { right: 12 } : { left: 12 }),
            color: c.textMuted, pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder={isRTL ? 'ابحث في المقالات...' : 'Search articles...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px',
              ...(isRTL ? { paddingRight: 38 } : { paddingLeft: 38 }),
              background: c.inputBg, border: `1px solid ${c.border}`,
              borderRadius: 10, color: c.text, fontSize: 14,
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = c.accent}
            onBlur={e => e.target.style.borderColor = c.border}
          />
        </div>

        {/* Add button */}
        <button
          onClick={handleNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', background: c.accent,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            color: '#fff', fontSize: 13, fontWeight: 600,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <Plus size={16} />
          <span>{isRTL ? 'مقال جديد' : 'New Article'}</span>
        </button>
      </div>

      {/* ── Category Tabs ──────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, padding: '12px 24px',
        borderBottom: `1px solid ${c.border}`, background: c.cardBg,
        overflowX: 'auto', flexShrink: 0,
      }}>
        {categoryList.map(cat => {
          const isActive = activeCategory === cat.id;
          const catMeta = CATEGORIES[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); }}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${isActive ? (catMeta?.color || c.accent) : c.border}`,
                background: isActive ? (catMeta?.color || c.accent) + '18' : 'transparent',
                color: isActive ? (catMeta?.color || c.accent) : c.textMuted,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {cat.label[lang]}
            </button>
          );
        })}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {articles.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 20px', color: c.textMuted,
          }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <h3 style={{ margin: '0 0 8px', color: c.text, fontWeight: 600 }}>
              {isRTL ? 'لا توجد مقالات' : 'No articles found'}
            </h3>
            <p style={{ margin: 0, fontSize: 14 }}>
              {searchQuery
                ? (isRTL ? 'جرب كلمات بحث مختلفة' : 'Try different search terms')
                : (isRTL ? 'اضغط "مقال جديد" لإنشاء أول مقال' : 'Click "New Article" to create your first article')
              }
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([catId, items]) => {
            const catMeta = CATEGORIES[catId];
            if (!catMeta || !items.length) return null;
            return (
              <div key={catId} style={{ marginBottom: 32 }}>
                {/* Category header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 16, paddingBottom: 8,
                  borderBottom: `2px solid ${catMeta.color}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: catMeta.color, flexShrink: 0,
                  }} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>
                    {catMeta[lang]}
                  </h2>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 12,
                    background: catMeta.color + '20', color: catMeta.color, fontWeight: 600,
                  }}>
                    {items.length}
                  </span>
                </div>

                {/* Article cards grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 16,
                }}>
                  {items.map(article => (
                    <div
                      key={article.id}
                      onClick={() => handleView(article)}
                      style={{
                        background: c.cardBg,
                        border: `1px solid ${c.border}`,
                        borderRadius: 12,
                        padding: 20,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                        borderTop: `3px solid ${catMeta.color}`,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(0,0,0,0.08)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Pin badge */}
                      {article.pinned && (
                        <div style={{
                          position: 'absolute', top: 10, ...(isRTL ? { left: 10 } : { right: 10 }),
                        }}>
                          <Pin size={14} color={c.pinColor} fill={c.pinColor} style={{ transform: 'rotate(45deg)' }} />
                        </div>
                      )}

                      {/* Title */}
                      <h3 style={{
                        margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: c.text,
                        lineHeight: 1.4, paddingInlineEnd: article.pinned ? 24 : 0,
                      }}>
                        {isRTL ? (article.title_ar || article.title) : article.title}
                      </h3>

                      {/* Subtitle in other language */}
                      {isRTL && article.title && (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: c.textMuted }}>{article.title}</p>
                      )}
                      {!isRTL && article.title_ar && (
                        <p style={{ margin: '0 0 10px', fontSize: 12, color: c.textMuted }}>{article.title_ar}</p>
                      )}

                      {/* Preview */}
                      <p style={{
                        margin: '0 0 14px', fontSize: 13, color: c.textMuted,
                        lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {(isRTL ? (article.content_ar || article.content) : article.content)
                          .replace(/[#*\-\[\]]/g, '').slice(0, 150)}
                      </p>

                      {/* Tags */}
                      {article.tags?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                          {article.tags.slice(0, 3).map(tag => (
                            <span key={tag} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 8px', borderRadius: 10,
                              background: c.accentLight, color: c.accent,
                              fontSize: 11, fontWeight: 500,
                            }}>
                              <Tag size={9} />
                              {tag}
                            </span>
                          ))}
                          {article.tags.length > 3 && (
                            <span style={{ fontSize: 11, color: c.textMuted, padding: '2px 4px' }}>
                              +{article.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        paddingTop: 10, borderTop: `1px solid ${c.border}`,
                        fontSize: 11, color: c.textMuted,
                      }}>
                        <span>{article.author}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Eye size={12} />
                          <span>{article.views || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Article Viewer Modal ────────────────────────────── */}
      {viewingArticle && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setViewingArticle(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 200, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            paddingTop: 40, overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 800, margin: '0 20px 40px',
              background: c.cardBg, borderRadius: 16,
              border: `1px solid ${c.border}`,
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Viewer header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: `1px solid ${c.border}`,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                {viewingArticle.pinned && <Pin size={14} color={c.pinColor} fill={c.pinColor} style={{ transform: 'rotate(45deg)', flexShrink: 0 }} />}
                <h2 style={{
                  margin: 0, fontSize: 18, fontWeight: 700, color: c.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {isRTL ? (viewingArticle.title_ar || viewingArticle.title) : viewingArticle.title}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => handleTogglePin(viewingArticle.id)}
                  title={isRTL ? 'تثبيت/إلغاء التثبيت' : 'Pin/Unpin'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    background: viewingArticle.pinned ? c.pinColor + '20' : 'transparent',
                    border: `1px solid ${c.border}`, cursor: 'pointer',
                    color: viewingArticle.pinned ? c.pinColor : c.textMuted,
                  }}
                >
                  {viewingArticle.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button
                  onClick={() => { setViewingArticle(null); handleEdit(viewingArticle); }}
                  title={isRTL ? 'تعديل' : 'Edit'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${c.border}`, cursor: 'pointer', color: c.accent,
                  }}
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(viewingArticle.id)}
                  title={isRTL ? 'حذف' : 'Delete'}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${c.border}`, cursor: 'pointer', color: c.danger,
                  }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setViewingArticle(null)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 32, height: 32, borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${c.border}`, cursor: 'pointer', color: c.textMuted,
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Meta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px',
              borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.textMuted,
              flexWrap: 'wrap',
            }}>
              <span>{isRTL ? 'الكاتب:' : 'Author:'} <strong>{viewingArticle.author}</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Eye size={12} /> {viewingArticle.views || 0} {isRTL ? 'مشاهدة' : 'views'}
              </span>
              <span style={{
                padding: '2px 10px', borderRadius: 10,
                background: (CATEGORIES[viewingArticle.category]?.color || c.accent) + '20',
                color: CATEGORIES[viewingArticle.category]?.color || c.accent,
                fontWeight: 600,
              }}>
                {CATEGORIES[viewingArticle.category]?.[lang] || viewingArticle.category}
              </span>
              {viewingArticle.tags?.map(tag => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 8px', borderRadius: 10,
                  background: c.accentLight, color: c.accent, fontSize: 11,
                }}>
                  <Tag size={9} /> {tag}
                </span>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              {renderMarkdown(
                isRTL ? (viewingArticle.content_ar || viewingArticle.content) : viewingArticle.content,
                c
              )}
            </div>

            {/* Other language content */}
            {((isRTL && viewingArticle.content) || (!isRTL && viewingArticle.content_ar)) && (
              <div style={{
                padding: '16px 24px', borderTop: `1px solid ${c.border}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              }}>
                <p style={{
                  margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: c.textMuted,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {isRTL ? 'English Version' : 'النسخة العربية'}
                </p>
                <div style={{ direction: isRTL ? 'ltr' : 'rtl', fontSize: 13, color: c.textMuted, lineHeight: 1.8 }}>
                  {renderMarkdown(
                    isRTL ? viewingArticle.content : viewingArticle.content_ar,
                    { ...c, text: c.textMuted }
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Editor Modal ───────────────────────────────────── */}
      {showEditor && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setShowEditor(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 950, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
            paddingTop: 30, overflowY: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 720, margin: '0 20px 40px',
              background: c.cardBg, borderRadius: 16,
              border: `1px solid ${c.border}`,
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}
          >
            {/* Editor header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: `1px solid ${c.border}`,
            }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: c.text }}>
                {editingArticle
                  ? (isRTL ? 'تعديل المقال' : 'Edit Article')
                  : (isRTL ? 'مقال جديد' : 'New Article')
                }
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8,
                  background: 'transparent', border: `1px solid ${c.border}`,
                  cursor: 'pointer', color: c.textMuted,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Title EN */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                  {isRTL ? 'العنوان (إنجليزي)' : 'Title (English)'}
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  placeholder="Article title..."
                  style={{
                    width: '100%', padding: '10px 14px', background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                    fontSize: 14, outline: 'none', direction: 'ltr',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Title AR */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                  {isRTL ? 'العنوان (عربي)' : 'Title (Arabic)'}
                </label>
                <input
                  type="text"
                  value={formData.title_ar}
                  onChange={e => setFormData(f => ({ ...f, title_ar: e.target.value }))}
                  placeholder="عنوان المقال..."
                  style={{
                    width: '100%', padding: '10px 14px', background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                    fontSize: 14, outline: 'none', direction: 'rtl',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Category + Pinned */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                    {isRTL ? 'التصنيف' : 'Category'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={formData.category}
                      onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px', background: c.inputBg,
                        border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                        fontSize: 14, outline: 'none', appearance: 'none',
                        cursor: 'pointer', boxSizing: 'border-box',
                      }}
                    >
                      {Object.entries(CATEGORIES).map(([id, cat]) => (
                        <option key={id} value={id}>{cat[lang]}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                      ...(isRTL ? { left: 12 } : { right: 12 }), pointerEvents: 'none', color: c.textMuted,
                    }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    fontSize: 13, color: c.text, padding: '10px 14px',
                    background: formData.pinned ? c.pinColor + '18' : c.inputBg,
                    border: `1px solid ${formData.pinned ? c.pinColor : c.border}`,
                    borderRadius: 8, transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.pinned}
                      onChange={e => setFormData(f => ({ ...f, pinned: e.target.checked }))}
                      style={{ display: 'none' }}
                    />
                    <Pin size={14} color={formData.pinned ? c.pinColor : c.textMuted} fill={formData.pinned ? c.pinColor : 'none'} />
                    {isRTL ? 'تثبيت' : 'Pinned'}
                  </label>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                  {isRTL ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma separated)'}
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={e => setFormData(f => ({ ...f, tags: e.target.value }))}
                  placeholder={isRTL ? 'مبيعات, دليل, أفضل الممارسات' : 'sales, guide, best-practices'}
                  style={{
                    width: '100%', padding: '10px 14px', background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                    fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Content EN */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                  {isRTL ? 'المحتوى (إنجليزي)' : 'Content (English)'}
                  <span style={{ fontWeight: 400, marginInlineStart: 6, fontSize: 11 }}>
                    {isRTL ? 'يدعم Markdown' : 'Supports Markdown'}
                  </span>
                </label>
                <textarea
                  value={formData.content}
                  onChange={e => setFormData(f => ({ ...f, content: e.target.value }))}
                  placeholder="## Heading\n\n- Bullet point\n- Another point\n\nParagraph text..."
                  rows={8}
                  style={{
                    width: '100%', padding: '12px 14px', background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                    fontSize: 13, outline: 'none', resize: 'vertical',
                    fontFamily: 'monospace', lineHeight: 1.6, direction: 'ltr',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Content AR */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>
                  {isRTL ? 'المحتوى (عربي)' : 'Content (Arabic)'}
                </label>
                <textarea
                  value={formData.content_ar}
                  onChange={e => setFormData(f => ({ ...f, content_ar: e.target.value }))}
                  placeholder="## عنوان\n\n- نقطة\n- نقطة أخرى\n\nنص الفقرة..."
                  rows={8}
                  style={{
                    width: '100%', padding: '12px 14px', background: c.inputBg,
                    border: `1px solid ${c.border}`, borderRadius: 8, color: c.text,
                    fontSize: 13, outline: 'none', resize: 'vertical',
                    fontFamily: 'monospace', lineHeight: 1.6, direction: 'rtl',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 10, padding: '16px 24px', borderTop: `1px solid ${c.border}`,
            }}>
              <button
                onClick={() => setShowEditor(false)}
                style={{
                  padding: '9px 20px', background: 'transparent',
                  border: `1px solid ${c.border}`, borderRadius: 8,
                  color: c.textMuted, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title && !formData.title_ar}
                style={{
                  padding: '9px 24px', background: c.accent,
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: (!formData.title && !formData.title_ar) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {editingArticle
                  ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
                  : (isRTL ? 'إنشاء المقال' : 'Create Article')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Dialog ──────────────────────────── */}
      {deleteConfirm && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, margin: '0 20px',
              background: c.cardBg, borderRadius: 14,
              border: `1px solid ${c.border}`, padding: 24,
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.5)' : '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: c.danger + '15', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={20} color={c.danger} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: c.text }}>
                  {isRTL ? 'حذف المقال' : 'Delete Article'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: c.textMuted }}>
                  {isRTL ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure? This action cannot be undone.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 18px', background: 'transparent',
                  border: `1px solid ${c.border}`, borderRadius: 8,
                  color: c.textMuted, fontSize: 13, cursor: 'pointer',
                }}
              >
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '8px 18px', background: c.danger,
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
