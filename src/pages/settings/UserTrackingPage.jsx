import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { thCls } from '../../utils/tableStyles';
import {
  Monitor, Smartphone, Tablet, Globe, Eye, Clock, Users, Shield,
  ChevronDown, ChevronUp, Search, X, Laptop, Activity,
} from 'lucide-react';
import { Card, KpiCard, Input, Pagination } from '../../components/ui';
import { getAllSessions, getSessionStats } from '../../services/sessionService';
import { getViewLogs, getViewStats } from '../../services/viewTrackingService';

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Globe };

const TAB_ITEMS = [
  { key: 'sessions', icon: Monitor, ar: 'الجلسات', en: 'Sessions' },
  { key: 'views', icon: Eye, ar: 'المشاهدات', en: 'Views' },
];

export default function UserTrackingPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const { profile } = useAuth();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [tab, setTab] = useState('sessions');
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Load data
  const sessions = useMemo(() => getAllSessions(), []);
  const sessionStats = useMemo(() => getSessionStats(), []);
  const viewLogs = useMemo(() => getViewLogs({ limit: 500 }), []);
  const viewStats = useMemo(() => getViewStats(), []);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return (sessions || []).filter(s =>
      (s.user_name || '').toLowerCase().includes(q) ||
      (s.user_id || '').toLowerCase().includes(q) ||
      (s.ip_address || '').includes(q) ||
      (s.browser || '').toLowerCase().includes(q) ||
      (s.os || '').toLowerCase().includes(q)
    );
  }, [sessions, search]);

  // Filter views
  const filteredViews = useMemo(() => {
    if (!search) return viewLogs;
    const q = search.toLowerCase();
    return viewLogs.filter(v =>
      (v.user_name || '').toLowerCase().includes(q) ||
      (v.entity_name || '').toLowerCase().includes(q) ||
      (v.entity_type || '').toLowerCase().includes(q)
    );
  }, [viewLogs, search]);

  // Group sessions by user
  const sessionsByUser = useMemo(() => {
    const map = {};
    filteredSessions.forEach(s => {
      if (!map[s.user_id]) map[s.user_id] = { user_name: s.user_name, user_role: s.user_role, sessions: [] };
      map[s.user_id].sessions.push(s);
    });
    return Object.entries(map).sort((a, b) => b[1].sessions.length - a[1].sessions.length);
  }, [filteredSessions]);

  // Pagination — sessions tab paginates sessionsByUser, views tab paginates filteredViews
  const currentData = tab === 'sessions' ? sessionsByUser : filteredViews;
  const totalPages = Math.max(1, Math.ceil(currentData.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedSessions = sessionsByUser.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedViews = filteredViews.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [search, tab]);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const DeviceIcon = ({ type }) => {
    const Icon = DEVICE_ICON[type] || Globe;
    return <Icon size={14} />;
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="px-4 py-20 text-center text-content-muted dark:text-content-muted-dark">
        {isRTL ? 'هذه الصفحة للأدمن فقط' : 'Admin access only'}
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <Activity size={20} className="text-brand-500" />
        </div>
        <div>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">
            {isRTL ? 'تتبع المستخدمين' : 'User Tracking'}
          </h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'الجلسات والأجهزة والمشاهدات' : 'Sessions, devices & view logs'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-card dark:bg-surface-card-dark rounded-xl p-1 border border-edge dark:border-edge-dark w-fit">
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-[7px] px-4 py-[7px] rounded-[7px] border-none cursor-pointer text-xs font-medium transition-all duration-150
              ${tab === t.key ? 'bg-brand-500 text-white' : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:bg-brand-500/[0.06]'}`}
          >
            <t.icon size={14} />
            {isRTL ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* ═══ SESSIONS TAB ═══ */}
      {tab === 'sessions' && (<>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard icon={Monitor} label={isRTL ? 'إجمالي الجلسات' : 'Total Sessions'} value={sessionStats.total} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'جلسات اليوم' : 'Today'} value={sessionStats.today} color="#22C55E" />
          <KpiCard icon={Users} label={isRTL ? 'مستخدمين نشطين' : 'Active Users'} value={sessionStats.uniqueUsersToday} color="#6B21A8" />
          <KpiCard icon={Shield} label={isRTL ? 'جلسات نشطة' : 'Active Sessions'} value={sessionStats.active} color="#F59E0B" />
        </div>

        {/* Device/Browser/OS breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {/* Devices */}
          <Card className="p-4">
            <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'الأجهزة' : 'Devices'}</p>
            <div className="space-y-2">
              {Object.entries(sessionStats.devices || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const Icon = DEVICE_ICON[type] || Globe;
                const pct = sessionStats.total > 0 ? Math.round((count / sessionStats.total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <Icon size={14} className="text-brand-500 shrink-0" />
                    <span className="text-xs text-content dark:text-content-dark capitalize w-16">{type}</span>
                    <div className="flex-1 h-4 bg-brand-500/[0.06] rounded overflow-hidden">
                      <div className="h-full bg-brand-500/30 rounded" style={{ width: pct + '%' }} />
                    </div>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark w-12 text-end">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Browsers */}
          <Card className="p-4">
            <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'المتصفحات' : 'Browsers'}</p>
            <div className="space-y-2">
              {Object.entries(sessionStats.browsers || {}).sort((a, b) => b[1] - a[1]).map(([browser, count]) => {
                const pct = sessionStats.total > 0 ? Math.round((count / sessionStats.total) * 100) : 0;
                return (
                  <div key={browser} className="flex items-center gap-2">
                    <Globe size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs text-content dark:text-content-dark w-16">{browser}</span>
                    <div className="flex-1 h-4 bg-blue-500/[0.06] rounded overflow-hidden">
                      <div className="h-full bg-blue-500/30 rounded" style={{ width: pct + '%' }} />
                    </div>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark w-12 text-end">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* OS */}
          <Card className="p-4">
            <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'أنظمة التشغيل' : 'Operating Systems'}</p>
            <div className="space-y-2">
              {Object.entries(sessionStats.oses || {}).sort((a, b) => b[1] - a[1]).map(([os, count]) => {
                const pct = sessionStats.total > 0 ? Math.round((count / sessionStats.total) * 100) : 0;
                return (
                  <div key={os} className="flex items-center gap-2">
                    <Laptop size={14} className="text-emerald-500 shrink-0" />
                    <span className="text-xs text-content dark:text-content-dark w-16">{os}</span>
                    <div className="flex-1 h-4 bg-emerald-500/[0.06] rounded overflow-hidden">
                      <div className="h-full bg-emerald-500/30 rounded" style={{ width: pct + '%' }} />
                    </div>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark w-12 text-end">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4 max-w-sm">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث عن مستخدم أو IP...' : 'Search user or IP...'}
              className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark placeholder:text-content-muted"
            />
            {search && <button onClick={() => setSearch('')} className="absolute end-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-content-muted"><X size={12} /></button>}
          </div>
        </div>

        {/* Per-User Device Summary */}
        <Card className="p-4 mb-5">
          <p className="m-0 mb-3 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'ملخص الأجهزة لكل مستخدم' : 'Devices per User'}</p>
          <div className="overflow-x-auto">
            <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls}>{isRTL ? 'المستخدم' : 'User'}</th>
                  <th className={thCls}>{isRTL ? 'الدور' : 'Role'}</th>
                  <th className={thCls}>{isRTL ? 'الأجهزة' : 'Devices'}</th>
                  <th className={thCls}>{isRTL ? 'عناوين IP' : 'IPs'}</th>
                  <th className={thCls}>{isRTL ? 'الجلسات' : 'Sessions'}</th>
                </tr>
              </thead>
              <tbody>
                {(sessionStats.userDeviceList || []).map(u => (
                  <tr key={u.user_id} className="border-b border-edge/50 dark:border-edge-dark/50">
                    <td className="px-4 py-2.5 text-xs font-semibold text-content dark:text-content-dark">{u.user_name}</td>
                    <td className="px-4 py-2.5 text-[10px] text-content-muted dark:text-content-muted-dark">{u.user_role}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-brand-500">{u.device_count}</td>
                    <td className="px-4 py-2.5 text-xs text-content dark:text-content-dark">{u.ip_count}</td>
                    <td className="px-4 py-2.5 text-xs text-content dark:text-content-dark">{u.session_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Sessions by User (expandable) */}
        <Card className="mb-5">
          <p className="m-0 px-4 pt-4 pb-2 text-xs font-bold text-content dark:text-content-dark">{isRTL ? 'سجل الجلسات' : 'Session Log'}</p>
          {pagedSessions.map(([userId, data]) => (
            <div key={userId} className="border-b border-edge/50 dark:border-edge-dark/50">
              <button
                onClick={() => setExpandedUser(expandedUser === userId ? null : userId)}
                className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-none cursor-pointer text-start"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-500/[0.12] flex items-center justify-center text-[10px] font-bold text-brand-500">
                    {(data.user_name || '?')[0]}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-content dark:text-content-dark">{data.user_name}</span>
                    <span className="text-[10px] text-content-muted dark:text-content-muted-dark ms-2">{data.user_role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 font-bold">{data.sessions.length} {isRTL ? 'جلسة' : 'sessions'}</span>
                  {expandedUser === userId ? <ChevronUp size={14} className="text-content-muted" /> : <ChevronDown size={14} className="text-content-muted" />}
                </div>
              </button>

              {expandedUser === userId && (
                <div className="px-4 pb-3">
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {(data.sessions || []).map(s => (
                      <div key={s.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-brand-500/[0.04] text-[11px]">
                        <DeviceIcon type={s.device_type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-content dark:text-content-dark capitalize">{s.device_type}</span>
                            <span className="text-content-muted dark:text-content-muted-dark">·</span>
                            <span className="text-content dark:text-content-dark">{s.browser}</span>
                            <span className="text-content-muted dark:text-content-muted-dark">·</span>
                            <span className="text-content dark:text-content-dark">{s.os}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-content-muted dark:text-content-muted-dark">{s.ip_address}</span>
                            <span className="text-content-muted dark:text-content-muted-dark">·</span>
                            <span className="text-content-muted dark:text-content-muted-dark">{fmtDate(s.login_at)}</span>
                          </div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${s.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-500'}`}>
                          {s.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'منتهي' : 'Ended')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {sessionsByUser.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد جلسات بعد' : 'No sessions yet'}</p>
          )}
          {sessionsByUser.length > 0 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} totalItems={sessionsByUser.length} safePage={safePage} />
          )}
        </Card>

      </>)}

      {/* ═══ VIEWS TAB ═══ */}
      {tab === 'views' && (<>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <KpiCard icon={Eye} label={isRTL ? 'إجمالي المشاهدات' : 'Total Views'} value={viewStats.total} color="#4A7AAB" />
          <KpiCard icon={Clock} label={isRTL ? 'مشاهدات اليوم' : 'Today'} value={viewStats.today} color="#22C55E" />
          <KpiCard icon={Users} label={isRTL ? 'مستخدمين' : 'Users'} value={viewStats.uniqueUsers} color="#6B21A8" />
          <KpiCard icon={Activity} label={isRTL ? 'نشطين اليوم' : 'Active Today'} value={viewStats.uniqueUsersToday} color="#F59E0B" />
        </div>

        {/* View breakdown by entity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {Object.entries(viewStats.byEntity || {}).map(([type, count]) => (
            <Card key={type} className="p-3 text-center">
              <p className="m-0 text-lg font-bold text-brand-500">{count}</p>
              <p className="m-0 text-[10px] text-content-muted dark:text-content-muted-dark capitalize">{type} views</p>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4 max-w-sm">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isRTL ? 'ابحث عن مستخدم أو عنصر...' : 'Search user or entity...'}
              className="w-full ps-9 pe-3 py-2 text-xs rounded-lg border border-edge dark:border-edge-dark bg-surface-card dark:bg-surface-card-dark text-content dark:text-content-dark placeholder:text-content-muted"
            />
            {search && <button onClick={() => setSearch('')} className="absolute end-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-content-muted"><X size={12} /></button>}
          </div>
        </div>

        {/* View Log Table */}
        <div className="overflow-x-auto bg-surface-card dark:bg-surface-card-dark rounded-xl border border-edge dark:border-edge-dark mb-5">
          <table dir={isRTL ? 'rtl' : 'ltr'} className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className={thCls}>{isRTL ? 'المستخدم' : 'User'}</th>
                <th className={thCls}>{isRTL ? 'النوع' : 'Type'}</th>
                <th className={thCls}>{isRTL ? 'العنصر' : 'Entity'}</th>
                <th className={thCls}>{isRTL ? 'الجهاز' : 'Device'}</th>
                <th className={thCls}>{isRTL ? 'المتصفح' : 'Browser'}</th>
                <th className={thCls}>{isRTL ? 'التاريخ' : 'Date'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredViews.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'لا توجد مشاهدات' : 'No views yet'}</td></tr>
              ) : pagedViews.map(v => (
                <tr key={v.id} className="border-b border-edge/50 dark:border-edge-dark/50">
                  <td className="px-4 py-2.5">
                    <div>
                      <span className="text-xs font-semibold text-content dark:text-content-dark">{v.user_name}</span>
                      <span className="text-[9px] text-content-muted dark:text-content-muted-dark ms-1.5">{v.user_role}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
                      ${v.entity_type === 'contact' ? 'bg-blue-500/10 text-blue-500' :
                        v.entity_type === 'opportunity' ? 'bg-emerald-500/10 text-emerald-500' :
                        v.entity_type === 'campaign' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-gray-500/10 text-gray-500'}`}>
                      {v.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-content dark:text-content-dark max-w-[150px] truncate">{v.entity_name || v.entity_id}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1 text-[10px] text-content-muted dark:text-content-muted-dark capitalize">
                      <DeviceIcon type={v.device_type} />
                      {v.device_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[10px] text-content-muted dark:text-content-muted-dark">{v.browser} · {v.os}</td>
                  <td className="px-4 py-2.5 text-[10px] text-content-muted dark:text-content-muted-dark whitespace-nowrap">{fmtDate(v.viewed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredViews.length > 0 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} totalItems={filteredViews.length} safePage={safePage} />
          )}
        </div>

      </>)}
    </div>
  );
}
