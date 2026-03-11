import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { NAV_ITEMS } from '../../config/navigation';
import supabase from '../../lib/supabase';
import { Search, X, Users, ClipboardList, Target, FileText, ArrowRight, Command, Loader2 } from 'lucide-react';

// Flatten nav items into searchable pages
const flattenNav = (items, parent = null) => {
  const result = [];
  items.forEach(item => {
    if (item.path) {
      result.push({ id: item.id, label: item.label, path: item.path, icon: item.icon, parent });
    }
    if (item.children) {
      item.children.forEach(child => {
        if (child.path) {
          result.push({ id: child.id, label: child.label, path: child.path, icon: item.icon, parent: item.label });
        }
      });
    }
  });
  return result;
};

const ALL_PAGES = flattenNav(NAV_ITEMS);

export default function GlobalSearch({ onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [contacts, setContacts] = useState([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [tasks, setTasks] = useState([]);
  const debounceRef = useRef(null);

  // Load tasks from localStorage on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem('platform_tasks');
      if (t) setTasks(JSON.parse(t));
    } catch { /* ignore */ }
    inputRef.current?.focus();
  }, []);

  // Search contacts from Supabase with debounce
  const searchContacts = useCallback(async (q) => {
    if (!q.trim()) { setContacts([]); return; }
    setSearchingContacts(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, company, contact_type, source')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
        .limit(6);
      if (!error && data) { setContacts(data); setSearchingContacts(false); return; }
    } catch { /* fall through to localStorage */ }
    // Fallback: localStorage
    try {
      const cached = localStorage.getItem('platform_contacts');
      if (cached) {
        const all = JSON.parse(cached);
        const ql = q.toLowerCase();
        setContacts(all.filter(c =>
          c.full_name?.toLowerCase().includes(ql) ||
          c.phone?.includes(ql) ||
          c.email?.toLowerCase().includes(ql) ||
          c.company?.toLowerCase().includes(ql)
        ).slice(0, 6));
      }
    } catch { /* ignore */ }
    setSearchingContacts(false);
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchContacts(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, searchContacts]);

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const results = useMemo(() => {
    if (!query.trim()) {
      // Show recent/quick access pages
      return ALL_PAGES.slice(0, 8).map(p => ({
        type: 'page',
        id: 'page-' + p.id,
        title: p.label[lang] || p.label.en,
        subtitle: p.parent ? (p.parent[lang] || p.parent.en) : '',
        path: p.path,
        icon: p.icon,
      }));
    }

    const q = query.toLowerCase().trim();
    const items = [];

    // Search pages
    ALL_PAGES.forEach(p => {
      const nameAr = p.label.ar?.toLowerCase() || '';
      const nameEn = p.label.en?.toLowerCase() || '';
      if (nameAr.includes(q) || nameEn.includes(q) || p.id.includes(q)) {
        items.push({
          type: 'page',
          id: 'page-' + p.id,
          title: p.label[lang] || p.label.en,
          subtitle: p.parent ? (p.parent[lang] || p.parent.en) : (isRTL ? 'صفحة' : 'Page'),
          path: p.path,
          icon: p.icon,
        });
      }
    });

    // Contacts from Supabase (already filtered by debounced search)
    contacts.forEach(c => {
      items.push({
        type: 'contact',
        id: 'contact-' + c.id,
        title: c.full_name || (isRTL ? 'بدون اسم' : 'No Name'),
        subtitle: [c.phone, c.contact_type, c.company].filter(Boolean).join(' · '),
        data: c,
      });
    });

    // Search tasks
    tasks.forEach(t => {
      const match = t.title?.toLowerCase().includes(q) ||
        t.contact_name?.toLowerCase().includes(q);
      if (match) {
        items.push({
          type: 'task',
          id: 'task-' + t.id,
          title: t.title,
          subtitle: [t.contact_name, t.status, t.priority].filter(Boolean).join(' · '),
          data: t,
        });
      }
    });

    return items.slice(0, 12);
  }, [query, contacts, tasks, lang, isRTL]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(0); }, [results]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const active = listRef.current.children[activeIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleSelect = (item) => {
    if (item.type === 'page') {
      navigate(item.path);
    } else if (item.type === 'contact') {
      navigate('/contacts', { state: { selectedContactId: item.data.id } });
    } else if (item.type === 'task') {
      navigate('/tasks');
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    }
  };

  const typeIcon = (type) => {
    if (type === 'contact') return <Users size={15} />;
    if (type === 'task') return <ClipboardList size={15} />;
    return null;
  };

  const typeColor = (type) => {
    if (type === 'contact') return '#4A7AAB';
    if (type === 'task') return '#F59E0B';
    return '#6B8DB5';
  };

  const typeLabel = (type) => {
    if (type === 'contact') return isRTL ? 'جهة اتصال' : 'Contact';
    if (type === 'task') return isRTL ? 'مهمة' : 'Task';
    return '';
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'} style={{
        width: '100%', maxWidth: 580, background: isDark ? '#1a2234' : '#ffffff',
        borderRadius: 16, border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : '#d1d5db'}`,
        boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6)' : '0 24px 80px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      }}>
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}` }}>
          <Search size={20} color={isDark ? '#6B8DB5' : '#9ca3af'} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRTL ? 'ابحث عن صفحات، جهات اتصال، مهام...' : 'Search pages, contacts, tasks...'}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'inherit',
              background: 'transparent', color: isDark ? '#E2EAF4' : '#1A2B3C',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#6B8DB5' : '#9ca3af', padding: 2 }}>
              <X size={16} />
            </button>
          )}
          <kbd style={{
            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
            background: isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6',
            border: `1px solid ${isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb'}`,
            color: isDark ? '#6B8DB5' : '#9ca3af',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 400, overflowY: 'auto', padding: '8px' }}>
          {results.length === 0 && query.trim() && !searchingContacts ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: isDark ? '#6B8DB5' : '#9ca3af' }}>
              <Search size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 14 }}>{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
            </div>
          ) : results.length === 0 && searchingContacts ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: isDark ? '#6B8DB5' : '#9ca3af' }}>
              <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 14 }}>{isRTL ? 'جاري البحث...' : 'Searching...'}</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          ) : (
            <>
              {!query.trim() && (
                <div style={{ padding: '6px 12px 10px', fontSize: 11, fontWeight: 600, color: isDark ? '#6B8DB5' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {isRTL ? 'تنقل سريع' : 'Quick Navigation'}
                </div>
              )}
              {results.map((item, i) => {
                const Icon = item.icon;
                const isActive = i === activeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: isActive ? (isDark ? 'rgba(74,122,171,0.15)' : '#EDF2F7') : 'transparent',
                      color: isDark ? '#E2EAF4' : '#1A2B3C', fontFamily: 'inherit',
                      textAlign: isRTL ? 'right' : 'left',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: item.type === 'page'
                        ? (isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)')
                        : (typeColor(item.type) + '15'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: item.type === 'page' ? '#4A7AAB' : typeColor(item.type),
                    }}>
                      {item.type === 'page' && Icon ? <Icon size={16} /> : typeIcon(item.type)}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div style={{ fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>

                    {/* Type badge for non-page items */}
                    {item.type !== 'page' && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600, flexShrink: 0,
                        background: typeColor(item.type) + '15',
                        color: typeColor(item.type),
                      }}>
                        {typeLabel(item.type)}
                      </span>
                    )}

                    {/* Enter hint on active */}
                    {isActive && (
                      <ArrowRight size={14} color={isDark ? '#6B8DB5' : '#9ca3af'} style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 20px', borderTop: `1px solid ${isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 11, color: isDark ? '#6B8DB5' : '#9ca3af',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ padding: '1px 5px', borderRadius: 4, background: isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6', border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 10 }}>↑↓</kbd>
              {isRTL ? 'تنقل' : 'Navigate'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kbd style={{ padding: '1px 5px', borderRadius: 4, background: isDark ? 'rgba(74,122,171,0.1)' : '#f3f4f6', border: `1px solid ${isDark ? 'rgba(74,122,171,0.15)' : '#e5e7eb'}`, fontSize: 10 }}>↵</kbd>
              {isRTL ? 'فتح' : 'Open'}
            </span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Command size={11} />K {isRTL ? 'للفتح' : 'to open'}
          </span>
        </div>
      </div>
    </div>
  );
}
