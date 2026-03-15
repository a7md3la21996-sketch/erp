import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import HeatmapCalendar from '../components/ui/HeatmapCalendar';
import {
  getActivityHeatmap,
  getCallsHeatmap,
  getDealsHeatmap,
  getOpportunitiesHeatmap,
  getContactsHeatmap,
  computeHeatmapStats,
} from '../services/heatmapService';
import { Activity, Phone, DollarSign, Target, Users, Flame, Calendar, TrendingUp, BarChart2, Clock, X } from 'lucide-react';

const DATA_SOURCES = [
  { id: 'activities', label_ar: 'كل الأنشطة', label_en: 'All Activities', icon: Activity, fetcher: getActivityHeatmap },
  { id: 'calls', label_ar: 'المكالمات', label_en: 'Calls', icon: Phone, fetcher: getCallsHeatmap },
  { id: 'deals', label_ar: 'الصفقات', label_en: 'Deals', icon: DollarSign, fetcher: getDealsHeatmap },
  { id: 'opportunities', label_ar: 'الفرص', label_en: 'Opportunities', icon: Target, fetcher: getOpportunitiesHeatmap },
  { id: 'contacts', label_ar: 'جهات الاتصال', label_en: 'Contacts Created', icon: Users, fetcher: getContactsHeatmap },
];

const TIME_RANGES = [
  { value: 3, label_ar: '3 أشهر', label_en: '3 Months' },
  { value: 6, label_ar: '6 أشهر', label_en: '6 Months' },
  { value: 12, label_ar: '12 شهر', label_en: '12 Months' },
];

export default function HeatmapPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [source, setSource] = useState('activities');
  const [months, setMonths] = useState(6);
  const [selectedDay, setSelectedDay] = useState(null);

  const currentSource = DATA_SOURCES.find(s => s.id === source);

  const data = useMemo(() => {
    return currentSource.fetcher(months);
  }, [source, months]);

  const stats = useMemo(() => computeHeatmapStats(data), [data]);

  const handleDayClick = (day) => {
    if (day.count > 0) {
      setSelectedDay(day);
    } else {
      setSelectedDay(null);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div style={{
      flex: '1 1 160px',
      padding: '16px 18px',
      borderRadius: 14,
      background: isDark ? '#1a2332' : '#ffffff',
      border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'),
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: (color || '#4A7AAB') + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={color || '#4A7AAB'} />
        </div>
        <span style={{
          fontSize: 11,
          color: isDark ? '#94a3b8' : '#64748b',
          fontWeight: 500,
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 22,
        fontWeight: 800,
        color: color || '#4A7AAB',
        textAlign: isRTL ? 'right' : 'left',
      }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{
      padding: '20px 28px',
      minHeight: '100vh',
      background: isDark ? '#0a1929' : '#f8fafc',
    }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: '#4A7AAB18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={22} color="#4A7AAB" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 800,
              color: isDark ? '#e2e8f0' : '#1e293b',
            }}>
              {isRTL ? 'خريطة النشاط' : 'Activity Map'}
            </h1>
            <p style={{
              margin: 0,
              fontSize: 12,
              color: isDark ? '#94a3b8' : '#64748b',
            }}>
              {isRTL ? 'نظرة شاملة على نشاطك اليومي' : 'Overview of your daily activity'}
            </p>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        flexWrap: 'wrap',
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        {/* Data source selector */}
        <div style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {DATA_SOURCES.map(src => {
            const SrcIcon = src.icon;
            const isActive = source === src.id;
            return (
              <button
                key={src.id}
                onClick={() => setSource(src.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 10,
                  border: '1px solid ' + (isActive ? '#4A7AAB' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
                  background: isActive ? '#4A7AAB' : (isDark ? '#1a2332' : '#ffffff'),
                  color: isActive ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}
              >
                <SrcIcon size={14} />
                {lang === 'ar' ? src.label_ar : src.label_en}
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Time range */}
        <div style={{
          display: 'flex',
          gap: 4,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}>
          {TIME_RANGES.map(tr => {
            const isActive = months === tr.value;
            return (
              <button
                key={tr.value}
                onClick={() => setMonths(tr.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid ' + (isActive ? '#4A7AAB' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')),
                  background: isActive ? 'rgba(74,122,171,0.12)' : 'transparent',
                  color: isActive ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {lang === 'ar' ? tr.label_ar : tr.label_en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Heatmap card */}
      <div style={{
        padding: '24px 28px',
        borderRadius: 16,
        background: isDark ? '#132337' : '#ffffff',
        border: '1px solid ' + (isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'),
        marginBottom: 20,
      }}>
        <HeatmapCalendar
          data={data}
          months={months}
          onDayClick={handleDayClick}
        />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        marginBottom: 20,
        flexDirection: isRTL ? 'row-reverse' : 'row',
      }}>
        <StatCard
          icon={BarChart2}
          label={isRTL ? 'الإجمالي' : 'Total'}
          value={stats.total.toLocaleString()}
          color="#4A7AAB"
        />
        <StatCard
          icon={TrendingUp}
          label={isRTL ? 'المعدل اليومي' : 'Daily Average'}
          value={stats.dailyAvg}
          color="#6B8DB5"
        />
        <StatCard
          icon={Flame}
          label={isRTL ? 'أطول سلسلة' : 'Longest Streak'}
          value={stats.streak + (isRTL ? ' يوم' : ' days')}
          color="#F59E0B"
        />
        <StatCard
          icon={Calendar}
          label={isRTL ? 'أكثر يوم' : 'Busiest Day'}
          value={stats.busiestDay
            ? new Date(stats.busiestDay.date + 'T00:00:00').toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
            : '-'}
          color="#10B981"
        />
        <StatCard
          icon={Clock}
          label={isRTL ? 'أكثر أسبوع' : 'Busiest Week'}
          value={stats.busiestWeek ? stats.busiestWeek.count + (isRTL ? ' نشاط' : ' acts') : '-'}
          color="#8B5CF6"
        />
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedDay.count > 0 && (
        <div style={{
          padding: '18px 24px',
          borderRadius: 14,
          background: isDark ? '#1a2332' : '#ffffff',
          border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0'),
          position: 'relative',
        }}>
          <button
            onClick={() => setSelectedDay(null)}
            style={{
              position: 'absolute',
              top: 12,
              [isRTL ? 'left' : 'right']: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#64748b',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={16} />
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#4A7AAB18',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Calendar size={18} color="#4A7AAB" />
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{
                fontSize: 14,
                fontWeight: 700,
                color: isDark ? '#e2e8f0' : '#1e293b',
              }}>
                {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString(
                  isRTL ? 'ar-EG' : 'en-US',
                  { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
                )}
              </div>
              <div style={{
                fontSize: 12,
                color: isDark ? '#94a3b8' : '#64748b',
              }}>
                {selectedDay.count} {isRTL ? 'نشاط مسجل' : (selectedDay.count === 1 ? 'recorded activity' : 'recorded activities')}
              </div>
            </div>
          </div>

          {/* Activity level indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            borderRadius: 10,
            background: isDark ? 'rgba(74,122,171,0.08)' : '#f8fafc',
            flexDirection: isRTL ? 'row-reverse' : 'row',
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: isDark ? '#94a3b8' : '#64748b',
            }}>
              {isRTL ? 'مستوى النشاط:' : 'Activity Level:'}
            </div>
            <div style={{
              display: 'flex',
              gap: 3,
            }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  style={{
                    width: 18,
                    height: 8,
                    borderRadius: 2,
                    background: i <= Math.min(5, Math.ceil(selectedDay.count / 3))
                      ? '#4A7AAB'
                      : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#4A7AAB',
            }}>
              {selectedDay.count <= 2
                ? (isRTL ? 'خفيف' : 'Light')
                : selectedDay.count <= 5
                  ? (isRTL ? 'متوسط' : 'Moderate')
                  : selectedDay.count <= 10
                    ? (isRTL ? 'نشط' : 'Active')
                    : (isRTL ? 'مكثف' : 'Intense')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
