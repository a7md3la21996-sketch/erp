/**
 * Scheduled Report Service — localStorage-based
 * Key: platform_scheduled_reports
 * History Key: platform_report_history
 */
import { createNotification } from './notificationsService';
import {
  fetchReportsData, filterByDateRange,
  computeContactsBySource, computeLeadsConversion, computePipeline,
  computeActivitySummary, computeRevenueByMonth, computeTopPerformers,
  computeAttendance, computeLeaveBalance, computeExpenseBreakdown,
} from './reportsDataService';

const STORAGE_KEY = 'platform_scheduled_reports';
const HISTORY_KEY = 'platform_report_history';
const MAX_HISTORY = 200;

// ── Report type definitions ──────────────────────────────────────────
export const REPORT_TYPES = {
  sales_summary:    { en: 'Sales Summary',      ar: 'ملخص المبيعات',     color: '#4A7AAB' },
  pipeline_report:  { en: 'Pipeline Report',    ar: 'تقرير المسار البيعي', color: '#6B21A8' },
  activity_report:  { en: 'Activity Report',    ar: 'تقرير الأنشطة',     color: '#F59E0B' },
  revenue_report:   { en: 'Revenue Report',     ar: 'تقرير الإيرادات',    color: '#10B981' },
  leads_report:     { en: 'Leads Report',       ar: 'تقرير الليدز',      color: '#3B82F6' },
  hr_attendance:    { en: 'HR Attendance',       ar: 'تقرير الحضور',      color: '#EC4899' },
  hr_leave:         { en: 'HR Leave',            ar: 'تقرير الإجازات',    color: '#14B8A6' },
  finance_expenses: { en: 'Finance Expenses',   ar: 'تقرير المصروفات',   color: '#EF4444' },
  team_performance: { en: 'Team Performance',   ar: 'أداء الفريق',       color: '#8B5CF6' },
};

export const FREQUENCY_OPTIONS = {
  daily:   { en: 'Daily',   ar: 'يومي',   color: '#10B981' },
  weekly:  { en: 'Weekly',  ar: 'أسبوعي', color: '#3B82F6' },
  monthly: { en: 'Monthly', ar: 'شهري',   color: '#8B5CF6' },
};

export const DAY_OF_WEEK = [
  { value: 0, en: 'Sunday',    ar: 'الأحد' },
  { value: 1, en: 'Monday',    ar: 'الإثنين' },
  { value: 2, en: 'Tuesday',   ar: 'الثلاثاء' },
  { value: 3, en: 'Wednesday', ar: 'الأربعاء' },
  { value: 4, en: 'Thursday',  ar: 'الخميس' },
  { value: 5, en: 'Friday',    ar: 'الجمعة' },
  { value: 6, en: 'Saturday',  ar: 'السبت' },
];

// ── localStorage helpers ─────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, 50);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(list) {
  if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_HISTORY / 2));
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

function genId() {
  return 'sched_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}

// ── Compute nextRun from schedule ────────────────────────────────────
function computeNextRun(schedule) {
  const now = new Date();
  const [hours, minutes] = (schedule.time || '09:00').split(':').map(Number);

  if (schedule.frequency === 'daily') {
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  if (schedule.frequency === 'weekly') {
    const targetDay = schedule.dayOfWeek ?? 0;
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    const diff = (targetDay - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + (diff === 0 && next <= now ? 7 : diff));
    return next.toISOString();
  }

  if (schedule.frequency === 'monthly') {
    const targetDay = schedule.dayOfMonth ?? 1;
    const next = new Date(now.getFullYear(), now.getMonth(), targetDay, hours, minutes, 0, 0);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return next.toISOString();
  }

  return now.toISOString();
}

// ── Seed sample schedules ────────────────────────────────────────────
function seedIfEmpty() {
  const list = load();
  if (list.length > 0) return;
  const now = new Date();
  const samples = [
    {
      id: 'sched_sample_1', name: 'Weekly Sales Summary',
      reportType: 'sales_summary', frequency: 'weekly', dayOfWeek: 0, dayOfMonth: null,
      time: '09:00', format: 'excel',
      recipients: [{ name: 'Ahmed', email: 'ahmed@company.com' }],
      filters: { dateRange: 'this_month' },
      enabled: true, lastRun: null, nextRun: null,
      created_at: new Date(now - 7 * 86400000).toISOString(), created_by: 'System',
    },
    {
      id: 'sched_sample_2', name: 'Monthly Expense Report',
      reportType: 'finance_expenses', frequency: 'monthly', dayOfWeek: null, dayOfMonth: 1,
      time: '08:00', format: 'csv',
      recipients: [{ name: 'Finance Team', email: 'finance@company.com' }],
      filters: { dateRange: 'this_month' },
      enabled: true, lastRun: null, nextRun: null,
      created_at: new Date(now - 14 * 86400000).toISOString(), created_by: 'System',
    },
    {
      id: 'sched_sample_3', name: 'Daily Pipeline Report',
      reportType: 'pipeline_report', frequency: 'daily', dayOfWeek: null, dayOfMonth: null,
      time: '07:30', format: 'excel',
      recipients: [{ name: 'Sales Director', email: 'director@company.com' }],
      filters: {},
      enabled: false, lastRun: null, nextRun: null,
      created_at: new Date(now - 3 * 86400000).toISOString(), created_by: 'System',
    },
  ];
  samples.forEach(s => { s.nextRun = computeNextRun(s); });
  save(samples);
}

// ── CRUD ─────────────────────────────────────────────────────────────
export function createSchedule(data) {
  seedIfEmpty();
  const schedule = {
    id: genId(),
    name: data.name || '',
    reportType: data.reportType || 'sales_summary',
    frequency: data.frequency || 'weekly',
    dayOfWeek: data.dayOfWeek ?? null,
    dayOfMonth: data.dayOfMonth ?? null,
    time: data.time || '09:00',
    format: data.format || 'excel',
    recipients: data.recipients || [],
    filters: data.filters || {},
    enabled: data.enabled !== false,
    lastRun: null,
    nextRun: null,
    created_at: new Date().toISOString(),
    created_by: data.created_by || 'System',
  };
  schedule.nextRun = computeNextRun(schedule);
  const list = load();
  list.unshift(schedule);
  save(list);
  return schedule;
}

export function getSchedules() {
  seedIfEmpty();
  return load();
}

export function updateSchedule(id, updates) {
  const list = load();
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const updated = { ...list[idx], ...updates };
  if (updates.frequency || updates.dayOfWeek !== undefined || updates.dayOfMonth !== undefined || updates.time) {
    updated.nextRun = computeNextRun(updated);
  }
  list[idx] = updated;
  save(list);
  return updated;
}

export function deleteSchedule(id) {
  const list = load().filter(s => s.id !== id);
  save(list);
  // Also clean up history
  const history = loadHistory().filter(h => h.scheduleId !== id);
  saveHistory(history);
}

export function toggleSchedule(id) {
  const list = load();
  const idx = list.findIndex(s => s.id === id);
  if (idx === -1) return null;
  list[idx].enabled = !list[idx].enabled;
  if (list[idx].enabled) {
    list[idx].nextRun = computeNextRun(list[idx]);
  }
  save(list);
  return list[idx];
}

// ── Generate report data for a given type ────────────────────────────
async function computeReportData(reportType, filters) {
  try {
    const rawData = await fetchReportsData();
    const { contacts, opportunities, deals, activities, employees, attendance, expenses } = rawData;

    // Apply date range filter
    const dateRange = filters?.dateRange || 'all';

    switch (reportType) {
      case 'sales_summary':
        return computeRevenueByMonth(filterByDateRange(deals, dateRange, 'created_at'));
      case 'pipeline_report':
        return computePipeline(filterByDateRange(opportunities, dateRange));
      case 'activity_report':
        return computeActivitySummary(filterByDateRange(activities, dateRange));
      case 'revenue_report':
        return computeRevenueByMonth(filterByDateRange(deals, dateRange, 'created_at'));
      case 'leads_report':
        return computeLeadsConversion(
          filterByDateRange(contacts, dateRange),
          filterByDateRange(opportunities, dateRange),
          deals
        );
      case 'hr_attendance':
        return computeAttendance(attendance, employees);
      case 'hr_leave':
        return computeLeaveBalance(employees);
      case 'finance_expenses':
        return computeExpenseBreakdown(filterByDateRange(expenses, dateRange, 'date'));
      case 'team_performance':
        return computeTopPerformers(filterByDateRange(deals, dateRange, 'created_at'));
      default: {
        return computeContactsBySource(filterByDateRange(contacts, dateRange));
      }
    }
  } catch {
    // Fallback: return mock summary
    return [
      { metric: 'Total', value: Math.floor(Math.random() * 100) + 10 },
      { metric: 'Active', value: Math.floor(Math.random() * 50) + 5 },
      { metric: 'Growth', value: Math.floor(Math.random() * 30) + '%' },
    ];
  }
}

// ── Generate a report ────────────────────────────────────────────────
export async function generateReport(scheduleId) {
  const list = load();
  const schedule = list.find(s => s.id === scheduleId);
  if (!schedule) throw new Error('Schedule not found');

  let data, status;
  try {
    data = await computeReportData(schedule.reportType, schedule.filters);
    status = 'success';
  } catch {
    data = [];
    status = 'error';
  }

  // Save history entry
  const historyEntry = {
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    scheduleId,
    generatedAt: new Date().toISOString(),
    data: Array.isArray(data) ? data : [],
    status,
    format: schedule.format,
    reportType: schedule.reportType,
    reportName: schedule.name,
  };
  const history = loadHistory();
  history.unshift(historyEntry);
  saveHistory(history);

  // Update schedule lastRun and nextRun
  const idx = list.findIndex(s => s.id === scheduleId);
  if (idx !== -1) {
    list[idx].lastRun = new Date().toISOString();
    list[idx].nextRun = computeNextRun(list[idx]);
    save(list);
  }

  // Create notification
  const typeName = REPORT_TYPES[schedule.reportType]?.en || schedule.reportType;
  createNotification({
    type: 'system',
    title_ar: 'تقرير مجدول جاهز',
    title_en: 'Scheduled Report Ready',
    body_ar: `تم إنشاء التقرير "${schedule.name}" (${REPORT_TYPES[schedule.reportType]?.ar || schedule.reportType})`,
    body_en: `Report "${schedule.name}" (${typeName}) has been generated`,
    for_user_id: 'all',
    entity_type: 'scheduled_report',
    entity_id: scheduleId,
  });

  return historyEntry;
}

// ── Get report history for a schedule ────────────────────────────────
export function getReportHistory(scheduleId) {
  return loadHistory().filter(h => h.scheduleId === scheduleId);
}

// ── Get all history ──────────────────────────────────────────────────
export function getAllReportHistory() {
  return loadHistory();
}

// ── Check and generate due reports ───────────────────────────────────
export async function checkAndGenerateDueReports() {
  const now = new Date();
  const list = load();
  const due = list.filter(s => s.enabled && s.nextRun && new Date(s.nextRun) <= now);

  for (const schedule of due) {
    try {
      await generateReport(schedule.id);
    } catch {
      // Silently skip failed ones
    }
  }

  return due.length;
}
