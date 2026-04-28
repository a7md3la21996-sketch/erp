import supabase from '../lib/supabase';
import { requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

let _cachedRules = null;

export async function fetchPayrollRules() {
  const { data, error } = await supabase
    .from('payroll_rules')
    .select('*')
    .eq('is_active', true)
    .order('category');
  if (error) throw error;
  return data || [];
}

export async function loadRulesMap() {
  if (_cachedRules) return _cachedRules;
  const rules = await fetchPayrollRules();
  const map = {};
  rules.forEach(r => { map[r.rule_key] = r.rule_value; });
  _cachedRules = map;
  return map;
}

export function clearRulesCache() {
  _cachedRules = null;
}

export async function updateRule(id, value) {
  // Payroll rule changes shift everyone's salary calculation — admin/HR only.
  requirePerm(P.PAYROLL_MANAGE, 'Not allowed to update payroll rules');
  clearRulesCache();
  const { data, error } = await supabase
    .from('payroll_rules')
    .update({ rule_value: value, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
