import supabase from '../lib/supabase';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

export async function fetchHolidays(year, month) {
  let query = supabase.from('holidays').select('*').order('date', { ascending: true });

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`;
    query = query.gte('date', startDate).lte('date', endDate);
  } else if (year) {
    query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createHoliday(data) {
  requirePerm(P.HR_POLICIES_MANAGE, 'Not allowed to create holidays');
  const { data: result, error } = await supabase
    .from('holidays')
    .insert({ ...data, created_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return result;
}

export async function createHolidaysBulk(holidays) {
  requirePerm(P.HR_POLICIES_MANAGE, 'Not allowed to bulk-create holidays');
  const { data, error } = await supabase
    .from('holidays')
    .upsert(holidays.map(h => ({ ...h, created_at: new Date().toISOString() })), { onConflict: 'date' })
    .select('*');
  if (error) throw error;
  return data || [];
}

export async function deleteHoliday(id) {
  requirePerm(P.HR_POLICIES_MANAGE, 'Not allowed to delete holidays');
  const { error } = await supabase.from('holidays').delete().eq('id', id);
  if (error) throw error;
}
