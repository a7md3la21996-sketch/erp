import supabase from '../lib/supabase';

export async function fetchEmployeeShifts(employeeId) {
  const { data, error } = await supabase
    .from('employee_shifts')
    .select('*, shifts(*)')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchAllEmployeeShifts() {
  const { data, error } = await supabase
    .from('employee_shifts')
    .select('*, shifts(*)')
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function assignShift(employeeId, shiftId, startDate, endDate, notes) {
  const { data, error } = await supabase
    .from('employee_shifts')
    .insert({
      employee_id: employeeId,
      shift_id: shiftId,
      start_date: startDate,
      end_date: endDate || null,
      notes: notes || null,
      created_at: new Date().toISOString(),
    })
    .select('*, shifts(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function assignShiftBulk(employeeIds, shiftId, startDate, endDate, notes) {
  const records = employeeIds.map(empId => ({
    employee_id: empId,
    shift_id: shiftId,
    start_date: startDate,
    end_date: endDate || null,
    notes: notes || null,
    created_at: new Date().toISOString(),
  }));
  const { data, error } = await supabase
    .from('employee_shifts')
    .insert(records)
    .select('*, shifts(*)');
  if (error) throw error;
  return data || [];
}

export async function deleteShiftAssignment(id) {
  const { error } = await supabase.from('employee_shifts').delete().eq('id', id);
  if (error) throw error;
}

// Get the active shift for an employee on a specific date
export function getActiveShift(assignments, date) {
  if (!assignments || !assignments.length) return null;
  const sorted = [...assignments].sort((a, b) => b.start_date.localeCompare(a.start_date));
  for (const a of sorted) {
    if (a.start_date <= date && (!a.end_date || a.end_date >= date)) {
      return a.shifts || a;
    }
  }
  return null;
}
