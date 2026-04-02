// ── Deals Service — bridge between CRM Opportunities and Operations ──
import supabase from '../lib/supabase';
import { logCreate } from './auditService';
import { reportError } from '../utils/errorReporter';
import { addToSyncQueue } from './syncService';

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
export async function getWonDeals({ role, userId, teamId, userName } = {}) {
  try {
    let query = supabase
      .from('deals')
      .select('*')
      .not('opportunity_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(0, 499);

    if (role === 'sales_agent' && userName) {
      query = query.or(`agent_en.eq.${userName},agent_ar.eq.${userName}`);
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) {
        const or = names.map(n => `agent_en.eq.${n},agent_ar.eq.${n}`).join(',');
        query = query.or(or);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('dealsService', 'getWonDeals', err);
    return [];
  }
}

/**
 * Generate next deal number.
 * Tries DB sequence first (race-condition safe), falls back to JS increment.
 */
async function nextDealNumber(existingDeals) {
  // Try database sequence (atomic, no race conditions)
  try {
    const { data, error } = await supabase.rpc('generate_deal_number');
    if (!error && data) return data;
  } catch {}
  // Fallback: JS-based (for offline/dev)
  const year = new Date().getFullYear();
  const prefix = `D-${year}-`;
  const nums = existingDeals
    .filter(d => d.deal_number?.startsWith(prefix))
    .map(d => parseInt(d.deal_number.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 100;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/**
 * Create a deal from a won opportunity
 * Saves to Supabase first, queues for retry on failure
 */
export async function createDealFromOpportunity(opp, existingDeals = [], extraFields = {}) {
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
      .insert([{ ...dealData, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    logCreate('deal', data.id, data);
    return data;
  } catch (err) {
    reportError('dealsService', 'createDealFromOpportunity', err);
    // Queue for retry
    const deal = {
      ...dealData,
      id: `deal-opp-${opp.id}`,
      created_at: new Date().toISOString().split('T')[0],
      _offline: true,
    };
    addToSyncQueue('deals', 'create', deal);
    return deal;
  }
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
