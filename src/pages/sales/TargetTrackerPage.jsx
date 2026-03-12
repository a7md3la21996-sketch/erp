import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { Trophy, TrendingUp, Target, Award, Star, Medal, ChevronUp, ChevronDown, Minus, Calendar, Users, BarChart2, DollarSign, Crown, Zap } from 'lucide-react';
import Card, { CardHeader } from '../../components/ui/Card';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Th, Td, Tr } from '../../components/ui/Table';

const MONTHS = [
  { id: 'jan', ar: 'يناير', en: 'January' },
  { id: 'feb', ar: 'فبراير', en: 'February' },
  { id: 'mar', ar: 'مارس', en: 'March' },
  { id: 'apr', ar: 'أبريل', en: 'April' },
  { id: 'may', ar: 'مايو', en: 'May' },
  { id: 'jun', ar: 'يونيو', en: 'June' },
];

const MOCK_TARGETS = [
  { emp_id: 'e1', month: 'mar', target: 1500000, achieved: 1250000, deals: 8,  units: 3 },
  { emp_id: 'e3', month: 'mar', target: 800000,  achieved: 790000,  deals: 5,  units: 2 },
  { emp_id: 'e5', month: 'mar', target: 600000,  achieved: 480000,  deals: 3,  units: 1 },
  { emp_id: 'e6', month: 'mar', target: 500000,  achieved: 520000,  deals: 4,  units: 2 },
  { emp_id: 'e8', month: 'mar', target: 400000,  achieved: 210000,  deals: 2,  units: 1 },
  { emp_id: 'e1', month: 'feb', target: 1500000, achieved: 1380000, deals: 9,  units: 4 },
  { emp_id: 'e3', month: 'feb', target: 800000,  achieved: 650000,  deals: 4,  units: 2 },
  { emp_id: 'e5', month: 'feb', target: 600000,  achieved: 600000,  deals: 4,  units: 1 },
  { emp_id: 'e6', month: 'feb', target: 500000,  achieved: 390000,  deals: 3,  units: 1 },
  { emp_id: 'e8', month: 'feb', target: 400000,  achieved: 440000,  deals: 3,  units: 2 },
  { emp_id: 'e1', month: 'jan', target: 1200000, achieved: 1100000, deals: 7,  units: 3 },
  { emp_id: 'e3', month: 'jan', target: 700000,  achieved: 720000,  deals: 5,  units: 2 },
  { emp_id: 'e5', month: 'jan', target: 500000,  achieved: 310000,  deals: 2,  units: 1 },
  { emp_id: 'e6', month: 'jan', target: 400000,  achieved: 450000,  deals: 4,  units: 2 },
  { emp_id: 'e8', month: 'jan', target: 350000,  achieved: 180000,  deals: 1,  units: 0 },
];

const SALES_ROLES = ['sales_director', 'sales_manager', 'team_leader', 'sales_agent'];
const fmt = (n) => { if (n >= 1000000) return (n/1000000).toFixed(1)+'M'; if (n >= 1000) return (n/1000).toFixed(0)+'K'; return n; };
const getRankIcon = (rank) => {
  if (rank === 1) return <Crown size={18} style={{ color: '#FFD700' }} />;
  if (rank === 2) return <Medal size={18} style={{ color: '#C0C0C0' }} />;
  if (rank === 3) return <Award size={18} style={{ color: '#CD7F32' }} />;
  return <span className="inline-block w-[18px] text-center text-[13px] font-bold text-content-muted dark:text-content-muted-dark">{rank}</span>;
};

export default function TargetTrackerPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const isRTL = lang === 'ar';
  const [selectedMonth, setSelectedMonth] = useState('mar');
  const [sortBy, setSortBy] = useState('pct');
  const [hoveredRow, setHoveredRow] = useState(null);

  const salesEmps = useMemo(() => MOCK_EMPLOYEES.filter(e => SALES_ROLES.includes(e.role)), []);

  const monthData = useMemo(() => {
    return salesEmps.map(emp => {
      const t = MOCK_TARGETS.find(t => t.emp_id === emp.id && t.month === selectedMonth);
      if (!t) return null;
      const pct = Math.round((t.achieved / t.target) * 100);
      return { ...emp, ...t, pct };
    }).filter(Boolean).sort((a, b) => sortBy === 'pct' ? b.pct - a.pct : sortBy === 'achieved' ? b.achieved - a.achieved : b.deals - a.deals);
  }, [salesEmps, selectedMonth, sortBy]);

  const totalTarget = monthData.reduce((s, e) => s + e.target, 0);
  const totalAchieved = monthData.reduce((s, e) => s + e.achieved, 0);
  const totalPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const topPerformer = monthData[0];
  const aboveTarget = monthData.filter(e => e.pct >= 100).length;
  const monthLabel = (id) => { const m = MONTHS.find(m => m.id === id); return m ? (lang === 'ar' ? m.ar : m.en) : id; };
  const getPctColor = (pct) => pct >= 100 ? '#4A7AAB' : pct >= 80 ? '#6B8DB5' : pct >= 60 ? '#8BA8C8' : '#EF4444';
  const getTrend = (empId, currentPct) => {
    const prevMonth = selectedMonth === 'mar' ? 'feb' : selectedMonth === 'feb' ? 'jan' : null;
    if (!prevMonth) return 0;
    const prev = MOCK_TARGETS.find(t => t.emp_id === empId && t.month === prevMonth);
    if (!prev) return 0;
    return currentPct - Math.round((prev.achieved / prev.target) * 100);
  };

  return (
    <div className="px-4 py-4 md:px-7 md:py-6 bg-surface-bg dark:bg-surface-bg-dark min-h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/[0.12] flex items-center justify-center">
            <Trophy size={20} className="text-brand-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content dark:text-content-dark m-0">
              {lang === 'ar' ? 'متابعة التارجت والترتيب' : 'Target Tracker & Leaderboard'}
            </h1>
            <p className="text-xs text-content-muted dark:text-content-muted-dark mt-0 m-0">
              {lang === 'ar' ? 'أداء فريق المبيعات الشهري' : 'Monthly Sales Team Performance'}
            </p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {MONTHS.map(m => (
            <Button
              key={m.id}
              variant={selectedMonth === m.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedMonth(m.id)}
            >
              {lang === 'ar' ? m.ar : m.en}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
        <KpiCard icon={Target} label={lang === 'ar' ? 'إجمالي التارجت' : 'Total Target'} value={fmt(totalTarget) + ' EGP'} sub={monthLabel(selectedMonth)} color="#4A7AAB" />
        <KpiCard icon={TrendingUp} label={lang === 'ar' ? 'إجمالي المحقق' : 'Total Achieved'} value={fmt(totalAchieved) + ' EGP'} sub={`${totalPct}% ${lang === 'ar' ? 'من التارجت' : 'of target'}`} color={totalPct >= 100 ? '#4A7AAB' : '#EF4444'} />
        <KpiCard icon={Crown} label={lang === 'ar' ? 'الأول هذا الشهر' : 'Top Performer'} value={topPerformer ? (lang === 'ar' ? topPerformer.full_name_ar : topPerformer.full_name_en) : '—'} sub={topPerformer ? `${topPerformer.pct}%` : ''} color="#FFD700" />
        <KpiCard icon={Zap} label={lang === 'ar' ? 'حققوا التارجت' : 'Hit Target'} value={`${aboveTarget} / ${monthData.length}`} sub={lang === 'ar' ? 'موظف' : 'agents'} color="#4A7AAB" />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Team Ranking Table */}
        <Card className="overflow-x-auto overflow-hidden">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-content dark:text-content-dark flex items-center gap-1.5">
              <BarChart2 size={16} className="text-brand-500" />
              {lang === 'ar' ? 'ترتيب الفريق' : 'Team Ranking'}
            </span>
            <div className="flex gap-1.5">
              {[{ key: 'pct', ar: 'بالنسبة', en: '% Target' }, { key: 'achieved', ar: 'بالمبلغ', en: 'Amount' }, { key: 'deals', ar: 'بالصفقات', en: 'Deals' }].map(s => (
                <Button
                  key={s.key}
                  variant={sortBy === s.key ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setSortBy(s.key)}
                  className="!text-[11px] !px-3 !py-1"
                >
                  {lang === 'ar' ? s.ar : s.en}
                </Button>
              ))}
            </div>
          </CardHeader>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-bg dark:bg-brand-500/[0.08]">
                {[{ ar: '#', en: '#', w: 'w-10' }, { ar: 'الموظف', en: 'Agent' }, { ar: 'التارجت', en: 'Target', w: 'w-[100px]' }, { ar: 'المحقق', en: 'Achieved', w: 'w-[100px]' }, { ar: 'النسبة', en: '% Done', w: 'w-[140px]' }, { ar: 'الصفقات', en: 'Deals', w: 'w-[70px]' }, { ar: 'التغيير', en: 'vs Last', w: 'w-[80px]' }].map((h, i) => (
                  <Th key={i} className={`whitespace-nowrap ${h.w || ''}`}>
                    {lang === 'ar' ? h.ar : h.en}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthData.map((emp, idx) => {
                const trend = getTrend(emp.id, emp.pct);
                const pctColor = getPctColor(emp.pct);
                return (
                  <Tr key={emp.id} onMouseEnter={() => setHoveredRow(emp.id)} onMouseLeave={() => setHoveredRow(null)}>
                    <Td className="text-center">{getRankIcon(idx + 1)}</Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                          style={{ background: emp.avatar_color || '#4A7AAB' }}
                        >
                          {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-content dark:text-content-dark">{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                          <div className="text-[11px] text-content-muted dark:text-content-muted-dark mt-px">{emp.role === 'sales_director' ? (lang === 'ar' ? 'مدير مبيعات' : 'Sales Director') : emp.role === 'sales_manager' ? (lang === 'ar' ? 'مدير فريق' : 'Sales Manager') : emp.role === 'team_leader' ? (lang === 'ar' ? 'قائد فريق' : 'Team Leader') : (lang === 'ar' ? 'موظف مبيعات' : 'Sales Agent')}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-[13px] text-content-muted dark:text-content-muted-dark font-medium">{fmt(emp.target)}</Td>
                    <Td className="text-[13px] font-bold text-content dark:text-content-dark">{fmt(emp.achieved)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12] min-w-[60px]">
                          <div className="h-full rounded" style={{ width: `${Math.min(emp.pct, 100)}%`, background: pctColor }} />
                        </div>
                        <span className="text-xs font-bold min-w-[36px] text-center" style={{ color: pctColor }}>{emp.pct}%</span>
                      </div>
                    </Td>
                    <Td className="text-center text-[13px] font-semibold text-content dark:text-content-dark">{emp.deals}</Td>
                    <Td className="text-center">
                      {trend > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-brand-500 text-xs font-bold"><ChevronUp size={14} />+{trend}%</span>
                      ) : trend < 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-bold"><ChevronDown size={14} />{trend}%</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-content-muted dark:text-content-muted-dark text-xs"><Minus size={14} />—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Podium Card */}
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-content dark:text-content-dark mb-4 flex items-center gap-1.5">
              <Trophy size={15} style={{ color: '#FFD700' }} />
              {lang === 'ar' ? 'البودييم' : 'Podium'}
            </div>
            <div className="flex items-end justify-center gap-2 mb-5 h-[100px]">
              {[1, 0, 2].map((idx) => {
                const emp = monthData[idx];
                if (!emp) return null;
                const heights = [80, 100, 65];
                const podiumColors = ['#C0C0C0', '#FFD700', '#CD7F32'];
                return (
                  <div key={idx} className="flex flex-col items-center w-20">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white mb-1.5"
                      style={{ background: emp.avatar_color || '#4A7AAB', border: `2px solid ${podiumColors[idx]}` }}
                    >
                      {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                    </div>
                    <div className="text-[10px] text-content-muted dark:text-content-muted-dark mb-1 text-center">
                      {lang === 'ar' ? emp.full_name_ar.split(' ')[0] : emp.full_name_en.split(' ')[0]}
                    </div>
                    <div
                      className="w-[72px] rounded-t-md flex items-center justify-center text-[13px] font-extrabold"
                      style={{ height: heights[idx], background: `${podiumColors[idx]}22`, border: `1px solid ${podiumColors[idx]}`, color: podiumColors[idx] }}
                    >
                      {idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
            {monthData.slice(0, 3).map((emp, idx) => (
              <div key={emp.id} className={`flex items-center gap-2.5 py-2 ${idx < 2 ? 'border-b border-edge dark:border-edge-dark' : ''}`}>
                <div className="w-5 text-center">{getRankIcon(idx + 1)}</div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-content dark:text-content-dark">{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                  <div className="text-[11px] text-content-muted dark:text-content-muted-dark">{fmt(emp.achieved)} EGP</div>
                </div>
                <Badge
                  size="sm"
                  className="font-bold rounded-md"
                  style={{ color: getPctColor(emp.pct), background: `${getPctColor(emp.pct)}15` }}
                >
                  {emp.pct}%
                </Badge>
              </div>
            ))}
          </Card>

          {/* Team Trend Card */}
          <Card className="p-5">
            <div className="text-[13px] font-semibold text-content dark:text-content-dark mb-3.5 flex items-center gap-1.5">
              <TrendingUp size={15} className="text-brand-500" />
              {lang === 'ar' ? 'اتجاه الفريق (آخر 3 أشهر)' : 'Team Trend (Last 3M)'}
            </div>
            {['mar', 'feb', 'jan'].map((m) => {
              const mData = MOCK_TARGETS.filter(t => t.month === m);
              const mPct = Math.round((mData.reduce((s,t)=>s+t.achieved,0) / mData.reduce((s,t)=>s+t.target,0)) * 100);
              const mLabel = MONTHS.find(mo => mo.id === m);
              return (
                <div key={m} className="mb-2.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">{lang === 'ar' ? mLabel.ar : mLabel.en}</span>
                    <span className="text-xs font-bold" style={{ color: getPctColor(mPct) }}>{mPct}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-gray-200 dark:bg-brand-500/[0.12]">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min(mPct,100)}%`, background: m === selectedMonth ? '#4A7AAB' : '#6B8DB5' }}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}
