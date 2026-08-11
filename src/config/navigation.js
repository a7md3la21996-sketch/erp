import { P } from './roles';
import {
  LayoutDashboard, Users, Target, Building2, ActivitySquare,
  DollarSign, Megaphone, UserCog, CalendarDays,
  ClipboardList, MessageSquare, Settings, BarChart3, Wallet, ClipboardCheck,
  TrendingUp, PieChart, Volume2, Crosshair, Grid3x3, Shield, Gift, Bell, HelpCircle,
  GitCompareArrows, Mail, BookOpen, Globe, FileText, MessageCircle,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: { ar: 'لوحة التحكم', en: 'Dashboard' }, icon: LayoutDashboard, path: '/dashboard', permission: P.DASHBOARD },
  // CRM as a scoped module: the card lands on the CRM Dashboard, and its side
  // menu exposes Leads (/leads). Master Leads / Opportunities / Lead-Distribution
  // deep-links still live in App.jsx and the dashboard lens cards.
  { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users, path: '/crm/dashboard', permission: P.CRM_DASHBOARD_PREVIEW, children: [
    { id: 'leads', label: { ar: 'العملاء المحتملين', en: 'Leads' }, path: '/leads', permission: P.CONTACTS_VIEW_OWN },
    { id: 'developers', label: { ar: 'المطوّرون', en: 'Developers' }, path: '/real-estate/developers', permission: P.PROJECTS_VIEW },
  ]},
  // OLD CRM submenu (rollback reference):
  // { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users, permission: P.CONTACTS_VIEW_OWN, children: [
  //   { id: 'crm-dashboard', label: { ar: 'لوحة CRM', en: 'CRM Dashboard' }, path: '/crm/dashboard', permission: P.CRM_DASHBOARD_PREVIEW },
  //   { id: 'contacts', label: { ar: 'العملاء المحتملين', en: 'Leads' }, path: '/leads', permission: P.CONTACTS_VIEW_OWN },
  //   { id: 'opportunities', label: { ar: 'الفرص البيعية', en: 'Opportunities' }, path: '/crm/opportunities', permission: P.OPPS_VIEW_OWN },
  //   { id: 'lead-pool', label: { ar: 'توزيع الليدز', en: 'Lead Distribution' }, path: '/crm/lead-pool', permission: P.POOL_VIEW },
  //   { id: 'master-leads', label: { ar: 'Master Leads', en: 'Master Leads' }, path: '/crm/master-leads', permission: P.POOL_SETTINGS },
  // ]},
  { id: 'activities', label: { ar: 'الأنشطة', en: 'Activities' }, icon: ActivitySquare, path: '/activities', permission: P.DASHBOARD },
  { id: 'real-estate', label: { ar: 'العقارات', en: 'Real Estate' }, icon: Building2, permission: P.PROJECTS_VIEW, children: [
    { id: 'projects', label: { ar: 'المشاريع', en: 'Projects' }, path: '/real-estate/projects', permission: P.PROJECTS_VIEW },
    { id: 'units', label: { ar: 'الوحدات', en: 'Units' }, path: '/real-estate/units', permission: P.UNITS_VIEW },
  ]},
  { id: 'sales', label: { ar: 'المبيعات', en: 'Sales' }, icon: DollarSign, permission: P.DEALS_VIEW_OWN, children: [
    { id: 'deals', label: { ar: 'الصفقات', en: 'Deals' }, path: '/sales/deals', permission: P.DEALS_VIEW_OWN },
    { id: 'commissions', label: { ar: 'العمولات', en: 'Commissions' }, path: '/sales/commissions', permission: P.COMM_VIEW_OWN },
    { id: 'forecast', label: { ar: 'توقعات المبيعات', en: 'Sales Forecast' }, path: '/sales/forecast', permission: P.DEALS_VIEW_OWN },
    { id: 'approvals', label: { ar: 'الموافقات', en: 'Approvals' }, path: '/approvals', permission: P.DEALS_VIEW_OWN },
  ]},
  { id: 'operations', label: { ar: 'العمليات', en: 'Operations' }, icon: ClipboardCheck, permission: P.OPS_VIEW, children: [
    { id: 'ops-deals',       label: { ar: 'معالجة الصفقات',     en: 'Deal Processing' },   path: '/operations',              permission: P.OPS_MANAGE },
    { id: 'ops-payments',    label: { ar: 'المدفوعات',          en: 'Payments' },          path: '/operations/payments',     permission: P.OPS_PAYMENTS },
    { id: 'ops-handover',    label: { ar: 'التسليمات',          en: 'Handover' },          path: '/operations/handover',     permission: P.OPS_HANDOVER },
    { id: 'ops-after-sales', label: { ar: 'خدمة ما بعد البيع',  en: 'After-Sales' },       path: '/operations/after-sales',  permission: P.OPS_AFTERSALES },
  ]},
  // Marketing unified into ONE entry that opens the Marketing page directly (no
  // submenu). The page has an in-page tab bar (نظرة عامة/الحملات/القنوات/القمع/ROI)
  // that switches sections via the same /marketing/* routes. To restore the old
  // submenu, replace this single entry with the commented group below.
  { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone, path: '/marketing', permission: P.CAMPAIGNS_VIEW },
  // OLD Marketing submenu (rollback reference):
  // { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone, permission: P.CAMPAIGNS_VIEW, children: [
  //   { id: 'mkt-dashboard', label: { ar: 'نظرة عامة', en: 'Dashboard' }, path: '/marketing', permission: P.CAMPAIGNS_VIEW },
  //   { id: 'mkt-campaigns', label: { ar: 'الحملات', en: 'Campaigns' }, path: '/marketing/campaigns', permission: P.CAMPAIGNS_VIEW },
  //   { id: 'mkt-channels', label: { ar: 'القنوات', en: 'Channels' }, path: '/marketing/channels', permission: P.CAMPAIGNS_VIEW },
  //   { id: 'mkt-funnel', label: { ar: 'القمع التسويقي', en: 'Funnel' }, path: '/marketing/funnel', permission: P.CAMPAIGNS_VIEW },
  //   { id: 'mkt-roi', label: { ar: 'تقرير الأداء و ROI', en: 'ROI Report' }, path: '/marketing/roi', permission: P.CAMPAIGNS_VIEW },
  // ]},
  { id: 'hr', label: { ar: 'الموارد البشرية', en: 'HR' }, icon: UserCog, permission: P.HR_VIEW_OWN, children: [
    { id: 'hr-home',      label: { ar: 'لوحة الموارد البشرية', en: 'HR Dashboard' }, path: '/hr',          permission: P.HR_VIEW_ALL },
    { id: 'employees',    label: { ar: 'الموظفين',        en: 'Employees' },    path: '/hr/employees',    permission: P.HR_VIEW_OWN },
    { id: 'departments',  label: { ar: 'الأقسام',         en: 'Departments' },  path: '/hr/departments',  permission: P.HR_VIEW_ALL },
    { id: 'org-chart',    label: { ar: 'الهيكل التنظيمي', en: 'Org Chart' },    path: '/hr/org-chart',    permission: P.HR_VIEW_OWN },
    // ── 5 Hubs (replace ~25 individual items)
    { group: { ar: 'المراكز', en: 'Hubs' } },
    { id: 'time-hub',     label: { ar: 'الوقت والحضور', en: 'Time & Attendance' }, path: '/hr/time',        permission: P.ATTEND_VIEW_OWN },
    { id: 'payroll-hub',  label: { ar: 'المرتبات',     en: 'Payroll' },           path: '/hr/payroll',     permission: P.PAYROLL_VIEW },
    { id: 'dev-hub',      label: { ar: 'الأداء والتطوير', en: 'Performance & Development' }, path: '/hr/development', permission: P.HR_VIEW_OWN },
    { id: 'talent-hub',   label: { ar: 'التوظيف',      en: 'Talent' },             path: '/hr/talent',     permission: P.HR_VIEW_ALL },
    { id: 'admin-hub',    label: { ar: 'الملفات والإدارة', en: 'Records & Admin' }, path: '/hr/admin',     permission: P.HR_VIEW_ALL },
    // ── Personal portals
    { group: { ar: 'بوابات شخصية', en: 'Portals' } },
    { id: 'hr-reports',   label: { ar: 'التقارير',      en: 'Reports' },          path: '/hr/reports',    permission: P.PAYROLL_VIEW },
    { id: 'self-service', label: { ar: 'بوابة الموظف',  en: 'Self-Service' },     path: '/hr/self-service', permission: P.HR_VIEW_OWN },
    { id: 'manager-dash', label: { ar: 'لوحة المدير',  en: 'Manager Board' },     path: '/manager',         permission: P.HR_VIEW_OWN },
  ]},
  { id: 'finance', label: { ar: 'المالية', en: 'Finance' }, icon: Wallet, permission: P.FINANCE_VIEW, children: [
    { id: 'fin-overview', label: { ar: 'نظرة عامة', en: 'Overview' }, path: '/finance', permission: P.FINANCE_VIEW },
    { id: 'fin-coa', label: { ar: 'دليل الحسابات', en: 'Chart of Accounts' }, path: '/finance/coa', permission: P.FINANCE_VIEW },
    { id: 'fin-journal', label: { ar: 'القيود اليومية', en: 'Journal Entries' }, path: '/finance/journal', permission: P.FINANCE_VIEW },
    { id: 'fin-invoices', label: { ar: 'الفواتير', en: 'Invoices' }, path: '/finance/invoices', permission: P.FINANCE_VIEW },
    { id: 'fin-expenses', label: { ar: 'المصروفات', en: 'Expenses' }, path: '/finance/expenses', permission: P.EXPENSES_VIEW_OWN },
    { id: 'fin-reports', label: { ar: 'التقارير المالية', en: 'Reports' }, path: '/finance/reports', permission: P.FINANCE_VIEW },
    { id: 'fin-budget', label: { ar: 'الموازنة', en: 'Budget' }, path: '/finance/budget', permission: P.FINANCE_VIEW },
  ]},
  { id: 'workspace', label: { ar: 'مساحة العمل', en: 'Workspace' }, icon: ClipboardList, permission: P.TASKS_VIEW_OWN, children: [
    { id: 'tasks', label: { ar: 'المهام', en: 'Tasks' }, path: '/tasks', permission: P.TASKS_VIEW_OWN },
    { id: 'calendar', label: { ar: 'التقويم', en: 'Calendar' }, path: '/calendar', permission: P.CALENDAR },
    { id: 'announcements', label: { ar: 'الإعلانات', en: 'Announcements' }, path: '/announcements', permission: P.DASHBOARD },
    { id: 'notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, path: '/notifications', permission: P.DASHBOARD },
  ]},
  { id: 'communication', label: { ar: 'التواصل', en: 'Communication' }, icon: MessageSquare, permission: P.CHAT_USE, children: [
    { id: 'chat', label: { ar: 'المحادثات', en: 'Chat' }, path: '/chat', permission: P.CHAT_USE },
    { id: 'email', label: { ar: 'البريد الإلكتروني', en: 'Email' }, path: '/email', permission: P.CHAT_USE },
    { id: 'whatsapp', label: { ar: 'واتساب', en: 'WhatsApp' }, path: '/whatsapp', permission: P.CHAT_USE },
  ]},
  { id: 'reports', label: { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' }, icon: BarChart3, path: '/reports', permission: P.RPT_SALES },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' }, icon: Settings, path: '/settings/general', permission: P.SETTINGS_VIEW },
  { id: 'changelog', label: { ar: 'ما الجديد', en: "What's New" }, icon: Gift, path: '/changelog', permission: P.DASHBOARD },
  { id: 'help-center', label: { ar: 'مركز المساعدة', en: 'Help & Knowledge' }, icon: HelpCircle, permission: P.DASHBOARD, children: [
    { id: 'help', label: { ar: 'دليل الاستخدام', en: 'Help Center' }, path: '/help', permission: P.DASHBOARD },
    { id: 'knowledge-base', label: { ar: 'قاعدة المعرفة', en: 'Knowledge Base' }, path: '/knowledge-base', permission: P.DASHBOARD },
  ]},
];

// ── Module-scoped navigation ────────────────────────────────────────────────
// The app is organised as focused "workspaces". The home launcher (/home) shows
// these as entry cards, and the sidebar scopes to ONE module at a time (derived
// from the URL) so you only ever see what belongs to the world you're in.
//
// MODULE_IDS  = top-level groups that act as full workspaces (shown as cards +
//               the sidebar scopes to them).
// GLOBAL_IDS  = cross-cutting things reachable from anywhere (dashboard, tasks,
//               chat, help…). They never "capture" the sidebar; they stay in the
//               global list / footer.
export const MODULE_IDS = ['crm', 'real-estate', 'sales', 'operations', 'marketing', 'hr', 'finance', 'reports'];
export const GLOBAL_IDS = ['dashboard', 'activities', 'workspace', 'communication', 'help-center', 'changelog'];

// Extra route prefixes a module owns beyond its own path + children paths (some
// pages live under a different URL than their group, e.g. Leads at /contacts).
export const MODULE_EXTRA_PATHS = {
  crm: ['/crm', '/leads', '/contacts'],
  'real-estate': ['/real-estate'],
  sales: ['/sales', '/approvals'],
  operations: ['/operations'],
  marketing: ['/marketing'],
  hr: ['/hr', '/manager'],
  finance: ['/finance'],
  reports: ['/reports'],
};

// Every path a top-level item owns (own path + children + declared extras).
function ownedPaths(item) {
  const paths = [];
  if (item.path) paths.push(item.path);
  (item.children || []).forEach(c => { if (c.path) paths.push(c.path); });
  (MODULE_EXTRA_PATHS[item.id] || []).forEach(p => paths.push(p));
  return paths;
}

// Which top-level module does a pathname belong to? Longest-prefix wins so a
// nested page maps to the deepest owning module (e.g. /real-estate/developers
// → 'real-estate' via its child path).
export function findModuleId(pathname) {
  let bestId = null, bestLen = -1;
  for (const item of NAV_ITEMS) {
    for (const p of ownedPaths(item)) {
      if ((pathname === p || pathname.startsWith(p + '/')) && p.length > bestLen) {
        bestLen = p.length;
        bestId = item.id;
      }
    }
  }
  return bestId;
}

// The route a module card opens: the group's own page, else its first
// permitted child.
export function moduleLandingPath(item, hasPermission) {
  if (item.path) return item.path;
  const child = (item.children || []).find(c => c.path && (!c.permission || !hasPermission || hasPermission(c.permission)));
  return child ? child.path : '/home';
}

/**
 * Role-based sidebar: only show these nav group IDs for each role.
 * If a role is not listed, all permitted items are shown (admin default).
 */
export const ROLE_NAV_GROUPS = {
  sales_agent:    ['dashboard', 'crm', 'activities', 'sales', 'real-estate', 'workspace', 'communication', 'help-center'],
  team_leader:    ['dashboard', 'crm', 'activities', 'sales', 'real-estate', 'workspace', 'communication', 'reports', 'help-center'],
  sales_manager:  ['dashboard', 'crm', 'activities', 'sales', 'real-estate', 'workspace', 'communication', 'reports', 'help-center'],
  sales_director: ['dashboard', 'crm', 'activities', 'sales', 'real-estate', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  marketing:      ['dashboard', 'crm', 'activities', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  hr:             ['dashboard', 'hr', 'activities', 'workspace', 'communication', 'help-center'],
  finance:        ['dashboard', 'finance', 'activities', 'sales', 'operations', 'workspace', 'communication', 'help-center'],
  operations:     ['dashboard', 'operations', 'activities', 'sales', 'crm', 'real-estate', 'workspace', 'communication', 'help-center'],
};
