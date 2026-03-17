import { logCreate, logUpdate, logDelete } from './auditService';

const STORAGE_KEY = 'platform_campaigns';

const INITIAL_CAMPAIGNS = [
  { id: '1', name_en: 'Spring Sale 2026', name_ar: 'تخفيضات الربيع 2026', platform: 'facebook', status: 'active', budget: 25000, spent: 18500, start_date: '2026-02-01', end_date: '2026-03-31', type: 'paid_ads', target_audience: 'new_leads', notes: '', created_by: 'أحمد علاء', created_at: '2026-01-28' },
  { id: '2', name_en: 'Brand Awareness Q1', name_ar: 'بناء الوعي Q1', platform: 'google_ads', status: 'active', budget: 40000, spent: 32000, start_date: '2026-01-15', end_date: '2026-03-15', type: 'paid_ads', target_audience: 'awareness', notes: '', created_by: 'سارة محمد', created_at: '2026-01-10' },
  { id: '3', name_en: 'Reels Campaign', name_ar: 'حملة ريلز', platform: 'instagram', status: 'active', budget: 15000, spent: 12000, start_date: '2026-02-10', end_date: '2026-04-10', type: 'content', target_audience: 'new_leads', notes: '', created_by: 'نورهان أحمد', created_at: '2026-02-05' },
  { id: '4', name_en: 'Retargeting Warm Leads', name_ar: 'إعادة استهداف', platform: 'facebook', status: 'paused', budget: 12000, spent: 9800, start_date: '2026-01-01', end_date: '2026-02-28', type: 'retargeting', target_audience: 'warm_leads', notes: '', created_by: 'أحمد علاء', created_at: '2025-12-25' },
  { id: '5', name_en: 'Google Search CRM', name_ar: 'بحث جوجل CRM', platform: 'google_ads', status: 'completed', budget: 30000, spent: 28500, start_date: '2025-11-01', end_date: '2026-01-31', type: 'paid_ads', target_audience: 'new_leads', notes: '', created_by: 'سارة محمد', created_at: '2025-10-20' },
  { id: '6', name_en: 'New Capital Launch', name_ar: 'إطلاق العاصمة الجديدة', platform: 'facebook', status: 'active', budget: 50000, spent: 22000, start_date: '2026-03-01', end_date: '2026-05-31', type: 'paid_ads', target_audience: 'new_leads', notes: '', created_by: 'أحمد علاء', created_at: '2026-02-20' },
  { id: '7', name_en: 'North Coast Summer', name_ar: 'الساحل الشمالي صيف', platform: 'instagram', status: 'active', budget: 35000, spent: 8000, start_date: '2026-03-10', end_date: '2026-06-30', type: 'content', target_audience: 'new_leads', notes: '', created_by: 'نورهان أحمد', created_at: '2026-03-01' },
  { id: '8', name_en: 'Cold Calling Campaign', name_ar: 'حملة كولد كول', platform: 'cold_call', status: 'active', budget: 5000, spent: 3000, start_date: '2026-02-15', end_date: '2026-04-15', type: 'outbound', target_audience: 'cold_leads', notes: '', created_by: 'محمد خالد', created_at: '2026-02-10' },
  { id: '9', name_en: 'Referral Program', name_ar: 'برنامج التوصيات', platform: 'referral', status: 'active', budget: 10000, spent: 4500, start_date: '2026-01-01', end_date: '2026-12-31', type: 'referral', target_audience: 'existing_clients', notes: '', created_by: 'سارة محمد', created_at: '2025-12-28' },
  { id: '10', name_en: 'Walk-in Event', name_ar: 'حدث زيارة مباشرة', platform: 'walk_in', status: 'completed', budget: 20000, spent: 19000, start_date: '2026-02-01', end_date: '2026-02-28', type: 'event', target_audience: 'new_leads', notes: '', created_by: 'محمد خالد', created_at: '2026-01-25' },
];

function loadCampaigns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [...INITIAL_CAMPAIGNS];
  } catch {
    return [...INITIAL_CAMPAIGNS];
  }
}

function saveCampaigns(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      // Campaigns are small; if still failing, trim old completed ones
      const trimmed = list.filter(c => c.status !== 'completed').concat(list.filter(c => c.status === 'completed').slice(0, 5));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* give up */ }
    }
  }
}

export async function fetchCampaigns() {
  return loadCampaigns();
}

export async function createCampaign(data) {
  const list = loadCampaigns();
  const campaign = { ...data, id: String(Date.now()), created_at: data.created_at || new Date().toISOString().slice(0, 10) };
  list.unshift(campaign);
  saveCampaigns(list);
  logCreate('campaign', campaign.id, campaign);
  return campaign;
}

export async function updateCampaign(id, updates) {
  const list = loadCampaigns();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Campaign not found');
  const old = { ...list[idx] };
  list[idx] = { ...list[idx], ...updates };
  saveCampaigns(list);
  logUpdate('campaign', id, old, list[idx]);
  return list[idx];
}

export async function deleteCampaign(id) {
  const list = loadCampaigns();
  const campaign = list.find(c => c.id === id);
  const filtered = list.filter(c => c.id !== id);
  saveCampaigns(filtered);
  if (campaign) logDelete('campaign', id, campaign);
  return true;
}

// Get contacts linked to a campaign by matching campaign_name or campaign_interactions
export function getCampaignContacts(campaignName, contacts) {
  if (!campaignName || !contacts) return [];
  const name = campaignName.toLowerCase().trim();
  return contacts.filter(c => {
    // Check campaign_name field
    if (c.campaign_name && c.campaign_name.toLowerCase().trim() === name) return true;
    // Check campaign_interactions array
    if (c.campaign_interactions?.some(i => i.campaign?.toLowerCase().trim() === name)) return true;
    return false;
  });
}

// Get campaign interactions for a specific campaign
export function getCampaignInteractions(campaignName, contacts) {
  if (!campaignName || !contacts) return { total: 0, unique: 0, repeats: 0, interactions: [] };
  const name = campaignName.toLowerCase().trim();
  const interactions = [];
  contacts.forEach(c => {
    (c.campaign_interactions || []).forEach(i => {
      if (i.campaign?.toLowerCase().trim() === name) {
        interactions.push({ ...i, contact_id: c.id, contact_name: c.full_name, contact_phone: c.phone });
      }
    });
    // Also count campaign_name as first interaction if no campaign_interactions exist
    if (c.campaign_name?.toLowerCase().trim() === name && (!c.campaign_interactions || c.campaign_interactions.length === 0)) {
      interactions.push({ campaign: c.campaign_name, source: c.source, date: c.created_at, contact_id: c.id, contact_name: c.full_name, contact_phone: c.phone });
    }
  });
  const uniqueContacts = new Set(interactions.map(i => i.contact_id));
  return {
    total: interactions.length,
    unique: uniqueContacts.size,
    repeats: interactions.length - uniqueContacts.size,
    interactions,
  };
}
