import { reportError } from '../utils/errorReporter';
import supabase from '../lib/supabase';
import { logCreate, logUpdate } from './auditService';
import {
  MOCK_JOURNAL_ENTRIES,
  MOCK_INVOICES,
  MOCK_EXPENSES,
  CHART_OF_ACCOUNTS,
} from '../data/finance_mock_data';

// ── Journal Entries ───────────────────────────────────────────

export async function fetchJournalEntries(filters = {}) {
  try {
    let query = supabase
      .from('journal_entries')
      .select(`
        *,
        journal_entry_lines ( id, account_id, debit, credit, description )
      `)
      .order('date', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.startDate) query = query.gte('date', filters.startDate);
    if (filters.endDate)   query = query.lte('date', filters.endDate);
    if (filters.search) {
      query = query.or(
        `description_ar.ilike.%${filters.search}%,description_en.ilike.%${filters.search}%,entry_number.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('financeService', 'query', err);
    let result = [...MOCK_JOURNAL_ENTRIES];
    if (filters.status) result = result.filter(e => e.status === filters.status);
    if (filters.startDate) result = result.filter(e => e.date >= filters.startDate);
    if (filters.endDate)   result = result.filter(e => e.date <= filters.endDate);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(e =>
        (e.description_ar || '').includes(s) ||
        (e.description_en || '').toLowerCase().includes(s) ||
        (e.entry_number || '').toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function createJournalEntry(data) {
  try {
    const { lines, ...entryData } = data;
    const { data: entry, error } = await supabase
      .from('journal_entries')
      .insert([{ ...entryData, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;

    if (lines && lines.length > 0) {
      const linesWithEntry = lines.map(l => ({ ...l, journal_entry_id: entry.id }));
      await supabase.from('journal_entry_lines').insert(linesWithEntry);
    }

    await logCreate('journal_entry', entry.id, entry);
    return entry;
  } catch (err) { reportError('financeService', 'query', err);
    const mock = {
      ...data,
      id: 'je-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    MOCK_JOURNAL_ENTRIES.unshift(mock);
    return mock;
  }
}

// ── Invoices ──────────────────────────────────────────────────

export async function fetchInvoices(filters = {}) {
  try {
    let query = supabase
      .from('invoices')
      .select('*')
      .order('date', { ascending: false });

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type)   query = query.eq('type', filters.type);
    if (filters.search) {
      query = query.or(
        `counterparty_ar.ilike.%${filters.search}%,counterparty_en.ilike.%${filters.search}%,number.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('financeService', 'query', err);
    let result = [...MOCK_INVOICES];
    if (filters.status) result = result.filter(i => i.status === filters.status);
    if (filters.type)   result = result.filter(i => i.type === filters.type);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(i =>
        (i.counterparty_ar || '').includes(s) ||
        (i.counterparty_en || '').toLowerCase().includes(s) ||
        (i.number || '').toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function createInvoice(data) {
  try {
    const { data: d, error } = await supabase
      .from('invoices')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('invoice', d.id, d);
    return d;
  } catch (err) { reportError('financeService', 'query', err);
    const mock = { ...data, id: 'inv-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_INVOICES.unshift(mock);
    return mock;
  }
}

export async function updateInvoiceStatus(id, status) {
  try {
    const { data: old } = await supabase.from('invoices').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    await logUpdate('invoice', id, old, data, `Invoice status changed to ${status}`);
    return data;
  } catch (err) { reportError('financeService', 'query', err);
    const idx = MOCK_INVOICES.findIndex(i => i.id === id);
    if (idx > -1) MOCK_INVOICES[idx].status = status;
    return MOCK_INVOICES[idx];
  }
}

// ── Expenses ──────────────────────────────────────────────────

export async function fetchExpenses(filters = {}) {
  try {
    let query = supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });

    if (filters.status)   query = query.eq('status', filters.status);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.search) {
      query = query.or(
        `vendor_ar.ilike.%${filters.search}%,vendor_en.ilike.%${filters.search}%,desc_ar.ilike.%${filters.search}%,desc_en.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query.range(0, 199);
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('financeService', 'query', err);
    let result = [...MOCK_EXPENSES];
    if (filters.status)   result = result.filter(e => e.status === filters.status);
    if (filters.category) result = result.filter(e => e.category === filters.category);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(e =>
        (e.vendor_ar || '').includes(s) ||
        (e.vendor_en || '').toLowerCase().includes(s) ||
        (e.desc_ar || '').includes(s) ||
        (e.desc_en || '').toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export async function createExpense(data) {
  try {
    const { data: d, error } = await supabase
      .from('expenses')
      .insert([{ ...data, created_at: new Date().toISOString() }])
      .select('*')
      .single();
    if (error) throw error;
    await logCreate('expense', d.id, d);
    return d;
  } catch (err) { reportError('financeService', 'query', err);
    const mock = { ...data, id: 'exp-' + Date.now(), created_at: new Date().toISOString() };
    MOCK_EXPENSES.unshift(mock);
    return mock;
  }
}

// ── Chart of Accounts ─────────────────────────────────────────

export async function fetchChartOfAccounts() {
  try {
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .order('code', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) { reportError('financeService', 'query', err);
    return [...CHART_OF_ACCOUNTS];
  }
}
