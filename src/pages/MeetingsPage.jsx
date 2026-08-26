import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building2, Video, Clock, CalendarClock, CheckCircle2, ChevronLeft, Search } from 'lucide-react';
import { fetchActivities } from '../services/activitiesService';
import { useAuth } from '../contexts/AuthContext';

// Meeting agenda — reads meetings (activities type='meeting') role-scoped via
// fetchActivities, splits Upcoming (still scheduled) vs Done, groups by day.
const SUBTYPES = {
  site_visit: { ar: 'معاينة', en: 'Site visit', Icon: MapPin,    color: '#2F6BD3' },
  office:     { ar: 'مكتب',    en: 'Office',     Icon: Building2, color: '#6B54D3' },
  online:     { ar: 'أونلاين', en: 'Online',     Icon: Video,     color: '#0FA372' },
};
const STATUS = {
  scheduled: { ar: 'مجدول', en: 'Scheduled', color: '#C9860A' },
  completed: { ar: 'تمّت',   en: 'Done',      color: '#0FA372' },
  cancelled: { ar: 'ملغي',   en: 'Cancelled', color: '#E5484D' },
};
const AV_COLORS = ['#2F6BD3', '#0FA372', '#7C5CE6', '#C8820E', '#C0508A', '#0E9AA7', '#5A63C4', '#D6553D'];
const initials = (n = '') => { const p = String(n).trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '؟'; };
const avatarColor = (n = '') => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };

export default function MeetingsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const data = await fetchActivities({ type: 'meeting', role: profile.role, userId: profile.id, teamId: profile.team_id, limit: 500 });
      setMeetings(Array.isArray(data) ? data : []);
    } catch { setMeetings([]); }
    finally { setLoading(false); }
  }, [profile?.id, profile?.role, profile?.team_id]);
  useEffect(() => { load(); }, [load]);

  const whenOf = (m) => new Date(m.scheduled_date || m.created_at);
  const isUpcoming = (m) => m.status === 'scheduled';
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const counts = useMemo(() => {
    const up = meetings.filter(isUpcoming).length;
    const today = meetings.filter(m => sameDay(whenOf(m), new Date())).length;
    return { upcoming: up, done: meetings.length - up, today };
  }, [meetings]);

  const filtered = useMemo(() => {
    let list = meetings;
    if (typeFilter !== 'all') list = list.filter(m => m.meeting_subtype === typeFilter);
    if (tab === 'upcoming') list = list.filter(isUpcoming);
    else if (tab === 'done') list = list.filter(m => !isUpcoming(m));
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter(m => (m.entity_name || '').toLowerCase().includes(q)); }
    const now = Date.now();
    return [...list].sort((a, b) => {
      const ta = whenOf(a).getTime(), tb = whenOf(b).getTime();
      if (tab === 'upcoming') {
        // Real upcoming (future) first, soonest on top; overdue ones sink to the
        // bottom (most-recent overdue first).
        const ao = ta < now, bo = tb < now;
        if (ao !== bo) return ao ? 1 : -1;
        return ao ? tb - ta : ta - tb;
      }
      return tb - ta; // done / all: latest first
    });
  }, [meetings, tab, typeFilter, search]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach(m => {
      const d = whenOf(m);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { date: d, items: [] });
      map.get(key).items.push(m);
    });
    return [...map.values()];
  }, [filtered]);

  const dayLabel = (d) => {
    const t = new Date(), tomo = new Date(), yest = new Date();
    tomo.setDate(t.getDate() + 1); yest.setDate(t.getDate() - 1);
    if (sameDay(d, t)) return isRTL ? 'اليوم' : 'Today';
    if (sameDay(d, tomo)) return isRTL ? 'غداً' : 'Tomorrow';
    if (sameDay(d, yest)) return isRTL ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long' });
  };
  const isToday = (d) => sameDay(d, new Date());
  const timeParts = (m) => {
    const s = whenOf(m).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const [hm, ap] = s.split(' ');
    return { hm, ap };
  };

  const TABS = [
    { k: 'upcoming', ar: 'قادمة', en: 'Upcoming', n: counts.upcoming },
    { k: 'done', ar: 'تمّت', en: 'Done', n: counts.done },
    { k: 'all', ar: 'الكل', en: 'All', n: meetings.length },
  ];
  const KPIS = [
    { label: isRTL ? 'قادمة' : 'Upcoming', value: counts.upcoming, color: '#C9860A', Icon: CalendarClock },
    { label: isRTL ? 'اليوم' : 'Today', value: counts.today, color: '#2F6BD3', Icon: Clock },
    { label: isRTL ? 'تمّت' : 'Done', value: counts.done, color: '#0FA372', Icon: CheckCircle2 },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full bg-surface-bg dark:bg-surface-bg-dark">
      <div className="max-w-[860px] mx-auto px-4 md:px-7 pt-5 md:pt-7 pb-24">
        {/* Header */}
        <div className="flex items-end justify-between gap-3 mb-5">
          <div>
            <h1 className="m-0 text-[22px] font-extrabold text-content dark:text-content-dark tracking-tight">{isRTL ? 'الاجتماعات' : 'Meetings'}</h1>
            <p className="m-0 mt-1 text-[12.5px] text-content-muted dark:text-content-muted-dark">{isRTL ? 'معايناتك واجتماعاتك — القادم والتمّ' : 'Your site visits & meetings — upcoming and done'}</p>
          </div>
          <span className="hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-brand-500/12 text-brand-500 shrink-0"><CalendarClock size={20} /></span>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2.5 md:gap-3 mb-5">
          {KPIS.map((k, i) => (
            <div key={i} className="relative bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-3.5 md:p-4 shadow-[0_1px_2px_rgba(20,30,50,0.04)] overflow-hidden">
              <span className="absolute -top-6 -end-6 w-16 h-16 rounded-full opacity-[0.08]" style={{ background: k.color }} />
              <span className="inline-flex w-9 h-9 rounded-xl items-center justify-center mb-2.5" style={{ background: k.color + '18', color: k.color }}><k.Icon size={17} /></span>
              <div className="text-[24px] leading-none font-extrabold text-content dark:text-content-dark tabular-nums">{k.value}</div>
              <div className="text-[11.5px] text-content-muted dark:text-content-muted-dark mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          <div className="inline-flex p-1 rounded-2xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark shadow-[0_1px_2px_rgba(20,30,50,0.04)]">
            {TABS.map(t => (
              <button key={t.k} onClick={() => setTab(t.k)}
                className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-bold cursor-pointer border-none transition-all ${tab === t.k ? 'bg-brand-500 text-white shadow-[0_2px_8px_rgba(47,107,211,0.30)]' : 'bg-transparent text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark'}`}>
                {isRTL ? t.ar : t.en}<span className={`ms-1.5 text-[10px] ${tab === t.k ? 'opacity-80' : 'opacity-60'}`}>{t.n}</span>
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[150px]">
            <Search size={15} className={`absolute top-1/2 -translate-y-1/2 text-content-muted dark:text-content-muted-dark ${isRTL ? 'right-3' : 'left-3'}`} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? 'ابحث باسم العميل…' : 'Search by lead…'}
              className={`w-full h-10 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-[13px] text-content dark:text-content-dark outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`} />
          </div>
        </div>

        {/* type filter */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {[{ k: 'all', ar: 'كل الأنواع', en: 'All types', color: '#6B7688' }, ...Object.entries(SUBTYPES).map(([k, v]) => ({ k, ar: v.ar, en: v.en, color: v.color, Icon: v.Icon }))].map(t => {
            const on = typeFilter === t.k;
            return (
              <button key={t.k} onClick={() => setTypeFilter(t.k)}
                className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold cursor-pointer border inline-flex items-center gap-1.5 transition-colors ${on ? '' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark hover:text-content dark:hover:text-content-dark'}`}
                style={on ? { background: t.color + '18', borderColor: t.color + '55', color: t.color } : undefined}>
                {t.Icon && <t.Icon size={12} />}
                {isRTL ? t.ar : t.en}
              </button>
            );
          })}
        </div>

        {/* Agenda */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="h-[76px] rounded-2xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="w-16 h-16 rounded-3xl bg-brand-500/10 flex items-center justify-center mb-4"><CalendarClock size={28} className="text-brand-500" /></span>
            <p className="m-0 font-extrabold text-[15px] text-content dark:text-content-dark">{isRTL ? 'لا توجد اجتماعات' : 'No meetings'}</p>
            <p className="m-0 mt-1.5 text-[12.5px] text-content-muted dark:text-content-muted-dark">{tab === 'upcoming' ? (isRTL ? 'مفيش اجتماعات قادمة في القائمة' : 'Nothing upcoming here') : (isRTL ? 'مفيش اجتماعات مطابقة' : 'Nothing matches')}</p>
          </div>
        ) : (
          <div className="space-y-7">
            {groups.map((g, gi) => (
              <div key={gi}>
                {/* day header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-2xl shrink-0 ${isToday(g.date) ? 'bg-brand-500 text-white' : 'bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark text-content dark:text-content-dark'}`}>
                    <span className="text-[15px] font-extrabold leading-none tabular-nums">{g.date.getDate()}</span>
                    <span className={`text-[8.5px] font-bold uppercase mt-0.5 ${isToday(g.date) ? 'text-white/80' : 'text-content-muted dark:text-content-muted-dark'}`}>{g.date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short' })}</span>
                  </div>
                  <div>
                    <div className="text-[13.5px] font-extrabold text-content dark:text-content-dark leading-tight">{dayLabel(g.date)}</div>
                    <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{g.date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })} · {g.items.length}</div>
                  </div>
                </div>

                {/* cards */}
                <div className="space-y-2.5">
                  {g.items.map(m => {
                    const sub = SUBTYPES[m.meeting_subtype] || SUBTYPES.site_visit;
                    // A still-'scheduled' meeting whose time has passed = overdue
                    // (booked, never closed out) — flag it so it reads as "needs action".
                    const overdue = m.status === 'scheduled' && whenOf(m).getTime() < Date.now();
                    const st = overdue ? { ar: 'متأخر', en: 'Overdue', color: '#E5484D' } : (STATUS[m.status] || STATUS.completed);
                    const agent = (isRTL ? (m.user_name_ar || m.user_name_en) : (m.user_name_en || m.user_name_ar)) || '';
                    const lead = m.entity_name || (isRTL ? 'بدون عميل' : 'No lead');
                    const { hm, ap } = timeParts(m);
                    return (
                      <button key={m.id} onClick={() => m.contact_id && navigate(`/leads?highlight=${m.contact_id}`)}
                        className="group w-full text-start relative flex items-center gap-3.5 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-3 pe-3.5 cursor-pointer overflow-hidden shadow-[0_1px_2px_rgba(20,30,50,0.04)] hover:shadow-[0_10px_28px_rgba(20,30,50,0.10)] hover:-translate-y-0.5 transition-all duration-200">
                        <span className="absolute inset-y-0 start-0 w-1" style={{ background: sub.color }} />
                        {/* time */}
                        <div className="flex flex-col items-center justify-center min-w-[46px] ps-1">
                          <span className="text-[15px] font-extrabold text-content dark:text-content-dark leading-none tabular-nums">{hm}</span>
                          <span className="text-[9.5px] font-bold text-content-muted dark:text-content-muted-dark mt-0.5">{ap}</span>
                        </div>
                        <div className="w-px self-stretch bg-edge dark:bg-edge-dark my-1.5" />
                        {/* avatar */}
                        <div className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-white text-[14px] font-extrabold shadow-[0_2px_6px_rgba(20,30,50,0.10)]" style={{ background: avatarColor(lead) }}>{initials(lead)}</div>
                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-[14.5px] text-content dark:text-content-dark truncate">{lead}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sub.color + '16', color: sub.color }}><sub.Icon size={11} />{isRTL ? sub.ar : sub.en}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.color + '16', color: st.color }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />{isRTL ? st.ar : st.en}</span>
                            {agent && <span className="inline-flex items-center gap-1 text-[10.5px] text-content-muted dark:text-content-muted-dark"><span className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0" style={{ background: avatarColor(agent) }}>{initials(agent)}</span>{agent}</span>}
                          </div>
                          {(m.notes || m.result) && <div className="text-[11.5px] text-content-muted dark:text-content-muted-dark mt-1 truncate">{m.result ? `${isRTL ? 'النتيجة: ' : 'Outcome: '}${m.result}` : m.notes}</div>}
                        </div>
                        <ChevronLeft size={16} className={`text-content-muted/50 dark:text-content-muted-dark/50 shrink-0 group-hover:text-brand-500 transition-colors ${isRTL ? '' : 'rotate-180'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
