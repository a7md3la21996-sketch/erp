import supabase from '../lib/supabase';
import { stripInternalFields } from '../utils/sanitizeForSupabase';
import { logCreate, logUpdate, logAudit } from './auditService';
import { requireAnyPerm, requirePerm } from '../utils/permissionGuard';
import { P } from '../config/roles';

import { reportError } from '../utils/errorReporter';
import { getTeamMemberIds, getTeamMemberNames } from '../utils/teamHelper';
import { applyRoleFilter } from '../utils/roleFilter';
import { retryWithBackoff } from '../utils/retryWithBackoff';

// Retry helper: wraps a Supabase builder thunk in exponential-backoff retry
// (3 attempts). Use for idempotent ops only — UPDATE/DELETE/SELECT — never for
// INSERT because a successful insert with a dropped response would create
// duplicates on retry.
const rq = (fn, label) => retryWithBackoff(fn, { label });

// ── Assignment History ─────────────────────────────────────────────────────

/** @deprecated Assignment history now comes from activities (type='reassignment') via fetchContactActivities */
export function getAssignmentHistory() {
  return [];
}

// Soft-delete columns must be written together — `is_deleted` (bool) and
// `deleted_at` (timestamp) drift if one is updated without the other. These
// helpers are the only correct way to set/clear soft-delete state on contacts.
const softDeleteFields = () => ({ is_deleted: true,  deleted_at: new Date().toISOString() });
const softUndeleteFields = () => ({ is_deleted: false, deleted_at: null });

/**
 * Increment a contact's lead score, capped at 100. Single-assignment now —
 * the score belongs to the sole assignee, so this is just a numeric update.
 */
export async function incrementLeadScore(contactId, increment) {
  try {
    const { data: current } = await rq(() => supabase.from('contacts').select('lead_score').eq('id', contactId).maybeSingle(), 'incrementLeadScore.read');
    const next = Math.min((current?.lead_score || 0) + increment, 100);
    await rq(() => supabase.from('contacts').update({ lead_score: next }).eq('id', contactId), 'incrementLeadScore.write');
    return next;
  } catch (err) {
    reportError('contactsService', 'incrementLeadScore', err);
    throw err;
  }
}

export async function recordAssignment(contactId, { fromAgent, toAgent, assignedBy, notes = '' }) {
  const entry = {
    from: fromAgent || null,
    to: toAgent,
    by: assignedBy,
    notes,
    at: new Date().toISOString(),
  };
  // Persist to Supabase (fire-and-forget). Report both Supabase {error}
  // responses (RLS, schema) and promise rejections (network) — earlier
  // versions only caught the latter, so RLS denials disappeared silently.
  supabase.from('activities').insert([{
    type: 'reassignment',
    entity_type: 'contact',
    contact_id: contactId,
    notes: `${fromAgent || '—'} → ${toAgent}${notes ? ': ' + notes : ''}`,
    user_id: null,
    user_name_en: assignedBy || null,
    status: 'completed',
    created_at: entry.at,
  }])
    .then(({ error }) => { if (error) reportError('contactsService', 'recordAssignment', error); })
    .catch((err) => { reportError('contactsService', 'recordAssignment', err); });
  // Update assigned_at timestamp. Best-effort, but at least surface failures
  // for monitoring instead of swallowing them silently.
  supabase.from('contacts').update({ assigned_at: entry.at }).eq('id', contactId)
    .then(({ error }) => { if (error) reportError('contactsService', 'recordAssignment.updateAssignedAt', error); })
    .catch(err => reportError('contactsService', 'recordAssignment.updateAssignedAt', err));
  return entry;
}

export async function fetchContacts({ role, userId, teamId, filters = {}, page, pageSize, sortBy }) {
  const isServerPaginated = typeof page === 'number' && typeof pageSize === 'number';
  try {
    // Map sortBy to Supabase column + direction
    const SORT_MAP = {
      created:       { column: 'created_at',       ascending: false },
      assigned:      { column: 'assigned_at',      ascending: false },
      last_activity: { column: 'last_activity_at', ascending: false },
      score:         { column: 'lead_score',        ascending: false },
      name:          { column: 'full_name',         ascending: true },
      stale:         { column: 'last_activity_at',  ascending: true },
    };
    const sort = SORT_MAP[sortBy] || SORT_MAP.created;
    let query = supabase
      .from('contacts')
      .select('*', isServerPaginated ? { count: 'exact' } : {})
      .or('is_deleted.is.null,is_deleted.eq.false')
      // nullsLast keeps NULL rows at the bottom regardless of sort direction
      // — without it, server pagination flips NULLs between pages and rows
      // appear / disappear when scrolling. The id tiebreaker after the
      // primary key gives a deterministic order so two rows with the same
      // sort value (or both NULL) always sort the same way across pages.
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .order('id', { ascending: true });

    // Role-based filtering. RLS already restricts which contacts each role
    // sees (own + team via get_team_member_names), so the heavy lifting is
    // server-side. We only add a narrow client-side filter for sales_agent
    // because it's a single, indexable @> check. For team_leader /
    // sales_manager / sales_director we DON'T add a client OR clause —
    // PostgREST 500'd when 6+ assigned_to_names.cs.[...] conditions were
    // OR'd together, and the RLS policy already returns the right rows.
    if (role === 'sales_agent' && userId) {
      // After Phase 1 (single-assignment), filter by UUID directly — much
      // faster than jsonb @> and avoids 500s when combined with other filters.
      query = query.eq('assigned_to', userId);
    }
    // For managers/leaders/director/admin/operations: rely on RLS.

    if (filters.search) {
      const s = filters.search.replace(/[%_\\'"(),.*+?^${}|[\]]/g, '');
      if (s.length > 0) {
        // For phone search: normalize so "01012345678", "1012345678", and
        // "+201012345678" all match the same row. Strip non-digits, drop a
        // leading 20 (country code), drop a leading 0, then ILIKE on the
        // resulting tail. Egyptian mobile numbers are 10 digits without
        // country code or leading 0.
        const isPhone = /^\d+$/.test(s) || s.startsWith('+');
        if (isPhone) {
          let digits = s.replace(/\D/g, '');
          if (digits.startsWith('0020')) digits = digits.slice(4);
          else if (digits.startsWith('20') && digits.length >= 11) digits = digits.slice(2);
          if (digits.startsWith('0')) digits = digits.slice(1);
          // Use last 9 of the normalized number — 9 digits is enough to
          // disambiguate without false negatives if the trailing portion
          // is what's stored.
          const tail = digits.length >= 9 ? digits.slice(-9) : digits;
          query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${tail}%,phone2.ilike.%${tail}%,email.ilike.%${s}%`);
        } else {
          query = query.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,campaign_name.ilike.%${s}%,notes.ilike.%${s}%,company.ilike.%${s}%`);
        }
      }
    }
    if (filters.contact_type) query = query.eq('contact_type', filters.contact_type);
    if (filters.source) {
      const srcValues = Array.isArray(filters.source) ? filters.source.filter(Boolean) : [filters.source];
      if (srcValues.length > 0) {
        if (filters.source_not) {
          // is_not / not_in
          if (srcValues.length === 1) query = query.neq('source', srcValues[0]);
          else query = query.not('source', 'in', `(${srcValues.map(v => `"${v}"`).join(',')})`);
        } else {
          // is / in
          if (srcValues.length === 1) query = query.eq('source', srcValues[0]);
          else query = query.in('source', srcValues);
        }
      }
    }
    if (filters.temperature) {
      // Single-assignment now — temperature is the single source of truth.
      query = query.eq('temperature', filters.temperature);
    }
    if (filters.showBlacklisted === false) query = query.eq('is_blacklisted', false);
    if (filters.showBlacklisted === true) query = query.eq('is_blacklisted', true);
    if (filters.department) query = query.eq('department', filters.department);
    // Unassigned: prefer UUID is null (fast, indexed) — also keep text fallback
    // for legacy rows that haven't been backfilled. Dropped the jsonb array
    // check because it was the slowest path and triggered 500s combined with
    // other filters.
    if (filters.unassigned) query = query.or('assigned_to.is.null,assigned_to_name.is.null,assigned_to_name.eq.');
    if (filters.contactIds?.length) {
      // Defensive: strip non-UUID values (e.g. legacy 'none' sentinel) so
      // PostgREST doesn't reject the request with 400 on contacts.id (uuid).
      const validIds = filters.contactIds.filter(v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
      if (validIds.length) {
        query = query.in('id', validIds.slice(0, 300));
      } else {
        // Caller asked for an empty/invalid set — short-circuit to no rows
        // by filtering on a never-matching uuid.
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    if (filters.excludeContactIds?.length && filters.excludeContactIds[0] !== 'none') {
      const excludeBatch = filters.excludeContactIds.slice(0, 500);
      query = query.not('id', 'in', `(${excludeBatch.join(',')})`);
    }
    if (filters.contact_status) {
      // Supports is / is_not / in / not_in. Single value vs array shape is
      // handled here; the boolean *_not flag covers the negation regardless
      // of single/multi.
      const statusValues = Array.isArray(filters.contact_status)
        ? filters.contact_status.filter(Boolean)
        : [filters.contact_status];
      if (statusValues.length > 0) {
        // Single-assignment now — contact_status is authoritative regardless
        // of which agent the filter is asking about.
        const isNot = !!filters.contact_status_not;
        if (isNot) {
          if (statusValues.length === 1) query = query.neq('contact_status', statusValues[0]);
          else query = query.not('contact_status', 'in', `(${statusValues.map(v => `"${v}"`).join(',')})`);
        } else {
          if (statusValues.length === 1) query = query.eq('contact_status', statusValues[0]);
          else query = query.in('contact_status', statusValues);
        }
      }
    }
    if (filters.assigned_to_name) {
      // Handle both single-value (is/is_not) and multi-value (in/not_in) operators.
      const agentValues = Array.isArray(filters.assigned_to_name)
        ? filters.assigned_to_name.filter(Boolean)
        : [filters.assigned_to_name];
      if (agentValues.length > 0) {
        if (filters.assigned_to_name_not) {
          // is_not / not_in: exclude any contact that has any of these agents.
          // Each .not() chains as an AND, which is exactly the "none of" semantic.
          // After Phase 1: filter by singular assigned_to_name (text) — faster
          // and avoids jsonb @> overhead. Replaces the old cs.[name] pattern.
          agentValues.forEach(v => {
            query = query.neq('assigned_to_name', v);
          });
        } else if (agentValues.length === 1) {
          query = query.eq('assigned_to_name', agentValues[0]);
        } else {
          query = query.in('assigned_to_name', agentValues);
        }
      }
    }
    // Activity indicator filter (based on last_activity_at)
    if (filters.activityFilter) {
      const now = Date.now();
      const activeDays = (filters.activityActiveDays || 3) * 86400000;
      const moderateDays = (filters.activityModerateDays || 7) * 86400000;
      if (filters.activityFilter === 'active_3d') {
        query = query.gte('last_activity_at', new Date(now - activeDays).toISOString());
      } else if (filters.activityFilter === 'moderate_7d') {
        query = query.gte('last_activity_at', new Date(now - moderateDays).toISOString()).lt('last_activity_at', new Date(now - activeDays).toISOString());
      } else if (filters.activityFilter === 'stale') {
        query = query.lt('last_activity_at', new Date(now - moderateDays).toISOString());
      } else if (filters.activityFilter === 'never') {
        query = query.is('last_activity_at', null);
      }
    }
    // Date range filter (created_at)
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom + 'T00:00:00');
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');
    // Server-side smart filters
    if (filters.smartName) query = query.ilike('full_name', `%${filters.smartName}%`);
    if (filters.smartEmail) query = query.ilike('email', `%${filters.smartEmail}%`);
    if (filters.smartPhone) {
      const digits = filters.smartPhone.replace(/\D/g, '');
      const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
      query = query.ilike('phone', `%${last9}%`);
    }
    if (filters.smartCampaign) query = query.ilike('campaign_name', `%${filters.smartCampaign}%`);
    if (filters.smartCreatedAt) {
      const { operator, value } = filters.smartCreatedAt;
      const now = new Date();
      if (operator === 'is') query = query.gte('created_at', value + 'T00:00:00').lte('created_at', value + 'T23:59:59');
      else if (operator === 'before') query = query.lt('created_at', value + 'T00:00:00');
      else if (operator === 'after') query = query.gt('created_at', value + 'T23:59:59');
      else if (operator === 'last_7') query = query.gte('created_at', new Date(now - 7 * 86400000).toISOString());
      else if (operator === 'last_30') query = query.gte('created_at', new Date(now - 30 * 86400000).toISOString());
      else if (operator === 'this_month') query = query.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    }

    if (isServerPaginated) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
      const { data, error, count } = await rq(() => query, 'fetchContacts.paginated');
      if (error) throw error;
      (data || []).forEach(c => {
        if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
        if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
      });
      return { data: data || [], count: count || 0 };
    }

    // Non-paginated: fetch first 1000 only (role filters applied on initial query)
    query = query.range(0, 999);
    const { data: allBatch, error: batchErr } = await rq(() => query, 'fetchContacts.full');
    if (batchErr) throw batchErr;
    const allData = allBatch || [];
    // Ensure array fields are never null (prevents .map() crashes)
    allData.forEach(c => {
      if (!Array.isArray(c.campaign_interactions)) c.campaign_interactions = [];
      if (!Array.isArray(c.extra_phones)) c.extra_phones = [];
    });
    return allData;
  } catch (err) {
    reportError('contactsService', 'fetchContacts', err);
    return isServerPaginated ? { data: [], count: 0 } : [];
  }
}

export async function createContact(contactData) {
  // Reject before we touch the DB if the caller doesn't have any contact-edit
  // permission. Defense in depth — the UI gate plus this guard plus DB RLS.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN], 'Not allowed to create contacts');
  // Input validation
  if (!contactData.phone || String(contactData.phone).replace(/\D/g, '').length < 8) {
    throw new Error('Invalid phone number');
  }
  if (contactData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactData.email)) {
    throw new Error('Invalid email format');
  }
  if (!contactData.department) {
    throw new Error('Department is required');
  }
  // Sanitize string fields to prevent XSS + remove internal fields + convert empty strings to null
  const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>|javascript\s*:|on\w+\s*=|data\s*:/gi, '').trim() : v;
  const INTERNAL_FIELDS = ['_customFieldValues', '_offline', '_campaign_count', '_country', '_opp_count', '_aging_level', 'countryCode', 'country'];
  const sanitized = {};
  for (const [k, v] of Object.entries(contactData)) {
    if (INTERNAL_FIELDS.includes(k)) continue;
    const val = sanitize(v);
    // Convert empty strings to null (Supabase rejects '' for date/number columns)
    sanitized[k] = val === '' ? null : val;
  }

  // Drop blank entries from extra_phones — the form lets users add a row
  // and leave it empty, which would persist as "" in the array and break
  // dedup/match queries.
  if (Array.isArray(sanitized.extra_phones)) {
    sanitized.extra_phones = sanitized.extra_phones
      .map(p => (typeof p === 'string' ? p.trim() : p))
      .filter(p => p && String(p).trim().length > 0);
  }

  // Remove non-UUID id (local temp IDs)
  if (sanitized.id && !sanitized.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    delete sanitized.id;
  }

  // Stamp assigned_at on initial creation if the contact is already assigned to someone.
  // This keeps "Sort: Assignment Date" meaningful for brand-new contacts too.
  if (!sanitized.assigned_at) {
    const hasAssignee = sanitized.assigned_to_name || (Array.isArray(sanitized.assigned_to_names) && sanitized.assigned_to_names.length > 0);
    if (hasAssignee) sanitized.assigned_at = new Date().toISOString();
  }

  // Mirror updateContact's resolver: when a caller passes assigned_to_name
  // without the UUID, look it up so the row isn't created with a name that
  // doesn't match its assigned_to. The DB trigger that resyncs name from
  // UUID would otherwise wipe the name on the very next update.
  if ('assigned_to_name' in sanitized && !('assigned_to' in sanitized)) {
    const newName = sanitized.assigned_to_name;
    if (newName) {
      try {
        const { data: u } = await supabase
          .from('users')
          .select('id')
          .or(`full_name_en.eq.${newName},full_name_ar.eq.${newName}`)
          .limit(1)
          .maybeSingle();
        if (u?.id) sanitized.assigned_to = u.id;
      } catch (lookupErr) {
        if (import.meta.env.DEV) console.warn('[createContact] could not resolve assigned_to_name to uuid:', newName, lookupErr);
      }
    }
  }

  try {
    const { data, error } = await supabase
      .from('contacts')
      .insert([stripInternalFields({ ...sanitized }, { table: 'contacts' })])
      .select('*')
      .single();
    if (error) {
      if (import.meta.env.DEV) console.error('[createContact] Supabase error:', error.message, error.details, error.hint);
      throw error;
    }
    // Auto-generate contact_number using timestamp + random suffix.
    // Timestamp-only suffix collided under parallel imports (two rows in the
    // same millisecond got the same number); 4 random base-36 chars give
    // ~1.7M unique combos per ms.
    if (!data.contact_number) {
      const ts = Date.now().toString(36).toUpperCase();
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
      const num = `C-${ts}-${rand}`;
      // Don't blindly mirror the value into the local object — if the update
      // fails (network blip, RLS), we'd return a contact whose in-memory
      // contact_number doesn't exist in the DB, hiding the failure from
      // every downstream caller. Use the rq() helper so we get the same
      // retry policy the rest of the service uses.
      const { error: numErr } = await rq(
        () => supabase.from('contacts').update({ contact_number: num }).eq('id', data.id),
        'createContact.assignNumber'
      );
      if (!numErr) {
        data.contact_number = num;
      } else {
        reportError('contactsService', 'createContact.assignNumber', numErr);
      }
    }
    logCreate('contact', data.id, data);
    return data;
  } catch (err) {
    reportError('contactsService', 'createContact', err);
    throw err;
  }
}

export async function updateContact(id, updates, lastKnownUpdatedAt) {
  // Block direct service calls without an edit permission. RLS is the
  // ultimate authority, but rejecting here gives a clean error message
  // instead of an opaque PostgREST one and avoids the round-trip.
  requireAnyPerm([P.CONTACTS_EDIT, P.CONTACTS_EDIT_OWN], 'Not allowed to update contacts');
  // Remove computed/internal fields that don't exist in Supabase
  const { _campaign_count, _country, _opp_count, _aging_level, _offline, _lastNote, _feedback, _triggerEdit, opportunities, ...cleanUpdates } = updates;
  if (import.meta.env.DEV) {
    const stripped = stripInternalFields({ ...cleanUpdates });
    console.log('[updateContact] id:', id, 'fields:', Object.keys(stripped));
  }
  try {
    // Check for conflicts before saving (optimistic locking)
    if (lastKnownUpdatedAt) {
      const { checkConflict } = await import('../utils/optimisticLock');
      const conflict = await checkConflict('contacts', id, lastKnownUpdatedAt);
      if (conflict) {
        const err = new Error(conflict.message_en);
        err.conflict = conflict;
        throw err;
      }
    }
    const { data: oldData } = await rq(() => supabase.from('contacts').select('*').eq('id', id).single(), 'updateContact.read');
    // Convert empty strings to null (Supabase rejects '' for date/number columns)
    const sanitized = {};
    for (const [k, v] of Object.entries(cleanUpdates)) {
      sanitized[k] = v === '' ? null : v;
    }
    // Drop blank entries from extra_phones (mirror createContact).
    if (Array.isArray(sanitized.extra_phones)) {
      sanitized.extra_phones = sanitized.extra_phones
        .map(p => (typeof p === 'string' ? p.trim() : p))
        .filter(p => p && String(p).trim().length > 0);
    }
    // Auto-sync assigned_to_name ↔ assigned_to_names
    if (sanitized.assigned_to_name && !sanitized.assigned_to_names) {
      const existing = oldData?.assigned_to_names || [];
      if (!existing.includes(sanitized.assigned_to_name)) {
        sanitized.assigned_to_names = [sanitized.assigned_to_name];
      }
    }
    if (sanitized.assigned_to_names && !sanitized.assigned_to_name) {
      const names = Array.isArray(sanitized.assigned_to_names) ? sanitized.assigned_to_names.filter(Boolean) : [];
      if (names.length > 0) sanitized.assigned_to_name = names[0];
    }
    // Auto-resolve assigned_to (UUID) from assigned_to_name when the
    // caller passed only the name. RLS on contacts gates SELECT by
    // assigned_to = auth.uid(), so failing to update the UUID alongside
    // the name silently hides the lead from the new owner — they see
    // the toast but the lead never appears in their list. This was
    // the root cause of the 'distributed leads not showing up' bug
    // reported May 3, 2026.
    if ('assigned_to_name' in sanitized && !('assigned_to' in sanitized)) {
      const newName = sanitized.assigned_to_name;
      const oldName = oldData?.assigned_to_name;
      if (newName && newName !== oldName) {
        try {
          const { data: u } = await supabase
            .from('users')
            .select('id')
            .or(`full_name_en.eq.${newName},full_name_ar.eq.${newName}`)
            .limit(1)
            .maybeSingle();
          if (u?.id) sanitized.assigned_to = u.id;
        } catch (lookupErr) {
          // Don't block the update if the name->UUID lookup fails — the
          // name is still authoritative for display, just RLS visibility
          // for the new owner will be broken until they're re-saved.
          if (import.meta.env.DEV) console.warn('[updateContact] could not resolve assigned_to_name to uuid:', newName, lookupErr);
        }
      } else if (newName === null || newName === '') {
        // Explicit unassign — clear the UUID too
        sanitized.assigned_to = null;
      }
    }

    // Refresh assigned_at whenever the assignment actually changes (add/remove/reassign).
    // Skip if the caller already set it (e.g. recordAssignment) and skip if the value
    // is semantically unchanged to avoid noisy timestamp churn.
    const assignmentTouched = 'assigned_to_name' in sanitized || 'assigned_to_names' in sanitized;
    if (assignmentTouched && !('assigned_at' in sanitized)) {
      const oldName = oldData?.assigned_to_name || null;
      const newName = sanitized.assigned_to_name ?? oldName;
      const oldNames = JSON.stringify((oldData?.assigned_to_names || []).slice().sort());
      const newNames = JSON.stringify(((sanitized.assigned_to_names ?? oldData?.assigned_to_names) || []).slice().sort());
      if (oldName !== newName || oldNames !== newNames) {
        sanitized.assigned_at = new Date().toISOString();
      }
    }
    const { data, error } = await rq(() => supabase
      .from('contacts')
      .update(stripInternalFields({ ...sanitized, updated_at: new Date().toISOString() }, { table: 'contacts' }))
      .eq('id', id)
      .select('*')
      .single(), 'updateContact.write');
    if (error) throw error;
    logUpdate('contact', id, oldData, data);
    return data;
  } catch (err) {
    throw err;
  }
}

export async function deleteContact(id) {
  // Sales agents have no DELETE permission — even though they have
  // CONTACTS_EDIT_OWN, deletion is reserved for managers/admins/ops.
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to delete contacts');
  try {
    // Soft delete: mark as deleted instead of removing from DB
    // This preserves all data and related records (opportunities, activities, etc.)
    const { data: oldData } = await rq(() => supabase.from('contacts').select('*').eq('id', id).single(), 'deleteContact.read');
    const { error } = await rq(() => supabase.from('contacts').update(softDeleteFields()).eq('id', id), 'deleteContact.write');
    if (error) throw error;
    // Log with full data for recovery
    logAudit({ action: 'delete', entity: 'contact', entityId: id, entityName: oldData?.full_name || '', oldData, description: `Soft deleted contact: ${oldData?.full_name || id}` });
  } catch (err) {
    throw err;
  }
}

export async function restoreContact(id) {
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to restore contacts');
  try {
    // Read the row to check ownership before flipping is_deleted. RLS would
    // hide a contact that ends up with no owner (assigned_to_names empty),
    // so restoring without an assignee leaves the row reachable only by
    // admins. Fall back to created_by_name (the original creator) — and if
    // that's missing too, refuse and let the caller pick an assignee.
    const { data: row } = await rq(
      () => supabase.from('contacts').select('id, assigned_to_name, assigned_to_names, created_by_name').eq('id', id).single(),
      'restoreContact.read'
    );
    const names = Array.isArray(row?.assigned_to_names) ? row.assigned_to_names.filter(Boolean) : [];
    const hasOwner = !!row?.assigned_to_name || names.length > 0;
    const updates = softUndeleteFields();
    if (!hasOwner) {
      const fallback = row?.created_by_name;
      if (!fallback) {
        const err = new Error('Cannot restore: contact has no assignee and no creator on record. Reassign first, then restore.');
        err.code = 'RESTORE_ORPHAN';
        throw err;
      }
      updates.assigned_to_name = fallback;
      updates.assigned_to_names = [fallback];
      updates.assigned_at = new Date().toISOString();
    }
    const { error } = await rq(
      () => supabase.from('contacts').update(updates).eq('id', id),
      'restoreContact.write'
    );
    if (error) throw error;
  } catch (err) {
    throw err;
  }
}

export async function permanentDeleteContact(id) {
  requirePerm(P.CONTACTS_DELETE, 'Not allowed to permanently delete contacts');
  // Atomic delete via RPC — all related rows + contact succeed or rollback together.
  // See supabase/migrations/permanent_delete_contact_rpc.sql
  const { error } = await rq(() => supabase.rpc('permanent_delete_contact', { p_contact_id: id }), 'permanentDeleteContact');
  if (error) throw error;
}

export async function blacklistContact(id, reason) {
  return updateContact(id, { is_blacklisted: true, blacklist_reason: reason });
}

/**
 * Strip all non-digit characters and compare last 9 digits.
 * 9 digits covers the local number without country code for most regions.
 */
function fuzzyPhoneMatch(stored, input) {
  if (!stored || !input) return false;
  const a = stored.replace(/\D/g, '');
  const b = input.replace(/\D/g, '');
  if (a.length < 9 || b.length < 9) return a === b;
  return a.slice(-9) === b.slice(-9);
}

/** Normalize phone: convert leading 00 to +, and Egyptian 01x to +201x */
function normalizePhoneLocal(p) {
  if (!p) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0') && p.length === 11 && p.startsWith('01')) return '+20' + p.slice(1);
  return p;
}

export async function checkDuplicate(phone) {
  const normalized = normalizePhoneLocal(phone);
  const digits = normalized ? normalized.replace(/\D/g, '') : '';
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits;

  try {
    const { data } = await rq(() => supabase
      .from('contacts')
      .select('id, full_name, phone, phone2, extra_phones, contact_type')
      .or(`phone.eq.${normalized.replace(/[^+\d]/g, '')},phone.ilike.%${last9.replace(/\D/g, '')},phone2.eq.${normalized.replace(/[^+\d]/g, '')},phone2.ilike.%${last9.replace(/\D/g, '')},extra_phones.ilike.%${last9.replace(/\D/g, '')}`)
      .limit(1)
      .maybeSingle(), 'checkDuplicate');
    if (data) return data;
  } catch (err) {
    reportError('contactsService', 'checkDuplicate', err);
  }

  return null;
}

/**
 * Bulk-distribute leads — compete model. For EVERY (contact × agent)
 * pair this creates a fresh clone of the contact assigned to that
 * agent. The original contact stays where it was — no ownership is
 * transferred. Use this when you want N agents to all try the same
 * batch of leads in parallel and the fastest closer wins.
 *
 * For "fair allocation that transfers ownership" (one lead → one
 * agent, split evenly), use the bulk Reassign flow instead. The old
 * round_robin/workload methods on this function were removed because
 * they performed Reassign semantics under a name that suggested
 * cloning — the duplication caused confusion in the field.
 *
 * Returns { applied, errors, totalPairs }
 */
export async function bulkDistributeLeads(contactIds, agentIds) {
  requireAnyPerm([P.CONTACTS_BULK, P.CONTACTS_EDIT], 'Not allowed to bulk distribute');
  if (!Array.isArray(contactIds) || contactIds.length === 0) throw new Error('No contacts');
  if (!Array.isArray(agentIds) || agentIds.length === 0) throw new Error('No agents');

  // Validate agents are active before we burn API calls cloning to them
  const { data: agents, error: aErr } = await rq(() =>
    supabase.from('users').select('id, status').in('id', agentIds), 'bulkDistribute.agents');
  if (aErr) throw aErr;
  const activeIds = (agents || []).filter(a => a.status !== 'inactive').map(a => a.id);
  if (activeIds.length === 0) throw new Error('No active agents in selection');

  // For each contact, clone to every selected (active) agent. Reuses the
  // single-contact distributeLeadToAgents path so clone shape, audit log,
  // and contact_number suffixing all stay consistent with the per-drawer
  // 'Distribute (compete)' tool.
  let applied = 0;
  const errors = [];
  for (const cid of contactIds) {
    try {
      const { created, errors: cloneErrors } = await distributeLeadToAgents(cid, activeIds);
      applied += created.length;
      cloneErrors.forEach(e => errors.push({ contactId: cid, ...e }));
    } catch (err) {
      errors.push({ contactId: cid, error: err.message });
    }
  }
  return { applied, errors, totalPairs: contactIds.length * activeIds.length };
}

/**
 * Hand off a single lead to another agent. Unlike distributeLeadToAgents
 * (which clones), this transfers ownership of the SAME record. The previous
 * owner loses it from their pipeline. Use this when a manager/operations
 * user receives a lead they don't intend to work and needs to route to a
 * sales agent.
 */
export async function handOffLead(contactId, toUserId, options = {}) {
  requireAnyPerm([P.CONTACTS_BULK, P.CONTACTS_EDIT], 'Not allowed to hand off leads');
  if (!contactId || !toUserId) throw new Error('contactId and toUserId required');

  // Resolve target user
  const { data: user, error: userErr } = await rq(() =>
    supabase.from('users').select('id, full_name_en, full_name_ar, status').eq('id', toUserId).single(), 'handOffLead.fetchUser');
  if (userErr || !user) throw new Error('Target user not found');
  if (user.status !== 'active') throw new Error('Target user is not active');

  const targetName = user.full_name_en || user.full_name_ar;
  if (!targetName) throw new Error('Target user has no name');

  // Fetch current contact to capture before-state for audit
  const { data: before, error: cErr } = await rq(() =>
    supabase.from('contacts').select('id, assigned_to, assigned_to_name').eq('id', contactId).single(), 'handOffLead.fetchContact');
  if (cErr || !before) throw new Error('Contact not found');

  // Single-assignment now after Phase 1 — the operational maps should hold
  // exactly one entry. Reset them for the new owner with fresh state, but
  // preserve the existing contact_status/temperature/lead_score (the work
  // history doesn't reset on hand-off — that would lose context).
  const updates = {
    assigned_to: toUserId,
    assigned_to_name: targetName,
    assigned_to_names: [targetName],
    assigned_at: new Date().toISOString(),
    assigned_by_name: options.assignedByName || null,
  };

  const { data, error } = await rq(() =>
    supabase.from('contacts').update(updates).eq('id', contactId).select('*').single(), 'handOffLead.update');
  if (error) throw error;

  // Audit log entry — captures the hand-off explicitly. logAudit takes
  // a single object (action / entity / entityId destructured) — the prior
  // positional call silently wrote a row with action=undefined that never
  // showed up in the timeline.
  logAudit({
    action: 'hand_off',
    entity: 'contact',
    entityId: contactId,
    entityName: data?.full_name || '',
    oldData: { assigned_to: before.assigned_to, assigned_to_name: before.assigned_to_name },
    newData: { assigned_to: toUserId, assigned_to_name: targetName },
    description: `Handed off ${data?.full_name || 'contact'} from ${before.assigned_to_name || '—'} to ${targetName}${options.assignedByName ? ' by ' + options.assignedByName : ''}`,
    userName: options.assignedByName || '',
  });

  // Also record the assignment as an activity row so it shows up in the
  // contact's timeline alongside calls/notes (the audit log is for the
  // settings page; activities feed the drawer). Fire-and-forget — the
  // service handles its own error reporting.
  recordAssignment(contactId, {
    fromAgent: before.assigned_to_name,
    toAgent: targetName,
    assignedBy: options.assignedByName || '',
  });

  return data;
}

/**
 * Distribute an existing lead to additional agents by creating clones.
 * Each clone inherits personal data (name, phone, source, campaign) but
 * starts with fresh operational state (status=new, temp=cold, score=0).
 * Used by the admin "Distribute Lead" tool — Phase 5 of UUID migration.
 */
export async function distributeLeadToAgents(originContactId, targetUserIds) {
  requireAnyPerm([P.CONTACTS_BULK, P.CONTACTS_EDIT], 'Not allowed to distribute leads');
  if (!originContactId || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
    throw new Error('originContactId and targetUserIds are required');
  }

  // Fetch origin
  const { data: origin, error: originErr } = await rq(() =>
    supabase.from('contacts').select('*').eq('id', originContactId).single(), 'distributeLead.fetchOrigin');
  if (originErr || !origin) throw new Error('Origin contact not found');

  // Fetch target users
  const { data: users, error: usersErr } = await rq(() =>
    supabase.from('users').select('id, full_name_en, full_name_ar').in('id', targetUserIds), 'distributeLead.fetchUsers');
  if (usersErr) throw usersErr;
  const usersById = Object.fromEntries((users || []).map(u => [u.id, u]));

  const created = [];
  const errors = [];

  for (let i = 0; i < targetUserIds.length; i++) {
    const userId = targetUserIds[i];
    const user = usersById[userId];
    if (!user) { errors.push({ userId, error: 'User not found' }); continue; }
    const name = user.full_name_en || user.full_name_ar;

    const clone = {
      // Personal — inherited from origin
      full_name: origin.full_name,
      phone: origin.phone,
      phone2: origin.phone2,
      email: origin.email,
      contact_type: origin.contact_type,
      source: origin.source,
      department: origin.department,
      platform: origin.platform,
      campaign_name: origin.campaign_name,
      campaign_id: origin.campaign_id,
      campaign_interactions: origin.campaign_interactions,
      preferred_location: origin.preferred_location,
      interested_in_type: origin.interested_in_type,
      budget_min: origin.budget_min,
      budget_max: origin.budget_max,
      company: origin.company,
      job_title: origin.job_title,
      gender: origin.gender,
      nationality: origin.nationality,
      birth_date: origin.birth_date,
      prefix: origin.prefix,
      extra_phones: origin.extra_phones,
      referred_by: origin.referred_by,
      // Fresh operational state
      contact_status: 'new',
      temperature: 'cold',
      lead_score: 0,
      assigned_to_name: name,
      assigned_to: userId,
      assigned_to_names: [name],
      assigned_at: new Date().toISOString(),
      contact_number: origin.contact_number ? `${origin.contact_number}-D${i + 1}` : null,
    };

    try {
      const { data, error } = await supabase.from('contacts').insert(clone).select('id, contact_number').single();
      if (error) throw error;
      created.push({ ...data, user_id: userId, name });
      // Audit log — logAudit takes a single object (not positional args).
      logAudit({
        action: 'distribute',
        entity: 'contact',
        entityId: data.id,
        entityName: origin.full_name || '',
        newData: { from_origin: originContactId, to_user_id: userId, to_user_name: name },
        description: `Distributed ${origin.full_name || 'contact'} clone to ${name}`,
      });
    } catch (err) {
      errors.push({ userId, name, error: err.message });
    }
  }

  return { created, errors };
}

/**
 * Disqualify other records sharing a phone after a deal is won.
 * Used by the "Pull leads from other agents" cleanup after closing a deal.
 */
export async function pullLeadsAfterDealWon(wonContactId, winnerName) {
  requireAnyPerm([P.CONTACTS_EDIT], 'Not allowed to pull leads');
  const { data: won, error: wonErr } = await rq(() =>
    supabase.from('contacts').select('phone').eq('id', wonContactId).single(), 'pullLeads.fetchWon');
  if (wonErr || !won?.phone) throw new Error('Won contact not found');

  const others = await fetchContactsByPhone(won.phone);
  const toUpdate = others.filter(c =>
    c.id !== wonContactId &&
    !c.is_deleted &&
    c.contact_status !== 'disqualified'
  );

  const reason = `Deal won by ${winnerName || 'another agent'}`;
  const updates = await Promise.allSettled(toUpdate.map(c =>
    supabase.from('contacts').update({
      contact_status: 'disqualified',
      disqualify_reason: 'won_by_other_agent',
      disqualify_note: reason,
    }).eq('id', c.id)
  ));

  // Supabase resolves with { error: ... } instead of throwing — checking only
  // `status === 'fulfilled'` would count permission/RLS failures as successes.
  const successes = updates.filter(r => r.status === 'fulfilled' && !r.value?.error).length;
  const failures = updates.length - successes;
  return { total: toUpdate.length, successes, failures, contacts: toUpdate };
}

/**
 * Master Profile: fetch all contact records sharing the same phone number.
 * Used by /contacts/master/:phone to aggregate cross-agent view.
 * Admin/operations only via permission gate at the route level.
 */
export async function fetchContactsByPhone(phone) {
  requireAnyPerm([P.CONTACTS_VIEW_ALL], 'Not allowed to view master profile');
  if (!phone) return [];
  const normalized = normalizePhoneLocal(phone);
  const digits = normalized.replace(/\D/g, '');
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits;
  try {
    const { data, error } = await rq(() => supabase
      .from('contacts')
      .select('*')
      .or(`phone.eq.${normalized},phone.ilike.%${last9},phone2.eq.${normalized},phone2.ilike.%${last9}`)
      .order('created_at', { ascending: false }), 'fetchContactsByPhone');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactsByPhone', err);
    return [];
  }
}

/**
 * Fetch combined activity timeline for all records sharing a phone.
 * Returns activities sorted chronologically (newest first).
 */
export async function fetchMasterProfileTimeline(contactIds) {
  requireAnyPerm([P.CONTACTS_VIEW_ALL], 'Not allowed to view master profile');
  if (!Array.isArray(contactIds) || contactIds.length === 0) return [];
  try {
    const { data, error } = await rq(() => supabase
      .from('activities')
      .select('*')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(500), 'fetchMasterProfileTimeline');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchMasterProfileTimeline', err);
    return [];
  }
}

/**
 * Fetch deals on records sharing a phone.
 * Used by Master Profile to show "won by X" indicator.
 */
export async function fetchMasterProfileDeals(contactIds) {
  requireAnyPerm([P.CONTACTS_VIEW_ALL], 'Not allowed to view master profile');
  if (!Array.isArray(contactIds) || contactIds.length === 0) return [];
  try {
    const { data, error } = await rq(() => supabase
      .from('deals')
      .select('id, deal_number, contact_id, agent_en, agent_ar, deal_value, status, created_at')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false }), 'fetchMasterProfileDeals');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchMasterProfileDeals', err);
    return [];
  }
}

export async function fetchContactActivities(contactId, { role, userId, teamId } = {}) {
  try {
    // Embed the from/to users via the FK columns so the drawer can render
    // current names instead of the (rename-stale) text in `notes`. We fetch
    // activities first, then resolve the user IDs in a separate query — this
    // avoids relying on PostgREST embed inference for FKs that may not have
    // been picked up by the schema cache yet (we got a "Server connection
    // failed" error in production from the `users:user_id(...)` syntax).
    const { data: activities, error } = await rq(() => supabase
      .from('activities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50), 'fetchContactActivities');
    if (error) throw error;
    if (!activities?.length) return [];

    // Collect every UUID we want to resolve in one batched lookup
    const userIds = new Set();
    for (const a of activities) {
      if (a.user_id) userIds.add(a.user_id);
      if (a.from_user_id) userIds.add(a.from_user_id);
      if (a.to_user_id) userIds.add(a.to_user_id);
    }

    let userMap = {};
    if (userIds.size > 0) {
      try {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name_en, full_name_ar')
          .in('id', [...userIds]);
        userMap = Object.fromEntries((users || []).map(u => [u.id, u]));
      } catch (lookupErr) {
        if (import.meta.env.DEV) console.warn('[fetchContactActivities] user resolve failed', lookupErr);
      }
    }

    return activities.map(a => ({
      ...a,
      users:     a.user_id      ? userMap[a.user_id]      : null,
      from_user: a.from_user_id ? userMap[a.from_user_id] : null,
      to_user:   a.to_user_id   ? userMap[a.to_user_id]   : null,
    }));
  } catch (err) {
    reportError('contactsService', 'fetchContactActivities', err);
    return [];
  }
}

export async function createActivity(activityData) {
  // Clean: convert empty strings to null (Supabase rejects '' for date/number columns)
  const cleaned = {};
  for (const [k, v] of Object.entries(activityData)) {
    cleaned[k] = v === '' ? null : v;
  }
  // Try Supabase FIRST — source of truth
  try {
    const { data, error } = await supabase
      .from('activities')
      .insert([stripInternalFields(cleaned)])
      .select('*')
      .single();
    if (error) throw error;
    // Update contact last_activity_at
    if (activityData.contact_id) {
      await supabase.from('contacts').update({ last_activity_at: new Date().toISOString() }).eq('id', activityData.contact_id);
      // Auto-complete matching pending tasks for this contact + agent + type
      const actType = activityData.type;
      const agentId = activityData.user_id;
      if (actType && agentId) {
        const matchTypes = actType === 'call' ? ['call', 'followup'] : [actType];
        try {
          await supabase.from('tasks')
            .update({ status: 'done', completed_at: new Date().toISOString() })
            .eq('contact_id', activityData.contact_id)
            .eq('assigned_to', agentId)
            .eq('status', 'pending')
            .in('type', matchTypes)
            .lte('due_date', new Date().toISOString());
        } catch {}
      }
    }
    return data;
  } catch (err) {
    reportError('contactsService', 'createActivity', err);
    throw err;
  }
}

export async function updateActivity(id, updates) {
  try {
    const { data, error } = await rq(() => supabase
      .from('activities')
      .update(stripInternalFields(updates))
      .eq('id', id)
      .select('*')
      .single(), 'updateActivity');
    if (error) throw error;
    return data;
  } catch (err) {
    reportError('contactsService', 'updateActivity', err);
    throw err;
  }
}

export async function fetchContactOpportunities(contactId, { role, userId, teamId } = {}) {
  try {
    let query = supabase
      .from('opportunities')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    // Role-based filtering — filter by name (not UUID) since imported opps may lack assigned_to UUID
    if (role === 'sales_agent' && userId) {
      const { data: agentUser } = await supabase.from('users').select('full_name_en').eq('id', userId).maybeSingle();
      if (agentUser?.full_name_en) {
        query = query.eq('assigned_to_name', agentUser.full_name_en);
      } else {
        query = query.eq('assigned_to', userId);
      }
    } else if ((role === 'team_leader' || role === 'sales_manager') && teamId) {
      const names = await getTeamMemberNames(role, teamId);
      if (names.length) query = query.in('assigned_to_name', names);
    }
    const { data, error } = await rq(() => query, 'fetchContactOpportunities');
    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('contactsService', 'fetchContactOpportunities', err);
    return [];
  }
}
