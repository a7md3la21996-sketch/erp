import supabase from '../lib/supabase';
import { reportError } from '../utils/errorReporter';

/**
 * Lead Recycling Service
 * - Auto temperature decay based on inactivity
 * - Identifies stale leads for redistribution
 */

const DECAY_RULES = {
  hot:  { daysToDecay: 7,  nextTemp: 'warm' },
  warm: { daysToDecay: 14, nextTemp: 'cold' },
  // cold stays cold — goes to recycling queue
};

const STALE_THRESHOLD_DAYS = 30; // leads with no activity for 30+ days

/**
 * Run temperature decay on all contacts.
 * Call this on dashboard load or via a scheduled job.
 * Returns count of decayed leads.
 */
export async function runTemperatureDecay() {
  let decayedCount = 0;
  const now = new Date();

  try {
    // Fetch contacts with temperature that might need decay
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, temperature, last_activity_at, created_at')
      .in('temperature', ['hot', 'warm'])
      .range(0, 499);

    if (error || !contacts?.length) return 0;

    const updates = [];
    contacts.forEach(c => {
      const rule = DECAY_RULES[c.temperature];
      if (!rule) return;

      const lastActivity = new Date(c.last_activity_at || c.created_at);
      const daysSince = Math.floor((now - lastActivity) / 86400000);

      if (daysSince >= rule.daysToDecay) {
        updates.push({ id: c.id, temperature: rule.nextTemp });
      }
    });

    // Batch update
    for (const u of updates) {
      await supabase.from('contacts').update({ temperature: u.temperature }).eq('id', u.id);
      decayedCount++;
    }

    // Also update localStorage cache
    if (decayedCount > 0) {
      try {
        const local = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
        const updateMap = new Map(updates.map(u => [u.id, u.temperature]));
        local.forEach(c => {
          if (updateMap.has(c.id)) c.temperature = updateMap.get(c.id);
        });
        localStorage.setItem('platform_contacts', JSON.stringify(local));
      } catch {}
    }
  } catch (err) {
    reportError('leadRecycling', 'temperatureDecay', err);
  }

  return decayedCount;
}

/**
 * Get stale leads (no activity for 30+ days, cold temperature).
 * These are candidates for recycling/redistribution.
 */
export async function getStaleLeads() {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_DAYS * 86400000).toISOString();

  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, full_name, phone, temperature, assigned_to_name, last_activity_at, created_at')
      .in('contact_type', ['lead', 'cold', 'qualified'])
      .or(`last_activity_at.lt.${cutoff},last_activity_at.is.null`)
      .order('last_activity_at', { ascending: true })
      .range(0, 99);

    if (error) throw error;
    return data || [];
  } catch (err) {
    reportError('leadRecycling', 'getStaleLeads', err);
    // Fallback to localStorage
    try {
      const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
      return contacts
        .filter(c => {
          if (!['lead', 'cold', 'qualified'].includes(c.contact_type)) return false;
          const lastAct = new Date(c.last_activity_at || c.created_at);
          return (Date.now() - lastAct) / 86400000 > STALE_THRESHOLD_DAYS;
        })
        .sort((a, b) => new Date(a.last_activity_at || a.created_at) - new Date(b.last_activity_at || b.created_at))
        .slice(0, 100);
    } catch { return []; }
  }
}

/**
 * Get recycling stats for dashboard.
 */
export function getRecyclingStats() {
  try {
    const contacts = JSON.parse(localStorage.getItem('platform_contacts') || '[]');
    const now = Date.now();
    const leads = contacts.filter(c => ['lead', 'cold', 'qualified', 'nurturing'].includes(c.contact_type));

    const hot = leads.filter(c => c.temperature === 'hot').length;
    const warm = leads.filter(c => c.temperature === 'warm').length;
    const cold = leads.filter(c => c.temperature === 'cold').length;
    const stale = leads.filter(c => {
      const lastAct = new Date(c.last_activity_at || c.created_at);
      return (now - lastAct) / 86400000 > STALE_THRESHOLD_DAYS;
    }).length;

    return { hot, warm, cold, stale, total: leads.length };
  } catch {
    return { hot: 0, warm: 0, cold: 0, stale: 0, total: 0 };
  }
}
