import supabase from '../lib/supabase';

// ── Team members cache (avoids repeated DB lookups) ───────────────────────
const _teamCache = { key: null, ids: null, names: null, ts: 0 };
const TEAM_CACHE_TTL = 60000; // 1 minute

export async function getTeamMemberIds(role, teamId) {
  if (!teamId) return [];
  const cacheKey = `${role}:${teamId}`;
  if (_teamCache.key === cacheKey && _teamCache.ids && Date.now() - _teamCache.ts < TEAM_CACHE_TTL) return _teamCache.ids;
  const teamIds = [teamId];
  if (role === 'sales_manager' || role === 'team_leader') {
    const { data: children } = await supabase.from('departments').select('id').eq('parent_id', teamId);
    if (children) teamIds.push(...children.map(c => c.id));
  }
  if (role === 'sales_manager') {
    // Manager also sees grandchild teams (TL teams)
    const childIds = [...teamIds];
    for (const cid of childIds) {
      if (cid === teamId) continue;
      const { data: grandchildren } = await supabase.from('departments').select('id').eq('parent_id', cid);
      if (grandchildren) teamIds.push(...grandchildren.map(c => c.id));
    }
  }
  const { data: members } = await supabase.from('users').select('id, full_name_en').in('team_id', teamIds);
  const ids = (members || []).map(m => m.id).filter(Boolean);
  const names = (members || []).map(m => m.full_name_en).filter(Boolean);
  _teamCache.key = cacheKey; _teamCache.ids = ids; _teamCache.names = names; _teamCache.ts = Date.now();
  return ids;
}

export async function getTeamMemberNames(role, teamId) {
  if (!teamId) return [];
  await getTeamMemberIds(role, teamId); // ensures cache is populated
  return _teamCache.names || [];
}
