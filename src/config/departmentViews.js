/**
 * Department-specific view configurations for ContactsPage.
 * Each department sees different columns, filters, sort options, and actions
 * while sharing the same underlying ContactsPage component.
 */

export const DEPT_VIEWS = {
  sales: {
    label_ar: 'المبيعات',
    label_en: 'Sales',
    // Table columns to show (ids match ContactsTable column slots)
    columns: ['contact', 'phone', 'assigned_to', 'temperature', 'source_date', 'last_feedback', 'actions'],
    // Smart filter fields relevant to this department
    smartFilterIds: [
      'prefix', 'contact_type', 'source', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', 'last_activity_at', 'lead_score', 'campaign_name', '_country',
      'assigned_to_name', 'assigned_by_name', '_campaign_count', '_opp_count',
    ],
    // Contact types available in this department
    contactTypes: ['lead', 'cold', 'developer', 'partner', 'qualified', 'customer', 'repeat_buyer', 'vip', 'referrer', 'client'],
    // Status options for filtering
    statusOptions: ['new', 'contacted', 'no_answer', 'interested', 'not_interested', 'disqualified', 'follow_up'],
    // Sort options
    sortIds: ['created', 'last_activity', 'score', 'name', 'stale'],
    // Actions in the row menu
    menuActions: ['edit', 'logCall', 'reminder', 'export', 'delete', 'disqualify', 'blacklist'],
    // Quick action buttons visible in the row
    rowActions: ['call', 'whatsapp', 'quickAction', 'pin'],
    // Default sort
    defaultSort: 'last_activity',
  },

  hr: {
    label_ar: 'الموارد البشرية',
    label_en: 'HR',
    columns: ['contact', 'phone', 'job_title', 'contact_status', 'source_date', 'actions'],
    smartFilterIds: [
      'prefix', 'contact_type', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', '_country', 'assigned_to_name',
    ],
    contactTypes: ['applicant'],
    statusOptions: ['new', 'contacted', 'no_answer', 'interested', 'not_interested', 'disqualified'],
    sortIds: ['created', 'name', 'last_activity'],
    menuActions: ['edit', 'reminder', 'delete'],
    rowActions: ['call', 'whatsapp', 'pin'],
    defaultSort: 'created',
  },

  finance: {
    label_ar: 'المالية',
    label_en: 'Finance',
    columns: ['contact', 'phone', 'company', 'contact_status', 'source_date', 'actions'],
    smartFilterIds: [
      'prefix', 'contact_type', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', '_country', 'assigned_to_name',
    ],
    contactTypes: ['supplier', 'partner'],
    statusOptions: ['new', 'contacted', 'interested', 'not_interested', 'follow_up'],
    sortIds: ['created', 'name', 'last_activity'],
    menuActions: ['edit', 'reminder', 'export', 'delete'],
    rowActions: ['call', 'whatsapp', 'pin'],
    defaultSort: 'created',
  },

  marketing: {
    label_ar: 'التسويق',
    label_en: 'Marketing',
    columns: ['contact', 'phone', 'temperature', 'source_date', 'lead_score', 'last_feedback', 'actions'],
    smartFilterIds: [
      'prefix', 'contact_type', 'source', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', 'last_activity_at', 'lead_score', 'campaign_name', '_country',
      '_campaign_count',
    ],
    contactTypes: ['lead', 'cold'],
    statusOptions: ['new', 'contacted', 'no_answer', 'interested', 'not_interested', 'follow_up'],
    sortIds: ['created', 'last_activity', 'score', 'name'],
    menuActions: ['edit', 'logCall', 'reminder', 'export'],
    rowActions: ['call', 'whatsapp', 'quickAction', 'pin'],
    defaultSort: 'last_activity',
  },

  operations: {
    label_ar: 'العمليات',
    label_en: 'Operations',
    columns: ['contact', 'phone', 'company', 'assigned_to', 'contact_status', 'source_date', 'actions'],
    smartFilterIds: [
      'prefix', 'contact_type', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', '_country', 'assigned_to_name',
    ],
    contactTypes: ['partner', 'supplier'],
    statusOptions: ['new', 'contacted', 'interested', 'not_interested', 'follow_up'],
    sortIds: ['created', 'name', 'last_activity'],
    menuActions: ['edit', 'logCall', 'reminder', 'export', 'delete'],
    rowActions: ['call', 'whatsapp', 'quickAction', 'pin'],
    defaultSort: 'created',
  },
};

/** Get the active department view config. Falls back to sales. */
export function getDeptView(dept) {
  return DEPT_VIEWS[dept] || DEPT_VIEWS.sales;
}

/** Default view when no department is selected (shows everything) */
export const ALL_DEPT_VIEW = {
  label_ar: 'الكل',
  label_en: 'All',
  columns: ['contact', 'phone', 'assigned_to', 'source_date', 'last_feedback', 'actions'],
  smartFilterIds: null, // null = show all
  contactTypes: null,   // null = show all
  statusOptions: null,
  sortIds: null,
  menuActions: null,
  rowActions: null,
  defaultSort: 'created',
};
