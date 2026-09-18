import { P } from './roles';
import {
  LayoutDashboard, Users, Target, Building2, ActivitySquare,
  DollarSign, Megaphone, UserCog, CalendarDays,
  ClipboardList, MessageSquare, Settings, BarChart3, Wallet, ClipboardCheck,
  TrendingUp, PieChart, Volume2, Grid3x3, Gift, Bell, HelpCircle,
  GitCompareArrows, Mail, BookOpen, FileText, MessageCircle,
  Briefcase, Boxes, HeartHandshake, Package, Headphones, GraduationCap, Clock, User, Receipt,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: { ar: 'لوحة التحكم', en: 'Dashboard' }, icon: LayoutDashboard, path: '/dashboard', permission: P.DASHBOARD },
  // CRM as a scoped module: the card lands on the CRM Dashboard, and its side
  // menu exposes Leads, Meetings, Developers, plus the real-estate inventory
  // (Projects/Units) and Deals — all consolidated here so the sales day lives in
  // one place. Deals stay own-scoped (P.DEALS_VIEW_OWN) so nobody sees another
  // rep's deals.
  { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users, path: '/crm/dashboard', permission: P.CRM_DASHBOARD_PREVIEW, children: [
    { id: 'leads', label: { ar: 'العملاء المحتملين', en: 'Leads' }, icon: Target, path: '/leads', permission: P.CONTACTS_VIEW_OWN },
    { id: 'meetings', label: { ar: 'الاجتماعات', en: 'Meetings' }, icon: CalendarDays, path: '/meetings', permission: P.CONTACTS_VIEW_OWN },
    { id: 'deals', label: { ar: 'الصفقات', en: 'Deals' }, icon: HeartHandshake, path: '/sales/deals', permission: P.DEALS_VIEW_OWN },
    { id: 'projects', label: { ar: 'المشاريع', en: 'Projects' }, icon: Building2, path: '/real-estate/projects', permission: P.PROJECTS_VIEW },
    { id: 'units', label: { ar: 'الوحدات', en: 'Units' }, icon: Boxes, path: '/real-estate/units', permission: P.UNITS_VIEW },
    { id: 'developers', label: { ar: 'المطوّرون', en: 'Developers' }, icon: Briefcase, path: '/real-estate/developers', permission: P.PROJECTS_VIEW },
    { id: 'crm-settings', label: { ar: 'إعدادات CRM', en: 'CRM Settings' }, icon: Settings, path: '/crm/settings', permission: P.SETTINGS_MANAGE },
  ]},
  { id: 'activities', label: { ar: 'الأنشطة', en: 'Activities' }, icon: ActivitySquare, path: '/activities', permission: P.DASHBOARD },
  { id: 'sales', label: { ar: 'المبيعات', en: 'Sales' }, icon: DollarSign, permission: P.DEALS_VIEW_OWN, children: [
    { id: 'commissions', label: { ar: 'العمولات', en: 'Commissions' }, icon: PieChart, path: '/sales/commissions', permission: P.COMM_VIEW_OWN },
    { id: 'forecast', label: { ar: 'توقعات المبيعات', en: 'Sales Forecast' }, icon: TrendingUp, path: '/sales/forecast', permission: P.DEALS_VIEW_OWN },
    { id: 'approvals', label: { ar: 'الموافقات', en: 'Approvals' }, icon: ClipboardCheck, path: '/approvals', permission: P.DEALS_VIEW_OWN },
  ]},
  { id: 'operations', label: { ar: 'العمليات', en: 'Operations' }, icon: ClipboardCheck, permission: P.OPS_VIEW, children: [
    { id: 'ops-deals',       label: { ar: 'معالجة الصفقات',     en: 'Deal Processing' },   icon: FileText,       path: '/operations',              permission: P.OPS_MANAGE },
    { id: 'ops-payments',    label: { ar: 'المدفوعات',          en: 'Payments' },          icon: Wallet,         path: '/operations/payments',     permission: P.OPS_PAYMENTS },
    { id: 'ops-handover',    label: { ar: 'التسليمات',          en: 'Handover' },          icon: Package,        path: '/operations/handover',     permission: P.OPS_HANDOVER },
    { id: 'ops-after-sales', label: { ar: 'خدمة ما بعد البيع',  en: 'After-Sales' },       icon: Headphones,     path: '/operations/after-sales',  permission: P.OPS_AFTERSALES },
  ]},
  { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone, path: '/marketing', permission: P.CAMPAIGNS_VIEW },
  { id: 'hr', label: { ar: 'الموارد البشرية', en: 'HR' }, icon: UserCog, permission: P.HR_VIEW_OWN, children: [
    { id: 'hr-home',      label: { ar: 'لوحة الموارد البشرية', en: 'HR Dashboard' }, icon: LayoutDashboard, path: '/hr',          permission: P.HR_VIEW_ALL },
    { id: 'employees',    label: { ar: 'الموظفين',        en: 'Employees' },    icon: Users,           path: '/hr/employees',    permission: P.HR_VIEW_OWN },
    { id: 'departments',  label: { ar: 'الأقسام',         en: 'Departments' },  icon: Building2,        path: '/hr/departments',  permission: P.HR_VIEW_ALL },
    { id: 'org-chart',    label: { ar: 'الهيكل التنظيمي', en: 'Org Chart' },    icon: GitCompareArrows, path: '/hr/org-chart',    permission: P.HR_VIEW_OWN },
    // ── 5 Hubs (replace ~25 individual items)
    { group: { ar: 'المراكز', en: 'Hubs' } },
    { id: 'time-hub',     label: { ar: 'الوقت والحضور', en: 'Time & Attendance' }, icon: Clock,          path: '/hr/time',        permission: P.ATTEND_VIEW_OWN },
    { id: 'payroll-hub',  label: { ar: 'المرتبات',     en: 'Payroll' },           icon: Wallet,         path: '/hr/payroll',     permission: P.PAYROLL_VIEW },
    { id: 'dev-hub',      label: { ar: 'الأداء والتطوير', en: 'Performance & Development' }, icon: TrendingUp, path: '/hr/development', permission: P.HR_VIEW_OWN },
    { id: 'talent-hub',   label: { ar: 'التوظيف',      en: 'Talent' },             icon: GraduationCap,  path: '/hr/talent',     permission: P.HR_VIEW_ALL },
    { id: 'admin-hub',    label: { ar: 'الملفات والإدارة', en: 'Records & Admin' }, icon: FileText,       path: '/hr/admin',     permission: P.HR_VIEW_ALL },
    // ── Personal portals
    { group: { ar: 'بوابات شخصية', en: 'Portals' } },
    { id: 'hr-reports',   label: { ar: 'التقارير',      en: 'Reports' },          icon: BarChart3,      path: '/hr/reports',    permission: P.PAYROLL_VIEW },
    { id: 'self-service', label: { ar: 'بوابة الموظف',  en: 'Self-Service' },     icon: User,           path: '/hr/self-service', permission: P.HR_VIEW_OWN },
    { id: 'manager-dash', label: { ar: 'لوحة المدير',  en: 'Manager Board' },     icon: LayoutDashboard, path: '/manager',         permission: P.HR_VIEW_OWN },
  ]},
  { id: 'finance', label: { ar: 'المالية', en: 'Finance' }, icon: Wallet, permission: P.FINANCE_VIEW, children: [
    { id: 'fin-overview', label: { ar: 'نظرة عامة', en: 'Overview' }, icon: PieChart, path: '/finance', permission: P.FINANCE_VIEW },
    { id: 'fin-coa', label: { ar: 'دليل الحسابات', en: 'Chart of Accounts' }, icon: BookOpen, path: '/finance/coa', permission: P.FINANCE_VIEW },
    { id: 'fin-journal', label: { ar: 'القيود اليومية', en: 'Journal Entries' }, icon: FileText, path: '/finance/journal', permission: P.FINANCE_VIEW },
    { id: 'fin-invoices', label: { ar: 'الفواتير', en: 'Invoices' }, icon: Receipt, path: '/finance/invoices', permission: P.FINANCE_VIEW },
    { id: 'fin-expenses', label: { ar: 'المصروفات', en: 'Expenses' }, icon: Wallet, path: '/finance/expenses', permission: P.EXPENSES_VIEW_OWN },
    { id: 'fin-reports', label: { ar: 'التقارير المالية', en: 'Reports' }, icon: BarChart3, path: '/finance/reports', permission: P.FINANCE_VIEW },
    { id: 'fin-budget', label: { ar: 'الموازنة', en: 'Budget' }, icon: TrendingUp, path: '/finance/budget', permission: P.FINANCE_VIEW },
  ]},
  { id: 'workspace', label: { ar: 'مساحة العمل', en: 'Workspace' }, icon: ClipboardList, permission: P.TASKS_VIEW_OWN, children: [
    { id: 'tasks', label: { ar: 'المهام', en: 'Tasks' }, icon: ClipboardList, path: '/tasks', permission: P.TASKS_VIEW_OWN },
    { id: 'calendar', label: { ar: 'التقويم', en: 'Calendar' }, icon: CalendarDays, path: '/calendar', permission: P.CALENDAR },
    { id: 'announcements', label: { ar: 'الإعلانات', en: 'Announcements' }, icon: Volume2, path: '/announcements', permission: P.DASHBOARD },
    { id: 'notifications', label: { ar: 'الإشعارات', en: 'Notifications' }, icon: Bell, path: '/notifications', permission: P.DASHBOARD },
  ]},
  { id: 'communication', label: { ar: 'التواصل', en: 'Communication' }, icon: MessageSquare, permission: P.CHAT_USE, children: [
    { id: 'chat', label: { ar: 'المحادثات', en: 'Chat' }, icon: MessageSquare, path: '/chat', permission: P.CHAT_USE },
    { id: 'email', label: { ar: 'البريد الإلكتروني', en: 'Email' }, icon: Mail, path: '/email', permission: P.CHAT_USE },
    { id: 'whatsapp', label: { ar: 'واتساب', en: 'WhatsApp' }, icon: MessageCircle, path: '/whatsapp', permission: P.CHAT_USE },
  ]},
  { id: 'reports', label: { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' }, icon: BarChart3, path: '/reports', permission: P.RPT_SALES },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' }, icon: Settings, path: '/settings/general', permission: P.SETTINGS_VIEW },
  { id: 'changelog', label: { ar: 'ما الجديد', en: "What's New" }, icon: Gift, path: '/changelog', permission: P.DASHBOARD },
  { id: 'help-center', label: { ar: 'مركز المساعدة', en: 'Help & Knowledge' }, icon: HelpCircle, permission: P.DASHBOARD, children: [
    { id: 'help', label: { ar: 'دليل الاستخدام', en: 'Help Center' }, icon: HelpCircle, path: '/help', permission: P.DASHBOARD },
    { id: 'knowledge-base', label: { ar: 'قاعدة المعرفة', en: 'Knowledge Base' }, icon: BookOpen, path: '/knowledge-base', permission: P.DASHBOARD },
  ]},
];

// ── Module-scoped navigation ────────────────────────────────────────────────
// The app is organised as focused "workspaces". The home launcher (/home) shows
// these as entry cards, and the sidebar scopes to ONE module at a time (derived
// from the URL) so you only ever see what belongs to the world you're in.
export const MODULE_IDS = ['crm', 'sales', 'operations', 'marketing', 'hr', 'finance', 'reports'];
export const GLOBAL_IDS = ['dashboard', 'activities', 'workspace', 'communication', 'help-center', 'changelog'];

// Extra route prefixes a module owns beyond its own path + children paths (some
// pages live under a different URL than their group, e.g. Leads at /leads). CRM
// now owns the real-estate inventory + deals routes it absorbed.
export const MODULE_EXTRA_PATHS = {
  crm: ['/crm', '/leads', '/contacts', '/real-estate', '/sales/deals'],
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
// nested page maps to the deepest owning module (e.g. /sales/deals → 'crm' via
// its child path, while /sales/commissions → 'sales').
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
  sales_agent:    ['dashboard', 'crm', 'activities', 'sales', 'workspace', 'communication', 'help-center'],
  team_leader:    ['dashboard', 'crm', 'activities', 'sales', 'workspace', 'communication', 'reports', 'help-center'],
  sales_manager:  ['dashboard', 'crm', 'activities', 'sales', 'workspace', 'communication', 'reports', 'help-center'],
  sales_director: ['dashboard', 'crm', 'activities', 'sales', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  marketing:      ['dashboard', 'crm', 'activities', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  hr:             ['dashboard', 'hr', 'activities', 'workspace', 'communication', 'help-center'],
  finance:        ['dashboard', 'finance', 'activities', 'sales', 'operations', 'workspace', 'communication', 'help-center'],
  operations:     ['dashboard', 'operations', 'activities', 'sales', 'crm', 'workspace', 'communication', 'help-center'],
};
