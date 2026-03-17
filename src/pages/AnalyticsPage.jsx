import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, BarChart3, Users, DollarSign,
  Target, Award, Clock, ArrowDownRight, Download, Filter,
  Trophy, Zap, Activity, PieChart as PieIcon, GitBranch, Printer,
} from 'lucide-react';
import { Card, CardHeader, KpiCard, ExportButton, Pagination } from '../components/ui';
import {
  loadAnalyticsData, filterByRange,
  computeConversionFunnel, computeLeadSourceROI,
  computeSalesCycleDuration, computeAgentPerformance,
  computeWinLossAnalysis, computeTrendAnalysis,
} from '../services/analyticsService';
import { exportToExcel, exportToCSV } from '../utils/exportUtils';
import { exportToPrintableHTML } from '../services/reportExportService';

// ── Constants ────────────────────────────────────────────────────
const ACCENT = '#4A7AAB';
const CHART_COLORS = ['#4A7AAB', '#6B8DB5', '#2B4C6F', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PIE_COLORS = ['#4A7AAB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B8DB5', '#2B4C6F'];

const TABS = [
  { id: 'funnel', icon: GitBranch, en: 'Conversion Funnel', ar: 'قمع التحويل' },
  { id: 'roi', icon: DollarSign, en: 'Lead Source ROI', ar: 'عائد مصادر الليدز' },
  { id: 'cycle', icon: Clock, en: 'Sales Cycle', ar: 'دورة المبيعات' },
  { id: 'winloss', icon: Target, en: 'Win/Loss', ar: 'ربح/خسارة' },
  { id: 'agents', icon: Users, en: 'Agent Performance', ar: 'أداء الوكلاء' },
];

const DATE_RANGES = [
  { id: 'this_month', en: 'This Month', ar: 'هذا الشهر' },
  { id: 'this_quarter', en: 'This Quarter', ar: 'هذا الربع' },
  { id: 'this_year', en: 'This Year', ar: 'هذه السنة' },
  { id: 'all', en: 'All Time', ar: 'كل الأوقات' },
];

// ── Chart Tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, isDark, isRTL, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: isDark ? 'rgba(26,35,50,0.95)' : 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(74,122,171,0.2)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      backdropFilter: 'blur(8px)',
      direction: isRTL ? 'rtl' : 'ltr',
    }}>
      <div style={{ color: isDark ? '#94a3b8' : '#64748b', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || ACCENT, fontWeight: 700, fontSize: 13 }}>
          {p.name}: {formatter ? formatter(p.value) : (typeof p.value === 'number' ? p.value.toLocaleString() : p.value)}
        </div>
      ))}
    </div>
  );
}

// ── Format helpers ───────────────────────────────────────────────
const fmtMoney = (v) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v?.toLocaleString?.() || '0';
};
const fmtPct = (v) => `${v}%`;

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function AnalyticsPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('funnel');
  const [dateRange, setDateRange] = useState('all');

  // ── Load & compute data ──────────────────────────────────────
  const rawData = useMemo(() => loadAnalyticsData(), []);

  const filteredData = useMemo(() => ({
    opportunities: filterByRange(rawData.opportunities, dateRange),
    contacts: filterByRange(rawData.contacts, dateRange),
    deals: filterByRange(rawData.deals, dateRange, 'closed_at'),
    activities: filterByRange(rawData.activities, dateRange),
  }), [rawData, dateRange]);

  const funnelData = useMemo(() => computeConversionFunnel(filteredData.opportunities), [filteredData.opportunities]);
  const roiData = useMemo(() => computeLeadSourceROI(filteredData.contacts, filteredData.opportunities, filteredData.deals), [filteredData]);
  const cycleData = useMemo(() => computeSalesCycleDuration(filteredData.opportunities), [filteredData.opportunities]);
  const winLossData = useMemo(() => computeWinLossAnalysis(filteredData.opportunities), [filteredData.opportunities]);
  const agentData = useMemo(() => computeAgentPerformance(filteredData.opportunities, filteredData.activities), [filteredData]);
  const trendData = useMemo(() => computeTrendAnalysis(filteredData.opportunities, 12), [filteredData.opportunities]);

  // ── Style helpers ────────────────────────────────────────────
  const bgPage = isDark ? '#0a1929' : '#f8fafc';
  const bgCard = isDark ? '#1a2332' : '#ffffff';
  const bgCardAlt = isDark ? '#132337' : '#f8fafc';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? 'rgba(74,122,171,0.15)' : 'rgba(0,0,0,0.08)';
  const axisColor = isDark ? '#475569' : '#cbd5e1';

  const cardStyle = {
    background: bgCard,
    border: `1px solid ${borderColor}`,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  };

  const tableHeaderStyle = {
    padding: '10px 14px',
    textAlign: isRTL ? 'right' : 'left',
    fontSize: 11,
    fontWeight: 600,
    color: textSecondary,
    borderBottom: `1px solid ${borderColor}`,
    background: bgCardAlt,
    whiteSpace: 'nowrap',
  };

  const tableCellStyle = {
    padding: '10px 14px',
    fontSize: 13,
    color: textPrimary,
    borderBottom: `1px solid ${borderColor}`,
    whiteSpace: 'nowrap',
  };

  // ── Export handler ───────────────────────────────────────────
  const handleExport = useCallback(async (format) => {
    let data = [];
    let filename = 'analytics';

    switch (activeTab) {
      case 'funnel':
        data = funnelData.map(f => ({
          Stage: f.label.en,
          Count: f.count,
          'Conversion Rate': `${f.conversionRate}%`,
          'Overall Rate': `${f.overallRate}%`,
          'Drop Off': f.dropOff,
          'Drop Off %': `${f.dropOffPct}%`,
        }));
        filename = 'conversion_funnel';
        break;
      case 'roi':
        data = roiData.map(r => ({
          Source: r.source,
          Leads: r.leads,
          Opportunities: r.opps,
          Deals: r.deals,
          Revenue: r.revenue,
          Cost: r.cost,
          'ROI %': `${r.roi}%`,
        }));
        filename = 'lead_source_roi';
        break;
      case 'cycle':
        data = cycleData.agentAvg.map(a => ({
          Agent: a.agent,
          'Avg Days': a.avgDays,
          'Min Days': a.minDays,
          'Max Days': a.maxDays,
          'Total Deals': a.totalDeals,
        }));
        filename = 'sales_cycle';
        break;
      case 'winloss':
        data = winLossData.winRateBySource.map(s => ({
          Source: s.source,
          Won: s.won,
          Lost: s.lost,
          Total: s.total,
          'Win Rate': `${s.winRate}%`,
        }));
        filename = 'win_loss_analysis';
        break;
      case 'agents':
        data = agentData.map(a => ({
          Agent: a.agent,
          Opportunities: a.opps,
          Won: a.deals,
          Lost: a.lost || 0,
          'Conversion %': `${a.conversionRate}%`,
          Revenue: a.revenue,
          'Avg Deal Size': a.avgDealSize || 0,
          'Avg Close Days': a.avgCycleDays,
          Activities: a.totalActivities,
          Calls: a.calls,
        }));
        filename = 'agent_performance';
        break;
    }

    if (format === 'excel') await exportToExcel(data, filename);
    else exportToCSV(data, filename);
  }, [activeTab, funnelData, roiData, cycleData, winLossData, agentData]);

  // ── Print / PDF handler ────────────────────────────────────────
  const handlePrint = useCallback(() => {
    let title = '';
    let sections = [];

    const tabLabel = TABS.find(t => t.id === activeTab);
    const tabTitle = isRTL ? (tabLabel?.ar || '') : (tabLabel?.en || '');
    const rangeLabel = DATE_RANGES.find(r => r.id === dateRange);
    const periodStr = isRTL ? (rangeLabel?.ar || '') : (rangeLabel?.en || '');

    switch (activeTab) {
      case 'funnel':
        title = isRTL ? 'تقرير قمع التحويل' : 'Conversion Funnel Report';
        sections = [{
          type: 'table',
          columns: [
            { key: 'stage', label: isRTL ? 'المرحلة' : 'Stage' },
            { key: 'count', label: isRTL ? 'العدد' : 'Count' },
            { key: 'convRate', label: isRTL ? 'معدل التحويل' : 'Conv. Rate' },
            { key: 'overallRate', label: isRTL ? 'المعدل الكلي' : 'Overall Rate' },
            { key: 'dropOff', label: isRTL ? 'الفاقد' : 'Drop Off' },
          ],
          data: funnelData.map(f => ({
            stage: isRTL ? f.label.ar : f.label.en,
            count: f.count,
            convRate: f.conversionRate + '%',
            overallRate: f.overallRate + '%',
            dropOff: f.dropOff,
          })),
        }];
        break;
      case 'roi':
        title = isRTL ? 'تقرير عائد مصادر الليدز' : 'Lead Source ROI Report';
        sections = [{
          type: 'table',
          columns: [
            { key: 'source', label: isRTL ? 'المصدر' : 'Source' },
            { key: 'leads', label: isRTL ? 'ليدز' : 'Leads' },
            { key: 'opps', label: isRTL ? 'فرص' : 'Opps' },
            { key: 'deals', label: isRTL ? 'صفقات' : 'Deals' },
            { key: 'revenue', label: isRTL ? 'الإيراد' : 'Revenue' },
            { key: 'roi', label: 'ROI %' },
          ],
          data: roiData.map(r => ({ ...r, roi: r.roi + '%', revenue: Number(r.revenue).toLocaleString() })),
        }];
        break;
      case 'cycle':
        title = isRTL ? 'تقرير دورة المبيعات' : 'Sales Cycle Report';
        sections = [{
          type: 'table',
          columns: [
            { key: 'agent', label: isRTL ? 'الوكيل' : 'Agent' },
            { key: 'avgDays', label: isRTL ? 'متوسط الأيام' : 'Avg Days' },
            { key: 'minDays', label: isRTL ? 'أقل' : 'Min' },
            { key: 'maxDays', label: isRTL ? 'أكثر' : 'Max' },
            { key: 'totalDeals', label: isRTL ? 'الصفقات' : 'Deals' },
          ],
          data: cycleData.agentAvg || [],
        }];
        break;
      case 'winloss':
        title = isRTL ? 'تقرير الربح والخسارة' : 'Win/Loss Analysis Report';
        sections = [{
          type: 'kpi',
          data: [
            { label: isRTL ? 'ناجحة' : 'Won', value: winLossData.totalWon || 0 },
            { label: isRTL ? 'خاسرة' : 'Lost', value: winLossData.totalLost || 0 },
            { label: isRTL ? 'معدل الفوز' : 'Win Rate', value: (winLossData.overallWinRate || 0) + '%' },
          ],
        }, {
          title: isRTL ? 'حسب المصدر' : 'By Source',
          type: 'table',
          columns: [
            { key: 'source', label: isRTL ? 'المصدر' : 'Source' },
            { key: 'won', label: isRTL ? 'ناجحة' : 'Won' },
            { key: 'lost', label: isRTL ? 'خاسرة' : 'Lost' },
            { key: 'winRate', label: isRTL ? 'معدل الفوز' : 'Win Rate' },
          ],
          data: (winLossData.winRateBySource || []).map(s => ({ ...s, winRate: s.winRate + '%' })),
        }];
        break;
      case 'agents':
        title = isRTL ? 'تقرير أداء الوكلاء' : 'Agent Performance Report';
        sections = [{
          type: 'table',
          columns: [
            { key: 'agent', label: isRTL ? 'الوكيل' : 'Agent' },
            { key: 'opps', label: isRTL ? 'الفرص' : 'Opps' },
            { key: 'deals', label: isRTL ? 'ناجحة' : 'Won' },
            { key: 'conversionRate', label: isRTL ? 'التحويل' : 'Conv %' },
            { key: 'revenue', label: isRTL ? 'الإيراد' : 'Revenue' },
            { key: 'avgCycleDays', label: isRTL ? 'أيام الإغلاق' : 'Avg Days' },
            { key: 'totalActivities', label: isRTL ? 'النشاطات' : 'Activities' },
          ],
          data: agentData.map(a => ({ ...a, conversionRate: a.conversionRate + '%', revenue: Number(a.revenue).toLocaleString() })),
        }];
        break;
    }

    exportToPrintableHTML(title, sections, {
      isRTL,
      filters: periodStr ? [periodStr] : [],
      subtitle: tabTitle,
    });
  }, [activeTab, funnelData, roiData, cycleData, winLossData, agentData, isRTL, dateRange]);

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
            {isRTL ? 'تحليلات متقدمة' : 'Advanced Analytics'}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: textSecondary }}>
            {isRTL ? 'رؤى شاملة عن أداء المبيعات والعملاء' : 'Comprehensive insights into sales & customer performance'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range Selector */}
          <div style={{ display: 'flex', gap: 2, background: bgCardAlt, borderRadius: 8, padding: 3, border: `1px solid ${borderColor}` }}>
            {DATE_RANGES.map(r => (
              <button
                key={r.id}
                onClick={() => setDateRange(r.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: dateRange === r.id ? 600 : 400,
                  cursor: 'pointer',
                  background: dateRange === r.id ? ACCENT : 'transparent',
                  color: dateRange === r.id ? '#fff' : textSecondary,
                  transition: 'all 0.2s',
                }}
              >
                {isRTL ? r.ar : r.en}
              </button>
            ))}
          </div>

          {/* Export */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => handleExport('excel')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${borderColor}`,
                background: bgCard, color: textSecondary,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              <Download size={13} /> Excel
            </button>
            <button
              onClick={() => handleExport('csv')}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${borderColor}`,
                background: bgCard, color: textSecondary,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              <Download size={13} /> CSV
            </button>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid ${borderColor}`,
                background: bgCard, color: textSecondary,
                fontSize: 12, cursor: 'pointer',
              }}
            >
              <Printer size={13} /> {isRTL ? 'طباعة' : 'Print'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 4,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 8,
                border: `1px solid ${active ? ACCENT : borderColor}`,
                background: active ? (isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.08)') : bgCard,
                color: active ? ACCENT : textSecondary,
                fontSize: 13, fontWeight: active ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={15} />
              {isRTL ? tab.ar : tab.en}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'funnel' && <FunnelTab data={funnelData} trendData={trendData} isDark={isDark} isRTL={isRTL} cardStyle={cardStyle} tableHeaderStyle={tableHeaderStyle} tableCellStyle={tableCellStyle} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} bgCardAlt={bgCardAlt} axisColor={axisColor} />}
      {activeTab === 'roi' && <ROITab data={roiData} isDark={isDark} isRTL={isRTL} cardStyle={cardStyle} tableHeaderStyle={tableHeaderStyle} tableCellStyle={tableCellStyle} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} bgCardAlt={bgCardAlt} axisColor={axisColor} />}
      {activeTab === 'cycle' && <CycleTab data={cycleData} isDark={isDark} isRTL={isRTL} cardStyle={cardStyle} tableHeaderStyle={tableHeaderStyle} tableCellStyle={tableCellStyle} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} bgCardAlt={bgCardAlt} axisColor={axisColor} />}
      {activeTab === 'winloss' && <WinLossTab data={winLossData} isDark={isDark} isRTL={isRTL} cardStyle={cardStyle} tableHeaderStyle={tableHeaderStyle} tableCellStyle={tableCellStyle} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} bgCardAlt={bgCardAlt} axisColor={axisColor} />}
      {activeTab === 'agents' && <AgentsTab data={agentData} isDark={isDark} isRTL={isRTL} cardStyle={cardStyle} tableHeaderStyle={tableHeaderStyle} tableCellStyle={tableCellStyle} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} bgCardAlt={bgCardAlt} axisColor={axisColor} />}

      {/* Demo notice */}
      {rawData.useMock && (
        <div style={{
          textAlign: 'center', padding: '12px 16px', fontSize: 12,
          color: textSecondary, background: bgCardAlt,
          borderRadius: 8, border: `1px solid ${borderColor}`,
          marginTop: 16,
        }}>
          {isRTL ? 'البيانات المعروضة هي بيانات تجريبية للعرض' : 'Displaying demo data for preview purposes'}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: CONVERSION FUNNEL
// ══════════════════════════════════════════════════════════════════
function FunnelTab({ data, trendData, isDark, isRTL, cardStyle, tableHeaderStyle, tableCellStyle, textPrimary, textSecondary, borderColor, bgCardAlt, axisColor }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label={isRTL ? 'إجمالي الفرص' : 'Total Opportunities'}
          value={data[0]?.count || 0}
          icon={BarChart3}
          color={ACCENT}
        />
        <KpiCard
          label={isRTL ? 'معدل التحويل' : 'Overall Conversion'}
          value={`${data[data.length - 1]?.overallRate || 0}%`}
          icon={TrendingUp}
          color="#10B981"
        />
        <KpiCard
          label={isRTL ? 'أعلى تسرب' : 'Highest Drop-off'}
          value={`${Math.max(...data.map(d => d.dropOffPct))}%`}
          icon={ArrowDownRight}
          color="#EF4444"
        />
        <KpiCard
          label={isRTL ? 'الصفقات المغلقة' : 'Closed Won'}
          value={data[data.length - 1]?.count || 0}
          icon={Trophy}
          color="#F59E0B"
        />
      </div>

      {/* Funnel Visualization */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'قمع التحويل' : 'Conversion Funnel'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((stage, i) => {
            const widthPct = Math.max(8, (stage.count / maxCount) * 100);
            const barColor = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <div key={stage.stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 110, flexShrink: 0, fontSize: 12, fontWeight: 500, color: textPrimary, textAlign: isRTL ? 'right' : 'left' }}>
                  {isRTL ? stage.label.ar : stage.label.en}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{
                    width: `${widthPct}%`,
                    height: 32,
                    borderRadius: 6,
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}aa)`,
                    display: 'flex', alignItems: 'center',
                    paddingLeft: isRTL ? 0 : 10,
                    paddingRight: isRTL ? 10 : 0,
                    transition: 'width 0.6s ease',
                    minWidth: 60,
                  }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{stage.count}</span>
                  </div>
                </div>
                <div style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: stage.conversionRate >= 50 ? '#10B981' : stage.conversionRate >= 25 ? '#F59E0B' : '#EF4444' }}>
                    {stage.conversionRate}%
                  </span>
                </div>
                {i > 0 && (
                  <div style={{ width: 70, flexShrink: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: '#EF4444' }}>-{stage.dropOff} ({stage.dropOffPct}%)</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trend Chart */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'اتجاه الفرص والتحويلات' : 'Opportunities & Conversions Trend'}
        </h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
              <Area type="monotone" dataKey="newOpps" name={isRTL ? 'فرص جديدة' : 'New Opps'} stroke={ACCENT} fill={`${ACCENT}30`} strokeWidth={2} />
              <Area type="monotone" dataKey="conversions" name={isRTL ? 'تحويلات' : 'Conversions'} stroke="#10B981" fill="#10B98130" strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Drop-off Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'تحليل التسرب بين المراحل' : 'Stage-to-Stage Drop-off Analysis'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>{isRTL ? 'المرحلة' : 'Stage'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'العدد' : 'Count'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'معدل التحويل' : 'Conversion Rate'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'المعدل الكلي' : 'Overall Rate'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'التسرب' : 'Drop-off'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'نسبة التسرب' : 'Drop-off %'}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((stage, i) => (
                <tr key={stage.stage}>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>{isRTL ? stage.label.ar : stage.label.en}</td>
                  <td style={tableCellStyle}>{stage.count.toLocaleString()}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: stage.conversionRate >= 50 ? '#10B98118' : stage.conversionRate >= 25 ? '#F59E0B18' : '#EF444418',
                      color: stage.conversionRate >= 50 ? '#10B981' : stage.conversionRate >= 25 ? '#F59E0B' : '#EF4444',
                    }}>
                      {stage.conversionRate}%
                    </span>
                  </td>
                  <td style={tableCellStyle}>{stage.overallRate}%</td>
                  <td style={tableCellStyle}>{i > 0 ? stage.dropOff : '—'}</td>
                  <td style={tableCellStyle}>{i > 0 ? `${stage.dropOffPct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: LEAD SOURCE ROI
// ══════════════════════════════════════════════════════════════════
function ROITab({ data, isDark, isRTL, cardStyle, tableHeaderStyle, tableCellStyle, textPrimary, textSecondary, borderColor, bgCardAlt, axisColor }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalCost = data.reduce((s, d) => s + d.cost, 0);
  const totalLeads = data.reduce((s, d) => s + d.leads, 0);
  const overallROI = totalCost > 0 ? Math.round(((totalRevenue - totalCost) / totalCost) * 100) : 0;

  // Pie data
  const pieData = data.map(d => ({ name: d.source, value: d.leads }));

  return (
    <div>
      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label={isRTL ? 'إجمالي الليدز' : 'Total Leads'} value={totalLeads.toLocaleString()} icon={Users} color={ACCENT} />
        <KpiCard label={isRTL ? 'إجمالي الإيراد' : 'Total Revenue'} value={fmtMoney(totalRevenue)} icon={DollarSign} color="#10B981" />
        <KpiCard label={isRTL ? 'إجمالي التكلفة' : 'Total Cost'} value={fmtMoney(totalCost)} icon={TrendingDown} color="#EF4444" />
        <KpiCard label={isRTL ? 'العائد الكلي' : 'Overall ROI'} value={`${overallROI}%`} icon={TrendingUp} color={overallROI > 0 ? '#10B981' : '#EF4444'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Revenue vs Cost Bar Chart */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'الإيراد مقابل التكلفة' : 'Revenue vs Cost by Source'}
          </h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} tickFormatter={fmtMoney} />
                <YAxis type="category" dataKey="source" tick={{ fontSize: 11, fill: textSecondary }} width={80} stroke={axisColor} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} formatter={fmtMoney} />} />
                <Bar dataKey="revenue" name={isRTL ? 'الإيراد' : 'Revenue'} fill="#10B981" radius={[0, 4, 4, 0]} />
                <Bar dataKey="cost" name={isRTL ? 'التكلفة' : 'Cost'} fill="#EF4444" radius={[0, 4, 4, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Distribution Pie */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'توزيع الليدز' : 'Lead Distribution by Source'}
          </h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ stroke: textSecondary, strokeWidth: 1 }}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ROI Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'جدول عائد الاستثمار' : 'ROI Breakdown'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>{isRTL ? 'المصدر' : 'Source'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'ليدز' : 'Leads'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'فرص' : 'Opps'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'صفقات' : 'Deals'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الإيراد' : 'Revenue'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'التكلفة' : 'Cost'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'التحويل' : 'Conv %'}</th>
                <th style={tableHeaderStyle}>ROI %</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.source}>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>{row.source}</td>
                  <td style={tableCellStyle}>{row.leads}</td>
                  <td style={tableCellStyle}>{row.opps}</td>
                  <td style={tableCellStyle}>{row.deals}</td>
                  <td style={tableCellStyle}>{fmtMoney(row.revenue)}</td>
                  <td style={tableCellStyle}>{fmtMoney(row.cost)}</td>
                  <td style={tableCellStyle}>{row.conversionRate}%</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      background: row.roi > 0 ? '#10B98118' : '#EF444418',
                      color: row.roi > 0 ? '#10B981' : '#EF4444',
                    }}>
                      {row.roi > 0 ? '+' : ''}{row.roi}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: SALES CYCLE
// ══════════════════════════════════════════════════════════════════
function CycleTab({ data, isDark, isRTL, cardStyle, tableHeaderStyle, tableCellStyle, textPrimary, textSecondary, borderColor, bgCardAlt, axisColor }) {
  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label={isRTL ? 'متوسط الدورة' : 'Avg Cycle'} value={`${data.overallAvg} ${isRTL ? 'يوم' : 'days'}`} icon={Clock} color={ACCENT} />
        <KpiCard label={isRTL ? 'أسرع وكيل' : 'Fastest Agent'} value={data.agentAvg[0]?.agent || '—'} sub={`${data.agentAvg[0]?.avgDays || 0} ${isRTL ? 'يوم' : 'days'}`} icon={Zap} color="#10B981" />
        <KpiCard label={isRTL ? 'أبطأ وكيل' : 'Slowest Agent'} value={data.agentAvg[data.agentAvg.length - 1]?.agent || '—'} sub={`${data.agentAvg[data.agentAvg.length - 1]?.avgDays || 0} ${isRTL ? 'يوم' : 'days'}`} icon={Clock} color="#EF4444" />
        <KpiCard label={isRTL ? 'المراحل' : 'Stages Tracked'} value={data.stageAvg.length} icon={Activity} color="#8B5CF6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Avg Days per Stage (Horizontal Bar) */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'متوسط الأيام في كل مرحلة' : 'Average Days per Stage'}
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={data.stageAvg} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
                <YAxis type="category" dataKey={d => isRTL ? d.label.ar : d.label.en} width={90} tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                <Bar dataKey="avgDays" name={isRTL ? 'متوسط الأيام' : 'Avg Days'} fill={ACCENT} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cycle Trend Line */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'اتجاه دورة المبيعات' : 'Sales Cycle Trend'}
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.cycleTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
                <YAxis tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
                <Line type="monotone" dataKey="avgDays" name={isRTL ? 'متوسط الأيام' : 'Avg Days'} stroke={ACCENT} strokeWidth={2} dot={{ r: 4, fill: ACCENT }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Cycle Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'دورة المبيعات حسب الوكيل' : 'Sales Cycle by Agent'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>{isRTL ? 'الوكيل' : 'Agent'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'متوسط' : 'Avg Days'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'أقل' : 'Min'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'أعلى' : 'Max'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الصفقات' : 'Deals'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'السرعة' : 'Speed'}</th>
              </tr>
            </thead>
            <tbody>
              {data.agentAvg.map((agent, i) => (
                <tr key={agent.agent}>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {agent.agent.charAt(0)}
                      </div>
                      {agent.agent}
                    </div>
                  </td>
                  <td style={tableCellStyle}>{agent.avgDays} {isRTL ? 'يوم' : 'days'}</td>
                  <td style={tableCellStyle}>{agent.minDays}</td>
                  <td style={tableCellStyle}>{agent.maxDays}</td>
                  <td style={tableCellStyle}>{agent.totalDeals}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: agent.avgDays <= data.overallAvg ? '#10B98118' : '#F59E0B18',
                      color: agent.avgDays <= data.overallAvg ? '#10B981' : '#F59E0B',
                    }}>
                      {agent.avgDays <= data.overallAvg ? (isRTL ? 'سريع' : 'Fast') : (isRTL ? 'بطيء' : 'Slow')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source Cycle Comparison */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'دورة المبيعات حسب المصدر' : 'Sales Cycle by Source'}
        </h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={data.sourceAvg}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
              <XAxis dataKey="source" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
              <Bar dataKey="avgDays" name={isRTL ? 'متوسط الأيام' : 'Avg Days'} radius={[6, 6, 0, 0]}>
                {data.sourceAvg.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4: WIN/LOSS ANALYSIS
// ══════════════════════════════════════════════════════════════════
function WinLossTab({ data, isDark, isRTL, cardStyle, tableHeaderStyle, tableCellStyle, textPrimary, textSecondary, borderColor, bgCardAlt, axisColor }) {
  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label={isRTL ? 'نسبة الفوز' : 'Win Rate'} value={`${data.overallWinRate}%`} icon={Trophy} color="#10B981" />
        <KpiCard label={isRTL ? 'فرص مربوحة' : 'Total Won'} value={data.totalWon} icon={TrendingUp} color={ACCENT} />
        <KpiCard label={isRTL ? 'فرص خاسرة' : 'Total Lost'} value={data.totalLost} icon={TrendingDown} color="#EF4444" />
        <KpiCard label={isRTL ? 'أسباب الخسارة' : 'Loss Reasons'} value={data.lostReasons.length} icon={Target} color="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Win Rate Over Time */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'نسبة الفوز عبر الوقت' : 'Win Rate Over Time'}
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={data.winRateByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} formatter={fmtPct} />} />
                <Line type="monotone" dataKey="winRate" name={isRTL ? 'نسبة الفوز' : 'Win Rate'} stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: '#10B981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lost Reasons Pie */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
            {isRTL ? 'أسباب الخسارة' : 'Lost Reasons Breakdown'}
          </h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.lostReasons.map(r => ({ name: r.reason, value: r.count }))} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: textSecondary, strokeWidth: 1 }}
                >
                  {data.lostReasons.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Win Rate by Source */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'نسبة الفوز حسب المصدر' : 'Win Rate by Source'}
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={data.winRateBySource}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
              <XAxis dataKey="source" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} tickFormatter={v => `${v}%`} />
              <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} formatter={fmtPct} />} />
              <Bar dataKey="winRate" name={isRTL ? 'نسبة الفوز' : 'Win Rate'} radius={[6, 6, 0, 0]}>
                {data.winRateBySource.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Agents by Win Rate */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'أفضل الوكلاء بنسبة الفوز' : 'Top Agents by Win Rate'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>#</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الوكيل' : 'Agent'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'مربوحة' : 'Won'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'خاسرة' : 'Lost'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الإجمالي' : 'Total'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'نسبة الفوز' : 'Win Rate'}</th>
              </tr>
            </thead>
            <tbody>
              {data.winRateByAgent.map((agent, i) => (
                <tr key={agent.agent}>
                  <td style={tableCellStyle}>
                    {i === 0 ? <Trophy size={16} style={{ color: '#FFD700' }} /> : i === 1 ? <Award size={16} style={{ color: '#C0C0C0' }} /> : i + 1}
                  </td>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>{agent.agent}</td>
                  <td style={{ ...tableCellStyle, color: '#10B981' }}>{agent.won}</td>
                  <td style={{ ...tableCellStyle, color: '#EF4444' }}>{agent.lost}</td>
                  <td style={tableCellStyle}>{agent.total}</td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 60, height: 6, borderRadius: 3,
                        background: isDark ? '#1e293b' : '#e2e8f0',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${agent.winRate}%`, height: '100%', borderRadius: 3,
                          background: agent.winRate >= 60 ? '#10B981' : agent.winRate >= 40 ? '#F59E0B' : '#EF4444',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: agent.winRate >= 60 ? '#10B981' : agent.winRate >= 40 ? '#F59E0B' : '#EF4444' }}>
                        {agent.winRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 5: AGENT PERFORMANCE
// ══════════════════════════════════════════════════════════════════
function AgentsTab({ data, isDark, isRTL, cardStyle, tableHeaderStyle, tableCellStyle, textPrimary, textSecondary, borderColor, bgCardAlt, axisColor }) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(data.length / pageSize);
  const paged = data.slice((page - 1) * pageSize, page * pageSize);

  const topAgent = data[0];
  const totalRevenue = data.reduce((s, a) => s + a.revenue, 0);
  const avgConversion = data.length > 0 ? Math.round(data.reduce((s, a) => s + a.conversionRate, 0) / data.length) : 0;
  const totalWon = data.reduce((s, a) => s + (a.deals || 0), 0);
  const totalLost = data.reduce((s, a) => s + (a.lost || 0), 0);

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label={isRTL ? 'أفضل وكيل' : 'Top Agent'} value={topAgent?.agent || '—'} sub={fmtMoney(topAgent?.revenue || 0)} icon={Trophy} color="#FFD700" />
        <KpiCard label={isRTL ? 'إجمالي الإيراد' : 'Total Revenue'} value={fmtMoney(totalRevenue)} icon={DollarSign} color="#10B981" />
        <KpiCard label={isRTL ? 'متوسط التحويل' : 'Avg Conversion'} value={`${avgConversion}%`} icon={Target} color={ACCENT} />
        <KpiCard label={isRTL ? 'صفقات رابحة' : 'Total Won'} value={totalWon} icon={Award} color="#10B981" />
        <KpiCard label={isRTL ? 'صفقات خاسرة' : 'Total Lost'} value={totalLost} icon={TrendingDown} color="#EF4444" />
        <KpiCard label={isRTL ? 'عدد الوكلاء' : 'Total Agents'} value={data.length} icon={Users} color="#8B5CF6" />
      </div>

      {/* Agent Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
        {data.slice(0, 6).map((agent, i) => (
          <div key={agent.agent} style={{
            ...cardStyle,
            marginBottom: 0,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {i === 0 && (
              <div style={{
                position: 'absolute', top: 8, right: isRTL ? 'auto' : 8, left: isRTL ? 8 : 'auto',
              }}>
                <Trophy size={20} style={{ color: '#FFD700' }} />
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: CHART_COLORS[i % CHART_COLORS.length],
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700,
              }}>
                {agent.agent.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>{agent.agent}</div>
                <div style={{ fontSize: 11, color: textSecondary }}>{fmtMoney(agent.revenue)} {isRTL ? 'إيراد' : 'revenue'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                { label: isRTL ? 'فرص' : 'Opps', value: agent.opps, color: '#F59E0B' },
                { label: isRTL ? 'رابحة' : 'Won', value: agent.deals, color: '#10B981' },
                { label: isRTL ? 'خاسرة' : 'Lost', value: agent.lost || 0, color: '#EF4444' },
                { label: isRTL ? 'تحويل' : 'Conv %', value: `${agent.conversionRate}%`, color: agent.conversionRate >= 20 ? '#10B981' : '#EF4444' },
                { label: isRTL ? 'متوسط صفقة' : 'Avg Deal', value: fmtMoney(agent.avgDealSize || 0), color: ACCENT },
                { label: isRTL ? 'دورة' : 'Cycle', value: `${agent.avgCycleDays}d`, color: '#6B8DB5' },
                { label: isRTL ? 'أنشطة' : 'Activities', value: agent.totalActivities, color: '#8B5CF6' },
                { label: isRTL ? 'مكالمات' : 'Calls', value: agent.calls, color: '#2B4C6F' },
              ].map(stat => (
                <div key={stat.label} style={{
                  textAlign: 'center', padding: '6px 4px',
                  background: bgCardAlt, borderRadius: 6,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: textSecondary }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Distribution Chart */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'الإيراد حسب الوكيل' : 'Revenue by Agent'}
        </h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
              <XAxis dataKey="agent" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} tickFormatter={fmtMoney} />
              <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} formatter={fmtMoney} />} />
              <Bar dataKey="revenue" name={isRTL ? 'الإيراد' : 'Revenue'} radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Distribution Chart */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'توزيع الأنشطة' : 'Activity Distribution'}
        </h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.3} />
              <XAxis dataKey="agent" tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <YAxis tick={{ fontSize: 11, fill: textSecondary }} stroke={axisColor} />
              <Tooltip content={<ChartTooltip isDark={isDark} isRTL={isRTL} />} />
              <Bar dataKey="calls" name={isRTL ? 'مكالمات' : 'Calls'} fill={ACCENT} stackId="a" />
              <Bar dataKey="meetings" name={isRTL ? 'اجتماعات' : 'Meetings'} fill="#8B5CF6" stackId="a" />
              <Bar dataKey="emails" name={isRTL ? 'إيميلات' : 'Emails'} fill="#F59E0B" stackId="a" radius={[6, 6, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full Leaderboard Table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600, color: textPrimary }}>
          {isRTL ? 'جدول الأداء الكامل' : 'Full Leaderboard'}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>#</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الوكيل' : 'Agent'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'فرص' : 'Opps'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'رابحة' : 'Won'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'خاسرة' : 'Lost'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'التحويل' : 'Conv %'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'الإيراد' : 'Revenue'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'متوسط صفقة' : 'Avg Deal'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'متوسط الدورة' : 'Avg Close'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'أنشطة' : 'Activities'}</th>
                <th style={tableHeaderStyle}>{isRTL ? 'مكالمات' : 'Calls'}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((agent, i) => (
                <tr key={agent.agent}>
                  <td style={tableCellStyle}>{(page - 1) * pageSize + i + 1}</td>
                  <td style={{ ...tableCellStyle, fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: CHART_COLORS[i % CHART_COLORS.length],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0,
                      }}>
                        {agent.agent.charAt(0)}
                      </div>
                      {agent.agent}
                    </div>
                  </td>
                  <td style={tableCellStyle}>{agent.opps}</td>
                  <td style={{ ...tableCellStyle, color: '#10B981', fontWeight: 500 }}>{agent.deals}</td>
                  <td style={{ ...tableCellStyle, color: '#EF4444', fontWeight: 500 }}>{agent.lost || 0}</td>
                  <td style={tableCellStyle}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: agent.conversionRate >= 20 ? '#10B98118' : '#F59E0B18',
                      color: agent.conversionRate >= 20 ? '#10B981' : '#F59E0B',
                    }}>
                      {agent.conversionRate}%
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, fontWeight: 600, color: '#10B981' }}>{fmtMoney(agent.revenue)}</td>
                  <td style={tableCellStyle}>{fmtMoney(agent.avgDealSize || 0)}</td>
                  <td style={tableCellStyle}>{agent.avgCycleDays} {isRTL ? 'يوم' : 'days'}</td>
                  <td style={tableCellStyle}>{agent.totalActivities}</td>
                  <td style={tableCellStyle}>{agent.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.length > pageSize && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={() => {}}
            totalItems={data.length}
          />
        )}
      </div>
    </div>
  );
}
