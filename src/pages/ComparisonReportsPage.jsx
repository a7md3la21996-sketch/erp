import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  GitCompareArrows, ArrowUpRight, ArrowDownRight, Minus, Download,
  Users, Target, Trophy, DollarSign, Activity, Percent, BarChart3, XCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  getComparisonData, getMonthlyBreakdown, getAgentComparison, getDepartmentComparison,
} from '../services/comparisonService';
import { exportToExcel } from '../utils/exportUtils';

const PERIOD_OPTIONS = [
  { id: 'this_month', label: 'هذا الشهر', labelEn: 'This Month' },
  { id: 'last_month', label: 'الشهر الماضي', labelEn: 'Last Month' },
  { id: 'this_quarter', label: 'هذا الربع', labelEn: 'This Quarter' },
  { id: 'last_quarter', label: 'الربع الماضي', labelEn: 'Last Quarter' },
  { id: 'this_year', label: 'هذه السنة', labelEn: 'This Year' },
  { id: 'last_year', label: 'السنة الماضية', labelEn: 'Last Year' },
];

const METRIC_ICONS = {
  contacts: Users,
  opportunities: Target,
  won_deals: Trophy,
  revenue: DollarSign,
  activities: Activity,
  conversion_rate: Percent,
  avg_deal: BarChart3,
  lost_deals: XCircle,
};

const METRIC_COLORS = {
  contacts: '#3B82F6',
  opportunities: '#8B5CF6',
  won_deals: '#10B981',
  revenue: '#F59E0B',
  activities: '#6366F1',
  conversion_rate: '#EC4899',
  avg_deal: '#14B8A6',
  lost_deals: '#EF4444',
};

function formatNumber(n, isCurrency, isPercent) {
  if (isPercent) return `${n}%`;
  if (isCurrency) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  }
  return n.toLocaleString();
}

export default function ComparisonReportsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [period1, setPeriod1] = useState('this_month');
  const [period2, setPeriod2] = useState('last_month');

  const metrics = useMemo(() => getComparisonData(period1, period2), [period1, period2]);
  const breakdown = useMemo(() => getMonthlyBreakdown(period1, period2), [period1, period2]);
  const agents = useMemo(() => getAgentComparison(period1, period2), [period1, period2]);
  const departments = useMemo(() => getDepartmentComparison(period1, period2), [period1, period2]);

  const p1Label = PERIOD_OPTIONS.find(p => p.id === period1)?.[isRTL ? 'label' : 'labelEn'] || '';
  const p2Label = PERIOD_OPTIONS.find(p => p.id === period2)?.[isRTL ? 'label' : 'labelEn'] || '';

  const handleExport = async () => {
    const rows = metrics.map(m => ({
      [isRTL ? 'المؤشر' : 'Metric']: isRTL ? m.label : m.labelEn,
      [p1Label]: m.period1Value,
      [p2Label]: m.period2Value,
      [isRTL ? 'التغير %' : 'Change %']: `${m.changeDirection === 'down' ? '-' : ''}${m.change}%`,
    }));
    await exportToExcel(rows, isRTL ? 'تقرير_المقارنة' : 'comparison_report', isRTL ? 'المقارنة' : 'Comparison');
  };

  // Styles
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const cardBorder = isDark ? '#334155' : '#E2E8F0';
  const textPrimary = isDark ? '#F1F5F9' : '#1E293B';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const pageBg = isDark ? '#0F172A' : '#F8FAFC';
  const selectBg = isDark ? '#1E293B' : '#FFFFFF';
  const selectBorder = isDark ? '#475569' : '#CBD5E1';
  const tableBorderColor = isDark ? '#334155' : '#E2E8F0';
  const tableHeaderBg = isDark ? '#1E293B' : '#F1F5F9';
  const tableRowHoverBg = isDark ? '#1E293B80' : '#F8FAFC';

  const chartBreakdown = breakdown.map(w => ({
    name: isRTL ? w.label : w.labelEn,
    [p1Label]: w.period1Opps,
    [p2Label]: w.period2Opps,
  }));

  const chartRevenue = breakdown.map(w => ({
    name: isRTL ? w.label : w.labelEn,
    [p1Label]: w.period1Revenue,
    [p2Label]: w.period2Revenue,
  }));

  const deptChartData = (departments || []).map(d => ({
    name: d.department,
    [p1Label]: d.period1Revenue,
    [p2Label]: d.period2Revenue,
  }));

  const noData = metrics.every(m => m.period1Value === 0 && m.period2Value === 0);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px', background: pageBg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: isDark ? '#3B82F620' : '#3B82F615',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitCompareArrows size={22} color="#3B82F6" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'تقارير المقارنة' : 'Comparison Reports'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {isRTL ? 'قارن الأداء بين فترتين زمنيتين' : 'Compare performance between two time periods'}
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            background: isDark ? '#3B82F6' : '#3B82F6',
            color: '#FFF', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
          }}
        >
          <Download size={16} />
          {isRTL ? 'تصدير Excel' : 'Export Excel'}
        </button>
      </div>

      {/* Period selectors */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        marginBottom: 24, flexWrap: 'wrap',
        padding: '16px 20px', borderRadius: 12,
        background: cardBg, border: `1px solid ${cardBorder}`,
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
            {isRTL ? 'الفترة أ' : 'Period A'}
          </label>
          <select
            value={period1}
            onChange={e => setPeriod1(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${selectBorder}`, background: selectBg,
              color: textPrimary, fontSize: 14, outline: 'none',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{isRTL ? o.label : o.labelEn}</option>
            ))}
          </select>
        </div>

        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: isDark ? '#475569' : '#E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, alignSelf: 'flex-end',
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: textSecondary }}>VS</span>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 6 }}>
            {isRTL ? 'الفترة ب' : 'Period B'}
          </label>
          <select
            value={period2}
            onChange={e => setPeriod2(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${selectBorder}`, background: selectBg,
              color: textPrimary, fontSize: 14, outline: 'none',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.id} value={o.id}>{isRTL ? o.label : o.labelEn}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty state */}
      {noData && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`,
        }}>
          <GitCompareArrows size={48} color={textSecondary} style={{ marginBottom: 16, opacity: 0.4 }} />
          <h3 style={{ margin: 0, color: textPrimary, fontSize: 18 }}>
            {isRTL ? 'لا توجد بيانات للمقارنة' : 'No data to compare'}
          </h3>
          <p style={{ margin: '8px 0 0', color: textSecondary, fontSize: 14 }}>
            {isRTL ? 'جرب اختيار فترات زمنية مختلفة' : 'Try selecting different time periods'}
          </p>
        </div>
      )}

      {!noData && (
        <>
          {/* Comparison Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16, marginBottom: 32,
          }}>
            {metrics.map(m => {
              const Icon = METRIC_ICONS[m.id] || BarChart3;
              const color = METRIC_COLORS[m.id] || '#3B82F6';
              const max = Math.max(m.period1Value, m.period2Value) || 1;
              const p1Pct = (m.period1Value / max) * 100;
              const p2Pct = (m.period2Value / max) * 100;
              const isGoodChange = m.invertColor
                ? m.changeDirection === 'down'
                : m.changeDirection === 'up';
              const changeColor = m.changeDirection === 'same' ? textSecondary
                : isGoodChange ? '#10B981' : '#EF4444';

              return (
                <div key={m.id} style={{
                  background: cardBg, borderRadius: 12,
                  border: `1px solid ${cardBorder}`,
                  padding: '16px 20px',
                  transition: 'all 0.2s',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: `${color}15`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} color={color} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>
                        {isRTL ? m.label : m.labelEn}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: changeColor, fontSize: 13, fontWeight: 700 }}>
                      {m.changeDirection === 'up' && <ArrowUpRight size={14} />}
                      {m.changeDirection === 'down' && <ArrowDownRight size={14} />}
                      {m.changeDirection === 'same' && <Minus size={14} />}
                      {m.change}%
                    </div>
                  </div>

                  {/* Values */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontSize: 10, color: '#3B82F6', fontWeight: 600, textTransform: 'uppercase' }}>
                        {isRTL ? 'الفترة أ' : 'Period A'}
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#3B82F6' }}>
                        {formatNumber(m.period1Value, m.isCurrency, m.isPercent)}
                      </p>
                    </div>
                    <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                      <span style={{ fontSize: 10, color: textSecondary, fontWeight: 600, textTransform: 'uppercase' }}>
                        {isRTL ? 'الفترة ب' : 'Period B'}
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: textSecondary }}>
                        {formatNumber(m.period2Value, m.isCurrency, m.isPercent)}
                      </p>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ height: 6, borderRadius: 3, background: isDark ? '#1E293B' : '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p1Pct}%`, borderRadius: 3, background: '#3B82F6', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: isDark ? '#1E293B' : '#F1F5F9', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p2Pct}%`, borderRadius: 3, background: isDark ? '#64748B' : '#94A3B8', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginBottom: 32 }}>
            {/* Opportunities Chart */}
            <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: textPrimary }}>
                {isRTL ? 'مقارنة الفرص' : 'Opportunities Comparison'}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartBreakdown} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#E2E8F0'} />
                  <XAxis dataKey="name" tick={{ fill: textSecondary, fontSize: 12 }} />
                  <YAxis tick={{ fill: textSecondary, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: cardBg, border: `1px solid ${cardBorder}`,
                      borderRadius: 8, color: textPrimary, fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={p1Label} fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={p2Label} fill={isDark ? '#64748B' : '#94A3B8'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue Chart */}
            <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: textPrimary }}>
                {isRTL ? 'مقارنة الإيرادات' : 'Revenue Comparison'}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartRevenue} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#E2E8F0'} />
                  <XAxis dataKey="name" tick={{ fill: textSecondary, fontSize: 12 }} />
                  <YAxis tick={{ fill: textSecondary, fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <Tooltip
                    contentStyle={{
                      background: cardBg, border: `1px solid ${cardBorder}`,
                      borderRadius: 8, color: textPrimary, fontSize: 13,
                    }}
                    formatter={v => v.toLocaleString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={p1Label} fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={p2Label} fill={isDark ? '#64748B' : '#94A3B8'} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Agent Performance Table */}
          <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20, marginBottom: 32, overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'مقارنة أداء الوكلاء' : 'Agent Performance Comparison'}
            </h3>
            {agents.length === 0 ? (
              <p style={{ color: textSecondary, textAlign: 'center', padding: 20 }}>
                {isRTL ? 'لا توجد بيانات' : 'No data available'}
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: tableHeaderBg }}>
                    {[
                      isRTL ? 'اسم الوكيل' : 'Agent Name',
                      `${p1Label} - ${isRTL ? 'الإيرادات' : 'Revenue'}`,
                      `${p2Label} - ${isRTL ? 'الإيرادات' : 'Revenue'}`,
                      isRTL ? 'التغير %' : 'Change %',
                      `${p1Label} - ${isRTL ? 'الصفقات' : 'Deals'}`,
                      `${p2Label} - ${isRTL ? 'الصفقات' : 'Deals'}`,
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px',
                        textAlign: isRTL ? 'right' : 'left',
                        fontWeight: 600, color: textSecondary,
                        borderBottom: `1px solid ${tableBorderColor}`,
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {agents.map((a, idx) => {
                    const changeColor = a.changeDirection === 'up' ? '#10B981'
                      : a.changeDirection === 'down' ? '#EF4444' : textSecondary;
                    return (
                      <tr key={idx} style={{ borderBottom: `1px solid ${tableBorderColor}` }}
                        onMouseEnter={e => e.currentTarget.style.background = tableRowHoverBg}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: textPrimary }}>{a.agent}</td>
                        <td style={{ padding: '10px 14px', color: '#3B82F6', fontWeight: 600 }}>{a.period1Revenue.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', color: textSecondary }}>{a.period2Revenue.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', color: changeColor, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {a.changeDirection === 'up' && <ArrowUpRight size={14} />}
                          {a.changeDirection === 'down' && <ArrowDownRight size={14} />}
                          {a.changeDirection === 'same' && <Minus size={14} />}
                          {a.change}%
                        </td>
                        <td style={{ padding: '10px 14px', color: '#3B82F6', fontWeight: 600 }}>{a.period1Deals}</td>
                        <td style={{ padding: '10px 14px', color: textSecondary }}>{a.period2Deals}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Department Comparison Chart */}
          <div style={{ background: cardBg, borderRadius: 12, border: `1px solid ${cardBorder}`, padding: 20, marginBottom: 32 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'مقارنة الأقسام' : 'Department Comparison'}
            </h3>
            {(departments || []).length === 0 ? (
              <p style={{ color: textSecondary, textAlign: 'center', padding: 20 }}>
                {isRTL ? 'لا توجد بيانات' : 'No data available'}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, (departments || []).length * 60)}>
                <BarChart data={deptChartData} layout="vertical" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#E2E8F0'} />
                  <XAxis type="number" tick={{ fill: textSecondary, fontSize: 12 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fill: textSecondary, fontSize: 12 }} width={100} />
                  <Tooltip
                    contentStyle={{
                      background: cardBg, border: `1px solid ${cardBorder}`,
                      borderRadius: 8, color: textPrimary, fontSize: 13,
                    }}
                    formatter={v => v.toLocaleString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={p1Label} fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey={p2Label} fill={isDark ? '#64748B' : '#94A3B8'} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}
    </div>
  );
}
