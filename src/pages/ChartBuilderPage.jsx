import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import {
  BarChart3, TrendingUp, PieChart as PieIcon, Activity, ArrowLeftRight,
  Save, Trash2, Maximize2, Minimize2, Pencil, Plus, X, Palette,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge } from '../components/ui';
import {
  DATA_SOURCES, CHART_TYPES, AGGREGATIONS, COLOR_PALETTES,
  getCharts, saveChart, updateChart, deleteChart, getDataForChart,
} from '../services/chartBuilderService';

// ── Chart type icons ──
const CHART_TYPE_META = {
  bar: { icon: BarChart3, label: { ar: 'أعمدة', en: 'Bar' } },
  line: { icon: TrendingUp, label: { ar: 'خطي', en: 'Line' } },
  pie: { icon: PieIcon, label: { ar: 'دائري', en: 'Pie' } },
  area: { icon: Activity, label: { ar: 'مساحة', en: 'Area' } },
  horizontal_bar: { icon: ArrowLeftRight, label: { ar: 'أعمدة أفقية', en: 'Horizontal Bar' } },
};

const PALETTE_META = {
  default: { label: { ar: 'أزرق', en: 'Blue' } },
  warm: { label: { ar: 'دافئ', en: 'Warm' } },
  cool: { label: { ar: 'بارد', en: 'Cool' } },
  mixed: { label: { ar: 'متنوع', en: 'Mixed' } },
};

// ── Reusable chart renderer ──
function ChartRenderer({ config, width = '100%', height = 300 }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { chartData, series, colors } = useMemo(() => getDataForChart(config), [config]);

  const axisStyle = { fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 };
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0';

  if (!chartData.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height, color: isDark ? '#94a3b8' : '#64748b', fontSize: 13,
      }}>
        {config.dataSource ? 'No data available for this configuration' : 'Select a data source to begin'}
      </div>
    );
  }

  const chartType = config.chartType || 'bar';

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={Math.min(height * 0.35, 120)}
            label={({ name, value }) => `${name}: ${value}`}
            labelLine={true}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: isDark ? '#1a2332' : '#fff',
              border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
              borderRadius: 8, fontSize: 12,
              color: isDark ? '#e2e8f0' : '#1e293b',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const isHorizontal = chartType === 'horizontal_bar';
  const multiSeries = config.groupBy && series.length > 1;

  if (chartType === 'bar' || chartType === 'horizontal_bar') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={chartData} layout={isHorizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={axisStyle} />
              <YAxis type="category" dataKey="name" tick={axisStyle} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" tick={axisStyle} />
              <YAxis tick={axisStyle} />
            </>
          )}
          <Tooltip contentStyle={{
            background: isDark ? '#1a2332' : '#fff',
            border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
            borderRadius: 8, fontSize: 12,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }} />
          {multiSeries && <Legend />}
          {multiSeries
            ? series.map((s, i) => (
                <Bar key={s} dataKey={s} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              ))
            : <Bar dataKey="value" fill={colors[0]} radius={[4, 4, 0, 0]} />
          }
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={{
            background: isDark ? '#1a2332' : '#fff',
            border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
            borderRadius: 8, fontSize: 12,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }} />
          {multiSeries && <Legend />}
          {multiSeries
            ? series.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
              ))
            : <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} dot={{ r: 3 }} />
          }
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={axisStyle} />
          <YAxis tick={axisStyle} />
          <Tooltip contentStyle={{
            background: isDark ? '#1a2332' : '#fff',
            border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
            borderRadius: 8, fontSize: 12,
            color: isDark ? '#e2e8f0' : '#1e293b',
          }} />
          {multiSeries && <Legend />}
          {multiSeries
            ? series.map((s, i) => (
                <Area key={s} type="monotone" dataKey={s} stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]} fillOpacity={0.15} strokeWidth={2} />
              ))
            : <Area type="monotone" dataKey="value" stroke={colors[0]} fill={colors[0]} fillOpacity={0.15} strokeWidth={2} />
          }
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

// ── Main Page ──
export default function ChartBuilderPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Builder state
  const [dataSource, setDataSource] = useState('');
  const [chartType, setChartType] = useState('bar');
  const [xAxis, setXAxis] = useState('');
  const [yAxis, setYAxis] = useState('count');
  const [yField, setYField] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [colorScheme, setColorScheme] = useState('default');
  const [chartName, setChartName] = useState('');

  // Saved charts
  const [savedCharts, setSavedCharts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    setSavedCharts(getCharts());
  }, []);

  // Available fields for selected data source
  const availableFields = useMemo(() => {
    if (!dataSource || !DATA_SOURCES[dataSource]) return {};
    return DATA_SOURCES[dataSource].fields;
  }, [dataSource]);

  const stringFields = useMemo(() =>
    Object.entries(availableFields).filter(([, f]) => f.type === 'string' || f.type === 'date'),
    [availableFields]
  );

  const numericFields = useMemo(() =>
    Object.entries(availableFields).filter(([, f]) => f.type === 'number'),
    [availableFields]
  );

  // Reset dependent fields on data source change
  useEffect(() => {
    setXAxis('');
    setYField('');
    setGroupBy('');
  }, [dataSource]);

  // Live preview config
  const previewConfig = useMemo(() => ({
    dataSource, chartType, xAxis, yAxis, yField, groupBy, colors: colorScheme,
  }), [dataSource, chartType, xAxis, yAxis, yField, groupBy, colorScheme]);

  const handleSave = useCallback(() => {
    if (!chartName.trim() || !dataSource || !xAxis) return;
    const config = { name: chartName.trim(), dataSource, chartType, xAxis, yAxis, yField, groupBy, colors: colorScheme };

    if (editingId) {
      updateChart(editingId, config);
      setEditingId(null);
    } else {
      saveChart(config);
    }
    setSavedCharts(getCharts());
    setChartName('');
  }, [chartName, dataSource, chartType, xAxis, yAxis, yField, groupBy, colorScheme, editingId]);

  const handleEdit = useCallback((chart) => {
    setEditingId(chart.id);
    setChartName(chart.name);
    setDataSource(chart.dataSource);
    setChartType(chart.chartType);
    setXAxis(chart.xAxis);
    setYAxis(chart.yAxis || 'count');
    setYField(chart.yField || '');
    setGroupBy(chart.groupBy || '');
    setColorScheme(chart.colors || 'default');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleDelete = useCallback((id) => {
    deleteChart(id);
    setSavedCharts(getCharts());
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setChartName('');
    setDataSource('');
    setChartType('bar');
    setXAxis('');
    setYAxis('count');
    setYField('');
    setGroupBy('');
    setColorScheme('default');
  }, []);

  // ── Styles ──
  const pageStyle = {
    padding: '24px 28px',
    minHeight: '100vh',
    direction: isRTL ? 'rtl' : 'ltr',
  };

  const headerStyle = {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap',
  };

  const titleStyle = {
    fontSize: 22, fontWeight: 700, margin: 0,
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const sectionTitleStyle = {
    fontSize: 16, fontWeight: 600, margin: '0 0 16px 0',
    color: isDark ? '#e2e8f0' : '#1e293b',
  };

  const builderCardStyle = {
    background: isDark ? '#1a2332' : '#fff',
    borderRadius: 14,
    border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
    padding: 24,
    marginBottom: 32,
  };

  const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 20,
  };

  const labelStyle = {
    fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block',
    color: isDark ? '#94a3b8' : '#64748b',
  };

  const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
    background: isDark ? '#0f1a2e' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 13,
    outline: 'none',
    cursor: 'pointer',
  };

  const inputStyle = {
    ...selectStyle,
    cursor: 'text',
  };

  const chartTypeBarStyle = {
    display: 'flex', gap: 6, flexWrap: 'wrap',
  };

  const paletteBarStyle = {
    display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
  };

  const previewAreaStyle = {
    background: isDark ? '#0f1a2e' : '#f8fafc',
    borderRadius: 10,
    border: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
    padding: 16,
    marginBottom: 20,
    minHeight: 320,
  };

  const savedGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 20,
  };

  const savedCardStyle = {
    background: isDark ? '#1a2332' : '#fff',
    borderRadius: 14,
    border: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
    overflow: 'hidden',
    transition: 'box-shadow 0.2s',
  };

  const savedCardHeaderStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '12px 16px',
    borderBottom: `1px solid ${isDark ? '#2d3748' : '#e2e8f0'}`,
  };

  const savedCardBodyStyle = {
    padding: 16,
  };

  const actionBtnStyle = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    color: isDark ? '#94a3b8' : '#64748b',
    display: 'inline-flex', alignItems: 'center',
  };

  const saveRowStyle = {
    display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
  };

  // ── Full-screen overlay ──
  const expandedChart = expandedId ? savedCharts.find(c => c.id === expandedId) : null;

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <BarChart3 size={26} style={{ color: '#4A7AAB' }} />
        <h1 style={titleStyle}>{isRTL ? 'منشئ الرسوم البيانية' : 'Chart Builder'}</h1>
        <Badge style={{ marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>
          {savedCharts.length} {isRTL ? 'رسم محفوظ' : 'saved'}
        </Badge>
      </div>

      {/* Section 1: Builder */}
      <div style={builderCardStyle}>
        <h2 style={sectionTitleStyle}>
          {editingId
            ? (isRTL ? 'تعديل الرسم البياني' : 'Edit Chart')
            : (isRTL ? 'إنشاء رسم بياني جديد' : 'Create New Chart')
          }
        </h2>

        <div style={formGridStyle}>
          {/* Data Source */}
          <div>
            <label style={labelStyle}>{isRTL ? 'مصدر البيانات' : 'Data Source'}</label>
            <select style={selectStyle} value={dataSource} onChange={e => setDataSource(e.target.value)}>
              <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
              {Object.entries(DATA_SOURCES).map(([key, src]) => (
                <option key={key} value={key}>{isRTL ? src.label.ar : src.label.en}</option>
              ))}
            </select>
          </div>

          {/* X-Axis */}
          <div>
            <label style={labelStyle}>{isRTL ? 'المحور الأفقي (X)' : 'X-Axis Field'}</label>
            <select style={selectStyle} value={xAxis} onChange={e => setXAxis(e.target.value)} disabled={!dataSource}>
              <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
              {stringFields.map(([key, f]) => (
                <option key={key} value={key}>{isRTL ? f.label.ar : f.label.en}</option>
              ))}
            </select>
          </div>

          {/* Y-Axis Aggregation */}
          <div>
            <label style={labelStyle}>{isRTL ? 'نوع التجميع (Y)' : 'Y-Axis Aggregation'}</label>
            <select style={selectStyle} value={yAxis} onChange={e => { setYAxis(e.target.value); if (e.target.value === 'count') setYField(''); }}>
              {Object.entries(AGGREGATIONS).map(([key, agg]) => (
                <option key={key} value={key}>{isRTL ? agg.label.ar : agg.label.en}</option>
              ))}
            </select>
          </div>

          {/* Y-Field (for sum/average) */}
          {(yAxis === 'sum' || yAxis === 'average') && (
            <div>
              <label style={labelStyle}>{isRTL ? 'حقل القيمة' : 'Value Field'}</label>
              <select style={selectStyle} value={yField} onChange={e => setYField(e.target.value)}>
                <option value="">{isRTL ? '— اختر —' : '— Select —'}</option>
                {numericFields.map(([key, f]) => (
                  <option key={key} value={key}>{isRTL ? f.label.ar : f.label.en}</option>
                ))}
              </select>
            </div>
          )}

          {/* Group By */}
          <div>
            <label style={labelStyle}>{isRTL ? 'تجميع حسب (اختياري)' : 'Group By (optional)'}</label>
            <select style={selectStyle} value={groupBy} onChange={e => setGroupBy(e.target.value)} disabled={!dataSource}>
              <option value="">{isRTL ? '— بدون —' : '— None —'}</option>
              {stringFields.filter(([key]) => key !== xAxis).map(([key, f]) => (
                <option key={key} value={key}>{isRTL ? f.label.ar : f.label.en}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Chart Type Selector */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{isRTL ? 'نوع الرسم البياني' : 'Chart Type'}</label>
          <div style={chartTypeBarStyle}>
            {CHART_TYPES.map(ct => {
              const meta = CHART_TYPE_META[ct];
              const Icon = meta.icon;
              const active = chartType === ct;
              return (
                <button
                  key={ct}
                  onClick={() => setChartType(ct)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#4A7AAB' : (isDark ? '#374151' : '#d1d5db')}`,
                    background: active ? (isDark ? '#1a3a5c' : '#e8f0fe') : 'transparent',
                    color: active ? '#4A7AAB' : (isDark ? '#94a3b8' : '#64748b'),
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={15} />
                  {isRTL ? meta.label.ar : meta.label.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* Color Palette */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>{isRTL ? 'لوحة الألوان' : 'Color Palette'}</label>
          <div style={paletteBarStyle}>
            {Object.entries(COLOR_PALETTES).map(([key, pal]) => {
              const active = colorScheme === key;
              return (
                <button
                  key={key}
                  onClick={() => setColorScheme(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#4A7AAB' : (isDark ? '#374151' : '#d1d5db')}`,
                    background: active ? (isDark ? '#1a3a5c' : '#e8f0fe') : 'transparent',
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', gap: 2 }}>
                    {pal.slice(0, 4).map((c, i) => (
                      <div key={i} style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                    ))}
                  </div>
                  {isRTL ? PALETTE_META[key].label.ar : PALETTE_META[key].label.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{isRTL ? 'معاينة مباشرة' : 'Live Preview'}</label>
          <div style={previewAreaStyle}>
            <ChartRenderer config={previewConfig} height={300} />
          </div>
        </div>

        {/* Save Row */}
        <div style={saveRowStyle}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={labelStyle}>{isRTL ? 'اسم الرسم البياني' : 'Chart Name'}</label>
            <input
              style={inputStyle}
              placeholder={isRTL ? 'مثال: توزيع جهات الاتصال' : 'e.g. Contacts by Source'}
              value={chartName}
              onChange={e => setChartName(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={!chartName.trim() || !dataSource || !xAxis}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 8, cursor: 'pointer',
                border: 'none',
                background: (!chartName.trim() || !dataSource || !xAxis) ? (isDark ? '#374151' : '#d1d5db') : '#4A7AAB',
                color: '#fff', fontSize: 13, fontWeight: 600,
                opacity: (!chartName.trim() || !dataSource || !xAxis) ? 0.5 : 1,
                transition: 'all 0.15s',
              }}
            >
              <Save size={15} />
              {editingId
                ? (isRTL ? 'حفظ التعديلات' : 'Save Changes')
                : (isRTL ? 'حفظ الرسم' : 'Save Chart')
              }
            </button>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`,
                  background: 'transparent',
                  color: isDark ? '#94a3b8' : '#64748b',
                  fontSize: 13,
                }}
              >
                <X size={14} />
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Saved Charts */}
      <div>
        <h2 style={sectionTitleStyle}>
          {isRTL ? 'الرسوم البيانية المحفوظة' : 'Saved Charts'}
          {savedCharts.length > 0 && (
            <span style={{ fontWeight: 400, fontSize: 13, color: isDark ? '#64748b' : '#94a3b8', marginInlineStart: 8 }}>
              ({savedCharts.length})
            </span>
          )}
        </h2>

        {savedCharts.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            color: isDark ? '#64748b' : '#94a3b8', fontSize: 14,
            background: isDark ? '#1a2332' : '#f8fafc',
            borderRadius: 14,
            border: `1px dashed ${isDark ? '#2d3748' : '#e2e8f0'}`,
          }}>
            <BarChart3 size={36} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
            {isRTL ? 'لا توجد رسوم بيانية محفوظة بعد. أنشئ رسمك الأول!' : 'No saved charts yet. Create your first chart above!'}
          </div>
        ) : (
          <div style={savedGridStyle}>
            {savedCharts.map(chart => (
              <div key={chart.id} style={savedCardStyle}>
                <div style={savedCardHeaderStyle}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                      {chart.name}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>
                      {isRTL
                        ? DATA_SOURCES[chart.dataSource]?.label.ar
                        : DATA_SOURCES[chart.dataSource]?.label.en
                      }
                      {' · '}
                      {isRTL
                        ? CHART_TYPE_META[chart.chartType]?.label.ar
                        : CHART_TYPE_META[chart.chartType]?.label.en
                      }
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={actionBtnStyle} onClick={() => setExpandedId(chart.id)} title={isRTL ? 'تكبير' : 'Expand'}>
                      <Maximize2 size={15} />
                    </button>
                    <button style={actionBtnStyle} onClick={() => handleEdit(chart)} title={isRTL ? 'تعديل' : 'Edit'}>
                      <Pencil size={15} />
                    </button>
                    <button style={{ ...actionBtnStyle, color: '#ef4444' }} onClick={() => handleDelete(chart.id)} title={isRTL ? 'حذف' : 'Delete'}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div style={savedCardBodyStyle}>
                  <ChartRenderer config={chart} height={220} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full-screen expanded view */}
      {expandedChart && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32,
          }}
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => setExpandedId(null)}
        >
          <div
            style={{
              background: isDark ? '#0a1929' : '#fff',
              borderRadius: 16,
              width: '100%', maxWidth: 1000,
              maxHeight: '90vh',
              overflow: 'auto',
              padding: 28,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {expandedChart.name}
                </h2>
                <span style={{ fontSize: 12, color: isDark ? '#64748b' : '#94a3b8' }}>
                  {isRTL ? DATA_SOURCES[expandedChart.dataSource]?.label.ar : DATA_SOURCES[expandedChart.dataSource]?.label.en}
                </span>
              </div>
              <button
                onClick={() => setExpandedId(null)}
                style={{
                  background: isDark ? '#1a2332' : '#f1f5f9',
                  border: 'none', borderRadius: 8, padding: '8px 8px',
                  cursor: 'pointer', color: isDark ? '#94a3b8' : '#64748b',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <Minimize2 size={18} />
              </button>
            </div>
            <ChartRenderer config={expandedChart} height={480} />
          </div>
        </div>
      )}
    </div>
  );
}
