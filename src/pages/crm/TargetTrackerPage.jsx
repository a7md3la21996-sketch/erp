import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import {
  Trophy, TrendingUp, Target, Award, Star, Medal,
  ChevronUp, ChevronDown, Minus, Calendar, Users,
  BarChart2, DollarSign, Crown, Zap
} from 'lucide-react';

// ─── Mock targets data ────────────────────────────────────────────────────────
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

const fmt = (n) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n;
};

const getRankIcon = (rank, isDark) => {
  if (rank === 1) return <Crown size={18} style={{ color: '#FFD700' }} />;
  if (rank === 2) return <Medal size={18} style={{ color: '#C0C0C0' }} />;
  if (rank === 3) return <Award size={18} style={{ color: '#CD7F32' }} />;
  return <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#8BA8C8' : '#6b7280', width: 18, textAlign: 'center', display: 'inline-block' }}>{rank}</span>;
};

export default function TargetTrackerPage() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const lang = i18n.language;
  const isRTL = lang === 'ar';

  const [selectedMonth, setSelectedMonth] = useState('mar');
  const [sortBy, setSortBy] = useState('pct'); // pct | achieved | deals
  const [hoveredRow, setHoveredRow] = useState(null);

  const c = {
    bg: isDark ? '#152232' : '#f1f5f9',
    cardBg: isDark ? '#1a2234' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e2e8f0',
    text: isDark ? '#E2EAF4' : '#0f172a',
    textMuted: isDark ? '#8BA8C8' : '#64748b',
    inputBg: isDark ? '#0F1E2D' : '#f8fafc',
    thBg: isDark ? 'rgba(74,122,171,0.08)' : '#f8fafc',
    rowHover: isDark ? 'rgba(74,122,171,0.08)' : '#f1f5f9',
    primary: '#2B4C6F',
    accent: '#4A7AAB',
    light: '#6B8DB5',
  };

  const salesEmps = useMemo(() =>
    MOCK_EMPLOYEES.filter(e => SALES_ROLES.includes(e.role)),
  []);

  const monthData = useMemo(() => {
    return salesEmps.map(emp => {
      const t = MOCK_TARGETS.find(t => t.emp_id === emp.id && t.month === selectedMonth);
      if (!t) return null;
      const pct = Math.round((t.achieved / t.target) * 100);
      return { ...emp, ...t, pct };
    }).filter(Boolean).sort((a, b) => {
      if (sortBy === 'pct') return b.pct - a.pct;
      if (sortBy === 'achieved') return b.achieved - a.achieved;
      if (sortBy === 'deals') return b.deals - a.deals;
      return 0;
    });
  }, [salesEmps, selectedMonth, sortBy]);

  // KPIs
  const totalTarget   = monthData.reduce((s, e) => s + e.target, 0);
  const totalAchieved = monthData.reduce((s, e) => s + e.achieved, 0);
  const totalPct      = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const topPerformer  = monthData[0];
  const aboveTarget   = monthData.filter(e => e.pct >= 100).length;

  const monthLabel = (id) => {
    const m = MONTHS.find(m => m.id === id);
    return m ? (lang === 'ar' ? m.ar : m.en) : id;
  };

  const getPctColor = (pct) => {
    if (pct >= 100) return '#4A7AAB';
    if (pct >= 80)  return '#6B8DB5';
    if (pct >= 60)  return '#8BA8C8';
    return '#EF4444';
  };

  const getTrend = (empId, currentPct) => {
    const prevMonths = ['feb', 'jan'];
    const prevMonth = selectedMonth === 'mar' ? 'feb' : selectedMonth === 'feb' ? 'jan' : null;
    if (!prevMonth) return 0;
    const prev = MOCK_TARGETS.find(t => t.emp_id === empId && t.month === prevMonth);
    if (!prev) return 0;
    const prevPct = Math.round((prev.achieved / prev.target) * 100);
    return currentPct - prevPct;
  };

  return (
    <div style={{ padding: 24, direction: isRTL ? 'rtl' : 'ltr', background: c.bg, minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: c.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={22} style={{ color: c.accent }} />
            {lang === 'ar' ? 'متابعة التارجت والترتيب' : 'Target Tracker & Leaderboard'}
          </h1>
          <p style={{ fontSize: 13, color: c.textMuted, margin: '4px 0 0' }}>
            {lang === 'ar' ? 'أداء فريق المبيعات الشهري' : 'Monthly Sales Team Performance'}
          </p>
        </div>

        {/* Month Selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MONTHS.map(m => (
            <button key={m.id} onClick={() => setSelectedMonth(m.id)} style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: `1px solid ${selectedMonth === m.id ? c.accent : c.border}`,
              background: selectedMonth === m.id ? c.accent : c.cardBg,
              color: selectedMonth === m.id ? '#fff' : c.textMuted,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {lang === 'ar' ? m.ar : m.en}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          {
            icon: <Target size={18} style={{ color: c.accent }} />,
            label: lang === 'ar' ? 'إجمالي التارجت' : 'Total Target',
            value: fmt(totalTarget) + ' EGP',
            sub: monthLabel(selectedMonth),
          },
          {
            icon: <TrendingUp size={18} style={{ color: totalPct >= 100 ? c.accent : '#EF4444' }} />,
            label: lang === 'ar' ? 'إجمالي المحقق' : 'Total Achieved',
            value: fmt(totalAchieved) + ' EGP',
            sub: `${totalPct}% ${lang === 'ar' ? 'من التارجت' : 'of target'}`,
            highlight: true,
            pct: totalPct,
          },
          {
            icon: <Crown size={18} style={{ color: '#FFD700' }} />,
            label: lang === 'ar' ? 'الأول هذا الشهر' : 'Top Performer',
            value: topPerformer ? (lang === 'ar' ? topPerformer.full_name_ar : topPerformer.full_name_en) : '—',
            sub: topPerformer ? `${topPerformer.pct}%` : '',
          },
          {
            icon: <Zap size={18} style={{ color: c.accent }} />,
            label: lang === 'ar' ? 'حققوا التارجت' : 'Hit Target',
            value: `${aboveTarget} / ${monthData.length}`,
            sub: lang === 'ar' ? 'موظف' : 'agents',
          },
        ].map((kpi, i) => (
          <div key={i} style={{
            background: c.cardBg, borderRadius: 12, padding: '16px 20px',
            border: `1px solid ${c.border}`,
            boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {kpi.icon}
              <span style={{ fontSize: 12, color: c.textMuted, fontWeight: 500 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.text, marginBottom: 4 }}>{kpi.value}</div>
            {kpi.highlight && kpi.pct !== undefined && (
              <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(74,122,171,0.15)' : '#e2e8f0', marginBottom: 4 }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(kpi.pct, 100)}%`, background: getPctColor(kpi.pct), transition: 'width 0.5s ease' }} />
              </div>
            )}
            <div style={{ fontSize: 12, color: c.textMuted }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Main Table */}
        <div style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, overflow: 'hidden', boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>

          {/* Table Header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: c.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={16} style={{ color: c.accent }} />
              {lang === 'ar' ? 'ترتيب الفريق' : 'Team Ranking'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'pct',      ar: 'بالنسبة',  en: '% Target' },
                { key: 'achieved', ar: 'بالمبلغ',  en: 'Amount' },
                { key: 'deals',    ar: 'بالصفقات', en: 'Deals' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${sortBy === s.key ? c.accent : c.border}`,
                  background: sortBy === s.key ? c.accent : 'transparent',
                  color: sortBy === s.key ? '#fff' : c.textMuted,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {lang === 'ar' ? s.ar : s.en}
                </button>
              ))}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: c.thBg }}>
                {[
                  { ar: '#',        en: '#',         w: 40  },
                  { ar: 'الموظف',  en: 'Agent',     w: null },
                  { ar: 'التارجت', en: 'Target',    w: 100 },
                  { ar: 'المحقق',  en: 'Achieved',  w: 100 },
                  { ar: 'النسبة',  en: '% Done',    w: 140 },
                  { ar: 'الصفقات', en: 'Deals',     w: 70  },
                  { ar: 'التغيير', en: 'vs Last',   w: 80  },
                ].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', fontSize: 11, fontWeight: 600,
                    color: c.textMuted, textAlign: isRTL ? 'right' : 'left',
                    whiteSpace: 'nowrap', width: h.w || undefined,
                  }}>
                    {lang === 'ar' ? h.ar : h.en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthData.map((emp, idx) => {
                const trend = getTrend(emp.id, emp.pct);
                const pctColor = getPctColor(emp.pct);
                const isHovered = hoveredRow === emp.id;
                return (
                  <tr key={emp.id}
                    onMouseEnter={() => setHoveredRow(emp.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: isHovered ? c.rowHover : 'transparent',
                      borderBottom: `1px solid ${c.border}`,
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {getRankIcon(idx + 1, isDark)}
                    </td>

                    {/* Employee */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: emp.avatar_color || c.accent,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>
                            {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
                          </div>
                          <div style={{ fontSize: 11, color: c.textMuted, marginTop: 1 }}>
                            {emp.role === 'sales_director' ? (lang === 'ar' ? 'مدير مبيعات' : 'Sales Director') :
                             emp.role === 'sales_manager'  ? (lang === 'ar' ? 'مدير فريق'  : 'Sales Manager')  :
                             emp.role === 'team_leader'    ? (lang === 'ar' ? 'قائد فريق'  : 'Team Leader')    :
                                                             (lang === 'ar' ? 'موظف مبيعات' : 'Sales Agent')}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Target */}
                    <td style={{ padding: '12px 14px', fontSize: 13, color: c.textMuted, fontWeight: 500 }}>
                      {fmt(emp.target)}
                    </td>

                    {/* Achieved */}
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: c.text }}>
                      {fmt(emp.achieved)}
                    </td>

                    {/* Progress */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 4, background: isDark ? 'rgba(74,122,171,0.12)' : '#e2e8f0', minWidth: 60 }}>
                          <div style={{
                            height: '100%', borderRadius: 4,
                            width: `${Math.min(emp.pct, 100)}%`,
                            background: pctColor,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, minWidth: 36, textAlign: 'center' }}>
                          {emp.pct}%
                        </span>
                      </div>
                    </td>

                    {/* Deals */}
                    <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: c.text }}>
                      {emp.deals}
                    </td>

                    {/* Trend */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {trend > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: c.accent, fontSize: 12, fontWeight: 700 }}>
                          <ChevronUp size={14} /> +{trend}%
                        </span>
                      ) : trend < 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: '#EF4444', fontSize: 12, fontWeight: 700 }}>
                          <ChevronDown size={14} /> {trend}%
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: c.textMuted, fontSize: 12 }}>
                          <Minus size={14} /> —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right Panel — Leaderboard Podium + Mini Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Podium Top 3 */}
          <div style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={15} style={{ color: '#FFD700' }} />
              {lang === 'ar' ? 'البودييم' : 'Podium'}
            </div>

            {/* Podium Visual */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 20, height: 100 }}>
              {[1, 0, 2].map((idx) => {
                const emp = monthData[idx];
                if (!emp) return null;
                const heights = [80, 100, 65];
                const rank = idx + 1;
                const podiumColors = ['#C0C0C0', '#FFD700', '#CD7F32'];
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: emp.avatar_color || c.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6,
                      border: `2px solid ${podiumColors[idx]}`,
                    }}>
                      {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                    </div>
                    <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 4, textAlign: 'center', lineHeight: 1.2 }}>
                      {lang === 'ar' ? emp.full_name_ar.split(' ')[0] : emp.full_name_en.split(' ')[0]}
                    </div>
                    <div style={{
                      width: 72, height: heights[idx], borderRadius: '6px 6px 0 0',
                      background: `${podiumColors[idx]}22`,
                      border: `1px solid ${podiumColors[idx]}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: podiumColors[idx],
                    }}>
                      {rank}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top 3 List */}
            {monthData.slice(0, 3).map((emp, idx) => {
              const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];
              return (
                <div key={emp.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 0',
                  borderBottom: idx < 2 ? `1px solid ${c.border}` : 'none',
                }}>
                  <div style={{ width: 20, textAlign: 'center' }}>
                    {getRankIcon(idx + 1, isDark)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>
                      {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
                    </div>
                    <div style={{ fontSize: 11, color: c.textMuted }}>{fmt(emp.achieved)} EGP</div>
                  </div>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: getPctColor(emp.pct),
                    background: `${getPctColor(emp.pct)}15`,
                    padding: '2px 8px', borderRadius: 6,
                  }}>
                    {emp.pct}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Monthly Trend Mini */}
          <div style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.border}`, padding: 20, boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={15} style={{ color: c.accent }} />
              {lang === 'ar' ? 'اتجاه الفريق (آخر 3 أشهر)' : 'Team Trend (Last 3M)'}
            </div>
            {['mar', 'feb', 'jan'].map((m, i) => {
              const mData = MOCK_TARGETS.filter(t => t.month === m);
              const mTotal = mData.reduce((s, t) => s + t.achieved, 0);
              const mTarget = mData.reduce((s, t) => s + t.target, 0);
              const mPct = Math.round((mTotal / mTarget) * 100);
              const mLabel = MONTHS.find(mo => mo.id === m);
              return (
                <div key={m} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? mLabel.ar : mLabel.en}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: getPctColor(mPct) }}>{mPct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 4, background: isDark ? 'rgba(74,122,171,0.12)' : '#e2e8f0' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(mPct, 100)}%`,
                      background: m === selectedMonth ? c.accent : c.light,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
