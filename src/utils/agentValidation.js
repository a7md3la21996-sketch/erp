// Validate that a set of agent names map to real users, and (for non-admin
// callers) that the agents are within the caller's team scope. Used by bulk
// reassign / bulk add-agent before any DB write.
//
// Two failure modes we close here:
//   (a) Ghost agents — a typo or stale UI option that doesn't match any
//       row in `users`. Without this check, the typo lives forever in
//       assigned_to_names / agent_statuses / agent_scores.
//   (b) Cross-team escalation — a team_leader passing the name of an
//       agent from another team. Without this check, the leader can
//       reassign contacts to someone they don't manage.
//
// Returns { ok: true } when all names are valid AND in scope. Otherwise
// returns { ok: false, unknown: [...], outOfScope: [...], message }.

import supabase from '../lib/supabase';
import { currentProfile } from './permissionGuard';
import { getTeamMemberNames } from './teamHelper';

export async function validateAgentNames(names) {
  const list = Array.isArray(names) ? names.filter(Boolean).map(n => n.trim()) : [];
  if (!list.length) return { ok: true, unknown: [], outOfScope: [] };

  const profile = currentProfile();
  // No profile loaded → defer to RLS. Don't block; the DB is the final
  // authority and we don't want to break mid-login or service_role calls.
  if (!profile) return { ok: true, unknown: [], outOfScope: [] };

  // Look up the names against the users table. Match either Arabic or
  // English full name to mirror how assigned_to_names is populated.
  const { data: users, error } = await supabase
    .from('users')
    .select('full_name_ar, full_name_en, team_id, role')
    .or(list.map(n => `full_name_en.eq.${n},full_name_ar.eq.${n}`).join(','));

  if (error) {
    // DB lookup failed — fail open rather than blocking a legitimate write.
    // The service guards + RLS still apply.
    return { ok: true, unknown: [], outOfScope: [] };
  }

  const known = new Set();
  (users || []).forEach(u => {
    if (u.full_name_en) known.add(u.full_name_en);
    if (u.full_name_ar) known.add(u.full_name_ar);
  });
  const unknown = list.filter(n => !known.has(n));

  // Admin / sales_director / operations / sales_manager (top of tree) get
  // global scope. Sales_agent can only assign to themselves. Team_leader
  // and sales_manager are scoped to their managed teams.
  let outOfScope = [];
  const role = profile.role;
  if (role === 'sales_agent') {
    const own = profile.full_name_en || profile.full_name_ar;
    outOfScope = list.filter(n => n !== own);
  } else if (role === 'team_leader' || role === 'sales_manager') {
    const teamId = profile.team_id;
    const allowed = teamId ? new Set(await getTeamMemberNames(role, teamId)) : new Set();
    outOfScope = list.filter(n => !allowed.has(n));
  }
  // admin / sales_director / operations / others → no scope filter.

  if (unknown.length === 0 && outOfScope.length === 0) {
    return { ok: true, unknown: [], outOfScope: [] };
  }
  const parts = [];
  if (unknown.length) parts.push(`unknown agents: ${unknown.join(', ')}`);
  if (outOfScope.length) parts.push(`out-of-scope agents: ${outOfScope.join(', ')}`);
  return {
    ok: false,
    unknown,
    outOfScope,
    message: parts.join(' · '),
  };
}
