import supabase from '../lib/supabase';

// Config keys stored in system_config
const META_CONFIG_KEY = 'meta_ads_config';
const GOOGLE_CONFIG_KEY = 'google_ads_config';

// Get/Save config
export async function getAdsConfig(platform) {
  const key = platform === 'meta' ? META_CONFIG_KEY : GOOGLE_CONFIG_KEY;
  try {
    const { data } = await supabase.from('system_config').select('value').eq('key', key).maybeSingle();
    if (data?.value) return data.value;
  } catch {}
  const saved = localStorage.getItem(`platform_${key}`);
  return saved ? JSON.parse(saved) : { enabled: false, token: '', account_id: '', last_sync: null };
}

export async function saveAdsConfig(platform, config) {
  const key = platform === 'meta' ? META_CONFIG_KEY : GOOGLE_CONFIG_KEY;
  localStorage.setItem(`platform_${key}`, JSON.stringify(config));
  try { await supabase.from('system_config').upsert({ key, value: config }); } catch {}
}

// Sync campaigns from Meta Ads API
export async function syncMetaCampaigns(config) {
  if (!config?.token || !config?.account_id) throw new Error('Meta Ads not configured');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/act_${config.account_id}/campaigns?fields=id,name,status,daily_budget,lifetime_budget,start_time,stop_time,objective&access_token=${config.token}`
  );
  if (!response.ok) throw new Error('Meta API error: ' + response.statusText);
  const { data } = await response.json();
  return data; // Array of campaigns
}

// Sync campaign insights (spend, leads, etc)
export async function syncMetaInsights(config, campaignId, dateRange = 'last_30d') {
  if (!config?.token) throw new Error('Meta Ads not configured');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=spend,impressions,clicks,actions,cost_per_action_type&date_preset=${dateRange}&access_token=${config.token}`
  );
  if (!response.ok) throw new Error('Meta API error');
  const { data } = await response.json();
  return data?.[0] || {};
}

// Sync Google Ads campaigns (placeholder - needs oauth)
export async function syncGoogleCampaigns(config) {
  if (!config?.token) throw new Error('Google Ads not configured');
  // Google Ads API requires OAuth2 + developer token
  // This is a placeholder for when credentials are provided
  throw new Error('Google Ads integration requires OAuth setup. Contact developer.');
}

// Import synced campaigns into ERP marketing service
export async function importCampaignsToERP(campaigns, platform) {
  const marketingCampaigns = campaigns.map(c => ({
    id: `${platform}_${c.id}`,
    name_en: c.name,
    name_ar: c.name,
    platform: platform === 'meta' ? 'facebook' : 'google_ads',
    status: c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'completed',
    budget: Number(c.lifetime_budget || c.daily_budget || 0) / 100, // Meta returns in cents
    spent: 0, // Updated from insights
    start_date: c.start_time?.split('T')[0] || '',
    end_date: c.stop_time?.split('T')[0] || '',
    type: 'paid_ads',
    external_id: c.id,
    source: platform,
    synced_at: new Date().toISOString(),
  }));

  // Save to localStorage and Supabase
  const existing = JSON.parse(localStorage.getItem('platform_campaigns') || '[]');
  const merged = [...existing.filter(e => !e.external_id || e.source !== platform), ...marketingCampaigns];
  localStorage.setItem('platform_campaigns', JSON.stringify(merged));

  return marketingCampaigns;
}
