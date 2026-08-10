import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  NAV_ITEMS, ROLE_NAV_GROUPS, MODULE_IDS, GLOBAL_IDS, moduleLandingPath,
} from '../config/navigation';

// Per-module accent (mid-ramp hex → reads in both light & dark). Falls back to
// a neutral gray for any module not listed.
const ACCENT = {
  dashboard: '#378ADD', crm: '#7F77DD', activities: '#1D9E75', 'real-estate': '#EF9F27',
  sales: '#639922', operations: '#888780', marketing: '#D85A30', hr: '#D4537E',
  finance: '#1D9E75', workspace: '#378ADD', communication: '#7F77DD',
  reports: '#BA7517', settings: '#888780', changelog: '#D4537E', 'help-center': '#888780',
  developers: '#0F6E56',
};
const accentOf = (id) => ACCENT[id] || '#888780';

// One-line description under each module card.
const MODULE_DESC = {
  crm: { ar: 'الليدز والمتابعات', en: 'Leads & follow-ups' },
  'real-estate': { ar: 'المشاريع والوحدات', en: 'Projects & units' },
  sales: { ar: 'الصفقات والعمولات', en: 'Deals & commissions' },
  operations: { ar: 'معالجة الصفقات والتسليم', en: 'Processing & handover' },
  marketing: { ar: 'الحملات والقنوات', en: 'Campaigns & channels' },
  hr: { ar: 'الموظفين والحضور والمرتبات', en: 'People, time & payroll' },
  finance: { ar: 'الحسابات والفواتير', en: 'Accounts & invoices' },
  reports: { ar: 'تحليلات ولوحات الأداء', en: 'Analytics & dashboards' },
};

// Launcher / home — a workspace picker. Each top-level module (CRM, HR, Finance…)
// is an entry card; opening one scopes the whole sidebar to that world. Global,
// cross-cutting pages (dashboard, tasks, chat, help…) sit in a compact quick row.
// Everything is filtered by the user's role (ROLE_NAV_GROUPS) and permissions.
export default function LauncherPage() {
  const { profile, hasPermission } = useAuth();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lbl = (l) => (isRTL ? l.ar : (l.en || l.ar));
  const [q, setQ] = useState('');

  const { modules, globals } = useMemo(() => {
    const role = profile?.role || 'admin';
    const roleGroups = ROLE_NAV_GROUPS[role];
    const canSee = (item) => hasPermission(item.permission) && (!roleGroups || roleGroups.includes(item.id));
    const byId = Object.fromEntries(NAV_ITEMS.map(i => [i.id, i]));
    const modules = MODULE_IDS.map(id => byId[id]).filter(it => it && canSee(it));
    const globals = GLOBAL_IDS.map(id => byId[id]).filter(it => it && canSee(it));
    return { modules, globals };
  }, [profile?.role, hasPermission]);

  const term = q.trim();
  const matches = (l) => !term || l.ar.includes(term) || (l.en || '').toLowerCase().includes(term.toLowerCase());

  const Chevron = isRTL ? ChevronLeft : ChevronRight;

  const filteredModules = modules.filter(m => matches(m.label) || (MODULE_DESC[m.id] && matches(MODULE_DESC[m.id])));
  const filteredGlobals = globals.filter(g => matches(g.label));
  const nothing = !filteredModules.length && !filteredGlobals.length;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return isRTL ? 'صباح الخير' : 'Good morning';
    if (h < 18) return isRTL ? 'مساء الخير' : 'Good afternoon';
    return isRTL ? 'مساء الخير' : 'Good evening';
  })();
  const name = isRTL ? (profile?.full_name_ar || profile?.full_name_en) : (profile?.full_name_en || profile?.full_name_ar);
  const today = new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const childCount = (item) => (item.children || []).filter(c => c.path && hasPermission(c.permission)).length;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="max-w-[1100px] mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="m-0 text-[22px] font-semibold text-content dark:text-content-dark">{greeting}{name ? `، ${name}` : ''}</h1>
          <p className="m-0 mt-1 text-[12.5px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'اختر المساحة التي تريد العمل فيها' : 'Choose a workspace to focus on'} · {today}</p>
        </div>
        <div className="relative w-[280px] max-w-[45vw]">
          <Search size={16} className={`absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark ${isRTL ? 'right-3' : 'left-3'}`} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQ(''); }}
            placeholder={isRTL ? 'ابحث في المساحات…' : 'Search workspaces…'}
            aria-label={isRTL ? 'بحث' : 'Search'}
            className={`w-full py-2 rounded-lg border border-edge dark:border-edge-dark bg-surface-input dark:bg-surface-input-dark text-content dark:text-content-dark text-[13px] outline-none focus:border-brand-500 transition-colors ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
          />
        </div>
      </div>

      {/* Module cards */}
      {filteredModules.length > 0 && (
        <section className="mb-7">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {filteredModules.map(m => {
              const Icon = m.icon;
              const color = accentOf(m.id);
              const desc = MODULE_DESC[m.id] ? lbl(MODULE_DESC[m.id]) : '';
              const n = childCount(m);
              return (
                <Link
                  key={m.id}
                  to={moduleLandingPath(m, hasPermission)}
                  className="group flex flex-col gap-3 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-xl p-4 no-underline hover:border-content-muted/40 dark:hover:border-content-muted-dark/40 transition-colors"
                >
                  <span className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: color + '1A', color }}>
                    {Icon && <Icon size={22} />}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium text-content dark:text-content-dark">{lbl(m.label)}</span>
                    {desc && <span className="block text-[12px] text-content-muted dark:text-content-muted-dark mt-0.5">{desc}</span>}
                  </span>
                  <span className="flex items-center justify-between mt-auto pt-1">
                    <span className="text-[11.5px]" style={{ color }}>{n > 0 ? `${n}${isRTL ? ' صفحات' : ' pages'}` : (isRTL ? 'افتح' : 'Open')}</span>
                    <Chevron size={16} className="text-content-muted dark:text-content-muted-dark opacity-0 group-hover:opacity-70 transition-opacity" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Global / quick access */}
      {filteredGlobals.length > 0 && (
        <section>
          <div className="text-[12px] font-medium text-content-muted dark:text-content-muted-dark mb-2.5 px-0.5">{isRTL ? 'وصول سريع' : 'Quick access'}</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {filteredGlobals.map(g => {
              const Icon = g.icon;
              const color = accentOf(g.id);
              return (
                <Link key={g.id} to={moduleLandingPath(g, hasPermission)} className="group flex items-center gap-2.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-[10px] px-3 py-2.5 no-underline hover:border-content-muted/40 dark:hover:border-content-muted-dark/40 transition-colors">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '1A', color }}>
                    {Icon && <Icon size={16} />}
                  </span>
                  <span className="flex-1 text-[12.5px] text-content dark:text-content-dark truncate">{lbl(g.label)}</span>
                  <Chevron size={15} className="shrink-0 text-content-muted dark:text-content-muted-dark opacity-0 group-hover:opacity-70 transition-opacity" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {nothing && (
        <div className="text-center py-12 text-[13px] text-content-muted dark:text-content-muted-dark">
          {isRTL ? 'مفيش نتائج مطابقة' : 'No matching results'}
        </div>
      )}
    </div>
  );
}
