const STORAGE_KEY = 'platform_workflows';
const MAX_WORKFLOWS = 50;

// ── localStorage helpers ────────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_WORKFLOWS) list = list.slice(0, MAX_WORKFLOWS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_WORKFLOWS / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── Config maps ─────────────────────────────────────────────────────────
export const TRIGGER_ENTITIES = {
  contact:     { ar: 'جهة اتصال',    en: 'Contact',     color: '#3B82F6' },
  opportunity: { ar: 'فرصة بيعية',    en: 'Opportunity',  color: '#8B5CF6' },
  deal:        { ar: 'صفقة',          en: 'Deal',         color: '#10B981' },
  task:        { ar: 'مهمة',          en: 'Task',         color: '#F59E0B' },
  leave:       { ar: 'إجازة',         en: 'Leave',        color: '#EF4444' },
};

export const TRIGGER_EVENTS = {
  created:        { ar: 'تم الإنشاء',        en: 'Created' },
  updated:        { ar: 'تم التعديل',         en: 'Updated' },
  deleted:        { ar: 'تم الحذف',           en: 'Deleted' },
  status_changed: { ar: 'تغيير الحالة',       en: 'Status Changed' },
  stage_changed:  { ar: 'تغيير المرحلة',      en: 'Stage Changed' },
  assigned:       { ar: 'تم التعيين',         en: 'Assigned' },
};

export const ENTITY_EVENTS_MAP = {
  contact:     ['created', 'updated', 'deleted', 'status_changed', 'assigned'],
  opportunity: ['created', 'updated', 'deleted', 'stage_changed', 'assigned'],
  deal:        ['created', 'updated', 'deleted', 'status_changed', 'stage_changed'],
  task:        ['created', 'updated', 'deleted', 'status_changed', 'assigned'],
  leave:       ['created', 'updated', 'deleted', 'status_changed'],
};

export const CONDITION_OPERATORS = {
  equals:       { ar: 'يساوي',        en: 'Equals' },
  not_equals:   { ar: 'لا يساوي',     en: 'Not Equals' },
  contains:     { ar: 'يحتوي',        en: 'Contains' },
  greater_than: { ar: 'أكبر من',       en: 'Greater Than' },
  less_than:    { ar: 'أصغر من',       en: 'Less Than' },
  is_empty:     { ar: 'فارغ',          en: 'Is Empty' },
  is_not_empty: { ar: 'غير فارغ',      en: 'Is Not Empty' },
};

export const ACTION_TYPES = {
  send_notification: { ar: 'إرسال إشعار',     en: 'Send Notification',  icon: 'Bell',         color: '#6366F1' },
  assign_to:         { ar: 'تعيين إلى',        en: 'Assign To',         icon: 'UserPlus',     color: '#3B82F6' },
  change_status:     { ar: 'تغيير الحالة',     en: 'Change Status',     icon: 'RefreshCw',    color: '#F59E0B' },
  change_field:      { ar: 'تغيير حقل',        en: 'Change Field',      icon: 'Edit3',        color: '#8B5CF6' },
  create_task:       { ar: 'إنشاء مهمة',       en: 'Create Task',       icon: 'ClipboardList', color: '#10B981' },
  send_sms:          { ar: 'إرسال رسالة',      en: 'Send SMS',          icon: 'MessageSquare', color: '#EC4899' },
};

export const ENTITY_FIELDS = {
  contact:     ['full_name', 'email', 'phone', 'status', 'contact_type', 'source', 'assigned_to', 'company'],
  opportunity: ['name', 'value', 'stage', 'probability', 'assigned_to', 'expected_close', 'source'],
  deal:        ['deal_number', 'value', 'status', 'stage', 'client_name', 'unit', 'payment_plan'],
  task:        ['title', 'status', 'priority', 'assigned_to', 'due_date', 'category'],
  leave:       ['employee', 'leave_type', 'status', 'start_date', 'end_date', 'days'],
};

// ── CRUD ────────────────────────────────────────────────────────────────
export function createWorkflow(workflow) {
  const list = load();
  const newWorkflow = {
    id: 'wf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    name: workflow.name || '',
    nameAr: workflow.nameAr || '',
    description: workflow.description || '',
    trigger: workflow.trigger || { entity: 'contact', event: 'created' },
    conditions: workflow.conditions || [],
    actions: workflow.actions || [],
    enabled: workflow.enabled !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  list.unshift(newWorkflow);
  save(list);
  return newWorkflow;
}

export function getWorkflows() {
  return load();
}

export function updateWorkflow(id, updates) {
  const list = load();
  const idx = list.findIndex(w => w.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() };
  save(list);
  return list[idx];
}

export function deleteWorkflow(id) {
  const list = load().filter(w => w.id !== id);
  save(list);
}

export function toggleWorkflow(id) {
  const list = load();
  const idx = list.findIndex(w => w.id === id);
  if (idx === -1) return null;
  list[idx].enabled = !list[idx].enabled;
  list[idx].updated_at = new Date().toISOString();
  save(list);
  return list[idx];
}

// ── Condition evaluation ────────────────────────────────────────────────
function evaluateCondition(condition, data) {
  const { field, operator, value } = condition;
  const actual = data?.[field];
  switch (operator) {
    case 'equals':       return String(actual) === String(value);
    case 'not_equals':   return String(actual) !== String(value);
    case 'contains':     return String(actual || '').toLowerCase().includes(String(value).toLowerCase());
    case 'greater_than': return Number(actual) > Number(value);
    case 'less_than':    return Number(actual) < Number(value);
    case 'is_empty':     return !actual || actual === '' || actual === null || actual === undefined;
    case 'is_not_empty': return actual !== '' && actual !== null && actual !== undefined;
    default:             return true;
  }
}

export function evaluateWorkflowConditions(conditions, data) {
  if (!conditions || conditions.length === 0) return true;
  let result = evaluateCondition(conditions[0], data);
  for (let i = 1; i < conditions.length; i++) {
    const connector = conditions[i].connector || 'and';
    const condResult = evaluateCondition(conditions[i], data);
    result = connector === 'or' ? (result || condResult) : (result && condResult);
  }
  return result;
}

// ── Test workflow ───────────────────────────────────────────────────────
export function testWorkflow(workflow) {
  const sampleData = {
    contact:     { id: 'test_1', full_name: 'Ahmed Ali', email: 'ahmed@test.com', phone: '+201234567890', status: 'new', contact_type: 'individual', source: 'website', assigned_to: 'agent_1', company: 'Test Corp' },
    opportunity: { id: 'test_2', name: 'New Project Deal', value: 500000, stage: 'qualification', probability: 40, assigned_to: 'agent_1', expected_close: '2026-04-15', source: 'referral' },
    deal:        { id: 'test_3', deal_number: 'DL-001', value: 1200000, status: 'active', stage: 'contract', client_name: 'Mohamed Hassan', unit: 'Unit A-101', payment_plan: 'installments' },
    task:        { id: 'test_4', title: 'Follow up with client', status: 'pending', priority: 'high', assigned_to: 'agent_2', due_date: '2026-03-20', category: 'follow_up' },
    leave:       { id: 'test_5', employee: 'Sara Ahmed', leave_type: 'annual', status: 'pending', start_date: '2026-03-25', end_date: '2026-03-28', days: 3 },
  };

  const entity = workflow.trigger?.entity || 'contact';
  const data = sampleData[entity];
  const conditionsPass = evaluateWorkflowConditions(workflow.conditions, data);

  const results = {
    trigger: { entity, event: workflow.trigger?.event, matched: true },
    sampleData: data,
    conditionsPass,
    conditionResults: (workflow.conditions || []).map(c => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
      actualValue: data[c.field],
      passed: evaluateCondition(c, data),
    })),
    actionsWouldExecute: conditionsPass ? (workflow.actions || []).map(a => ({
      type: a.type,
      config: a.config,
      label: ACTION_TYPES[a.type]?.en || a.type,
    })) : [],
  };

  return results;
}

