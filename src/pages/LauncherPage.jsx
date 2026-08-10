import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { NAV_ITEMS, ROLE_NAV_GROUPS } from '../config/navigation';

// Per-module accent (mid-ramp hex → reads in both light & dark). Falls back to
// a neutral gray for any module not listed.
const ACCENT = {
  dashboard: '#378ADD', crm: '#7F77DD', activities: '#1D9E75', 'real-estate': '#EF9F27',
  sales: '#639922', operations: '#888780', marketing: '#D85A30', hr: '#D4537E',
  finance: '#1D9E75', workspace: '#378ADD', communication: '#7F77DD',
  reports: '#BA7517', settings: '#888780', changelog: '#D4537E', 'help-center': '#888780',
};
const accentOf = (id) => ACCENT[id] || '#888780';

// Launcher / home — an icon+pages grid generated from NAV_ITEMS, filtered by the
// user's role (ROLE_NAV_GROUPS) and permissions. Each module with sub-pages is a
// section; top-level pages with no children are gathered into "Quick access".
export default function LauncherPage() {
  const { profile, hasPermission } = useAuth();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lbl = (l) => (isRTL ? l.ar : (l.en || l.ar));
  const [q, setQ] = useState('');

  const { quick, sections } = useMemo(() => {
    const role = profile?.role || 'admin';
    const roleGroups = ROLE_NAV_GROUPS[role];
    const visible = NAV_ITEMS.filter(item =>
      hasPermission(item.permission) && (!roleGroups || roleGroups.includes(item.id))
    );
    const quick = [];
    const sections = [];
    visible.forEach(item => {
      const pages = (item.children || []).filter(c => c.path && hasPermission(c.permission));
      if (pages.length) sections.push({ id: item.id, label: item.label, Icon: item.icon, pages });
      else if (item.path) quick.push(item);
    });
    return { quick, sections };
  }, [profile?.role, hasPermission]);

  const term = q.trim();
  const matches = (l) => !term || l.ar.includes(term) || (l.en || '').toLowerCase().includes(term.toLowerCase());

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const filteredQuick = quick.filter(it => matches(it.label));
  const filteredSections = sections
    .map(s => ({ ...s, pages: s.pages.filter(p => matches(p.label) || matches(s.label)) }))
    .filter(s => s.pages.length);
  const nothing = !filteredQuick.length && !filteredSections.length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'مساء الخير' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();
  const name = isRTL ? (profile?.full_name_ar || profile?.full_name_en) : (profile?.full_name_en || profile?.full_name_ar);
  const today = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const Tile = ({ to, label, color }) => (
    <Link to={to} className="group flex items-center gap-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] px-3 py-2.5 no-underline hover:border-content-muted/40 dark:hover:border-content-muted-dark/40 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <span className="flex-1 text-[12.5px] text-content dark:text-content-dark truncate">{label}</span>
      <Chevron size={15} className="shrink-0 text-content-muted dark:text-content-muted-dark opacity-0 group-hover:opacity-70 transition-opacity" />
    </Link>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-[1100px] mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-[22px] font-semibold text-content dark:text-content-dark">{greeting}{name ? `، ${name}` : ''}</h1>
          <p className="m-0 mt-1 text-[12.5px] text-content-muted dark:text-content-muted-dark">{today}</p>
        </div>
        <div className="relative w-[280px] max-w-[45vw]">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQ(''); }}
            placeholder={isRTL ? 'ابحث في كل الصفحات…' : 'Search all pages…'}
            aria-label={isRTL ? 'بحث' : 'Search'}
            className={`w-full py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none focus:border-brand-500 transition-colors ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>
      </div>

      {/* Quick access (top-level pages without sub-pages) */}
      {filteredQuick.length > 0 && (
        <section className="mb-6">
          <div className="text-[12px] font-medium text-content-muted dark:text-content-muted-dark mb-2.5 px-0.5">{isRTL ? 'وصول سريع' : 'Quick access'}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {filteredQuick.map(it => {
              const Icon = it.icon;
              const color = accentOf(it.id);
              return (
                <Link key={it.id} to={it.path} className="group flex items-center gap-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] px-3 py-2.5 no-underline hover:border-content-muted/40 dark:hover:border-content-muted-dark/40 transition-colors">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '1A', color }}>
                    {Icon && <Icon size={16} />}
                  </span>
                  <span className="flex-1 text-[12.5px] text-content dark:text-content-dark truncate">{lbl(it.label)}</span>
                  <Chevron size={15} className="shrink-0 text-content-muted dark:text-content-muted-dark opacity-0 group-hover:opacity-70 transition-opacity" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Module sections */}
      <div className="flex flex-col gap-5">
        {filteredSections.map(s => {
          const color = accentOf(s.id);
          return (
            <section key={s.id}>
              <div className="flex items-center gap-2.5 mb-3 ps-2.5" style={{ borderInlineStart: `3px solid ${color}` }}>
                <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: color + '1A', color }}>
                  {s.Icon && <s.Icon size={18} />}
                </span>
                <span className="text-[14.5px] font-medium text-content dark:text-content-dark">{lbl(s.label)}</span>
                <span className="text-[11px] text-content-muted dark:text-content-muted-dark ms-auto">{s.pages.length}{isRTL ? ' صفحات' : ' pages'}</span>
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                {s.pages.map(p => <Tile key={p.id} to={p.path} label={lbl(p.label)} color={color} />)}
              </div>
            </section>
          );
        })}
      </div>

      {nothing && (
        <div className="text-center py-12 text-[13px] text-content-muted dark:text-content-muted-dark">
          {isRTL ? 'مفيش نتائج مطابقة' : 'No matching results'}
        </div>
      )}
    </div>
  );
}
