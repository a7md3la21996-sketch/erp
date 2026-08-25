import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building2, Video, Clock, User, CalendarClock, CheckCircle2 } from 'lucide-react';
import { fetchActivities } from '../services/activitiesService';
import { useAuth } from '../contexts/AuthContext';

// Meeting agenda — reads meetings (activities type='meeting') role-scoped via
// fetchActivities, then splits into Upcoming (still scheduled) vs Done and
// groups by day. No new data source.
const SUBTYPES = {
  site_visit: { ar: 'معاينة', en: 'Site visit', Icon: MapPin, color: '#2F6BD3' },
  office:     { ar: 'مكتب',    en: 'Office',     Icon: Building2, color: '#5A63C4' },
  online:     { ar: 'أونلاين', en: 'Online',     Icon: Video, color: '#0FA372' },
};
const STATUS = {
  scheduled: { ar: 'مجدول', en: 'Scheduled', color: '#C9860A' },
  completed: { ar: 'تمّت',   en: 'Done',      color: '#158A57' },
  cancelled: { ar: 'ملغي',   en: 'Cancelled', color: '#D6403B' },
};

export default function MeetingsPage() {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming'); // upcoming | done | all
  const [typeFilter, setTypeFilter] = useState('all');

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
    return [...list].sort((a, b) => tab === 'upcoming' ? whenOf(a) - whenOf(b) : whenOf(b) - whenOf(a));
  }, [meetings, tab, typeFilter]);

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
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const timeLabel = (m) => whenOf(m).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const TABS = [
    { k: 'upcoming', ar: 'قادمة', en: 'Upcoming', n: counts.upcoming },
    { k: 'done', ar: 'تمّت', en: 'Done', n: counts.done },
    { k: 'all', ar: 'الكل', en: 'All', n: meetings.length },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-4 md:p-7 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="m-0 text-xl font-extrabold text-content dark:text-content-dark tracking-tight">{isRTL ? 'الاجتماعات' : 'Meetings'}</h1>
        <p className="m-0 mt-0.5 text-xs text-content-muted dark:text-content-muted-dark">{isRTL ? 'معايناتك واجتماعاتك — القادم والتمّ' : 'Your site visits and meetings — upcoming and done'}</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {[
          { label: isRTL ? 'قادمة' : 'Upcoming', value: counts.upcoming, color: '#C9860A', Icon: CalendarClock },
          { label: isRTL ? 'اليوم' : 'Today', value: counts.today, color: '#2F6BD3', Icon: Clock },
          { label: isRTL ? 'تمّت' : 'Done', value: counts.done, color: '#158A57', Icon: CheckCircle2 },
        ].map((k, i) => (
          <div key={i} className="bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-3.5 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: k.color + '18', color: k.color }}><k.Icon size={18} /></span>
            <div className="min-w-0">
              <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{k.label}</div>
              <div className="text-xl font-extrabold text-content dark:text-content-dark tabular-nums">{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + type filter */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex gap-1 p-0.5 rounded-xl bg-surface-bg dark:bg-surface-bg-dark border border-edge dark:border-edge-dark">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer border-none transition-colors ${tab === t.k ? 'bg-brand-500 text-white' : 'bg-transparent text-content-muted dark:text-content-muted-dark'}`}>
              {isRTL ? t.ar : t.en} <span className="opacity-70">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap ms-auto">
          {[{ k: 'all', ar: 'كل الأنواع', en: 'All types' }, ...Object.entries(SUBTYPES).map(([k, v]) => ({ k, ar: v.ar, en: v.en }))].map(t => (
            <button key={t.k} onClick={() => setTypeFilter(t.k)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border transition-colors ${typeFilter === t.k ? 'bg-brand-500/12 border-brand-500/30 text-brand-500' : 'bg-transparent border-edge dark:border-edge-dark text-content-muted dark:text-content-muted-dark'}`}>
              {isRTL ? t.ar : t.en}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda */}
      {loading ? (
        <div className="py-16 text-center text-content-muted dark:text-content-muted-dark text-sm">{isRTL ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-3"><CalendarClock size={26} className="text-brand-500" /></span>
          <p className="m-0 font-bold text-sm text-content dark:text-content-dark">{isRTL ? 'لا توجد اجتماعات' : 'No meetings'}</p>
          <p className="m-0 mt-1 text-xs text-content-muted dark:text-content-muted-dark">{tab === 'upcoming' ? (isRTL ? 'مفيش اجتماعات قادمة' : 'Nothing upcoming') : (isRTL ? 'مفيش اجتماعات هنا' : 'Nothing here')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g, gi) => (
            <div key={gi}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span className="text-[13px] font-extrabold text-content dark:text-content-dark">{dayLabel(g.date)}</span>
                <span className="text-[11px] text-content-muted dark:text-content-muted-dark">· {g.items.length}</span>
                <div className="flex-1 h-px bg-edge dark:bg-edge-dark" />
              </div>
              <div className="space-y-2">
                {g.items.map(m => {
                  const sub = SUBTYPES[m.meeting_subtype] || SUBTYPES.site_visit;
                  const st = STATUS[m.status] || STATUS.completed;
                  const agent = isRTL ? (m.user_name_ar || m.user_name_en) : (m.user_name_en || m.user_name_ar);
                  return (
                    <button key={m.id} onClick={() => m.contact_id && navigate(`/leads?highlight=${m.contact_id}`)}
                      className="w-full text-start flex items-center gap-3 bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark rounded-2xl p-3.5 cursor-pointer hover:shadow-md transition-shadow"
                      style={{ borderInlineStart: `3px solid ${sub.color}` }}>
                      <div className="flex flex-col items-center justify-center w-14 shrink-0">
                        <span className="text-sm font-extrabold text-content dark:text-content-dark tabular-nums">{timeLabel(m)}</span>
                        <span className="mt-1 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: sub.color + '18', color: sub.color }}><sub.Icon size={15} /></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-content dark:text-content-dark truncate">{m.entity_name || (isRTL ? 'بدون عميل' : 'No lead')}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: sub.color + '18', color: sub.color }}>{isRTL ? sub.ar : sub.en}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.color + '18', color: st.color }}>{isRTL ? st.ar : st.en}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
                          {agent && <span className="flex items-center gap-1"><User size={12} /> {agent}</span>}
                          {m.notes && <span className="truncate">· {m.notes}</span>}
                        </div>
                        {m.result && <div className="mt-1 text-[11.5px] text-content dark:text-content-dark truncate">{isRTL ? 'النتيجة: ' : 'Outcome: '}{m.result}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
