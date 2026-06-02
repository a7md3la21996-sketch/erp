import { Suspense } from 'react';
import lazyRetry from '../../utils/lazyRetry';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, CalendarDays, CalendarOff, PartyPopper, Zap, ArrowRightLeft, TrendingUp } from 'lucide-react';
import { PageSkeleton } from '../../components/ui';

const TimeHubOverview    = lazyRetry(() => import('./TimeHubOverview'));
const AttendancePage     = lazyRetry(() => import('./AttendancePage'));
const ShiftsPage         = lazyRetry(() => import('./ShiftsPage'));
const HolidaysPage       = lazyRetry(() => import('./HolidaysPage'));
const LeavePage          = lazyRetry(() => import('./LeavePage'));
const LeaveCarryoverPage = lazyRetry(() => import('./LeaveCarryoverPage'));
const OvertimePage       = lazyRetry(() => import('./OvertimePage'));

const TABS = [
  { key: 'overview',   icon: TrendingUp,    label_ar: 'نظرة عامة',       label_en: 'Overview' },
  { key: 'attendance', icon: Clock,         label_ar: 'الحضور',          label_en: 'Attendance', Cmp: AttendancePage },
  { key: 'shifts',     icon: CalendarDays,  label_ar: 'الشيفتات',        label_en: 'Shifts',     Cmp: ShiftsPage },
  { key: 'holidays',   icon: PartyPopper,   label_ar: 'الإجازات الرسمية', label_en: 'Holidays',   Cmp: HolidaysPage },
  { key: 'leave',      icon: CalendarOff,   label_ar: 'الإجازات',        label_en: 'Leave',      Cmp: LeavePage },
  { key: 'overtime',   icon: Zap,           label_ar: 'الأوفرتايم',     label_en: 'Overtime',   Cmp: OvertimePage },
  { key: 'carryover',  icon: ArrowRightLeft, label_ar: 'ترحيل الإجازات', label_en: 'Carryover',  Cmp: LeaveCarryoverPage },
];

export default function TimeHubPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const params = new URLSearchParams(location.search);
  const activeKey = TABS.find(t => t.key === params.get('tab'))?.key || 'overview';
  const ActiveCmp = TABS.find(t => t.key === activeKey)?.Cmp;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen">
      <div className={`flex items-center gap-3.5 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
          <Clock size={22} className="text-brand-500" />
        </div>
        <div className={isRTL ? 'text-right' : 'text-left'}>
          <h1 className="m-0 text-xl font-bold text-content dark:text-content-dark">{isRTL ? 'الوقت والحضور' : 'Time & Attendance'}</h1>
          <p className="m-0 text-xs text-content-muted dark:text-content-muted-dark">
            {isRTL ? 'الحضور، الشيفتات، الإجازات، والأوفرتايم في مكان واحد' : 'Attendance, shifts, leave & overtime'}
          </p>
        </div>
      </div>

      <div className={`flex gap-1 mb-5 p-1 rounded-xl bg-surface-card dark:bg-surface-card-dark border border-edge dark:border-edge-dark overflow-x-auto ${isRTL ? 'flex-row-reverse' : ''}`}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key === 'overview' ? '/hr/time' : `/hr/time?tab=${tab.key}`)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-brand-500 text-white' : 'text-content-muted dark:text-content-muted-dark hover:bg-brand-500/10 hover:text-brand-500'
              }`}
            >
              <Icon size={14} />
              {isRTL ? tab.label_ar : tab.label_en}
            </button>
          );
        })}
      </div>

      <Suspense fallback={<div className="px-4 py-4"><PageSkeleton hasKpis tableRows={6} /></div>}>
        {activeKey === 'overview'
          ? <TimeHubOverview isRTL={isRTL} lang={lang} />
          : ActiveCmp && <div className="-mx-4 -my-4 md:-mx-7 md:-my-6"><ActiveCmp /></div>}
      </Suspense>
    </div>
  );
}
