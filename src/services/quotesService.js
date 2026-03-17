// ── Quotes / Proposals Service ──────────────────────────────────────

const STORAGE_KEY = 'platform_quotes';

function getLocalQuotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveLocalQuotes(quotes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes)); } catch { /* ignore */ }
}

// ── Auto-increment quote number ──
export function generateQuoteNumber() {
  const quotes = getLocalQuotes();
  if (!quotes.length) return 'QT-0001';
  const nums = quotes.map(q => {
    const m = (q.quote_number || '').match(/QT-(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = Math.max(0, ...nums);
  return `QT-${String(max + 1).padStart(4, '0')}`;
}

// ── Calculate line totals and summary ──
export function calculateTotals(items = []) {
  let subtotal = 0;
  let discount_total = 0;
  let tax_total = 0;

  const computed = items.map(item => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const discPct = Number(item.discount_percent) || 0;
    const taxPct = Number(item.tax_percent) ?? 15;

    const lineGross = qty * price;
    const lineDiscount = lineGross * (discPct / 100);
    const lineAfterDiscount = lineGross - lineDiscount;
    const lineTax = lineAfterDiscount * (taxPct / 100);
    const lineTotal = lineAfterDiscount + lineTax;

    subtotal += lineGross;
    discount_total += lineDiscount;
    tax_total += lineTax;

    return { ...item, total: Math.round(lineTotal * 100) / 100 };
  });

  const grand_total = subtotal - discount_total + tax_total;

  return {
    items: computed,
    subtotal: Math.round(subtotal * 100) / 100,
    discount_total: Math.round(discount_total * 100) / 100,
    tax_total: Math.round(tax_total * 100) / 100,
    grand_total: Math.round(grand_total * 100) / 100,
  };
}

// ── CRUD ──

export function getQuotes() {
  return getLocalQuotes().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getQuoteById(id) {
  return getLocalQuotes().find(q => String(q.id) === String(id)) || null;
}

export function getQuotesByOpportunity(opportunityId) {
  return getLocalQuotes().filter(q => String(q.opportunity_id) === String(opportunityId));
}

export function getQuotesByContact(contactId) {
  return getLocalQuotes().filter(q => String(q.contact_id) === String(contactId));
}

export function createQuote(data) {
  const now = new Date().toISOString();
  const totals = calculateTotals(data.items || []);
  const validUntil = data.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const quote = {
    ...data,
    id: Date.now().toString(),
    quote_number: data.quote_number || generateQuoteNumber(),
    status: data.status || 'draft',
    created_at: now,
    updated_at: now,
    valid_until: validUntil,
    currency: data.currency || 'SAR',
    items: totals.items,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    tax_total: totals.tax_total,
    grand_total: totals.grand_total,
  };

  const all = getLocalQuotes();
  all.unshift(quote);
  saveLocalQuotes(all);
  return quote;
}

export function updateQuote(id, updates) {
  const all = getLocalQuotes();
  const idx = all.findIndex(q => String(q.id) === String(id));
  if (idx === -1) return null;

  // Recalculate totals if items changed
  let totals = {};
  if (updates.items) {
    totals = calculateTotals(updates.items);
  }

  all[idx] = {
    ...all[idx],
    ...updates,
    ...totals,
    ...(updates.items ? { items: totals.items } : {}),
    updated_at: new Date().toISOString(),
  };

  saveLocalQuotes(all);
  return all[idx];
}

export function deleteQuote(id) {
  const all = getLocalQuotes();
  const filtered = all.filter(q => String(q.id) !== String(id));
  saveLocalQuotes(filtered);
}

export function duplicateQuote(id) {
  const original = getQuoteById(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const newQuote = {
    ...original,
    id: Date.now().toString(),
    quote_number: generateQuoteNumber(),
    status: 'draft',
    created_at: now,
    updated_at: now,
    sent_at: null,
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };

  const all = getLocalQuotes();
  all.unshift(newQuote);
  saveLocalQuotes(all);
  return newQuote;
}

// ── Stats ──
export function getQuoteStats() {
  const quotes = getLocalQuotes();
  const total = quotes.length;
  const draft = quotes.filter(q => q.status === 'draft').length;
  const sent = quotes.filter(q => q.status === 'sent').length;
  const accepted = quotes.filter(q => q.status === 'accepted').length;
  const rejected = quotes.filter(q => q.status === 'rejected').length;
  const expired = quotes.filter(q => q.status === 'expired').length;

  const total_value = quotes.reduce((s, q) => s + (q.grand_total || 0), 0);
  const accepted_value = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.grand_total || 0), 0);
  const pending_value = quotes.filter(q => q.status === 'sent').reduce((s, q) => s + (q.grand_total || 0), 0);
  const acceptance_rate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return { total, draft, sent, accepted, rejected, expired, total_value, accepted_value, pending_value, acceptance_rate };
}
