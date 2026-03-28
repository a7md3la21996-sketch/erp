import { reportError } from '../utils/errorReporter';
// ── Commission Installments Service ─────────────────────────────────────
// Tracks installment payments from developers to the company

import supabase from '../lib/supabase';

const STORAGE_KEY = 'platform_commission_installments';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    return [];
  }
}

function saveAll(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

function generateId() {
  return 'ci_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Auto-mark overdue: any pending installment whose due_date < today
 */
function autoMarkOverdue(list) {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  const updated = list.map(item => {
    if (item.status === 'pending' && item.due_date && item.due_date < today) {
      changed = true;
      return { ...item, status: 'overdue' };
    }
    return item;
  });
  if (changed) saveAll(updated);
  return updated;
}

/**
 * Fetch installments with optional filters
 * @param {Object} filters - { status, developer_name, deal_id }
 */
export async function fetchInstallments(filters = {}) {
  try {
    let query = supabase.from('commission_installments').select('*').order('due_date', { ascending: true }).range(0, 499);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.developer_name) query = query.eq('developer_name', filters.developer_name);
    if (filters.deal_id) query = query.eq('deal_id', filters.deal_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    // Fallback to localStorage
    let data = autoMarkOverdue(loadAll());
    if (filters.status) data = data.filter(d => d.status === filters.status);
    if (filters.developer_name) data = data.filter(d => d.developer_name === filters.developer_name);
    if (filters.deal_id) data = data.filter(d => d.deal_id === filters.deal_id);
    data.sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    return data;
  }
}

/**
 * Create a new installment
 */
export async function createInstallment(data) {
  const item = {
    id: data.id || generateId(),
    deal_id: data.deal_id || '',
    deal_name: data.deal_name || '',
    developer_name: data.developer_name || '',
    total_commission: Number(data.total_commission) || 0,
    installment_number: Number(data.installment_number) || 1,
    installments_total: Number(data.installments_total) || 1,
    amount: Number(data.amount) || 0,
    due_date: data.due_date || '',
    status: data.status || 'pending',
    paid_date: data.paid_date || '',
    notes: data.notes || '',
    created_at: new Date().toISOString(),
  };
  // Save to localStorage first (optimistic)
  try { const all = loadAll(); all.unshift(item); saveAll(all); } catch {}
  // Try Supabase
  try {
    const { data: sbData, error } = await supabase.from('commission_installments').insert([item]).select('*').single();
    if (error) throw error;
    return sbData;
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    return item;
  }
}

/**
 * Update an existing installment
 */
export async function updateInstallment(id, updates) {
  // Update localStorage (optimistic)
  const all = loadAll();
  const idx = all.findIndex(i => i.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...updates };
  saveAll(all);
  // Try Supabase
  try {
    const { data, error } = await supabase.from('commission_installments').update(updates).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    return all[idx];
  }
}

/**
 * Delete an installment
 */
export async function deleteInstallment(id) {
  // Delete from localStorage (optimistic)
  const all = loadAll();
  const filtered = all.filter(i => i.id !== id);
  saveAll(filtered);
  // Try Supabase
  try {
    const { error } = await supabase.from('commission_installments').delete().eq('id', id);
    if (error) throw error;
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    // localStorage already updated as fallback
  }
  return filtered;
}

/**
 * Get aggregate stats
 */
export async function getInstallmentStats() {
  let data;
  try {
    const { data: sbData, error } = await supabase.from('commission_installments').select('*');
    if (error) throw error;
    data = sbData || [];
  } catch (err) { reportError('commissionInstallmentsService', 'query', err);
    data = autoMarkOverdue(loadAll());
  }
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const totalDue = data
    .filter(d => d.status === 'pending' || d.status === 'overdue')
    .reduce((s, d) => s + (d.amount || 0), 0);

  const totalPaid = data
    .filter(d => d.status === 'paid')
    .reduce((s, d) => s + (d.amount || 0), 0);

  const totalOverdue = data
    .filter(d => d.status === 'overdue')
    .reduce((s, d) => s + (d.amount || 0), 0);

  const upcomingThisMonth = data
    .filter(d => d.status === 'pending' && d.due_date >= todayStr && d.due_date <= endOfMonth)
    .reduce((s, d) => s + (d.amount || 0), 0);

  return { totalDue, totalPaid, totalOverdue, upcomingThisMonth };
}
