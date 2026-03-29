/**
 * Simple Event Bus for decoupled communication.
 * Services emit events, notification system listens and reacts.
 *
 * Usage:
 *   // Emit
 *   eventBus.emit('deal:won', { dealId, clientName, value });
 *
 *   // Listen
 *   eventBus.on('deal:won', (data) => createNotification(...));
 *
 *   // Cleanup
 *   eventBus.off('deal:won', handler);
 */

const listeners = {};

const eventBus = {
  on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return () => eventBus.off(event, callback);
  },

  off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    if (!listeners[event]) return;
    listeners[event].forEach(cb => {
      try { cb(data); } catch {}
    });
  },

  // Remove all listeners for an event
  clear(event) {
    if (event) delete listeners[event];
    else Object.keys(listeners).forEach(k => delete listeners[k]);
  },
};

export default eventBus;

// ── Pre-registered event types ──
export const EVENTS = {
  DEAL_WON: 'deal:won',
  LEAD_ASSIGNED: 'lead:assigned',
  TASK_ASSIGNED: 'task:assigned',
  STAGE_CHANGED: 'opportunity:stage_changed',
  CONTACT_CREATED: 'contact:created',
  ACTIVITY_LOGGED: 'activity:logged',
  REMINDER_DUE: 'reminder:due',
  APPROVAL_NEEDED: 'approval:needed',
};
