import supabase from '../lib/supabase';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

const TABLE = 'employee_onboarding';

// Default checklist template — keep aligned with OnboardingPage's CHECKLIST_ITEMS
const DEFAULT_CHECKLIST = {
  documents: false,
  it_setup: false,
  workspace: false,
  orientation: false,
  team_intro: false,
  policy_ack: false,
  training: false,
  first_review: false,
};

export async function fetchOnboardingRecords() {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`
      *,
      employee:employees!employee_id (id, full_name_ar, full_name_en, employee_id, department_id, position),
      mentor:employees!mentor_id (id, full_name_ar, full_name_en)
    `)
    .order('start_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createOnboarding(data) {
  requirePerm(P.HR_VIEW_ALL, 'Not allowed to manage onboarding');
  const payload = {
    employee_id: data.employee_id,
    mentor_id: data.mentor_id || null,
    start_date: data.start_date,
    target_completion_date: data.target_completion_date || null,
    status: data.status || 'not_started',
    checklist: { ...DEFAULT_CHECKLIST, ...(data.checklist || {}) },
    notes: data.notes || null,
    created_by: data.created_by || null,
  };
  const { data: created, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select(`
      *,
      employee:employees!employee_id (id, full_name_ar, full_name_en, employee_id, department_id, position),
      mentor:employees!mentor_id (id, full_name_ar, full_name_en)
    `)
    .single();
  if (error) throw error;
  return created;
}

export async function updateOnboarding(id, updates) {
  requirePerm(P.HR_VIEW_ALL, 'Not allowed to manage onboarding');
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:employees!employee_id (id, full_name_ar, full_name_en, employee_id, department_id, position),
      mentor:employees!mentor_id (id, full_name_ar, full_name_en)
    `)
    .single();
  if (error) throw error;
  return data;
}

// Toggle a single checklist item — used by the row UI. Auto-derives status.
export async function toggleChecklistItem(id, itemKey, currentChecklist) {
  const newChecklist = { ...currentChecklist, [itemKey]: !currentChecklist[itemKey] };
  const values = Object.values(newChecklist);
  const status = values.every(Boolean) ? 'completed'
               : values.some(Boolean) ? 'in_progress'
               : 'not_started';
  return updateOnboarding(id, { checklist: newChecklist, status });
}

export async function deleteOnboarding(id) {
  requirePerm(P.HR_VIEW_ALL, 'Not allowed to delete onboarding records');
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

export { DEFAULT_CHECKLIST };
