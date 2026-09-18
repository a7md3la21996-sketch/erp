import { ENGAGED_RESULTS } from '../../../services/interactionsService';

// ── Lead-level responsiveness (from the full activity history) ──────────────
// A separate axis from "last activity result": has this lead EVER replied, how
// often, and recently? Computed from real activities using the SAME engaged-
// result rule the logger enforces (interactionsService.ENGAGED_RESULTS).
//   replies  = engaged (answered/replied/attended/visited) or inbound touches
//   attempts = all contact-type activities (engaged + not)
// windowDays comes from CRM Settings (crmThresholds.responsive_window_days).

const CONTACT_TYPES = ['call', 'whatsapp', 'email', 'meeting', 'visit'];

export function computeResponsiveness(activities = [], windowDays = 7) {
  let attempts = 0, replies = 0, lastReplyAt = null;
  for (const a of activities) {
    if (!CONTACT_TYPES.includes(a.type)) continue;
    attempts++;
    const engaged = a.result && ENGAGED_RESULTS[a.type]?.has(a.result);
    const inbound = a.direction === 'in' || a.direction === 'inbound';
    if (engaged || inbound) {
      replies++;
      const d = a.created_at ? new Date(a.created_at) : null;
      if (d && (!lastReplyAt || d > lastReplyAt)) lastReplyAt = d;
    }
  }
  const lastReplyDays = lastReplyAt ? Math.floor((Date.now() - lastReplyAt.getTime()) / 86400000) : null;
  let state, color;
  if (attempts === 0) { state = 'not_contacted'; color = '#9AA4B2'; }
  else if (replies === 0) { state = 'never'; color = '#D6403B'; }
  else if (lastReplyDays != null && lastReplyDays <= windowDays) { state = 'responsive'; color = '#158A57'; }
  else { state = 'unresponsive'; color = '#C9860A'; }
  return { state, color, replies, attempts, lastReplyDays };
}

export const RESP_LABELS = {
  not_contacted: { ar: 'لم يتم التواصل', en: 'Not contacted yet' },
  never:         { ar: 'لم يرد نهائياً',  en: 'Never responded' },
  responsive:    { ar: 'متجاوب',          en: 'Responsive' },
  unresponsive:  { ar: 'توقّف عن الرد',   en: 'Unresponsive lately' },
};
