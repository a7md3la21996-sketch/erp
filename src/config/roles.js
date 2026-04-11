export const ROLES = {
  ADMIN: 'admin',
  SALES_DIRECTOR: 'sales_director',
  SALES_MANAGER: 'sales_manager',
  TEAM_LEADER: 'team_leader',
  SALES_AGENT: 'sales_agent',
  MARKETING: 'marketing',
  HR: 'hr',
  FINANCE: 'finance',
  OPERATIONS: 'operations',
};

export const ROLE_LABELS = {
  admin: { ar: 'مدير النظام', en: 'Admin' },
  sales_director: { ar: 'مدير المبيعات', en: 'Sales Director' },
  sales_manager: { ar: 'سيلز مانجر', en: 'Sales Manager' },
  team_leader: { ar: 'تيم ليدر', en: 'Team Leader' },
  sales_agent: { ar: 'سيلز', en: 'Sales Agent' },
  marketing: { ar: 'تسويق', en: 'Marketing' },
  hr: { ar: 'موارد بشرية', en: 'HR' },
  finance: { ar: 'مالية', en: 'Finance' },
  operations: { ar: 'عمليات', en: 'Operations' },
};

export const P = {
  DASHBOARD: 'dashboard.view',

  // Contacts
  CONTACTS_VIEW_OWN: 'contacts.view_own',
  CONTACTS_VIEW_ALL: 'contacts.view_all',
  CONTACTS_EDIT_OWN: 'contacts.edit_own',
  CONTACTS_EDIT: 'contacts.edit',
  CONTACTS_DELETE: 'contacts.delete',
  CONTACTS_EXPORT: 'contacts.export',
  CONTACTS_IMPORT: 'contacts.import',
  CONTACTS_BULK: 'contacts.bulk',

  // Opportunities
  OPPS_VIEW_OWN: 'opps.view_own',
  OPPS_VIEW_ALL: 'opps.view_all',
  OPPS_EDIT_OWN: 'opps.edit_own',
  OPPS_EDIT: 'opps.edit',
  OPPS_DELETE: 'opps.delete',
  OPPS_EXPORT: 'opps.export',
  OPPS_BULK: 'opps.bulk',

  // Deals
  DEALS_VIEW_OWN: 'deals.view_own',
  DEALS_VIEW_ALL: 'deals.view_all',

  // Pool
  POOL_VIEW: 'pool.view',
  POOL_MANAGE: 'pool.manage',
  POOL_ASSIGN: 'pool.assign',
  POOL_VIEW_FRESH: 'pool.view_fresh',
  POOL_SETTINGS: 'pool.settings',

  // Real Estate
  DEVS_VIEW: 'devs.view',
  PROJECTS_VIEW: 'projects.view',
  UNITS_VIEW: 'units.view',

  // Commissions & Reports
  COMM_VIEW_OWN: 'comm.view_own',
  RPT_SALES: 'rpt.sales',
  CAMPAIGNS_VIEW: 'campaigns.view',

  // HR
  HR_VIEW_OWN: 'hr.view_own',
  HR_VIEW_ALL: 'hr.view_all',
  HR_POLICIES_MANAGE: 'hr.policies.manage',
  HR_EMPLOYEES_VIEW: 'hr.employees.view',
  HR_EMPLOYEES_MANAGE: 'hr.employees.manage',
  ATTEND_VIEW_OWN: 'attend.view_own',
  LEAVE_REQUEST: 'leave.request',
  PAYROLL_VIEW: 'payroll.view',

  // Finance
  FINANCE_VIEW: 'finance.view',
  EXPENSES_VIEW_OWN: 'expenses.view_own',

  // Workspace
  TASKS_VIEW_OWN: 'tasks.view_own',
  CALENDAR: 'calendar.view',
  CHAT_USE: 'chat.use',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  SLA_MANAGE: 'sla.manage',
  SCORING_MANAGE: 'scoring.manage',
  AUDIT_VIEW: 'audit.view',

  // Operations
  OPS_VIEW: 'ops.view',
  OPS_MANAGE: 'ops.manage',
  OPS_PAYMENTS: 'ops.payments',
  OPS_HANDOVER: 'ops.handover',
  OPS_AFTERSALES: 'ops.after_sales',
};

export const ROLE_PERMISSIONS = {
  admin: Object.values(P),

  sales_director: [
    P.DASHBOARD,
    // Contacts: full access (no export)
    P.CONTACTS_VIEW_OWN, P.CONTACTS_VIEW_ALL, P.CONTACTS_EDIT, P.CONTACTS_DELETE, P.CONTACTS_IMPORT, P.CONTACTS_BULK,
    // Opportunities: full access (no export)
    P.OPPS_VIEW_OWN, P.OPPS_VIEW_ALL, P.OPPS_EDIT, P.OPPS_DELETE, P.OPPS_BULK,
    // Deals & Commissions
    P.DEALS_VIEW_OWN, P.DEALS_VIEW_ALL, P.COMM_VIEW_OWN,
    // Pool: full
    P.POOL_VIEW, P.POOL_MANAGE, P.POOL_ASSIGN, P.POOL_VIEW_FRESH, P.POOL_SETTINGS,
    // Other
    P.PROJECTS_VIEW, P.UNITS_VIEW, P.RPT_SALES, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE,
  ],

  sales_manager: [
    P.DASHBOARD,
    // Contacts: full access (no export)
    P.CONTACTS_VIEW_OWN, P.CONTACTS_VIEW_ALL, P.CONTACTS_EDIT, P.CONTACTS_DELETE, P.CONTACTS_IMPORT, P.CONTACTS_BULK,
    // Opportunities: full access (no export)
    P.OPPS_VIEW_OWN, P.OPPS_VIEW_ALL, P.OPPS_EDIT, P.OPPS_DELETE, P.OPPS_BULK,
    // Deals
    P.DEALS_VIEW_OWN, P.DEALS_VIEW_ALL,
    // Pool: full
    P.POOL_VIEW, P.POOL_MANAGE, P.POOL_ASSIGN, P.POOL_VIEW_FRESH, P.POOL_SETTINGS,
    // Other
    P.PROJECTS_VIEW, P.UNITS_VIEW, P.RPT_SALES, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE,
  ],

  team_leader: [
    P.DASHBOARD,
    // Contacts: view own + edit own + bulk (for team assignment)
    P.CONTACTS_VIEW_OWN, P.CONTACTS_EDIT_OWN, P.CONTACTS_BULK,
    // Opportunities: view own + edit own + bulk
    P.OPPS_VIEW_OWN, P.OPPS_EDIT_OWN, P.OPPS_BULK,
    // Deals
    P.DEALS_VIEW_OWN,
    // Pool
    P.POOL_VIEW, P.POOL_MANAGE, P.POOL_ASSIGN, P.POOL_VIEW_FRESH,
    // Other
    P.PROJECTS_VIEW, P.UNITS_VIEW, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE,
  ],

  sales_agent: [
    P.DASHBOARD,
    // Contacts: view own + edit own only
    P.CONTACTS_VIEW_OWN, P.CONTACTS_EDIT_OWN,
    // Opportunities: view own + edit own only
    P.OPPS_VIEW_OWN, P.OPPS_EDIT_OWN,
    // Deals
    P.DEALS_VIEW_OWN,
    // Pool
    P.POOL_VIEW,
    // Other
    P.PROJECTS_VIEW, P.UNITS_VIEW, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE,
  ],

  marketing: [P.DASHBOARD, P.CONTACTS_VIEW_OWN, P.CAMPAIGNS_VIEW, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE],
  hr: [P.DASHBOARD, P.HR_VIEW_OWN, P.HR_VIEW_ALL, P.HR_POLICIES_MANAGE, P.HR_EMPLOYEES_VIEW, P.HR_EMPLOYEES_MANAGE, P.ATTEND_VIEW_OWN, P.LEAVE_REQUEST, P.PAYROLL_VIEW, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE],
  finance: [P.DASHBOARD, P.CONTACTS_VIEW_OWN, P.FINANCE_VIEW, P.EXPENSES_VIEW_OWN, P.DEALS_VIEW_OWN, P.COMM_VIEW_OWN, P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE, P.OPS_VIEW, P.OPS_PAYMENTS],
  operations: [
    P.DASHBOARD,
    // Operations
    P.OPS_VIEW, P.OPS_MANAGE, P.OPS_PAYMENTS, P.OPS_HANDOVER, P.OPS_AFTERSALES,
    // Sales (contacts, opps, deals)
    P.CONTACTS_VIEW_OWN, P.CONTACTS_VIEW_ALL, P.CONTACTS_EDIT,
    P.OPPS_VIEW_OWN, P.OPPS_VIEW_ALL, P.OPPS_EDIT,
    P.DEALS_VIEW_OWN,
    // Marketing
    P.CAMPAIGNS_VIEW,
    // Lead Distribution
    P.POOL_VIEW, P.POOL_MANAGE, P.POOL_ASSIGN,
    // Users + Ads Integration
    P.USERS_MANAGE, P.SETTINGS_VIEW,
    // Common
    P.TASKS_VIEW_OWN, P.CALENDAR, P.CHAT_USE,
    P.PROJECTS_VIEW, P.UNITS_VIEW,
  ],
};
