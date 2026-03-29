import { reportError } from '../utils/errorReporter';
/**
 * OKR Service — localStorage-based with Supabase-ready structure
 * Key: platform_okrs
 */

import supabase from '../lib/supabase';

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

// ── CRUD ───────────────────────────────────────────────────────────────
export async function getObjectives(filters = {}) {
  try {
    let query = supabase.from('okrs').select('*');
    if (filters.quarter) query = query.eq('quarter', filters.quarter);
    if (filters.year) query = query.eq('year', Number(filters.year));
    if (filters.department) query = query.eq('department', filters.department);
    if (filters.status) query = query.eq('status', filters.status);
    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('okrService', 'query', err);
    // Fallback to localStorage
    let data = getAll();
    if (filters.quarter) data = data.filter(o => o.quarter === filters.quarter);
    if (filters.year) data = data.filter(o => o.year === Number(filters.year));
    if (filters.department) data = data.filter(o => o.department === filters.department);
    if (filters.status) data = data.filter(o => o.status === filters.status);
    return data;
  }
}

export async function getObjectiveById(id) {
  try {
    const { data, error } = await supabase.from('okrs').select('*').eq('id', id).single();
    if (error) throw error;
    return data || null;
  } catch (err) { reportError('okrService', 'query', err);
    return getAll().find(o => o.id === id) || null;
  }
}

export async function createObjective({ title, titleAr, description, quarter, year, owner_id, owner_name, department, keyResults = [] }) {
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
  // Save to localStorage first (optimistic)
  try { const all = getAll(); all.unshift(obj); saveAll(all); } catch {}
  // Try Supabase
  try {
    const { data, error } = await supabase.from('okrs').insert([obj]).select('*').single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('okrService', 'query', err);
    return obj;
  }
}

export async function updateObjective(id, updates) {
  // Update localStorage (optimistic)
  const all = getAll();
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return null;
  const old = { ...all[idx] };
  all[idx] = { ...all[idx], ...updates };
  saveAll(all);
  // Try Supabase
  try {
    const { data, error } = await supabase.from('okrs').update(updates).eq('id', id).select('*').single();
    if (error) throw error;
    return { old, updated: data };
  } catch (err) { reportError('okrService', 'query', err);
    return { old, updated: all[idx] };
  }
}

export async function deleteObjective(id) {
  // Delete from localStorage (optimistic)
  const all = getAll();
  const idx = all.findIndex(o => o.id === id);
  if (idx === -1) return null;
  const removed = all.splice(idx, 1)[0];
  saveAll(all);
  // Try Supabase
  try {
    const { error } = await supabase.from('okrs').delete().eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('okrService', 'query', err);
    // localStorage already updated
  }
  return removed;
}

// ── Key Results ────────────────────────────────────────────────────────
export async function addKeyResult(objectiveId, keyResult) {
  const all = getAll();
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
  // Try Supabase — update the entire okr record with new keyResults
  try {
    const { error } = await supabase.from('okrs').update({ keyResults: obj.keyResults }).eq('id', objectiveId);
    if (error) throw error;
  } catch (err) { reportError('okrService', 'query', err);
    // localStorage already updated
  }
  return kr;
}

export async function updateKeyResult(objectiveId, krId, updates) {
  const all = getAll();
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
  // Try Supabase — update the entire okr record with updated keyResults
  try {
    const { error } = await supabase.from('okrs').update({ keyResults: obj.keyResults }).eq('id', objectiveId);
    if (error) throw error;
  } catch (err) { reportError('okrService', 'query', err);
    // localStorage already updated
  }
  return kr;
}

export async function deleteKeyResult(objectiveId, krId) {
  const all = getAll();
  const obj = all.find(o => o.id === objectiveId);
  if (!obj) return null;
  obj.keyResults = obj.keyResults.filter(k => k.id !== krId);
  saveAll(all);
  // Try Supabase — update the entire okr record with filtered keyResults
  try {
    const { error } = await supabase.from('okrs').update({ keyResults: obj.keyResults }).eq('id', objectiveId);
    if (error) throw error;
  } catch (err) { reportError('okrService', 'query', err);
    // localStorage already updated
  }
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

export async function getQuarterSummary(quarter, year) {
  const objectives = await getObjectives({ quarter, year: Number(year) });
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
