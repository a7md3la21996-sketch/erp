import { stripInternalFields } from "../utils/sanitizeForSupabase";
import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import { requireAnyPerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

// Supabase is the single source of truth for campaigns. (The old localStorage
// dual-write + INITIAL_CAMPAIGNS seed was removed — it fabricated fake
// campaigns and, on any transient read error, resurrected them as permanent
// "ghost" rows that polluted the KPIs.)

export async function fetchCampaigns() {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 9999);
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('marketingService', 'fetchCampaigns', err);
    return [];
  }
}

export async function createCampaign(data) {
  // Anyone who can edit a contact (own or all) can also create campaigns
  // inline from the lead form — otherwise sales agents end up "creating"
  // campaigns that never persist and have to recreate them per lead.
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW, P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN], 'Not allowed to create campaigns');
  const campaign = { ...data, created_at: data.created_at || new Date().toISOString().slice(0, 10) };
  // Remove non-UUID id (e.g. temporary client ids).
  if (campaign.id && !campaign.id.match(/^[0-9a-f]{8}-/i)) delete campaign.id;
  // Supabase rejects '' for date/number columns — coerce empties to null.
  for (const [k, v] of Object.entries(campaign)) { if (v === '') campaign[k] = null; }
  const { data: sbData, error } = await supabase.from('campaigns').insert([stripInternalFields(campaign)]).select('*').single();
  if (error) {
    reportError('marketingService', 'createCampaign', error);
    throw new Error(error.message || 'Failed to create campaign');
  }
  logCreate('campaign', sbData.id, sbData);
  return sbData;
}

export async function updateCampaign(id, updates) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to update campaigns');
  const clean = { ...updates };
  for (const [k, v] of Object.entries(clean)) { if (v === '') clean[k] = null; }
  const { data, error } = await supabase.from('campaigns').update(stripInternalFields(clean)).eq('id', id).select('*').single();
  if (error) {
    reportError('marketingService', 'updateCampaign', error);
    throw new Error(error.message || 'Failed to update campaign');
  }
  logUpdate('campaign', id, { id }, data);
  return data;
}

export async function deleteCampaign(id) {
  requireAnyPerm([P.SETTINGS_MANAGE, P.CAMPAIGNS_VIEW], 'Not allowed to delete campaigns');
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) {
    reportError('marketingService', 'deleteCampaign', error);
    throw new Error(error.message || 'Failed to delete campaign');
  }
  logDelete('campaign', id, { id });
  return true;
}

// ── DB-side aggregates (accuracy at scale) ───────────────────────────────────
// Replace the old "fetch ALL contacts/opps/deals into the browser and compute
// in JS" approach (capped at 1000 rows → wrong numbers). See
// supabase/migrations/get_campaign_stats_rpc.sql.

// Per-campaign stats across the FULL dataset. Returns
// [{campaign_id, leads, engaged, interactions, opps, won_deals, revenue}].
export async function getCampaignStats() {
  try {
    const { data, error } = await supabase.rpc('get_campaign_stats');
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('marketingService', 'getCampaignStats', err); return []; }
}

// Company-wide + per-channel funnel using UNIQUE contacts. platform '__all__'
// is the overall row; the rest are per-platform.
export async function getCampaignFunnel() {
  try {
    const { data, error } = await supabase.rpc('get_campaign_funnel');
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('marketingService', 'getCampaignFunnel', err); return []; }
}

// On-demand detail for the campaign drawer: the contacts attributed to ONE
// campaign, fetched only when the drawer opens — so we never pull the whole
// contacts table into the browser. Matches by campaign_id first, then by exact
// name (best-effort illustrative list; headline counts come from
// getCampaignStats). Special chars in names are stripped so they can't break
// the PostgREST or() filter.
export async function getCampaignDetail(camp, limit = 500) {
  if (!camp?.id) return [];
  // PostgREST or() values: quote and strip the delimiters that would break the
  // filter list (double-quote, comma, parens).
  const q = (v) => `"${String(v).replace(/["(),]/g, ' ').trim()}"`;
  const ors = [`campaign_id.eq.${camp.id}`];
  if (camp.name_en) ors.push(`campaign_name.eq.${q(camp.name_en)}`);
  if (camp.name_ar) ors.push(`campaign_name.eq.${q(camp.name_ar)}`);
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, source, contact_status, created_at, campaign_id, campaign_name, campaign_interactions')
      .or(ors.join(','))
      .or('is_deleted.is.null,is_deleted.eq.false')
      .limit(limit);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('marketingService', 'getCampaignDetail', err); return []; }
}
