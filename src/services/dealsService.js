// ── Deals Service — bridge between CRM Opportunities and Operations ──

const STORAGE_KEY = 'platform_won_deals';

/**
 * Get all deals created from won opportunities
 */
export function getWonDeals() {
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
 * @param {Object} opp — full opportunity object (with contacts, users, projects relations)
 * @param {Array} existingDeals — all existing deals (mock + won) to generate unique deal_number
 * @returns {Object} the new deal
 */
export function createDealFromOpportunity(opp, existingDeals = []) {
  const contact = opp.contacts || {};
  const agent = opp.users || {};
  const project = opp.projects || {};

  const deal = {
    id: `deal-opp-${opp.id}`,
    deal_number: nextDealNumber(existingDeals),
    opportunity_id: opp.id,
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
    created_at: new Date().toISOString().split('T')[0],
    documents: {
      national_id: false,
      reservation_form: false,
      down_payment_receipt: false,
      contract: false,
      developer_receipt: false,
    },
  };

  // Persist
  const existing = getWonDeals();
  // Don't duplicate if already created for this opportunity
  if (existing.some(d => d.opportunity_id === opp.id)) {
    return existing.find(d => d.opportunity_id === opp.id);
  }
  existing.unshift(deal);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

  return deal;
}

/**
 * Check if a deal already exists for an opportunity
 */
export function dealExistsForOpportunity(oppId) {
  return getWonDeals().some(d => d.opportunity_id === oppId);
}
