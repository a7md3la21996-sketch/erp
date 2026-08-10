import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';
import { logCreate, logUpdate, logDelete } from './auditService';
import { currentProfile } from '../utils/permissionGuard';

// Who may MANAGE (add/edit/delete) developers: Operations + Admin only.
// Everyone else can view. (DB RLS enforces the same; this is the fast, clear gate.)
export const MANAGE_ROLES = ['admin', 'operations'];
export function canManageDevelopers(profile) {
  return MANAGE_ROLES.includes((profile || currentProfile?.() || {}).role);
}
function requireManage() {
  if (!canManageDevelopers()) {
    throw new Error('Only Operations and Admin can add or edit developers');
  }
}

// Developers Hub directory. Read is open to everyone (with real-estate view);
// writes are restricted to Operations + Admin.
export async function fetchDevelopers() {
  try {
    const { data, error } = await supabase.from('developers').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('developersService', 'fetchDevelopers', err);
    return [];
  }
}

export async function createDeveloper(payload) {
  requireManage();
  const me = currentProfile?.();
  const row = {
    ...payload,
    created_by: me?.id || null,
    created_by_name: me?.full_name_en || me?.full_name_ar || null,
  };
  const { data, error } = await supabase.from('developers').insert([row]).select('*').single();
  if (error) throw new Error(error.message || 'Failed to add developer');
  logCreate('developer', data.id, data);
  return data;
}

export async function updateDeveloper(id, patch) {
  requireManage();
  const { data, error } = await supabase
    .from('developers')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message || 'Failed to update developer');
  logUpdate('developer', id, { id }, data);
  return data;
}

export async function deleteDeveloper(id) {
  requireManage();
  const { error } = await supabase.from('developers').delete().eq('id', id);
  if (error) throw new Error(error.message || 'Failed to delete developer');
  logDelete('developer', id, { id });
}
