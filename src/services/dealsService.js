// ── Deals Service — bridge between CRM Opportunities and Operations ──
import supabase from '../lib/supabase';
import { logCreate } from './auditService';

const STORAGE_KEY = 'platform_won_deals';

/**
 * Get all deals created from won opportunities
 */
export async function getWonDeals() {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .not('opportunity_id', 'is', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (data?.length) {
      // Sync to localStorage
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
      return data;
    }
  } catch { /* fallback */ }
  // Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Sync version for non-async callers (localStorage only)
export function getWonDealsSync() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Generate next deal number (D-YYYY-NNN)
 */
function nextDealNumber(existingDeals) {
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
 * Saves to Supabase first, falls back to localStorage
 */
export async function createDealFromOpportunity(opp, existingDeals = []) {
  const contact = opp.contacts || {};
  const agent = opp.users || {};
  const project = opp.projects || {};

  // Check if already exists
  const localDeals = getWonDealsSync();
  const existing = localDeals.find(d => d.opportunity_id === opp.id);
  if (existing) return existing;

  const dealData = {
    deal_number: nextDealNumber([...existingDeals, ...localDeals]),
    opportunity_id: opp.id,
    contact_id: opp.contact_id || null,
    project_id: opp.project_id || null,
    client_ar: contact.full_name || opp.contact_name || '—',
    client_en: contact.full_name || opp.contact_name || '—',
    phone: contact.phone || '',
    agent_ar: agent.full_name_ar || opp.agent_name || '—',
    agent_en: agent.full_name_en || agent.full_name_ar || opp.agent_name || '—',
    project_ar: project.name_ar || opp.project_name || '',
    project_en: project.name_en || project.name_ar || opp.project_name || '',
    developer_ar: '',
    developer_en: '',
    unit_code: '',
    unit_type_ar: '',
    unit_type_en: '',
    deal_value: opp.budget || 0,
    down_payment: 0,
    installments_count: 0,
    status: 'new_deal',
    documents: {
      national_id: false,
      reservation_form: false,
      down_payment_receipt: false,
      contract: false,
      developer_receipt: false,
    },
  };

  // Try Supabase first
  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([{ ...dealData, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    // Sync to localStorage
    localDeals.unshift(data);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localDeals)); } catch {}
    logCreate('deal', data.id, data);
    return data;
  } catch { /* fallback to localStorage */ }

  // localStorage fallback
  const deal = {
    ...dealData,
    id: `deal-opp-${opp.id}`,
    created_at: new Date().toISOString().split('T')[0],
  };
  localDeals.unshift(deal);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(localDeals)); } catch {}
  return deal;
}

/**
 * Check if a deal already exists for an opportunity
 */
export function dealExistsForOpportunity(oppId) {
  return getWonDealsSync().some(d => d.opportunity_id === oppId);
}
