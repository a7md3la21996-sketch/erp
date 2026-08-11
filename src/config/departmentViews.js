/**
 * View configuration for the Sales CRM Leads page (ContactsPage).
 * The system is a single-department (Sales) CRM, so only the sales view exists.
 * (Legacy hr/finance/marketing/operations views + ALL_DEPT_VIEW were removed
 * once the Leads page was locked to the sales department.)
 */

export const DEPT_VIEWS = {
  sales: {
    label_ar: 'المبيعات',
    label_en: 'Sales',
    // Table columns to show (ids match ContactsTable column slots)
    columns: ['contact', 'phone', 'assigned_to', 'source_date', 'last_feedback', 'next_action', 'actions'],
    // Smart filter fields relevant to this department
    smartFilterIds: [
      'prefix', 'contact_type', 'source', 'contact_status', 'full_name', 'phone', 'email',
      'created_at', 'assigned_at', 'last_activity_at', 'campaign_name', '_country',
      'assigned_to_name', 'assigned_by_name', '_campaign_count', '_no_activity_by', '_meeting',
    ],
    // Contact types available in this department
    contactTypes: ['lead', 'cold', 'customer', 'repeat_buyer', 'vip', 'referrer'],
    // Status options for filtering
    statusOptions: ['new', 'following', 'has_opportunity', 'contacted', 'disqualified'],
    // Sort options
    sortIds: ['created', 'created_asc', 'next_follow_up', 'next_follow_up_desc', 'assigned', 'last_activity', 'updated', 'name', 'stale'],
    // Actions in the row menu
    menuActions: ['edit', 'logCall', 'reminder', 'export', 'delete', 'disqualify', 'blacklist'],
    // Quick action buttons visible in the row
    rowActions: ['call', 'whatsapp', 'quickAction', 'pin'],
    // Default sort
    defaultSort: 'last_activity',
  },
};

/** Get the active department view config. Always the sales view. */
export function getDeptView() {
  return DEPT_VIEWS.sales;
}
