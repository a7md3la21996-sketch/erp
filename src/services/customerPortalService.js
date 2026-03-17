// ── Customer Portal Service ──────────────────────────────────────

const STORAGE_KEY = 'platform_portal_links';

function getLinks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveLinks(links) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(links)); } catch { /* ignore */ }
}

export function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
  return token;
}

export function createPortalLink(contactId, contactName, permissions = {}, expiryDays = 30) {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + expiryDays);

  const link = {
    id: Date.now().toString(),
    contact_id: contactId,
    contact_name: contactName,
    token: generateToken(),
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    is_active: true,
    last_accessed: null,
    access_count: 0,
    permissions: {
      view_opportunities: true,
      view_quotes: true,
      view_invoices: true,
      view_activities: false,
      ...permissions,
    },
  };

  const all = getLinks();
  all.unshift(link);
  saveLinks(all);
  return link;
}

export function deactivateLink(id) {
  const all = getLinks();
  const idx = all.findIndex(l => l.id === id);
  if (idx > -1) {
    all[idx].is_active = false;
    saveLinks(all);
  }
  return all[idx] || null;
}

export function deleteLink(id) {
  const all = getLinks();
  const filtered = all.filter(l => l.id !== id);
  saveLinks(filtered);
}

export function getLinksByContact(contactId) {
  return getLinks().filter(l => String(l.contact_id) === String(contactId));
}

export function getAllLinks() {
  return getLinks();
}

export function getLinkByToken(token) {
  return getLinks().find(l => l.token === token) || null;
}

export function recordAccess(token) {
  const all = getLinks();
  const idx = all.findIndex(l => l.token === token);
  if (idx > -1) {
    all[idx].access_count = (all[idx].access_count || 0) + 1;
    all[idx].last_accessed = new Date().toISOString();
    saveLinks(all);
  }
}

export function getPortalData(token) {
  const link = getLinkByToken(token);
  if (!link) return null;

  // Check if expired or deactivated
  const now = new Date();
  if (!link.is_active || new Date(link.expires_at) < now) return null;

  // Record access
  recordAccess(token);

  // Get contact info
  let contacts = [];
  try { contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]'); } catch { /* ignore */ }
  const contact = contacts.find(c => String(c.id) === String(link.contact_id)) || null;

  // Get opportunities
  let opportunities = [];
  if (link.permissions.view_opportunities) {
    try {
      const allOpps = JSON.parse(localStorage.getItem('platform_opportunities') || '[]');
      opportunities = allOpps.filter(o => String(o.contact_id) === String(link.contact_id));
    } catch { /* ignore */ }
  }

  // Get quotes (from deals or finance)
  let quotes = [];
  if (link.permissions.view_quotes) {
    try {
      const allDeals = JSON.parse(localStorage.getItem('platform_deals') || '[]');
      quotes = allDeals
        .filter(d => String(d.contact_id) === String(link.contact_id) && d.quote_amount)
        .map(d => ({
          id: d.id,
          deal_name: d.name || d.deal_name || '',
          amount: d.quote_amount || d.amount || 0,
          status: d.quote_status || d.status || 'draft',
          created_at: d.created_at,
        }));
    } catch { /* ignore */ }
  }

  // Get invoices
  let invoices = [];
  if (link.permissions.view_invoices) {
    try {
      const allInvoices = JSON.parse(localStorage.getItem('platform_finance_invoices') || '[]');
      invoices = allInvoices.filter(i => String(i.contact_id) === String(link.contact_id));
    } catch { /* ignore */ }
  }

  // Get activities
  let activities = [];
  if (link.permissions.view_activities) {
    try {
      const allActs = JSON.parse(localStorage.getItem('platform_activities') || '[]');
      activities = allActs
        .filter(a => String(a.contact_id) === String(link.contact_id))
        .slice(0, 20);
    } catch { /* ignore */ }
  }

  return {
    contact,
    contact_name: link.contact_name,
    permissions: link.permissions,
    opportunities,
    quotes,
    invoices,
    activities,
  };
}
