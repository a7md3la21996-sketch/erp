import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../data/hr_mock_data';

// ── Employees ─────────────────────────────────────────────────

export async function fetchEmployees(filters = {}) {
  try {
    let query = supabase
      .from('employees')
      .select(`
        *,
        departments ( id, name_ar, name_en )
      `)
      .order('full_name_ar', { ascending: true });

    if (filters.department) query = query.eq('department_id', filters.department);
    if (filters.status)     query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(
        `full_name_ar.ilike.%${filters.search}%,full_name_en.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    let result = [...MOCK_EMPLOYEES];
    if (filters.department) result = result.filter(e => e.department === filters.department);
    if (filters.status)     result = result.filter(e => e.status === filters.status);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(e =>
        e.full_name_ar.toLowerCase().includes(s) ||
        e.full_name_en.toLowerCase().includes(s) ||
        e.email.toLowerCase().includes(s) ||
        e.phone.includes(s)
      );
    }
    return result;
  }
}

export async function createEmployee(data) {
  try {
    const { data: d, error } = await supabase
      .from('employees')
      .insert([{ ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('employee', d.id, d);
    return d;
  } catch {
    const mock = { ...data, id: 'e' + Date.now(), created_at: new Date().toISOString() };
    MOCK_EMPLOYEES.push(mock);
    return mock;
  }
}

export async function updateEmployee(id, updates) {
  try {
    const { data: old } = await supabase.from('employees').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('employees')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('employee', id, old, data);
    return data;
  } catch {
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === id);
    if (idx > -1) Object.assign(MOCK_EMPLOYEES[idx], updates);
    return MOCK_EMPLOYEES[idx];
  }
}

export async function deleteEmployee(id) {
  try {
    const { data: old } = await supabase.from('employees').select('*').eq('id', id).single();
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
    await logDelete('employee', id, old);
  } catch {
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === id);
    if (idx > -1) MOCK_EMPLOYEES.splice(idx, 1);
  }
}

// ── Departments ───────────────────────────────────────────────

export async function fetchDepartments() {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name_ar', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch {
    return [...DEPARTMENTS];
  }
}
