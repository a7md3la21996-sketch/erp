import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate, logDelete } from './auditService';
import {
  MOCK_OPS_DEALS,
  MOCK_INSTALLMENTS,
  MOCK_HANDOVERS,
  MOCK_TICKETS,
} from '../data/operations_mock_data';

// ── Deals ─────────────────────────────────────────────────────

export async function fetchDeals(filters = {}) {
  try {
    let query = supabase
      .from('deals')
      .select(`
        *,
        contacts ( id, full_name, phone ),
        projects ( id, name_ar, name_en )
      `)
      .order('created_at', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) {
      query = query.or(
        `client_ar.ilike.%${filters.search}%,client_en.ilike.%${filters.search}%,deal_number.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      );
    }
    if (filters.agent)     query = query.eq('agent_en', filters.agent);
    if (filters.developer) query = query.eq('developer_en', filters.developer);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('operationsService', 'query', err);
    let result = [...MOCK_OPS_DEALS];
    if (filters.status) result = result.filter(d => d.status === filters.status);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(d =>
        (d.client_ar || '').includes(s) ||
        (d.client_en || '').toLowerCase().includes(s) ||
        (d.deal_number || '').toLowerCase().includes(s) ||
        (d.phone || '').includes(s)
      );
    }
    if (filters.agent)     result = result.filter(d => d.agent_en === filters.agent);
    if (filters.developer) result = result.filter(d => d.developer_en === filters.developer);
    return result;
  }
}

export async function createDeal(data) {
  try {
    const { data: d, error } = await supabase
      .from('deals')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('deal', d.id, d);
    return d;
  } catch (err) { reportError('operationsService', 'query', err);
    const mock = { ...data, id: 'deal-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_OPS_DEALS.unshift(mock);
    return mock;
  }
}

export async function updateDeal(id, updates) {
  try {
    const { data: old } = await supabase.from('deals').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('deal', id, old, data);
    return data;
  } catch (err) { reportError('operationsService', 'query', err);
    const idx = MOCK_OPS_DEALS.findIndex(d => d.id === id);
    if (idx > -1) Object.assign(MOCK_OPS_DEALS[idx], updates);
    return MOCK_OPS_DEALS[idx];
  }
}

// ── Installments ──────────────────────────────────────────────

export async function fetchInstallments(dealId) {
  try {
    let query = supabase
      .from('installments')
      .select('*')
      .order('due_date', { ascending: true });

    if (dealId) query = query.eq('deal_id', dealId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('operationsService', 'query', err);
    let result = [...MOCK_INSTALLMENTS];
    if (dealId) result = result.filter(i => i.deal_id === dealId);
    return result.sort((a, b) => a.due_date.localeCompare(b.due_date));
  }
}

export async function createInstallment(data) {
  try {
    const { data: d, error } = await supabase
      .from('installments')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return d;
  } catch (err) { reportError('operationsService', 'query', err);
    const mock = { ...data, id: 'inst-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_INSTALLMENTS.push(mock);
    return mock;
  }
}

export async function updateInstallmentStatus(id, status, extra = {}) {
  try {
    const { data, error } = await supabase
      .from('installments')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  } catch (err) { reportError('operationsService', 'query', err);
    const idx = MOCK_INSTALLMENTS.findIndex(i => i.id === id);
    if (idx > -1) Object.assign(MOCK_INSTALLMENTS[idx], { status, ...extra });
    return MOCK_INSTALLMENTS[idx];
  }
}

// ── Handovers ─────────────────────────────────────────────────

export async function fetchHandovers(filters = {}) {
  try {
    let query = supabase
      .from('handovers')
      .select('*')
      .order('expected_handover', { ascending: true });

    if (filters.status)  query = query.eq('status', filters.status);
    if (filters.dealId)  query = query.eq('deal_id', filters.dealId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('operationsService', 'query', err);
    let result = [...MOCK_HANDOVERS];
    if (filters.status) result = result.filter(h => h.status === filters.status);
    if (filters.dealId) result = result.filter(h => h.deal_id === filters.dealId);
    return result;
  }
}

export async function createHandover(data) {
  try {
    const { data: d, error } = await supabase
      .from('handovers')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    return d;
  } catch (err) { reportError('operationsService', 'query', err);
    const mock = { ...data, id: 'ho-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_HANDOVERS.push(mock);
    return mock;
  }
}

// ── Tickets ───────────────────────────────────────────────────

export async function fetchTickets(filters = {}) {
  try {
    let query = supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.status)   query = query.eq('status', filters.status);
    if (filters.type)     query = query.eq('type', filters.type);
    if (filters.priority) query = query.eq('priority', filters.priority);
    if (filters.dealId)   query = query.eq('deal_id', filters.dealId);
    if (filters.search) {
      query = query.or(
        `subject_ar.ilike.%${filters.search}%,subject_en.ilike.%${filters.search}%,ticket_number.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('operationsService', 'query', err);
    let result = [...MOCK_TICKETS];
    if (filters.status)   result = result.filter(t => t.status === filters.status);
    if (filters.type)     result = result.filter(t => t.type === filters.type);
    if (filters.priority) result = result.filter(t => t.priority === filters.priority);
    if (filters.dealId)   result = result.filter(t => t.deal_id === filters.dealId);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(t =>
        (t.subject_ar || '').includes(s) ||
        (t.subject_en || '').toLowerCase().includes(s) ||
        (t.ticket_number || '').toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
}

export async function createTicket(data) {
  try {
    const { data: d, error } = await supabase
      .from('tickets')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('ticket', d.id, d);
    return d;
  } catch (err) { reportError('operationsService', 'query', err);
    const mock = { ...data, id: 'tkt-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_TICKETS.unshift(mock);
    return mock;
  }
}

export async function updateTicketStatus(id, status) {
  try {
    const { data: old } = await supabase.from('tickets').select('*').eq('id', id).single();
    const updates = { status };
    if (status === 'resolved' || status === 'closed') {
      updates.resolved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('ticket', id, old, data, `Ticket status changed to ${status}`);
    return data;
  } catch (err) { reportError('operationsService', 'query', err);
    const idx = MOCK_TICKETS.findIndex(t => t.id === id);
    if (idx > -1) {
      MOCK_TICKETS[idx].status = status;
      if (status === 'resolved' || status === 'closed') {
        MOCK_TICKETS[idx].resolved_at = new Date().toISOString();
      }
    }
    return MOCK_TICKETS[idx];
  }
}
