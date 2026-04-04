// TODO: Migrate to Supabase — currently reads CRM data from localStorage keys
import { syncToSupabase } from '../utils/supabaseSync';
/**
 * Smart Suggestions / AI Insights Engine
 * Analyzes CRM data and generates actionable insights
 */

const DISMISSED_KEY = 'platform_dismissed_suggestions';
const CACHE_KEY = '_suggestions_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function makeSuggestion({ type, priority, title_ar, title_en, description_ar, description_en, action_label_ar, action_label_en, action_path, entity, entity_id }) {
  return {
    id: `${type}_${entity_id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    priority,
    title_ar,
    title_en,
    description_ar,
    description_en,
    action_label_ar,
    action_label_en,
    action_path,
    entity: entity || null,
    entity_id: entity_id || null,
    dismissed: false,
    created_at: new Date().toISOString(),
  };
}

// ── Analyzers ────────────────────────────────────────────────────────────────

function analyzeInactiveContacts(contacts, activities) {
  const suggestions = [];
  const activityByContact = {};
  activities.forEach(a => {
    const cid = a.contact_id;
    if (!cid) return;
    const d = new Date(a.created_at || a.date).getTime();
    if (!activityByContact[cid] || d > activityByContact[cid]) activityByContact[cid] = d;
  });

  contacts.forEach(c => {
    const lastAct = activityByContact[c.id] || (c.last_activity_at ? new Date(c.last_activity_at).getTime() : null);
    if (!lastAct) return;
    const days = Math.floor((Date.now() - lastAct) / 86400000);
    if (days >= 14) {
      const name = c.full_name || c.name || c.full_name_ar || 'Unknown';
      suggestions.push(makeSuggestion({
        type: 'inactive_contact',
        priority: days > 30 ? 'high' : 'medium',
        title_ar: `العميل ${name} مكلمتوش من ${days} يوم`,
        title_en: `${name} hasn't been contacted in ${days} days`,
        description_ar: `آخر تواصل كان من ${days} يوم. حاول تتواصل معاه تاني.`,
        description_en: `Last activity was ${days} days ago. Consider reaching out.`,
        action_label_ar: 'عرض العميل',
        action_label_en: 'View Contact',
        action_path: '/contacts',
        entity: 'contact',
        entity_id: c.id,
      }));
    }
  });
  return suggestions;
}

function analyzeStuckOpportunities(opportunities) {
  const suggestions = [];
  opportunities.forEach(opp => {
    const budget = Number(opp.budget || opp.value || 0);
    if (budget <= 0) return;
    const lastChange = opp.stage_changed_at || opp.updated_at || opp.created_at;
    const days = daysSince(lastChange);
    if (days >= 7 && opp.stage !== 'closed_won' && opp.stage !== 'closed_lost') {
      suggestions.push(makeSuggestion({
        type: 'stuck_opportunity',
        priority: days > 14 ? 'high' : 'medium',
        title_ar: `فرصة بقيمة ${budget.toLocaleString()} متحركتش من ${days} يوم`,
        title_en: `Opportunity worth ${budget.toLocaleString()} stuck for ${days} days`,
        description_ar: `الفرصة في مرحلة "${opp.stage}" ومفيش تحديث من ${days} يوم.`,
        description_en: `Opportunity at "${opp.stage}" stage with no update for ${days} days.`,
        action_label_ar: 'عرض الفرصة',
        action_label_en: 'View Opportunity',
        action_path: '/crm/opportunities',
        entity: 'opportunity',
        entity_id: opp.id,
      }));
    }
  });
  return suggestions;
}

function analyzeOverdueTasks(tasks) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter(t =>
    t.due_date && t.due_date < today &&
    (t.status === 'pending' || t.status === 'in_progress' || t.status === 'todo')
  );
  if (overdue.length === 0) return [];
  return [makeSuggestion({
    type: 'overdue_tasks',
    priority: overdue.length >= 5 ? 'high' : 'medium',
    title_ar: `${overdue.length} مهام متأخرة`,
    title_en: `${overdue.length} overdue tasks`,
    description_ar: `عندك ${overdue.length} مهام فات ميعادها ولسه مخلصتش.`,
    description_en: `You have ${overdue.length} tasks past their due date.`,
    action_label_ar: 'عرض المهام',
    action_label_en: 'View Tasks',
    action_path: '/tasks',
    entity: 'task',
    entity_id: 'overdue',
  })];
}

function analyzeHotLeads(contacts, activities) {
  const suggestions = [];
  const activityByContact = {};
  activities.forEach(a => {
    const cid = a.contact_id;
    if (!cid) return;
    const d = new Date(a.created_at || a.date).getTime();
    if (!activityByContact[cid] || d > activityByContact[cid]) activityByContact[cid] = d;
  });

  contacts.forEach(c => {
    if (c.temperature !== 'hot') return;
    const lastAct = activityByContact[c.id] || (c.last_activity_at ? new Date(c.last_activity_at).getTime() : null);
    const days = lastAct ? Math.floor((Date.now() - lastAct) / 86400000) : Infinity;
    if (days >= 3) {
      const name = c.full_name || c.name || c.full_name_ar || 'Unknown';
      suggestions.push(makeSuggestion({
        type: 'hot_lead_no_activity',
        priority: 'high',
        title_ar: `عميل ساخن ${name} محتاج متابعة`,
        title_en: `Hot lead ${name} needs follow-up`,
        description_ar: `العميل مصنف "ساخن" بس مفيش تواصل من ${days === Infinity ? '?' : days} يوم.`,
        description_en: `Contact marked "hot" with no activity for ${days === Infinity ? '?' : days} days.`,
        action_label_ar: 'متابعة العميل',
        action_label_en: 'Follow Up',
        action_path: '/contacts',
        entity: 'contact',
        entity_id: c.id,
      }));
    }
  });
  return suggestions;
}

function analyzeExpiringApprovals(approvals) {
  const pending = approvals.filter(a => a.status === 'pending');
  const old = pending.filter(a => daysSince(a.created_at) >= 3);
  if (old.length === 0) return [];
  return [makeSuggestion({
    type: 'expiring_approvals',
    priority: old.length >= 3 ? 'high' : 'medium',
    title_ar: `${old.length} طلبات موافقة معلقة`,
    title_en: `${old.length} pending approvals waiting`,
    description_ar: `فيه ${old.length} طلبات موافقة مستنية من أكتر من 3 أيام.`,
    description_en: `${old.length} approval requests have been pending for 3+ days.`,
    action_label_ar: 'عرض الطلبات',
    action_label_en: 'View Approvals',
    action_path: '/tasks',
    entity: 'approval',
    entity_id: 'pending',
  })];
}

function analyzeHighValueAtRisk(opportunities) {
  const suggestions = [];
  const earlyStages = ['new', 'qualification', 'qualified', 'lead', 'site_visit_scheduled'];
  opportunities.forEach(opp => {
    const budget = Number(opp.budget || opp.value || 0);
    if (budget <= 100000) return;
    if (!earlyStages.includes(opp.stage)) return;
    const days = daysSince(opp.created_at);
    if (days >= 14) {
      suggestions.push(makeSuggestion({
        type: 'high_value_at_risk',
        priority: 'high',
        title_ar: `فرصة كبيرة محتاجة اهتمام`,
        title_en: `High-value opportunity needs attention`,
        description_ar: `فرصة بقيمة ${budget.toLocaleString()} في مرحلة مبكرة من ${days} يوم.`,
        description_en: `Opportunity worth ${budget.toLocaleString()} at early stage for ${days} days.`,
        action_label_ar: 'عرض الفرصة',
        action_label_en: 'View Opportunity',
        action_path: '/crm/opportunities',
        entity: 'opportunity',
        entity_id: opp.id,
      }));
    }
  });
  return suggestions;
}

function analyzeNoFollowUp(contacts, activities) {
  const suggestions = [];
  const activityByContact = {};
  activities.forEach(a => {
    const cid = a.contact_id;
    if (!cid) return;
    const d = new Date(a.created_at || a.date).getTime();
    if (!activityByContact[cid] || d > activityByContact[cid]) activityByContact[cid] = d;
  });

  contacts.forEach(c => {
    if (c.next_action_date) return; // already has follow-up
    const lastAct = activityByContact[c.id];
    if (!lastAct) return;
    const days = Math.floor((Date.now() - lastAct) / 86400000);
    if (days <= 7 && days >= 0) {
      const name = c.full_name || c.name || c.full_name_ar || 'Unknown';
      suggestions.push(makeSuggestion({
        type: 'no_followup',
        priority: 'low',
        title_ar: `العميل ${name} محتاج جدولة متابعة`,
        title_en: `${name} needs a follow-up scheduled`,
        description_ar: `فيه نشاط أخير بس مفيش تاريخ متابعة محدد.`,
        description_en: `Recent activity exists but no next follow-up date is set.`,
        action_label_ar: 'جدولة متابعة',
        action_label_en: 'Schedule Follow-up',
        action_path: '/contacts',
        entity: 'contact',
        entity_id: c.id,
      }));
    }
  });
  return suggestions;
}

function analyzeWinStreak(opportunities) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const wonThisMonth = opportunities.filter(o =>
    o.stage === 'closed_won' && o.closed_at && o.closed_at >= monthStart
  );
  if (wonThisMonth.length >= 3) {
    return [makeSuggestion({
      type: 'win_streak',
      priority: 'low',
      title_ar: `أداء ممتاز! ${wonThisMonth.length} صفقات هذا الشهر`,
      title_en: `Great performance! ${wonThisMonth.length} deals closed this month`,
      description_ar: `مبروك! قفلت ${wonThisMonth.length} صفقات الشهر ده. كمّل كده!`,
      description_en: `Congratulations! You closed ${wonThisMonth.length} deals this month. Keep it up!`,
      action_label_ar: 'عرض الصفقات',
      action_label_en: 'View Deals',
      action_path: '/sales/deals',
      entity: 'deal',
      entity_id: 'win_streak',
    })];
  }
  return [];
}

// ── Main API ─────────────────────────────────────────────────────────────────

let _cache = null;
let _cacheTime = 0;

export function generateSuggestions(forceRefresh = false) {
  // Return cached if fresh
  if (!forceRefresh && _cache && (Date.now() - _cacheTime) < CACHE_TTL) {
    return _cache;
  }

  const contacts = loadJSON('platform_contacts');
  const opportunities = loadJSON('platform_opportunities');
  const tasks = loadJSON('platform_tasks');
  const activities = loadJSON('platform_activities');
  const approvals = loadJSON('platform_approvals');
  const dismissed = getDismissed();

  let suggestions = [
    ...analyzeInactiveContacts(contacts, activities),
    ...analyzeStuckOpportunities(opportunities),
    ...analyzeOverdueTasks(tasks),
    ...analyzeHotLeads(contacts, activities),
    ...analyzeExpiringApprovals(approvals),
    ...analyzeHighValueAtRisk(opportunities),
    ...analyzeNoFollowUp(contacts, activities),
    ...analyzeWinStreak(opportunities),
  ];

  // Filter dismissed (match by type + entity_id)
  suggestions = suggestions.filter(s => {
    const key = `${s.type}_${s.entity_id}`;
    return !dismissed.includes(key);
  });

  // Sort by priority: high > medium > low
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

  _cache = suggestions;
  _cacheTime = Date.now();
  return suggestions;
}

export function getSuggestionsCount() {
  return generateSuggestions().length;
}

export function dismissSuggestion(suggestion) {
  const key = `${suggestion.type}_${suggestion.entity_id}`;
  const dismissed = getDismissed();
  if (!dismissed.includes(key)) {
    dismissed.push(key);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed)); } catch { /* ignore */ }
  }
  // Invalidate cache
  _cache = null;
}

export function getDismissed() {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; }
}

export function clearDismissed() {
  localStorage.removeItem(DISMISSED_KEY);
  _cache = null;
}
