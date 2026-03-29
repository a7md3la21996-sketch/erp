import { syncToSupabase } from '../utils/supabaseSync';
import { reportError } from '../utils/errorReporter';
/**
 * Chart Builder Service
 * localStorage-based service for custom chart configurations and data retrieval
 */

const STORAGE_KEY = 'platform_custom_charts';

const DATA_SOURCES = {
  contacts: {
    key: 'platform_contacts',
    label: { ar: 'جهات الاتصال', en: 'Contacts' },
    fields: {
      contact_type: { label: { ar: 'نوع جهة الاتصال', en: 'Contact Type' }, type: 'string' },
      department: { label: { ar: 'القسم', en: 'Department' }, type: 'string' },
      source: { label: { ar: 'المصدر', en: 'Source' }, type: 'string' },
      status: { label: { ar: 'الحالة', en: 'Status' }, type: 'string' },
      gender: { label: { ar: 'الجنس', en: 'Gender' }, type: 'string' },
      nationality: { label: { ar: 'الجنسية', en: 'Nationality' }, type: 'string' },
      created_at: { label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, type: 'date' },
    },
  },
  opportunities: {
    key: 'platform_opportunities',
    label: { ar: 'الفرص البيعية', en: 'Opportunities' },
    fields: {
      stage: { label: { ar: 'المرحلة', en: 'Stage' }, type: 'string' },
      temperature: { label: { ar: 'الحرارة', en: 'Temperature' }, type: 'string' },
      priority: { label: { ar: 'الأولوية', en: 'Priority' }, type: 'string' },
      budget: { label: { ar: 'الميزانية', en: 'Budget' }, type: 'number' },
      department: { label: { ar: 'القسم', en: 'Department' }, type: 'string' },
      created_at: { label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, type: 'date' },
    },
  },
  deals: {
    key: 'platform_won_deals',
    label: { ar: 'الصفقات', en: 'Deals' },
    fields: {
      deal_value: { label: { ar: 'قيمة الصفقة', en: 'Deal Value' }, type: 'number' },
      status: { label: { ar: 'الحالة', en: 'Status' }, type: 'string' },
      created_at: { label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, type: 'date' },
      unit_type_ar: { label: { ar: 'نوع الوحدة', en: 'Unit Type' }, type: 'string' },
    },
  },
  activities: {
    key: 'platform_activities',
    label: { ar: 'الأنشطة', en: 'Activities' },
    fields: {
      type: { label: { ar: 'النوع', en: 'Type' }, type: 'string' },
      dept: { label: { ar: 'القسم', en: 'Department' }, type: 'string' },
      created_at: { label: { ar: 'تاريخ الإنشاء', en: 'Created Date' }, type: 'date' },
    },
  },
  tasks: {
    key: 'platform_tasks',
    label: { ar: 'المهام', en: 'Tasks' },
    fields: {
      status: { label: { ar: 'الحالة', en: 'Status' }, type: 'string' },
      priority: { label: { ar: 'الأولوية', en: 'Priority' }, type: 'string' },
      type: { label: { ar: 'النوع', en: 'Type' }, type: 'string' },
      dept: { label: { ar: 'القسم', en: 'Department' }, type: 'string' },
      due_date: { label: { ar: 'تاريخ الاستحقاق', en: 'Due Date' }, type: 'date' },
    },
  },
  expenses: {
    key: 'platform_expense_claims',
    label: { ar: 'المصروفات', en: 'Expenses' },
    fields: {
      category: { label: { ar: 'الفئة', en: 'Category' }, type: 'string' },
      status: { label: { ar: 'الحالة', en: 'Status' }, type: 'string' },
      amount: { label: { ar: 'المبلغ', en: 'Amount' }, type: 'number' },
      date: { label: { ar: 'التاريخ', en: 'Date' }, type: 'date' },
    },
  },
};

const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'horizontal_bar'];

const AGGREGATIONS = {
  count: { label: { ar: 'العدد', en: 'Count' } },
  sum: { label: { ar: 'المجموع', en: 'Sum' } },
  average: { label: { ar: 'المتوسط', en: 'Average' } },
};

const COLOR_PALETTES = {
  default: ['#4A7AAB', '#6BAED6', '#9ECAE1', '#C6DBEF', '#2171B5', '#084594'],
  warm: ['#E85D5D', '#F59E0B', '#F97316', '#EF4444', '#FB923C', '#FCA5A5'],
  cool: ['#10B981', '#3B82F6', '#6366F1', '#14B8A6', '#818CF8', '#34D399'],
  mixed: ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'],
};

// ── CRUD ──

function getCharts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) { reportError('chartBuilderService', 'query', err);
    return [];
  }
}

function saveChart(config) {
  const charts = getCharts();
  const newChart = {
    id: `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...config,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  charts.push(newChart);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
  return newChart;
}

function updateChart(id, updates) {
  const charts = getCharts();
  const idx = charts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  charts[idx] = { ...charts[idx], ...updates, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
  return charts[idx];
}

function deleteChart(id) {
  const charts = getCharts().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

// ── Data retrieval ──

function getRawData(dataSourceKey) {
  const src = DATA_SOURCES[dataSourceKey];
  if (!src) return [];
  try {
    const raw = localStorage.getItem(src.key);
    return raw ? JSON.parse(raw) : [];
  } catch (err) { reportError('chartBuilderService', 'query', err);
    return [];
  }
}

function formatDateValue(val) {
  if (!val) return 'Unknown';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return 'Unknown';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (err) { reportError('chartBuilderService', 'query', err);
    return 'Unknown';
  }
}

function getFieldValue(item, field, fieldDef) {
  let val = item[field];
  if (val === undefined || val === null || val === '') return 'Unknown';
  if (fieldDef?.type === 'date') return formatDateValue(val);
  return String(val);
}

function getDataForChart(config) {
  const { dataSource, xAxis, yAxis = 'count', yField, groupBy, colors = 'default' } = config;
  const rawData = getRawData(dataSource);
  if (!rawData.length) return { chartData: [], series: [], colors: COLOR_PALETTES[colors] || COLOR_PALETTES.default };

  const srcDef = DATA_SOURCES[dataSource];
  const xFieldDef = srcDef?.fields?.[xAxis];
  const palette = COLOR_PALETTES[colors] || COLOR_PALETTES.default;

  if (!groupBy) {
    // Single-series aggregation
    const groups = {};
    for (const item of rawData) {
      const key = getFieldValue(item, xAxis, xFieldDef);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    const chartData = Object.entries(groups).map(([name, items]) => {
      let value;
      if (yAxis === 'count') {
        value = items.length;
      } else if (yAxis === 'sum' && yField) {
        value = items.reduce((s, it) => s + (parseFloat(it[yField]) || 0), 0);
      } else if (yAxis === 'average' && yField) {
        const sum = items.reduce((s, it) => s + (parseFloat(it[yField]) || 0), 0);
        value = items.length ? Math.round(sum / items.length) : 0;
      } else {
        value = items.length;
      }
      return { name, value };
    });

    // Sort: dates chronologically, others by value desc
    if (xFieldDef?.type === 'date') {
      chartData.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      chartData.sort((a, b) => b.value - a.value);
    }

    return { chartData, series: ['value'], colors: palette };
  }

  // Multi-series (groupBy)
  const groupByDef = srcDef?.fields?.[groupBy];
  const seriesSet = new Set();
  const xGroups = {};

  for (const item of rawData) {
    const xKey = getFieldValue(item, xAxis, xFieldDef);
    const gKey = getFieldValue(item, groupBy, groupByDef);
    seriesSet.add(gKey);
    if (!xGroups[xKey]) xGroups[xKey] = {};
    if (!xGroups[xKey][gKey]) xGroups[xKey][gKey] = [];
    xGroups[xKey][gKey].push(item);
  }

  const seriesArr = Array.from(seriesSet);
  const chartData = Object.entries(xGroups).map(([name, groupData]) => {
    const row = { name };
    for (const s of seriesArr) {
      const items = groupData[s] || [];
      if (yAxis === 'count') {
        row[s] = items.length;
      } else if (yAxis === 'sum' && yField) {
        row[s] = items.reduce((sum, it) => sum + (parseFloat(it[yField]) || 0), 0);
      } else if (yAxis === 'average' && yField) {
        const sum = items.reduce((acc, it) => acc + (parseFloat(it[yField]) || 0), 0);
        row[s] = items.length ? Math.round(sum / items.length) : 0;
      } else {
        row[s] = items.length;
      }
    }
    return row;
  });

  if (xFieldDef?.type === 'date') {
    chartData.sort((a, b) => a.name.localeCompare(b.name));
  }

  return { chartData, series: seriesArr, colors: palette };
}

export {
  DATA_SOURCES,
  CHART_TYPES,
  AGGREGATIONS,
  COLOR_PALETTES,
  getCharts,
  saveChart,
  updateChart,
  deleteChart,
  getDataForChart,
  getRawData,
};
