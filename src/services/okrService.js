/**
 * OKR Service — localStorage-based with Supabase-ready structure
 * Key: platform_okrs
 */

const LOCAL_KEY = 'platform_okrs';

// ── Status colors ──────────────────────────────────────────────────────
export const STATUS_COLORS = {
  on_track: '#10B981',
  at_risk: '#F59E0B',
  behind: '#EF4444',
  completed: '#4A7AAB',
};

export const OBJ_STATUS_OPTIONS = [
  { value: 'draft', label_ar: 'مسودة', label_en: 'Draft', color: '#94a3b8' },
  { value: 'active', label_ar: 'نشط', label_en: 'Active', color: '#4A7AAB' },
  { value: 'completed', label_ar: 'مكتمل', label_en: 'Completed', color: '#10B981' },
  { value: 'cancelled', label_ar: 'ملغي', label_en: 'Cancelled', color: '#EF4444' },
];

export const KR_STATUS_OPTIONS = [
  { value: 'on_track', label_ar: 'على المسار', label_en: 'On Track', color: '#10B981' },
  { value: 'at_risk', label_ar: 'في خطر', label_en: 'At Risk', color: '#F59E0B' },
  { value: 'behind', label_ar: 'متأخر', label_en: 'Behind', color: '#EF4444' },
  { value: 'completed', label_ar: 'مكتمل', label_en: 'Completed', color: '#4A7AAB' },
];

export const KR_UNIT_OPTIONS = [
  { value: 'number', label_ar: 'عدد', label_en: 'Number' },
  { value: 'percentage', label_ar: 'نسبة', label_en: 'Percentage' },
  { value: 'currency', label_ar: 'مبلغ', label_en: 'Currency' },
];

export const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

// ── localStorage helpers ───────────────────────────────────────────────
function getAll() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
function saveAll(data) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      data.length = Math.min(data.length, 50);
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); } catch { /* give up */ }
    }
  }
}

function genId() {
  return 'okr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Mock data (Q1 2026) ───────────────────────────────────────────────
function ensureMockData() {
  const existing = getAll();
  if (existing.length > 0) return existing;

  const mockData = [
    {
      id: genId(),
      title: 'Increase Sales Revenue',
      titleAr: 'زيادة إيرادات المبيعات',
      description: 'Drive Q1 revenue growth through new deals and upselling',
      quarter: 'Q1',
      year: 2026,
      owner_id: 'e1',
      owner_name: 'Ahmed Alaa Eldin',
      department: 'sales',
      status: 'active',
      created_at: '2026-01-02T08:00:00Z',
      keyResults: [
        { id: genId(), title: 'Close 15 new deals', titleAr: 'إغلاق 15 صفقة جديدة', target: 15, current: 9, unit: 'number', progress: 60, status: 'on_track', dueDate: '2026-03-31' },
        { id: genId(), title: 'Achieve 1.5M revenue', titleAr: 'تحقيق 1.5 مليون إيرادات', target: 1500000, current: 1050000, unit: 'currency', progress: 70, status: 'on_track', dueDate: '2026-03-31' },
        { id: genId(), title: 'Increase average deal size by 20%', titleAr: 'زيادة متوسط حجم الصفقة 20%', target: 20, current: 12, unit: 'percentage', progress: 60, status: 'at_risk', dueDate: '2026-03-31' },
      ],
    },
    {
      id: genId(),
      title: 'Improve Customer Satisfaction',
      titleAr: 'تحسين رضا العملاء',
      description: 'Enhance customer experience and reduce churn',
      quarter: 'Q1',
      year: 2026,
      owner_id: 'e2',
      owner_name: 'Sara Khaled',
      department: 'sales',
      status: 'active',
      created_at: '2026-01-03T09:00:00Z',
      keyResults: [
        { id: genId(), title: 'Achieve NPS score of 75+', titleAr: 'تحقيق NPS 75+', target: 75, current: 68, unit: 'number', progress: 91, status: 'on_track', dueDate: '2026-03-31' },
        { id: genId(), title: 'Reduce churn rate to 3%', titleAr: 'تقليل معدل المغادرة إلى 3%', target: 3, current: 4.2, unit: 'percentage', progress: 55, status: 'at_risk', dueDate: '2026-03-31' },
      ],
    },
    {
      id: genId(),
      title: 'Launch Marketing Campaigns',
      titleAr: 'إطلاق حملات تسويقية',
      description: 'Execute brand awareness and lead generation campaigns',
      quarter: 'Q1',
      year: 2026,
      owner_id: 'e3',
      owner_name: 'Mohamed Ali',
      department: 'marketing',
      status: 'active',
      created_at: '2026-01-05T10:00:00Z',
      keyResults: [
        { id: genId(), title: 'Generate 500 qualified leads', titleAr: 'توليد 500 عميل محتمل', target: 500, current: 320, unit: 'number', progress: 64, status: 'at_risk', dueDate: '2026-03-31' },
        { id: genId(), title: 'Achieve 50K website visits', titleAr: 'تحقيق 50K زيارة', target: 50000, current: 38000, unit: 'number', progress: 76, status: 'on_track', dueDate: '2026-03-31' },
        { id: genId(), title: 'Social media engagement +30%', titleAr: 'زيادة التفاعل 30%', target: 30, current: 15, unit: 'percentage', progress: 50, status: 'behind', dueDate: '2026-03-31' },
      ],
    },
    {
      id: genId(),
      title: 'Enhance HR Processes',
      titleAr: 'تطوير عمليات الموارد البشرية',
      description: 'Streamline hiring and improve employee engagement',
      quarter: 'Q1',
      year: 2026,
      owner_id: 'e4',
      owner_name: 'Nora Hassan',
      department: 'hr',
      status: 'active',
      created_at: '2026-01-04T11:00:00Z',
      keyResults: [
        { id: genId(), title: 'Hire 8 new employees', titleAr: 'توظيف 8 موظفين', target: 8, current: 3, unit: 'number', progress: 38, status: 'behind', dueDate: '2026-03-31' },
        { id: genId(), title: 'Employee satisfaction 85%+', titleAr: 'رضا الموظفين 85%+', target: 85, current: 79, unit: 'percentage', progress: 93, status: 'on_track', dueDate: '2026-03-31' },
      ],
    },
  ];

  saveAll(mockData);
  return mockData;
}

// ── CRUD ───────────────────────────────────────────────────────────────
export function getObjectives(filters = {}) {
  let data = ensureMockData();
  if (filters.quarter) data = data.filter(o => o.quarter === filters.quarter);
  if (filters.year) data = data.filter(o => o.year === Number(filters.year));
  if (filters.department) data = data.filter(o => o.department === filters.department);
  if (filters.status) data = data.filter(o => o.status === filters.status);
  return data;
}

export function getObjectiveById(id) {
  return ensureMockData().find(o => o.id === id) || null;
}

export function createObjective({ title, titleAr, description, quarter, year, owner_id, owner_name, department, keyResults = [] }) {
  const all = ensureMockData();
  const obj = {
    id: genId(),
    title,
    titleAr: titleAr || '',
    description: description || '',
    quarter,
    year: Number(year),
    owner_id: owner_id || '',
    owner_name: owner_name || '',
    department: department || '',
    status: 'draft',
    created_at: new Date().toISOString(),
    keyResults: keyResults.map(kr => ({
      id: genId(),
      title: kr.title || '',
      titleAr: kr.titleAr || '',
      target: Number(kr.target) || 0,
      current: Number(kr.current) || 0,
      unit: kr.unit || 'number',
      progress: 0,
      status: 'on_track',
      dueDate: kr.dueDate || '',
    })),
  };
  all.unshift(obj);
  saveAll(all);
  return obj;
}

export function updateObjective(id, updates) {
  const all = ensureMockData();
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return null;
  const old = { ...all[idx] };
  all[idx] = { ...all[idx], ...updates };
  saveAll(all);
  return { old, updated: all[idx] };
}

export function deleteObjective(id) {
  const all = ensureMockData();
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return null;
  const removed = all.splice(idx, 1)[0];
  saveAll(all);
  return removed;
}

// ── Key Results ────────────────────────────────────────────────────────
export function addKeyResult(objectiveId, keyResult) {
  const all = ensureMockData();
  const obj = all.find(o => o.id === objectiveId);
  if (!obj) return null;
  const kr = {
    id: genId(),
    title: keyResult.title || '',
    titleAr: keyResult.titleAr || '',
    target: Number(keyResult.target) || 0,
    current: Number(keyResult.current) || 0,
    unit: keyResult.unit || 'number',
    progress: 0,
    status: 'on_track',
    dueDate: keyResult.dueDate || '',
  };
  obj.keyResults.push(kr);
  saveAll(all);
  return kr;
}

export function updateKeyResult(objectiveId, krId, updates) {
  const all = ensureMockData();
  const obj = all.find(o => o.id === objectiveId);
  if (!obj) return null;
  const kr = obj.keyResults.find(k => k.id === krId);
  if (!kr) return null;
  Object.assign(kr, updates);
  // Recompute progress
  if (kr.target > 0) {
    kr.progress = Math.min(100, Math.round((kr.current / kr.target) * 100));
  }
  saveAll(all);
  return kr;
}

export function deleteKeyResult(objectiveId, krId) {
  const all = ensureMockData();
  const obj = all.find(o => o.id === objectiveId);
  if (!obj) return null;
  obj.keyResults = obj.keyResults.filter(k => k.id !== krId);
  saveAll(all);
  return true;
}

// ── Computed ───────────────────────────────────────────────────────────
export function computeObjectiveProgress(objective) {
  const krs = objective?.keyResults || [];
  if (krs.length === 0) return 0;
  const sum = krs.reduce((s, kr) => {
    const p = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : kr.progress || 0;
    return s + p;
  }, 0);
  return Math.round(sum / krs.length);
}

export function getQuarterSummary(quarter, year) {
  const objectives = getObjectives({ quarter, year: Number(year) });
  const total = objectives.length;
  if (total === 0) return { total: 0, avgProgress: 0, onTrack: 0, atRisk: 0, behind: 0 };

  let progressSum = 0;
  let onTrack = 0;
  let atRisk = 0;
  let behind = 0;

  objectives.forEach(obj => {
    const p = computeObjectiveProgress(obj);
    progressSum += p;

    // Determine overall status by KR statuses
    const krs = obj.keyResults || [];
    const hasBehind = krs.some(k => k.status === 'behind');
    const hasAtRisk = krs.some(k => k.status === 'at_risk');

    if (hasBehind) behind++;
    else if (hasAtRisk) atRisk++;
    else onTrack++;
  });

  return {
    total,
    avgProgress: Math.round(progressSum / total),
    onTrack,
    atRisk,
    behind,
  };
}
