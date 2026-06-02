// Master Leads service — wraps the master_leads_list / master_leads_count
// RPCs that group contacts by phone and return one row per "lead family"
// (the original + every clone that shares the phone).
//
// Used by /crm/master-leads — admin-only view that lets the sales admin
// see, for any phone, exactly which agents currently hold a copy of it.

import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

export async function fetchMasterLeads({
  search = null,
  minClones = 1,
  ownerId = null,
  page = 1,
  pageSize = 50,
} = {}) {
  try {
    const offset = (page - 1) * pageSize;
    const [listRes, countRes] = await Promise.all([
      supabase.rpc('master_leads_list', {
        p_search: search || null,
        p_min_clones: minClones,
        p_owner_id: ownerId || null,
        p_limit: pageSize,
        p_offset: offset,
      }),
      supabase.rpc('master_leads_count', {
        p_search: search || null,
        p_min_clones: minClones,
        p_owner_id: ownerId || null,
      }),
    ]);
    if (listRes.error) throw listRes.error;
    if (countRes.error) throw countRes.error;
    return {
      rows: Array.isArray(listRes.data) ? listRes.data : [],
      total: typeof countRes.data === 'number' ? countRes.data : 0,
    };
  } catch (err) {
    reportError('masterLeadsService', 'fetchMasterLeads', err);
    return { rows: [], total: 0, error: err };
  }
}
