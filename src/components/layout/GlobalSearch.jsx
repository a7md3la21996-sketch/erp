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
    <div onClick={onClose} className="fixed inset-0 z-[9999] bg-black/50 flex items-start justify-center pt-[12vh]">
      <div onClick={e => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'} className="w-full max-w-[580px] bg-surface-card dark:bg-surface-card-dark rounded-2xl border border-gray-300 dark:border-brand-500/30 shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-edge dark:border-brand-500/15">
          <Search size={20} className="shrink-0 text-content-muted dark:text-brand-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRTL ? 'ابحث عن صفحات، جهات اتصال، مهام...' : 'Search pages, contacts, tasks...'}
            className="flex-1 border-none outline-none text-[15px] font-[inherit] bg-transparent text-content dark:text-content-dark placeholder:text-content-muted dark:placeholder:text-brand-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-brand-400 p-0.5">
              <X size={16} />
            </button>
          )}
          <kbd className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-gray-100 dark:bg-brand-500/10 border border-edge dark:border-edge-dark text-content-muted dark:text-brand-400">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto p-2">
          {results.length === 0 && query.trim() && !searchingContacts ? (
            <div className="text-center py-8 px-5 text-content-muted dark:text-brand-400">
              <Search size={28} className="opacity-30 mb-2 mx-auto" />
              <p className="m-0 text-sm">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
            </div>
          ) : results.length === 0 && searchingContacts ? (
            <div className="text-center py-8 px-5 text-content-muted dark:text-brand-400">
              <Loader2 size={24} className="animate-spin mb-2 mx-auto" />
              <p className="m-0 text-sm">{isRTL ? 'جاري البحث...' : 'Searching...'}</p>
            </div>
          ) : (
            <>
              {!query.trim() && (
                <div className="px-3 pt-1.5 pb-2.5 text-[11px] font-semibold text-content-muted dark:text-brand-400 uppercase tracking-wide">
                  {isRTL ? 'تنقل سريع' : 'Quick Navigation'}
                </div>
              )}
              {results.map((item, i) => {
                const Icon = item.icon;
                const isActiveItem = i === activeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-[10px] border-none cursor-pointer font-[inherit] transition-colors duration-100 text-start ${isActiveItem ? 'bg-brand-50 dark:bg-brand-500/15' : 'bg-transparent'} text-content dark:text-content-dark`}
                  >
                    {/* Icon */}
                    <div
                      className="w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center"
                      style={{
                        background: item.type === 'page'
                          ? (isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)')
                          : (typeColor(item.type) + '15'),
                        color: item.type === 'page' ? '#4A7AAB' : typeColor(item.type),
                      }}
                    >
                      {item.type === 'page' && Icon ? <Icon size={16} /> : typeIcon(item.type)}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-content-muted dark:text-brand-400 whitespace-nowrap overflow-hidden text-ellipsis mt-px">
                          {item.subtitle}
                        </div>
                      )}
                    </div>

                    {/* Type badge for non-page items */}
                    {item.type !== 'page' && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0"
                        style={{
                          background: typeColor(item.type) + '15',
                          color: typeColor(item.type),
                        }}
                      >
                        {typeLabel(item.type)}
                      </span>
                    )}

                    {/* Enter hint on active */}
                    {isActiveItem && (
                      <ArrowRight size={14} className="shrink-0 text-content-muted dark:text-brand-400" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-edge dark:border-brand-500/10 flex items-center justify-between text-[11px] text-content-muted dark:text-brand-400">
          <div className="flex gap-3 items-center">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px rounded bg-gray-100 dark:bg-brand-500/10 border border-edge dark:border-brand-500/15 text-[10px]">↑↓</kbd>
              {isRTL ? 'تنقل' : 'Navigate'}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-px rounded bg-gray-100 dark:bg-brand-500/10 border border-edge dark:border-brand-500/15 text-[10px]">↵</kbd>
              {isRTL ? 'فتح' : 'Open'}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command size={11} />K {isRTL ? 'للفتح' : 'to open'}
          </span>
        </div>
      </div>
    </div>
  );
}
