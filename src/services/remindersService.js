import supabase from '../lib/supabase';

export async function fetchReminders({ userId, entityType, entityId, todayOnly = false } = {}) {
  let query = supabase
    .from('reminders')
    .select(`*, users!reminders_assigned_to_fkey (full_name_ar, full_name_en)`)
    .order('due_at', { ascending: true });

  if (userId) query = query.eq('assigned_to', userId);
  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);
  if (todayOnly) {
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    query = query.gte('due_at', start.toISOString()).lte('due_at', end.toISOString());
  }

  const { data, error } = await query.eq('is_done', false).limit(100);
  if (error) throw error;
  return data || [];
}

export async function fetchTodayReminders(userId) {
  return fetchReminders({ userId, todayOnly: true });
}

export async function createReminder({ entityType, entityId, entityName, dueAt, type = 'call', notes = '', assignedTo }) {
  const { data, error } = await supabase
    .from('reminders')
    .insert([{ entity_type: entityType, entity_id: entityId, entity_name: entityName, due_at: dueAt, type, notes, assigned_to: assignedTo, is_done: false, created_at: new Date().toISOString() }])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function markReminderDone(id) {
  const { data, error } = await supabase
    .from('reminders')
    .update({ is_done: true, done_at: new Date().toISOString() })
    .eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteReminder(id) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

export async function updateReminder(id, updates) {
  const { data, error } = await supabase
    .from('reminders').update(updates).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export const REMINDER_TYPES = {
  call:     { en: 'Call',        ar: '\u0645\u0643\u0627\u0644\u0645\u0629',    color: '#10B981', icon: 'Phone' },
  whatsapp: { en: 'WhatsApp',    ar: '\u0648\u0627\u062a\u0633\u0627\u0628',    color: '#25D366', icon: 'MessageCircle' },
  visit:    { en: 'Site Visit',  ar: '\u0632\u064a\u0627\u0631\u0629 \u0645\u0648\u0642\u0639', color: '#4A7AAB', icon: 'MapPin' },
  meeting:  { en: 'Meeting',     ar: '\u0627\u062c\u062a\u0645\u0627\u0639',    color: '#8B5CF6', icon: 'Users' },
  email:    { en: 'Email',       ar: '\u0628\u0631\u064a\u062f',                  color: '#F59E0B', icon: 'Mail' },
};
