import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { NAV_ITEMS } from '../../config/navigation';
import supabase from '../../lib/supabase';
import { fetchTasks } from '../../services/tasksService';
import { fetchActivities, ACTIVITY_TYPES } from '../../services/activitiesService';
import { fetchEmployees } from '../../services/employeesService';
import { fetchOpportunities } from '../../services/opportunitiesService';
import {
  Search, X, Users, ClipboardList, Target, FileText, ArrowRight, Command,
  Loader2, Briefcase, Activity, Clock, CheckSquare, UserCheck, AlertTriangle
} from 'lucide-react';

const RECENT_KEY = 'platform_global_search_recent';
const MAX_RECENT = 5;
const HISTORY_KEY = 'platform_global_search_history';
const MAX_HISTORY = 8;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let _searchCache = { data: null, ts: 0 };

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

// ── Entity config ──────────────────────────────────────────────────────────
const ENTITY_CONFIG = {
  contact: {
    icon: Users,
    color: '#4A7AAB',
    label: { ar: 'جهات الاتصال', en: 'Contacts' },
    labelSingle: { ar: 'جهة اتصال', en: 'Contact' },
    path: '/contacts',
  },
  opportunity: {
    icon: Target,
    color: '#2B4C6F',
    label: { ar: 'الفرص', en: 'Opportunities' },
    labelSingle: { ar: 'فرصة', en: 'Opportunity' },
    path: '/crm/opportunities',
  },
  task: {
    icon: CheckSquare,
    color: '#F59E0B',
    label: { ar: 'المهام', en: 'Tasks' },
    labelSingle: { ar: 'مهمة', en: 'Task' },
    path: '/tasks',
  },
  employee: {
    icon: UserCheck,
    color: '#6B8DB5',
    label: { ar: 'الموظفين', en: 'Employees' },
    labelSingle: { ar: 'موظف', en: 'Employee' },
    path: '/hr/employees',
  },
  activity: {
    icon: Activity,
    color: '#8BA8C8',
    label: { ar: 'الأنشطة', en: 'Activities' },
    labelSingle: { ar: 'نشاط', en: 'Activity' },
    path: '/activities',
  },
};

export default function GlobalSearch({ onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Cached entity data
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [activities, setActivities] = useState([]);

  // Recent searches
  const [recentSearches, setRecentSearches] = useState([]);
  // Search query history
  const [searchHistory, setSearchHistory] = useState([]);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const r = localStorage.getItem(RECENT_KEY);
      if (r) setRecentSearches(JSON.parse(r));
    } catch { /* ignore */ }
    try {
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setSearchHistory(JSON.parse(h));
    } catch { /* ignore */ }
    inputRef.current?.focus();
  }, []);

  // Load all entity data on mount — use module-level cache to avoid refetching on every open
  useEffect(() => {
    let cancelled = false;

    // Return cached data if fresh enough
    if (_searchCache.data && (Date.now() - _searchCache.ts) < CACHE_TTL) {
      const d = _searchCache.data;
      setContacts(d.contacts); setOpportunities(d.opportunities);
      setTasks(d.tasks); setEmployees(d.employees); setActivities(d.activities);
      setDataLoaded(true);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [contactsRes, oppsRes, tasksRes, employeesRes, activitiesRes] = await Promise.allSettled([
          (async () => {
            try {
              const { data, error } = await supabase
                .from('contacts')
                .select('id, full_name, phone, email, company, contact_type, source')
                .order('last_activity_at', { ascending: false })
                .limit(200);
              if (error) throw error;
              return data || [];
            } catch {
              return [];
            }
          })(),
          fetchOpportunities(),
          fetchTasks(),
          fetchEmployees(),
          fetchActivities({ limit: 100 }),
        ]);

        if (cancelled) return;
        const c = contactsRes.status === 'fulfilled' ? contactsRes.value : [];
        const o = oppsRes.status === 'fulfilled' ? oppsRes.value : [];
        const t = tasksRes.status === 'fulfilled' ? tasksRes.value : [];
        const e = employeesRes.status === 'fulfilled' ? employeesRes.value : [];
        const a = activitiesRes.status === 'fulfilled' ? activitiesRes.value : [];
        setContacts(c); setOpportunities(o); setTasks(t); setEmployees(e); setActivities(a);
        const allFailed = [contactsRes, oppsRes, tasksRes, employeesRes, activitiesRes].every(r => r.status === 'rejected');
        if (allFailed) setLoadError(true);
        else _searchCache = { data: { contacts: c, opportunities: o, tasks: t, employees: e, activities: a }, ts: Date.now() };
        setDataLoaded(true);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    };
    loadData();
    return () => { cancelled = true; };
  }, []);

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [onClose]);

  // Debounced query for filtering
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Build grouped results
  const { groupedResults, flatResults } = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();

    // No query: show recent searches + quick nav
    if (!q) {
      const items = [];
      // Search history
      searchHistory.forEach(term => {
        items.push({
          type: 'history',
          id: 'history-' + term,
          title: term,
          subtitle: '',
          section: 'history',
        });
      });
      // Recent searches
      recentSearches.forEach(r => {
        items.push({
          ...r,
          section: 'recent',
        });
      });
      // Quick nav pages
      ALL_PAGES.slice(0, 6).forEach(p => {
        items.push({
          type: 'page',
          id: 'page-' + p.id,
          title: p.label[lang] || p.label.en,
          subtitle: p.parent ? (p.parent[lang] || p.parent.en) : '',
          path: p.path,
          icon: p.icon,
          section: 'pages',
        });
      });

      // Group them
      const grouped = {};
      items.forEach(item => {
        const sec = item.section || 'other';
        if (!grouped[sec]) grouped[sec] = [];
        grouped[sec].push(item);
      });

      return { groupedResults: grouped, flatResults: items };
    }

    // Search across all entities
    const sections = {};
    const addToSection = (key, item) => {
      if (!sections[key]) sections[key] = [];
      sections[key].push(item);
    };

    // 1. Pages
    ALL_PAGES.forEach(p => {
      const nameAr = p.label.ar?.toLowerCase() || '';
      const nameEn = p.label.en?.toLowerCase() || '';
      if (nameAr.includes(q) || nameEn.includes(q) || p.id.includes(q)) {
        addToSection('page', {
          type: 'page',
          id: 'page-' + p.id,
          title: p.label[lang] || p.label.en,
          subtitle: p.parent ? (p.parent[lang] || p.parent.en) : (isRTL ? 'صفحة' : 'Page'),
          path: p.path,
          icon: p.icon,
        });
      }
    });

    // 2. Contacts
    contacts.forEach(c => {
      const match =
        c.full_name?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q);
      if (match) {
        addToSection('contact', {
          type: 'contact',
          id: 'contact-' + c.id,
          title: c.full_name || (isRTL ? 'بدون اسم' : 'No Name'),
          subtitle: [c.phone, c.contact_type, c.company].filter(Boolean).join(' · '),
          data: c,
        });
      }
    });

    // 3. Opportunities
    opportunities.forEach(o => {
      const contactName = o.contacts?.full_name || o.contact_name || '';
      const projectName = isRTL
        ? (o.projects?.name_ar || o.project_name || '')
        : (o.projects?.name_en || o.project_name || '');
      const match =
        contactName.toLowerCase().includes(q) ||
        projectName.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q);
      if (match) {
        addToSection('opportunity', {
          type: 'opportunity',
          id: 'opp-' + o.id,
          title: contactName || (isRTL ? 'فرصة' : 'Opportunity'),
          subtitle: [projectName, o.stage, o.priority].filter(Boolean).join(' · '),
          data: o,
        });
      }
    });

    // 4. Tasks
    tasks.forEach(t => {
      const match =
        t.title?.toLowerCase().includes(q) ||
        t.contact_name?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q);
      if (match) {
        addToSection('task', {
          type: 'task',
          id: 'task-' + t.id,
          title: t.title,
          subtitle: [t.contact_name, t.status, t.priority].filter(Boolean).join(' · '),
          data: t,
        });
      }
    });

    // 5. Employees
    employees.forEach(e => {
      const nameAr = e.full_name_ar?.toLowerCase() || '';
      const nameEn = e.full_name_en?.toLowerCase() || '';
      const match =
        nameAr.includes(q) ||
        nameEn.includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.phone?.includes(q) ||
        e.job_title?.toLowerCase().includes(q);
      if (match) {
        addToSection('employee', {
          type: 'employee',
          id: 'emp-' + e.id,
          title: isRTL ? (e.full_name_ar || e.full_name_en) : (e.full_name_en || e.full_name_ar),
          subtitle: [e.job_title, e.departments?.name_ar || e.department, e.status].filter(Boolean).join(' · '),
          data: e,
        });
      }
    });

    // 6. Activities
    activities.forEach(a => {
      const match = a.notes?.toLowerCase().includes(q);
      if (match) {
        const typeInfo = ACTIVITY_TYPES[a.type] || {};
        addToSection('activity', {
          type: 'activity',
          id: 'act-' + a.id,
          title: a.notes?.length > 60 ? a.notes.substring(0, 60) + '...' : (a.notes || ''),
          subtitle: [
            isRTL ? typeInfo.ar : typeInfo.en,
            isRTL ? a.user_name_ar : a.user_name_en,
            a.dept
          ].filter(Boolean).join(' · '),
          data: a,
        });
      }
    });

    // Limit each section
    const limited = {};
    Object.entries(sections).forEach(([key, items]) => {
      limited[key] = items.slice(0, 5);
    });

    // Flatten for keyboard nav
    const flat = [];
    ['page', 'contact', 'opportunity', 'task', 'employee', 'activity'].forEach(key => {
      if (limited[key]) flat.push(...limited[key]);
    });

    return { groupedResults: limited, flatResults: flat };
  }, [debouncedQuery, contacts, opportunities, tasks, employees, activities, lang, isRTL, recentSearches, searchHistory]);

  // Reset active index when results change
  useEffect(() => { setActiveIndex(0); }, [flatResults]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('[data-search-item]');
      const active = items[activeIndex];
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const saveRecent = (item) => {
    if (item.type === 'page' && !debouncedQuery.trim()) return; // Don't save quick nav clicks
    try {
      const recent = [...recentSearches.filter(r => r.id !== item.id), {
        type: item.type,
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        path: item.path,
        data: item.data ? { id: item.data.id } : undefined,
      }].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
      setRecentSearches(recent);
    } catch { /* ignore */ }
  };

  const saveHistory = (term) => {
    try {
      const history = [term, ...searchHistory.filter(h => h !== term)].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      setSearchHistory(history);
    } catch { /* ignore */ }
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setSearchHistory([]);
  };

  const handleSelect = (item) => {
    if (item.type === 'history') {
      setQuery(item.title);
      return; // don't navigate, just fill the search
    }
    if (debouncedQuery.trim()) {
      saveHistory(debouncedQuery.trim());
    }
    saveRecent(item);
    const cfg = ENTITY_CONFIG[item.type];
    if (item.type === 'page') {
      navigate(item.path);
    } else if (item.type === 'contact') {
      navigate('/contacts', { state: { selectedContactId: item.data?.id } });
    } else if (cfg) {
      navigate(cfg.path);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) {
        handleSelect(flatResults[activeIndex]);
      } else if (debouncedQuery.trim()) {
        saveHistory(debouncedQuery.trim());
      }
    }
  };

  const getTypeIcon = (type) => {
    const cfg = ENTITY_CONFIG[type];
    if (cfg) {
      const Icon = cfg.icon;
      return <Icon size={15} />;
    }
    return null;
  };

  const getTypeColor = (type) => {
    return ENTITY_CONFIG[type]?.color || '#6B8DB5';
  };

  const getTypeLabel = (type) => {
    const cfg = ENTITY_CONFIG[type];
    if (!cfg) return '';
    return isRTL ? cfg.labelSingle.ar : cfg.labelSingle.en;
  };

  const getSectionLabel = (section) => {
    if (section === 'history') return isRTL ? 'عمليات بحث سابقة' : 'Search History';
    if (section === 'recent') return isRTL ? 'عمليات بحث حديثة' : 'Recent Searches';
    if (section === 'pages') return isRTL ? 'تنقل سريع' : 'Quick Navigation';
    if (section === 'page') return isRTL ? 'الصفحات' : 'Pages';
    const cfg = ENTITY_CONFIG[section];
    if (cfg) return isRTL ? cfg.label.ar : cfg.label.en;
    return section;
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecentSearches([]);
  };

  // Track flat index for rendering
  let flatIndex = -1;

  // Determine section order
  const q = debouncedQuery.toLowerCase().trim();
  const sectionOrder = q
    ? ['page', 'contact', 'opportunity', 'task', 'employee', 'activity']
    : ['history', 'recent', 'pages'];

  const hasResults = flatResults.length > 0;
  const isSearching = loading && !dataLoaded;

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
            placeholder={isRTL ? 'ابحث عن صفحات، جهات اتصال، فرص، مهام، موظفين...' : 'Search pages, contacts, opportunities, tasks, employees...'}
            className="flex-1 border-none outline-none text-[15px] font-[inherit] bg-transparent text-content dark:text-content-dark placeholder:text-content-muted dark:placeholder:text-brand-400"
          />
          {loading && !dataLoaded && (
            <Loader2 size={16} className="animate-spin shrink-0 text-content-muted dark:text-brand-400" />
          )}
          {query && (
            <button onClick={() => setQuery('')} className="bg-transparent border-none cursor-pointer text-content-muted dark:text-brand-400 p-0.5">
              <X size={16} />
            </button>
          )}
          <kbd className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-gray-100 dark:bg-brand-500/10 border border-edge dark:border-edge-dark text-content-muted dark:text-brand-400">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[420px] overflow-y-auto p-2">
          {loadError && q ? (
            <div className="text-center py-8 px-5 text-content-muted dark:text-brand-400">
              <AlertTriangle size={28} className="opacity-40 mb-2 mx-auto text-amber-500" />
              <p className="m-0 text-sm">{isRTL ? 'تعذر تحميل البيانات' : 'Failed to load data'}</p>
              <p className="m-0 text-[11px] mt-1 opacity-60">{isRTL ? 'تحقق من الاتصال وحاول مرة أخرى' : 'Check your connection and try again'}</p>
            </div>
          ) : !hasResults && q && !isSearching ? (
            <div className="text-center py-8 px-5 text-content-muted dark:text-brand-400">
              <Search size={28} className="opacity-30 mb-2 mx-auto" />
              <p className="m-0 text-sm">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
              <p className="m-0 text-[11px] mt-1 opacity-60">{isRTL ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}</p>
            </div>
          ) : !hasResults && isSearching ? (
            <div className="text-center py-8 px-5 text-content-muted dark:text-brand-400">
              <Loader2 size={24} className="animate-spin mb-2 mx-auto" />
              <p className="m-0 text-sm">{isRTL ? 'جاري تحميل البيانات...' : 'Loading data...'}</p>
            </div>
          ) : (
            <>
              {sectionOrder.map(section => {
                const items = groupedResults[section];
                if (!items || items.length === 0) return null;

                return (
                  <div key={section} className="mb-1">
                    {/* Section header */}
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
                      <div className="flex items-center gap-2">
                        {ENTITY_CONFIG[section] && (
                          <span style={{ color: ENTITY_CONFIG[section].color, opacity: 0.7 }}>
                            {(() => { const Icon = ENTITY_CONFIG[section].icon; return <Icon size={12} />; })()}
                          </span>
                        )}
                        {section === 'history' && (
                          <span style={{ color: '#8BA8C8', opacity: 0.7 }}>
                            <Clock size={12} />
                          </span>
                        )}
                        {section === 'recent' && (
                          <span style={{ color: '#8BA8C8', opacity: 0.7 }}>
                            <Clock size={12} />
                          </span>
                        )}
                        <span className="text-[11px] font-semibold text-content-muted dark:text-brand-400 uppercase tracking-wide">
                          {getSectionLabel(section)}
                        </span>
                      </div>
                      {section === 'history' && searchHistory.length > 0 && (
                        <button
                          onClick={clearHistory}
                          className="text-[10px] text-content-muted dark:text-brand-400 hover:text-red-400 bg-transparent border-none cursor-pointer px-1"
                        >
                          {isRTL ? 'مسح' : 'Clear'}
                        </button>
                      )}
                      {section === 'recent' && recentSearches.length > 0 && (
                        <button
                          onClick={clearRecent}
                          className="text-[10px] text-content-muted dark:text-brand-400 hover:text-red-400 bg-transparent border-none cursor-pointer px-1"
                        >
                          {isRTL ? 'مسح' : 'Clear'}
                        </button>
                      )}
                    </div>

                    {/* Section items */}
                    {items.map((item) => {
                      flatIndex++;
                      const currentFlatIndex = flatIndex;
                      const isActiveItem = currentFlatIndex === activeIndex;
                      const Icon = item.icon;
                      const itemType = item.type;
                      const color = getTypeColor(itemType);

                      return (
                        <button
                          key={item.id}
                          data-search-item
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIndex(currentFlatIndex)}
                          className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-[10px] border-none cursor-pointer font-[inherit] transition-colors duration-100 text-start ${isActiveItem ? 'bg-brand-50 dark:bg-brand-500/15' : 'bg-transparent'} text-content dark:text-content-dark`}
                        >
                          {/* Icon */}
                          <div
                            className="w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center"
                            style={{
                              background: itemType === 'history'
                                ? (isDark ? 'rgba(139,168,200,0.12)' : 'rgba(139,168,200,0.08)')
                                : itemType === 'page'
                                  ? (isDark ? 'rgba(74,122,171,0.12)' : 'rgba(74,122,171,0.08)')
                                  : (color + '15'),
                              color: itemType === 'history' ? '#8BA8C8' : itemType === 'page' ? '#4A7AAB' : color,
                            }}
                          >
                            {itemType === 'history' ? <Clock size={16} /> : itemType === 'page' && Icon ? <Icon size={16} /> : getTypeIcon(itemType)}
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
                          {itemType !== 'page' && section !== 'recent' && section !== 'pages' && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0"
                              style={{
                                background: color + '15',
                                color: color,
                              }}
                            >
                              {getTypeLabel(itemType)}
                            </span>
                          )}

                          {/* Recent badge */}
                          {section === 'recent' && itemType !== 'page' && (
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0"
                              style={{
                                background: getTypeColor(itemType) + '15',
                                color: getTypeColor(itemType),
                              }}
                            >
                              {getTypeLabel(itemType)}
                            </span>
                          )}

                          {/* Enter hint on active */}
                          {isActiveItem && (
                            <ArrowRight size={14} className="shrink-0 text-content-muted dark:text-brand-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Result count footer when searching */}
              {q && hasResults && (
                <div className="text-center py-2 text-[11px] text-content-muted dark:text-brand-400 opacity-60">
                  {isRTL
                    ? `${flatResults.length} نتيجة`
                    : `${flatResults.length} result${flatResults.length !== 1 ? 's' : ''}`
                  }
                </div>
              )}
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
