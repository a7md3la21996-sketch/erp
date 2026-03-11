import supabase from '../lib/supabase';
import { getAttendanceForMonth, updateAttendanceRecord, addAttendanceRecord } from '../data/attendanceStore';

// ── Attendance ────────────────────────────────────────────────

export async function fetchAttendance({ month, year, employeeId } = {}) {
  try {
    let query = supabase
      .from('attendance')
      .select(`
        *,
        employees ( id, full_name_ar, full_name_en, department_id )
      `)
      .order('date', { ascending: true });

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }
    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch {
    if (!month || !year) {
      const now = new Date();
      month = month || (now.getMonth() + 1);
      year  = year  || now.getFullYear();
    }
    let records = getAttendanceForMonth(year, month);
    if (employeeId) records = records.filter(r => r.employee_id === employeeId);
    return records;
  }
}

export async function recordCheckIn(employeeId) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 5);

  try {
    const { data, error } = await supabase
      .from('attendance')
      .insert([{
        employee_id: employeeId,
        date,
        check_in: time,
        status: 'present',
        created_at: now.toISOString(),
      }])
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch {
    const record = {
      id: `${employeeId}-${date}`,
      employee_id: employeeId,
      date,
      check_in: time,
      check_out: null,
      status: 'present',
      notes: '',
      created_at: now.toISOString(),
    };
    addAttendanceRecord(now.getFullYear(), now.getMonth() + 1, record);
    return record;
  }
}

export async function recordCheckOut(employeeId) {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 5);

  try {
    const { data, error } = await supabase
      .from('attendance')
      .update({ check_out: time })
      .eq('employee_id', employeeId)
      .eq('date', date)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch {
    const records = getAttendanceForMonth(now.getFullYear(), now.getMonth() + 1);
    const existing = records.find(r => r.employee_id === employeeId && r.date === date);
    if (existing) {
      existing.check_out = time;
      updateAttendanceRecord(now.getFullYear(), now.getMonth() + 1, existing);
      return existing;
    }
    return null;
  }
}

export async function getAttendanceSummary(month, year) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance')
      .select('employee_id, status')
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;

    const summary = { total: 0, present: 0, absent: 0, late: 0, leave: 0 };
    (data || []).forEach(r => {
      summary.total++;
      if (r.status === 'present') summary.present++;
      else if (r.status === 'absent') summary.absent++;
      else if (r.status === 'late') summary.late++;
      else if (r.status === 'leave') summary.leave++;
    });
    return summary;
  } catch {
    const records = getAttendanceForMonth(year, month);
    const summary = { total: records.length, present: 0, absent: 0, late: 0, leave: 0 };
    records.forEach(r => {
      if (r.absent) summary.absent++;
      else if (r.check_in) summary.present++;
    });
    return summary;
  }
}
