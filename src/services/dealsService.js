// ── Deals Service — bridge between CRM Opportunities and Operations ──
import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';
import { reportError } from '../utils/errorReporter';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import { requireAnyPerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

// The actual columns on the `deals` table. Deal builders below copy fields off
// a contact/opportunity (source, campaign_name) and support a multi-unit `units`
// array — none of which exist as deals columns, so PostgREST rejects the whole
// insert with "Could not find the 'campaign_name' column ... in the schema
// cache". Whitelisting to real columns drops any stray field (current or
// future) instead of failing the write.
const DEAL_COLUMNS = new Set([
  'agent_ar', 'agent_en', 'assigned_to', 'client_ar', 'client_budget', 'client_en',
  'contact_id', 'created_at', 'deal_number', 'deal_value', 'developer_ar', 'developer_en',
  'documents', 'down_payment', 'id', 'installments_count', 'notes', 'opportunity_id',
  'phone', 'project_ar', 'project_en', 'project_id', 'status', 'unit_code',
  'unit_type_ar', 'unit_type_en', 'updated_at',
]);
function pickDealColumns(obj) {
  const out = {};
  for (const k of Object.keys(obj || {})) if (DEAL_COLUMNS.has(k)) out[k] = obj[k];
  return out;
}

// ── Team cache ────────────────────────────────────────────────────────────
const _teamCache = { key: null, names: null, ts: 0 };
async function getTeamMemberNames(role, teamId) {
  if (!teamId) return [];
  const ck = `${role}:${teamId}`;
  if (_teamCache.key === ck && _teamCache.names && Date.now() - _teamCache.ts < 60000) return _teamCache.names;
  const teamIds = [teamId];
  if (role === 'sales_manager') {
    const { data: ch } = await supabase.from('departments').select('id').eq('parent_id', teamId);
    if (ch) teamIds.push(...ch.map(c => c.id));
  }
  const { data: members } = await supabase.from('users').select('full_name_en, full_name_ar').in('team_id', teamIds);
  const names = (members || []).flatMap(m => [m.full_name_en, m.full_name_ar]).filter(Boolean);
  _teamCache.key = ck; _teamCache.names = names; _teamCache.ts = Date.now();
  return names;
}

/**
 * Get deals filtered by role
 */
export async function getWonDeals({ role, userId, teamId, userName, contactId, agentNames, slim } = {}) {
  try {
    // CRM/sales deals are distinguished from Operations' manual deals by
    // their CRM linkage: a sales deal has an opportunity_id (legacy, opp-based)
    // OR a contact_id (Phase B: deals created straight from a lead, no opp).
    // Operations' manual deals (OperationsPage AddDealModal) have NEITHER, so
    // they stay excluded here.
    // `slim` (dashboard aggregates) selects only the columns the KPI/revenue
    // maths read — skips the heavy documents/units JSONB — and fetches ALL rows
    // so the totals aren't silently capped. Other callers keep '*' + one page.
    const cols = slim
      ? 'id, status, deal_value, created_at, updated_at, agent_en, agent_ar, client_en, client_ar, contact_id, opportunity_id, assigned_to'
      : '*';
    // Resolve team-member names (async) before building the query.
    // Quote each value so names containing a comma / parenthesis / dot don't
    // corrupt the PostgREST or() grammar (that produced 400s).
    const qv = (n) => `"${String(n).replace(/"/g, '')}"`;
    let nameOr = null;
    if (Array.isArray(agentNames) && agentNames.length) {
      nameOr = agentNames.map(n => `agent_en.eq.${qv(n)},agent_ar.eq.${qv(n)}`).join(',');
    } else if (role === 'sales_agent' && userName) {
      nameOr = `agent_en.eq.${qv(userName)},agent_ar.eq.${qv(userName)}`;
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) nameOr = names.map(n => `agent_en.eq.${qv(n)},agent_ar.eq.${qv(n)}`).join(',');
    }
    const build = () => {
      let q = supabase.from('deals').select(cols)
        .or('opportunity_id.not.is.null,contact_id.not.is.null')
        .order('created_at', { ascending: false });
      if (contactId) q = q.eq('contact_id', contactId);
      if (nameOr) q = q.or(nameOr);
      return q;
    };

    if (!slim) {
      const { data, error } = await build().range(0, 499);
      if (error) throw error;
      return data || [];
    }
    // slim path — page through everything so revenue/win totals are complete
    const all = []; let from = 0; const PAGE = 1000;
    for (;;) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) throw error;
      all.push(...(data || []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  } catch (err) {
    reportError('dealsService', 'getWonDeals', err);
    return [];
  }
}

/**
 * Generate next deal number.
 * Tries DB sequence first (race-condition safe), falls back to timestamp-based ID.
 */
async function nextDealNumber(existingDeals) {
  // Try database sequence (atomic, no race conditions)
  try {
    const { data, error } = await supabase.rpc('generate_deal_number');
    if (!error && data) return data;
  } catch {}
  // Fallback: timestamp-based (race-condition safe, like contacts do)
  return 'D-' + Date.now().toString(36).toUpperCase();
}

/**
 * Create a deal from a won opportunity
 * Saves to Supabase first, queues for retry on failure
 */
export async function createDealFromOpportunity(opp, existingDeals = [], extraFields = {}) {
  // Creating a deal is a side effect of closing an opportunity won, so the
  // permission gate is the same as editing an opportunity. There's no
  // dedicated DEALS_CREATE permission today.
  requireAnyPerm([P.OPPS_EDIT, P.OPPS_EDIT_OWN], 'Not allowed to create deals');
  const contact = opp.contacts || {};
  const agent = opp.users || {};
  const project = opp.projects || {};

  // Check if already exists in Supabase
  try {
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('*')
      .eq('opportunity_id', opp.id)
      .maybeSingle();
    if (existingDeal) return existingDeal;
  } catch (err) {
    reportError('dealsService', 'createDealFromOpportunity:dupCheck', err);
  }

  const dealData = {
    deal_number: await nextDealNumber(existingDeals),
    opportunity_id: opp.id,
    contact_id: opp.contact_id || null,
    project_id: opp.project_id || null,
    client_ar: contact.full_name || opp.contact_name || '—',
    client_en: contact.full_name || opp.contact_name || '—',
    phone: contact.phone || '',
    source: contact.source || opp.source || '',
    campaign_name: contact.campaign_name || '',
    agent_ar: agent.full_name_ar || opp.agent_name || '—',
    agent_en: agent.full_name_en || agent.full_name_ar || opp.agent_name || '—',
    project_ar: project.name_ar || opp.project_name || '',
    project_en: project.name_en || project.name_ar || opp.project_name || '',
    developer_ar: extraFields.developer_ar || '',
    developer_en: extraFields.developer_en || '',
    unit_code: extraFields.unit_code || '',
    unit_type_ar: extraFields.unit_type_ar || '',
    unit_type_en: extraFields.unit_type_en || '',
    // Multi-unit support: array of { unit_code, unit_type_ar, unit_type_en }
    units: extraFields.units || (extraFields.unit_code ? [{ unit_code: extraFields.unit_code, unit_type_ar: extraFields.unit_type_ar || '', unit_type_en: extraFields.unit_type_en || '' }] : []),
    deal_value: opp.deal_value || opp.budget || 0,
    client_budget: opp.budget || 0,
    down_payment: extraFields.down_payment || 0,
    installments_count: extraFields.installments_count || 0,
    status: 'new_deal',
    documents: {
      national_id: false,
      reservation_form: false,
      down_payment_receipt: false,
      contract: false,
      developer_receipt: false,
    },
  };

  // Try Supabase first — source of truth
  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([pickDealColumns(stripInternalFields({ ...dealData, created_at: new Date().toISOString() }))])
      .select('*')
      .single();
    if (error) throw error;
    logCreate('deal', data.id, data);
    return data;
  } catch (err) {
    reportError('dealsService', 'createDealFromOpportunity', err);
    throw err;
  }
}

/**
 * Phase B — create a deal STRAIGHT from a contact/lead (no opportunity record).
 * Mirrors createDealFromOpportunity but sources its data from the contact plus
 * the closing wizard's extraFields; opportunity_id stays null. Deal-specific
 * fields (units, developer, down payment, installments, deal value) come from
 * extraFields because the contact doesn't carry them.
 *
 * Returns { deal, created } — `created:false` means a deal already existed for
 * this contact and the existing one is returned (so callers don't show a false
 * "deal created" message or re-trigger status writes).
 */
export async function createDealFromContact(contact, extraFields = {}, existingDeals = []) {
  // Same gate as the opportunity path: closing a deal is a sales action.
  requireAnyPerm([P.OPPS_EDIT, P.OPPS_EDIT_OWN], 'Not allowed to create deals');
  const c = contact || {};

  // A lead can legitimately have MULTIPLE deals (multiple reservations /
  // contracts — one per unit). Callers that want a NEW deal each time pass
  // allowDuplicate; the default keeps the old one-deal guard for legacy callers.
  if (!extraFields.allowDuplicate) {
    try {
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('*')
        .eq('contact_id', c.id)
        .is('opportunity_id', null)
        .limit(1);
      if (existingDeal?.[0]) return { deal: existingDeal[0], created: false };
    } catch (err) {
      reportError('dealsService', 'createDealFromContact:dupCheck', err);
    }
  }

  const agentName = extraFields.agent_name || c.assigned_to_name || '—';
  const dealData = {
    deal_number: await nextDealNumber(existingDeals),
    opportunity_id: null,
    contact_id: c.id || null,
    // Own the deal by the lead's owner id so scoped deal counts (e.g. the
    // dashboard Source Performance "Deals" column, which filters on
    // deals.assigned_to) include drawer-created deals. Was left null.
    assigned_to: extraFields.assigned_to || c.assigned_to || null,
    project_id: extraFields.project_id || null,
    client_ar: c.full_name || '—',
    client_en: c.full_name || '—',
    phone: c.phone || '',
    source: c.source || '',
    campaign_name: c.campaign_name || '',
    agent_ar: extraFields.agent_ar || agentName,
    agent_en: extraFields.agent_en || agentName,
    project_ar: extraFields.project_ar || extraFields.project || '',
    project_en: extraFields.project_en || extraFields.project || '',
    developer_ar: extraFields.developer_ar || '',
    developer_en: extraFields.developer_en || '',
    unit_code: extraFields.unit_code || '',
    unit_type_ar: extraFields.unit_type_ar || '',
    unit_type_en: extraFields.unit_type_en || '',
    units: extraFields.units || (extraFields.unit_code ? [{ unit_code: extraFields.unit_code, unit_type_ar: extraFields.unit_type_ar || '', unit_type_en: extraFields.unit_type_en || '' }] : []),
    deal_value: extraFields.deal_value || extraFields.budget || 0,
    client_budget: extraFields.budget || extraFields.deal_value || 0,
    down_payment: extraFields.down_payment || 0,
    installments_count: extraFields.installments_count || 0,
    // Deal-events model: caller can set the milestone status directly
    // (reserved / contracted / won / lost). Defaults to new_deal.
    status: extraFields.status || 'new_deal',
    documents: {
      national_id: false,
      reservation_form: false,
      down_payment_receipt: false,
      contract: false,
      developer_receipt: false,
    },
  };

  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([pickDealColumns(stripInternalFields({ ...dealData, created_at: new Date().toISOString() }))])
      .select('*')
      .single();
    if (error) throw error;
    logCreate('deal', data.id, data);
    return { deal: data, created: true };
  } catch (err) {
    reportError('dealsService', 'createDealFromContact', err);
    throw err;
  }
}

/**
 * Deal-events model: advance ONE specific deal to a new status (+ optionally
 * update money fields the caller supplied). A lead can have several deals
 * (one per unit), so we target a deal by id, never "the lead's deal".
 */
export async function advanceDeal(dealId, status, extraFields = {}) {
  requireAnyPerm([P.OPPS_EDIT, P.OPPS_EDIT_OWN], 'Not allowed to update a deal');
  const patch = { status, updated_at: new Date().toISOString() };
  if (extraFields.deal_value != null && extraFields.deal_value !== '') patch.deal_value = Number(extraFields.deal_value) || 0;
  if (extraFields.down_payment != null && extraFields.down_payment !== '') patch.down_payment = Number(extraFields.down_payment) || 0;
  if (extraFields.unit_code) patch.unit_code = extraFields.unit_code;
  if (extraFields.notes) patch.notes = extraFields.notes;
  try {
    const { data, error } = await supabase.from('deals').update(patch).eq('id', dealId).select('*').single();
    if (error) throw error;
    logUpdate('deal', data.id, { id: dealId }, data);
    return { deal: data };
  } catch (err) { reportError('dealsService', 'advanceDeal', err); throw err; }
}

/**
 * Check if a deal already exists for an opportunity (queries Supabase)
 */
export async function dealExistsForOpportunity(oppId) {
  try {
    const { count, error } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .eq('opportunity_id', oppId);
    if (error) throw error;
    return count > 0;
  } catch (err) {
    reportError('dealsService', 'dealExistsForOpportunity', err);
    return false;
  }
}
