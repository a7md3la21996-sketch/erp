import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  TrendingUp, DollarSign, Target, BarChart3, Percent,
  ChevronDown, Filter, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Line, ComposedChart, Cell,
} from 'recharts';
import { KpiCard, SmartFilter, applySmartFilters, Pagination, PageSkeleton } from '../../components/ui';
import { useAuditFilter } from '../../hooks/useAuditFilter';
import { fmtMoney, fmtFull } from '../../utils/formatting';
import {
  loadOpportunities, computeForecast, computeMonthlyForecast,
  computeStageFunnel, computeAccuracy, getDateRange, getDepartments,
  STAGE_PROBABILITIES,
} from '../../services/forecastService';

// ── Stage Labels ───────────────────────────────────────────────────
const STAGE_LABELS = {
  qualification:        { ar: 'تأهيل',         en: 'Qualification' },
  site_visit_scheduled: { ar: 'موعد معاينة',   en: 'Visit Scheduled' },
  site_visited:         { ar: 'تمت المعاينة',  en: 'Site Visited' },
  proposal:             { ar: 'عرض سعر',       en: 'Proposal' },
  negotiation:          { ar: 'تفاوض',         en: 'Negotiation' },
  reserved:             { ar: 'محجوز',         en: 'Reserved' },
  contracted:           { ar: 'تعاقد',         en: 'Contracted' },
  closed_won:           { ar: 'تم الإغلاق',    en: 'Closed Won' },
  closed_lost:          { ar: 'خسارة',         en: 'Closed Lost' },
  new:                  { ar: 'جديد',          en: 'New' },
  initial:              { ar: 'أولي',          en: 'Initial' },
  qualified:            { ar: 'مؤهل',          en: 'Qualified' },
  contacted:            { ar: 'تم التواصل',    en: 'Contacted' },
  closing:              { ar: 'إغلاق',         en: 'Closing' },
  nurturing:            { ar: 'رعاية',         en: 'Nurturing' },
  converted:            { ar: 'محول',          en: 'Converted' },
  request:              { ar: 'طلب',           en: 'Request' },
  evaluation:           { ar: 'تقييم',         en: 'Evaluation' },
  agreement:            { ar: 'اتفاق',         en: 'Agreement' },
  execution:            { ar: 'تنفيذ',         en: 'Execution' },
  pending:              { ar: 'معلق',          en: 'Pending' },
  under_review:         { ar: 'مراجعة',        en: 'Under Review' },
  approved:             { ar: 'موافق عليه',    en: 'Approved' },
};
const stageLabel = (key, isRTL) => {
  const s = STAGE_LABELS[key];
  return s ? (isRTL ? s.ar : s.en) : key;
};

// ── Date Range Options ─────────────────────────────────────────────
const DATE_RANGES = [
  { value: 'this_quarter', ar: 'هذا الربع', en: 'This Quarter' },
  { value: 'next_quarter', ar: 'الربع القادم', en: 'Next Quarter' },
  { value: 'this_year', ar: 'هذه السنة', en: 'This Year' },
  { value: 'last_6_months', ar: 'آخر 6 أشهر', en: 'Last 6 Months' },
];

// ── Dept Labels ────────────────────────────────────────────────────
const DEPT_LABELS = {
  all:        { ar: 'كل الأقسام',      en: 'All Departments' },
  sales:      { ar: 'المبيعات',        en: 'Sales' },
  marketing:  { ar: 'التسويق',         en: 'Marketing' },
  operations: { ar: 'العمليات',        en: 'Operations' },
  hr:         { ar: 'الموارد البشرية', en: 'HR' },
  finance:    { ar: 'المالية',         en: 'Finance' },
};

// ── Stage Colors ───────────────────────────────────────────────────
const STAGE_COLORS = {
  qualification: '#4A7AAB', site_visit_scheduled: '#4A7AAB', site_visited: '#2B4C6F',
  proposal: '#3B82F6', negotiation: '#F59E0B', reserved: '#8B5CF6',
  contracted: '#10B981', closed_won: '#22C55E', closed_lost: '#EF4444',
  new: '#94A3B8', initial: '#94A3B8', qualified: '#3B82F6', contacted: '#4A7AAB',
  closing: '#F97316', nurturing: '#8B5CF6', converted: '#10B981',
  request: '#4A7AAB', evaluation: '#2B4C6F', agreement: '#F59E0B',
  execution: '#8B5CF6', pending: '#94A3B8', under_review: '#F59E0B', approved: '#10B981',
};

// ── Smart Filter Fields ────────────────────────────────────────────
const SMART_FIELDS = [
  { id: 'stage', label: 'المرحلة', labelEn: 'Stage', type: 'select', options: Object.keys(STAGE_LABELS).map(k => ({ value: k, label: STAGE_LABELS[k].ar, labelEn: STAGE_LABELS[k].en })) },
  { id: 'budget', label: 'الميزانية', labelEn: 'Budget', type: 'number' },
];

// ── Main Component ─────────────────────────────────────────────────
export default function SalesForecastPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const { auditFields, applyAuditFilters } = useAuditFilter('opportunity');

  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('this_year');
  const [deptFilter, setDeptFilter] = useState('all');
  const [smartFilters, setSmartFilters] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Load data
  useEffect(() => {
    setLoading(true);
    try {
      const data = loadOpportunities();
      setOpportunities(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  // All SmartFilter fields
  const allSmartFields = useMemo(() => [...SMART_FIELDS, ...auditFields], [auditFields]);

  // Filter by department
  const deptFiltered = useMemo(() => {
    if (deptFilter === 'all') return opportunities;
    return opportunities.filter(o => o.department === deptFilter);
  }, [opportunities, deptFilter]);

  // Apply smart filters
  const smartFiltered = useMemo(() => {
    let data = deptFiltered;
    if (smartFilters.length > 0) {
      data = applySmartFilters(data, smartFilters, allSmartFields);
      data = applyAuditFilters(data, smartFilters);
    }
    return data;
  }, [deptFiltered, smartFilters, allSmartFields, applyAuditFilters]);

  // Compute date range
  const range = useMemo(() => getDateRange(dateRange), [dateRange]);

  // KPIs
  const kpis = useMemo(() => computeForecast(smartFiltered, range), [smartFiltered, range]);

  // Monthly chart data
  const monthlyData = useMemo(() => computeMonthlyForecast(smartFiltered, range, isRTL), [smartFiltered, range, isRTL]);

  // Cumulative forecast trend line
  const chartData = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map(m => {
      cumulative += m.weighted;
      return { ...m, cumulative };
    });
  }, [monthlyData]);

  // Stage funnel
  const funnel = useMemo(() => {
    const rangeFiltered = smartFiltered.filter(opp => {
      const d = new Date(opp.created_at || opp.updated_at);
      return d >= range.start && d <= range.end;
    });
    return computeStageFunnel(rangeFiltered);
  }, [smartFiltered, range]);

  // Accuracy data
  const accuracy = useMemo(() => computeAccuracy(smartFiltered), [smartFiltered]);

  // Departments for filter
  const departments = useMemo(() => getDepartments(opportunities), [opportunities]);

  // Forecast table data = monthly breakdown
  const tableData = useMemo(() => {
    return monthlyData.map(m => {
      const acc = accuracy.find(a => a.month === `${m.year}-${String(m.month + 1).padStart(2, '0')}`);
      return {
        ...m,
        accuracy: acc ? acc.accuracy : null,
      };
    });
  }, [monthlyData, accuracy]);

  // Pagination on table
  const totalPages = Math.ceil(tableData.length / pageSize);
  const paginatedTable = tableData.slice((page - 1) * pageSize, page * pageSize);

  // Max funnel value for bar width
  const maxFunnelValue = useMemo(() => Math.max(...funnel.map(f => f.value), 1), [funnel]);

  if (loading) return <PageSkeleton hasKpis tableRows={6} tableCols={5} />;

  // ── Styles ───────────────────────────────────────────────────────
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(74,122,171,0.15)' : '1px solid #e2e8f0';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const pageBg = isDark ? '#0a1929' : '#f8fafc';
  const tableBg = isDark ? '#132337' : '#ffffff';
  const tableHeaderBg = isDark ? 'rgba(74,122,171,0.08)' : '#f8fafc';
  const borderColor = isDark ? 'rgba(74,122,171,0.15)' : '#e2e8f0';
  const hoverBg = isDark ? 'rgba(74,122,171,0.08)' : '#f1f5f9';

  return (
    <div style={{ padding: '24px', background: pageBg, minHeight: '100vh' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(74,122,171,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <TrendingUp size={20} color="#4A7AAB" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
              {isRTL ? 'توقعات المبيعات' : 'Sales Forecast'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: textSecondary }}>
              {isRTL ? 'تحليل خط الأنابيب والتوقعات المرجحة' : 'Pipeline analysis & weighted forecast'}
            </p>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range */}
          <div style={{ position: 'relative' }}>
            <select
              value={dateRange}
              onChange={e => { setDateRange(e.target.value); setPage(1); }}
              style={{
                appearance: 'none', padding: '8px 32px 8px 12px', borderRadius: 8,
                background: cardBg, color: textPrimary, border: cardBorder,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none',
                minWidth: 140,
              }}
            >
              {DATE_RANGES.map(r => (
                <option key={r.value} value={r.value}>{isRTL ? r.ar : r.en}</option>
              ))}
            </select>
            <Calendar size={14} style={{
              position: 'absolute', [isRTL ? 'left' : 'right']: 10,
              top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: textSecondary,
            }} />
          </div>

          {/* Department */}
          {departments.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
                style={{
                  appearance: 'none', padding: '8px 32px 8px 12px', borderRadius: 8,
                  background: cardBg, color: textPrimary, border: cardBorder,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer', outline: 'none',
                  minWidth: 140,
                }}
              >
                <option value="all">{isRTL ? 'كل الأقسام' : 'All Departments'}</option>
                {departments.map(d => (
                  <option key={d} value={d}>
                    {DEPT_LABELS[d] ? (isRTL ? DEPT_LABELS[d].ar : DEPT_LABELS[d].en) : d}
                  </option>
                ))}
              </select>
              <Filter size={14} style={{
                position: 'absolute', [isRTL ? 'left' : 'right']: 10,
                top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: textSecondary,
              }} />
            </div>
          )}
        </div>
      </div>

      {/* Smart Filter */}
      <div style={{ marginBottom: 16 }}>
        <SmartFilter
          fields={allSmartFields}
          filters={smartFilters}
          onChange={f => { setSmartFilters(f); setPage(1); }}
        />
      </div>

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16, marginBottom: 24,
      }}>
        <KpiCard
          title={isRTL ? 'إجمالي خط الأنابيب' : 'Total Pipeline'}
          value={fmtMoney(kpis.totalPipeline)}
          icon={<DollarSign size={18} />}
          color="#4A7AAB"
        />
        <KpiCard
          title={isRTL ? 'التوقع المرجح' : 'Weighted Forecast'}
          value={fmtMoney(kpis.weightedRevenue)}
          icon={<TrendingUp size={18} />}
          color="#3B82F6"
        />
        <KpiCard
          title={isRTL ? 'الإيراد الفعلي' : 'Actual Revenue'}
          value={fmtMoney(kpis.actualRevenue)}
          icon={<Target size={18} />}
          color="#10B981"
        />
        <KpiCard
          title={isRTL ? 'نسبة الفوز' : 'Win Rate'}
          value={`${kpis.winRate}%`}
          icon={<Percent size={18} />}
          color="#F59E0B"
        />
        <KpiCard
          title={isRTL ? 'متوسط الصفقة' : 'Avg Deal Size'}
          value={fmtMoney(kpis.avgDealSize)}
          icon={<BarChart3 size={18} />}
          color="#8B5CF6"
        />
      </div>

      {/* Charts Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
        gap: 16, marginBottom: 24,
      }}>
        {/* Monthly Forecast Chart */}
        <div style={{
          background: cardBg, borderRadius: 12, border: cardBorder,
          padding: 20, minHeight: 360,
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'التوقعات الشهرية' : 'Monthly Forecast'}
          </h3>
          {chartData.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: textSecondary, fontSize: 14 }}>
              {isRTL ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(74,122,171,0.12)' : '#e2e8f0'} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: textSecondary, fontSize: 12 }}
                  axisLine={{ stroke: borderColor }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: textSecondary, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => fmtMoney(v)}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: isDark ? '#1a2332' : '#fff',
                    border: cardBorder, borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    color: textPrimary, fontSize: 13,
                  }}
                  formatter={(value, name) => [fmtFull(Math.round(value)), name]}
                  labelStyle={{ color: textSecondary, fontSize: 12, marginBottom: 4 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: textSecondary }}
                />
                <Bar
                  dataKey="pipeline"
                  name={isRTL ? 'خط الأنابيب' : 'Pipeline'}
                  fill="rgba(74,122,171,0.35)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="weighted"
                  name={isRTL ? 'التوقع المرجح' : 'Weighted'}
                  fill="#4A7AAB"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="actual"
                  name={isRTL ? 'الفعلي' : 'Actual'}
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name={isRTL ? 'التراكمي' : 'Cumulative'}
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#F59E0B' }}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stage Funnel */}
        <div style={{
          background: cardBg, borderRadius: 12, border: cardBorder,
          padding: 20, minHeight: 360, overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'قمع المراحل' : 'Stage Funnel'}
          </h3>
          {funnel.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: textSecondary, fontSize: 14 }}>
              {isRTL ? 'لا توجد بيانات' : 'No data'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {funnel.map(item => {
                const barWidth = Math.max((item.value / maxFunnelValue) * 100, 8);
                const color = STAGE_COLORS[item.stage] || '#4A7AAB';
                return (
                  <div key={item.stage}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: textPrimary }}>
                        {stageLabel(item.stage, isRTL)}
                      </span>
                      <span style={{ fontSize: 11, color: textSecondary }}>
                        {item.count} {isRTL ? 'فرصة' : 'deals'} &middot; {Math.round(item.probability * 100)}%
                      </span>
                    </div>
                    <div style={{
                      width: '100%', height: 22, borderRadius: 6,
                      background: isDark ? 'rgba(74,122,171,0.08)' : '#f1f5f9',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      <div style={{
                        width: `${barWidth}%`, height: '100%', borderRadius: 6,
                        background: color, opacity: 0.8,
                        transition: 'width 0.4s ease',
                      }} />
                      <span style={{
                        position: 'absolute', [isRTL ? 'right' : 'left']: 8,
                        top: '50%', transform: 'translateY(-50%)',
                        fontSize: 11, fontWeight: 600,
                        color: barWidth > 30 ? '#fff' : textPrimary,
                      }}>
                        {fmtMoney(item.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Forecast Table */}
      <div style={{
        background: cardBg, borderRadius: 12, border: cardBorder,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${borderColor}` }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'جدول التوقعات' : 'Forecast Table'}
          </h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ background: tableHeaderBg }}>
                {[
                  isRTL ? 'الشهر' : 'Month',
                  isRTL ? 'الصفقات' : 'Deals',
                  isRTL ? 'خط الأنابيب' : 'Pipeline Value',
                  isRTL ? 'التوقع المرجح' : 'Weighted Value',
                  isRTL ? 'الفعلي' : 'Actual',
                  isRTL ? 'الدقة' : 'Accuracy',
                ].map((col, idx) => (
                  <th key={idx} style={{
                    textAlign: isRTL ? 'right' : 'left',
                    padding: '10px 16px', fontSize: 11, fontWeight: 700,
                    color: '#6B8DB5', textTransform: 'uppercase',
                    letterSpacing: '0.05em', borderBottom: `1px solid ${borderColor}`,
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedTable.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{
                    textAlign: 'center', padding: 40,
                    color: textSecondary, fontSize: 14,
                  }}>
                    {isRTL ? 'لا توجد بيانات في هذه الفترة' : 'No data for this period'}
                  </td>
                </tr>
              ) : (
                paginatedTable.map((row, idx) => (
                  <tr key={idx} style={{
                    borderBottom: `1px solid ${borderColor}`,
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: textPrimary }}>
                      {row.label} {row.year}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: textPrimary }}>
                      {row.deals}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: textPrimary, fontFamily: 'monospace' }}>
                      {fmtFull(Math.round(row.pipeline))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#4A7AAB', fontWeight: 600, fontFamily: 'monospace' }}>
                      {fmtFull(Math.round(row.weighted))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#10B981', fontWeight: 600, fontFamily: 'monospace' }}>
                      {fmtFull(Math.round(row.actual))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      {row.accuracy != null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                          background: row.accuracy >= 80
                            ? 'rgba(16,185,129,0.12)'
                            : row.accuracy >= 50
                              ? 'rgba(245,158,11,0.12)'
                              : 'rgba(239,68,68,0.12)',
                          color: row.accuracy >= 80
                            ? '#10B981'
                            : row.accuracy >= 50
                              ? '#F59E0B'
                              : '#EF4444',
                        }}>
                          {row.accuracy}%
                        </span>
                      ) : (
                        <span style={{ color: textSecondary, fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={ps => { setPageSize(ps); setPage(1); }}
              total={tableData.length}
            />
          </div>
        )}
      </div>

      {/* Bottom summary */}
      <div style={{
        marginTop: 16, padding: '12px 20px', borderRadius: 10,
        background: isDark ? 'rgba(74,122,171,0.06)' : 'rgba(74,122,171,0.04)',
        border: `1px solid ${borderColor}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 12, color: textSecondary }}>
          {isRTL
            ? `${kpis.totalDeals} فرصة في الفترة المحددة • ${kpis.closedWon} فوز • ${kpis.closedLost} خسارة`
            : `${kpis.totalDeals} opportunities in selected period • ${kpis.closedWon} won • ${kpis.closedLost} lost`
          }
        </span>
        <span style={{ fontSize: 12, color: '#4A7AAB', fontWeight: 600 }}>
          {isRTL ? `التوقع المرجح: ${fmtMoney(kpis.weightedRevenue)}` : `Weighted Forecast: ${fmtMoney(kpis.weightedRevenue)}`}
        </span>
      </div>
    </div>
  );
}
