/**
 * Unified Role-Based Filter
 * Single source of truth for data access filtering.
 * Call this from ANY service before executing a query.
 *
 * Usage:
 *   const query = supabase.from('contacts').select('*');
 *   const filtered = await applyRoleFilter(query, 'contacts', { role, userId, teamId, userName });
 *   const { data } = await filtered;
 */

import supabase from '../lib/supabase';

// Cache team data for 60 seconds
const _cache = { key: null, ids: null, names: null, ts: 0 };
const CACHE_TTL = 60000;

async function getTeamData(role, teamId) {
  if (!teamId) return { ids: [], names: [] };
  const ck = `${role}:${teamId}`;
  if (_cache.key === ck && _cache.ids && Date.now() - _cache.ts < CACHE_TTL) {
    return { ids: _cache.ids, names: _cache.names };
  }

  const teamIds = [teamId];
  if (role === 'sales_manager') {
    const { data: children } = await supabase.from('departments').select('id').eq('parent_id', teamId);
    if (children) teamIds.push(...children.map(c => c.id));
  }

  const { data: members } = await supabase.from('users').select('id, full_name_en').in('team_id', teamIds);
  const ids = (members || []).map(m => m.id).filter(Boolean);
  const names = (members || []).map(m => m.full_name_en).filter(Boolean);

  _cache.key = ck;
  _cache.ids = ids;
  _cache.names = names;
  _cache.ts = Date.now();

  return { ids, names };
}

// Get current user's name (cached per session)
let _userName = null;
let _userNameId = null;
async function getUserName(userId) {
  if (_userNameId === userId && _userName) return _userName;
  const { data } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
  _userName = data?.full_name_en || null;
  _userNameId = userId;
  return _userName;
}

/**
 * Apply role-based filter to a Supabase query.
 *
 * @param {object} query - Supabase query builder
 * @param {string} table - Table name ('contacts', 'opportunities', 'activities', 'tasks', 'deals')
 * @param {object} opts - { role, userId, teamId }
 * @returns {object} - Filtered query
 */
export async function applyRoleFilter(query, table, { role, userId, teamId } = {}) {
  // Admin and Operations see everything
  if (role === 'admin') return query;
  if (role === 'operations') return query;
  // If no role info, return unfiltered (let RLS handle it)
  if (!role || !userId) return query;

  // Get user's name
  let myName;
  try {
    myName = await getUserName(userId);
  } catch {
    return query; // If can't get name, return unfiltered
  }

  // Sales Agent: sees only their own data
  if (role === 'sales_agent') {
    switch (table) {
      case 'contacts':
        if (myName) return query.filter('assigned_to_names', 'cs', JSON.stringify([myName]));
        return query.eq('id', '00000000-0000-0000-0000-000000000000'); // show nothing
      case 'opportunities':
        if (myName) return query.eq('assigned_to_name', myName);
        return query.eq('assigned_to', userId);
      case 'activities':
        if (myName) return query.or(`user_name_en.eq.${myName},user_id.eq.${userId}`);
        return query.eq('user_id', userId);
      case 'tasks':
        if (myName) return query.or(`assigned_to.eq.${userId},assigned_to_name_en.eq.${myName}`);
        return query.eq('assigned_to', userId);
      case 'deals':
        if (myName) return query.or(`agent_en.eq.${myName}`);
        return query;
      default:
        return query;
    }
  }

  // Team Leader / Sales Manager: sees their team's data
  if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
    const { ids, names } = await getTeamData(role, teamId);

    if (!names.length && !ids.length) {
      return query.eq('id', '00000000-0000-0000-0000-000000000000'); // show nothing
    }

    switch (table) {
      case 'contacts':
        if (names.length) {
          const orConds = names.map(n => `assigned_to_names.cs.["${n}"]`).join(',');
          return query.or(orConds);
        }
        return query;
      case 'opportunities':
        if (names.length) return query.in('assigned_to_name', names);
        if (ids.length) return query.in('assigned_to', ids);
        return query;
      case 'activities':
        if (names.length) {
          const nameConds = names.map(n => `user_name_en.eq.${n}`).join(',');
          const idConds = ids.map(id => `user_id.eq.${id}`).join(',');
          return query.or(`${nameConds},${idConds}`);
        }
        return query;
      case 'tasks':
        if (ids.length) return query.in('assigned_to', ids);
        return query;
      case 'deals':
        if (names.length) return query.in('agent_en', names);
        return query;
      default:
        return query;
    }
  }

  // Other roles (marketing, hr, finance): see everything in their scope
  return query;
}

/**
 * Check if user can perform an action
 */
export function canPerform(role, action) {
  const PERMISSIONS = {
    delete_contact: ['admin'],
    reassign: ['admin', 'operations', 'sales_manager', 'team_leader'],
    export: ['admin'],
    import: ['admin', 'operations'],
    settings: ['admin'],
    bulk_actions: ['admin', 'operations', 'sales_manager', 'team_leader'],
  };
  return (PERMISSIONS[action] || []).includes(role);
}
