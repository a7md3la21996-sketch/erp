import { Phone, MessageCircle, Mail, Users as UsersIcon, Clock, Star } from 'lucide-react';

// ─── Temperature Config ───
export const TEMP_CONFIG = {
  hot:  { label_ar: "ساخن", label_en: "Hot",  color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
  warm: { label_ar: "دافئ", label_en: "Warm", color: "#F97316", bg: "rgba(249,115,22,0.10)" },
  cool: { label_ar: "عادي", label_en: "Cool", color: "#8BA8C8", bg: "rgba(139,168,200,0.10)" },
  cold: { label_ar: "بارد", label_en: "Cold", color: "#4A7AAB", bg: "rgba(74,122,171,0.10)" },
};

// ─── Priority Config ───
export const PRIORITY_CONFIG = {
  urgent: { label_ar: "عاجل",  label_en: "Urgent", color: "#EF4444" },
  high:   { label_ar: "عالي",  label_en: "High",   color: "#4A7AAB" },
  medium: { label_ar: "متوسط", label_en: "Medium", color: "#6B8DB5" },
  low:    { label_ar: "منخفض", label_en: "Low",    color: "#8BA8C8" },
};

// ─── Activity Icons ───
export const ACTIVITY_ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: UsersIcon, note: Clock, site_visit: Star };

// ─── Sort Options ───
export const SORT_OPTIONS = {
  newest: { ar: 'الأحدث', en: 'Newest' },
  oldest: { ar: 'الأقدم', en: 'Oldest' },
  budget_high: { ar: 'الميزانية (الأعلى)', en: 'Budget (High)' },
  budget_low: { ar: 'الميزانية (الأقل)', en: 'Budget (Low)' },
  temp_hot: { ar: 'الأسخن', en: 'Hottest' },
  lead_score: { ar: 'درجة العميل', en: 'Lead Score' },
  stale: { ar: 'بدون تواصل', en: 'Stale (No Contact)' },
};

export const TEMP_ORDER = { hot: 0, warm: 1, cool: 2, cold: 3 };

// ─── Stage Win Rates for Weighted Pipeline Forecast ───
export const STAGE_WIN_RATES = {
  new: 0.05, lead: 0.10, contacted: 0.20, qualified: 0.30, interested: 0.40,
  site_visit: 0.50, negotiation: 0.60, proposal: 0.70, closed_won: 1.0, closed_lost: 0,
  screening: 0.15, interview: 0.35, offer: 0.65, hired: 1.0, rejected: 0,
  awareness: 0.10, engagement: 0.25, conversion: 0.50, retention: 0.75,
  planning: 0.15, execution: 0.40, review: 0.60, completed: 1.0, cancelled: 0,
  budgeting: 0.15, approval: 0.40, processing: 0.60, paid: 1.0,
};

// ─── Lead Score calculation ───
export const calcLeadScore = (opp) => {
  let score = 0;
  // Temperature (0-30)
  if (opp.temperature === 'hot') score += 30;
  else if (opp.temperature === 'warm') score += 20;
  else if (opp.temperature === 'cool') score += 10;
  // Budget (0-25)
  const b = opp.budget || 0;
  if (b >= 1000000) score += 25;
  else if (b >= 500000) score += 20;
  else if (b >= 100000) score += 15;
  else if (b > 0) score += 5;
  // Stage progression (0-25)
  const stagePoints = { qualification: 5, site_visit_scheduled: 10, site_visited: 13, proposal: 16, negotiation: 19, reserved: 21, contracted: 23, closed_won: 25 };
  score += stagePoints[opp.stage] || 0;
  // Recency (0-20)
  const days = Math.floor((Date.now() - new Date(opp.updated_at || opp.created_at || 0).getTime()) / 86400000);
  if (days <= 1) score += 20;
  else if (days <= 3) score += 15;
  else if (days <= 7) score += 10;
  else if (days <= 14) score += 5;
  return Math.min(score, 100);
};

export const scoreColor = (s) => s >= 70 ? '#10B981' : s >= 40 ? '#F59E0B' : '#EF4444';
export const scoreLabel = (s, isRTL) => s >= 70 ? (isRTL ? 'ساخن' : 'Hot') : s >= 40 ? (isRTL ? 'دافئ' : 'Warm') : (isRTL ? 'بارد' : 'Cold');

// ─── Budget formatting ───
export const fmtBudget = (n) => { if (!n || n <= 0) return "—"; if (n >= 1000000) return (n / 1000000).toFixed(1) + "M"; if (n >= 1000) return (n / 1000).toFixed(0) + "K"; return n.toLocaleString(); };

// ─── Date helpers ───
export const daysSince = (date) => date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : 999;
export const daysInStage = (opp) => daysSince(opp.stage_changed_at || opp.updated_at || opp.created_at);

// ─── Activity label ───
export const actLabel = (createdAt, isRTL) => {
  if (!createdAt) return { text: '—', color: '#8BA8C8' };
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return { text: isRTL ? "اليوم" : "Today", color: "#4A7AAB" };
  if (days === 1) return { text: isRTL ? "أمس" : "Yesterday", color: "#6B8DB5" };
  if (days <= 3) return { text: days + (isRTL ? "د" : "d"), color: "#8BA8C8" };
  return { text: days + (isRTL ? "د" : "d"), color: "#EF4444" };
};

// ─── Avatar helpers ───
export const initials = (n) => (n || "").trim().split(" ").map(w => w[0]).slice(0, 2).join("") || "?";
export const ACOLORS = ["#1B3347", "#2B4C6F", "#4A7AAB", "#6B8DB5", "#8BA8C8"];
export const avatarColor = (id) => ACOLORS[(id || 0) % ACOLORS.length];

// ─── Display name helpers ───
export const getContactName = (opp) => opp.contacts?.full_name || opp.contact_name || '—';
export const getAgentName = (opp, lang) => {
  if (opp.users) return lang === 'ar' ? opp.users.full_name_ar : (opp.users.full_name_en || opp.users.full_name_ar);
  return opp.agent_name || '—';
};
export const getProjectName = (opp, lang) => {
  if (opp.projects) return lang === 'ar' ? opp.projects.name_ar : (opp.projects.name_en || opp.projects.name_ar);
  return opp.project_name || '';
};

// ─── Saved Filters (localStorage) ───
const SAVED_FILTERS_KEY = 'platform_opp_saved_filters';
export const getSavedFilters = () => { try { return JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]'); } catch { return []; } };
export const saveSavedFilters = (f) => { try { localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(f)); } catch {} };

// ─── Stage History (Supabase + localStorage fallback) ───
const STAGE_HISTORY_KEY = 'platform_opp_stage_history';
export const getStageHistory = async (oppId) => {
  // Try Supabase first
  try {
    const { default: supabase } = await import('../../../lib/supabase');
    const { data } = await supabase.from('stage_history').select('*').eq('opportunity_id', oppId).order('changed_at', { ascending: false });
    if (data?.length) return data.map(d => ({ from: d.from_stage, to: d.to_stage, at: d.changed_at }));
  } catch {}
  // Fallback to localStorage
  try { const all = JSON.parse(localStorage.getItem(STAGE_HISTORY_KEY) || '{}'); return all[oppId] || []; } catch { return []; }
};
export const addStageHistory = (oppId, fromStage, toStage) => {
  const entry = { from: fromStage, to: toStage, at: new Date().toISOString() };
  // Save to localStorage
  try {
    const all = JSON.parse(localStorage.getItem(STAGE_HISTORY_KEY) || '{}');
    if (!all[oppId]) all[oppId] = [];
    all[oppId].push(entry);
    localStorage.setItem(STAGE_HISTORY_KEY, JSON.stringify(all));
  } catch {}
  // Also persist to Supabase (best-effort, non-blocking)
  import('../../../lib/supabase').then(({ default: supabase }) => {
    supabase.from('stage_history').insert([{
      opportunity_id: oppId,
      from_stage: fromStage,
      to_stage: toStage,
      changed_at: entry.at,
    }]).catch(() => {});
  }).catch(() => {});
};

// ─── Notes (Supabase via activities table + localStorage fallback) ───
const NOTES_KEY = 'platform_opp_notes';
export const getOppNotes = async (oppId) => {
  try {
    const { default: supabase } = await import('../../../lib/supabase');
    const { data } = await supabase.from('activities').select('id, notes, created_at, user_name_en, user_name_ar')
      .eq('contact_id', oppId).eq('type', 'note').order('created_at', { ascending: false }).limit(20);
    if (data?.length) return data.map(a => ({ id: a.id, text: a.notes, at: a.created_at, by: a.user_name_en || a.user_name_ar }));
  } catch {}
  try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); return all[oppId] || []; } catch { return []; }
};
export const addOppNote = async (oppId, text, profile) => {
  const note = { id: Date.now().toString(), text, at: new Date().toISOString() };
  // Save to localStorage
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (!all[oppId]) all[oppId] = [];
    all[oppId].unshift(note);
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch {}
  // Persist to Supabase
  try {
    const { default: supabase } = await import('../../../lib/supabase');
    await supabase.from('activities').insert([{
      type: 'note', notes: text, contact_id: oppId, entity_type: 'opportunity',
      user_id: profile?.id || null, user_name_en: profile?.full_name_en || '', user_name_ar: profile?.full_name_ar || '',
      dept: 'sales', status: 'completed', created_at: note.at,
    }]);
  } catch {}
  return note;
};
export const deleteOppNote = (oppId, noteId) => {
  try {
    const all = JSON.parse(localStorage.getItem(NOTES_KEY) || '{}');
    if (all[oppId]) all[oppId] = all[oppId].filter(n => n.id !== noteId);
    localStorage.setItem(NOTES_KEY, JSON.stringify(all));
  } catch {}
};
