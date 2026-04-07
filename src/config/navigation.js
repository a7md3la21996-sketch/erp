import { P } from './roles';
import {
  LayoutDashboard, Users, Target, Building2, ActivitySquare, BookUser,
  DollarSign, Megaphone, UserCog, CalendarDays,
  ClipboardList, MessageSquare, Settings, BarChart3, Wallet, ClipboardCheck,
  TrendingUp, PieChart, Volume2, Crosshair, Grid3x3, Shield, Gift, Bell, HelpCircle,
  GitCompareArrows, Mail, BookOpen, Globe, FileText, MessageCircle,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: { ar: 'لوحة التحكم', en: 'Dashboard' }, icon: LayoutDashboard, path: '/dashboard', permission: P.DASHBOARD },
  { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users, permission: P.CONTACTS_VIEW_OWN, children: [
    { id: 'contacts', label: { ar: 'العملاء المحتملين', en: 'Leads' }, path: '/contacts', permission: P.CONTACTS_VIEW_OWN },
    { id: 'opportunities', label: { ar: 'الفرص البيعية', en: 'Opportunities' }, path: '/crm/opportunities', permission: P.OPPS_VIEW_OWN },
    { id: 'lead-pool', label: { ar: 'توزيع الليدز', en: 'Lead Distribution' }, path: '/crm/lead-pool', permission: P.POOL_VIEW },
  ]},
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
  { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone, permission: P.CAMPAIGNS_VIEW, children: [
    { id: 'mkt-dashboard', label: { ar: 'نظرة عامة', en: 'Dashboard' }, path: '/marketing', permission: P.CAMPAIGNS_VIEW },
    { id: 'mkt-campaigns', label: { ar: 'الحملات', en: 'Campaigns' }, path: '/marketing/campaigns', permission: P.CAMPAIGNS_VIEW },
    { id: 'mkt-channels', label: { ar: 'القنوات', en: 'Channels' }, path: '/marketing/channels', permission: P.CAMPAIGNS_VIEW },
    { id: 'mkt-funnel', label: { ar: 'القمع التسويقي', en: 'Funnel' }, path: '/marketing/funnel', permission: P.CAMPAIGNS_VIEW },
    { id: 'mkt-roi', label: { ar: 'تقرير الأداء و ROI', en: 'ROI Report' }, path: '/marketing/roi', permission: P.CAMPAIGNS_VIEW },
  ]},
  { id: 'hr', label: { ar: 'الموارد البشرية', en: 'HR' }, icon: UserCog, permission: P.HR_VIEW_OWN, children: [
    // ── الموظفين
    { group: { ar: 'الموظفين', en: 'People' } },
    { id: 'employees',    label: { ar: 'الموظفين',        en: 'Employees' },    path: '/hr/employees',    permission: P.HR_VIEW_OWN },
    { id: 'departments',  label: { ar: 'الأقسام',         en: 'Departments' },  path: '/hr/departments',  permission: P.HR_VIEW_ALL },
    { id: 'org-chart',    label: { ar: 'الهيكل التنظيمي', en: 'Org Chart' },    path: '/hr/org-chart',    permission: P.HR_VIEW_OWN },
    { id: 'documents',    label: { ar: 'المستندات',       en: 'Documents' },    path: '/hr/documents',    permission: P.HR_VIEW_ALL },
    // ── الحضور والدوام
    { group: { ar: 'الحضور والدوام', en: 'Attendance' } },
    { id: 'attendance',   label: { ar: 'الحضور',          en: 'Attendance' },   path: '/hr/attendance',   permission: P.ATTEND_VIEW_OWN },
    { id: 'shifts',       label: { ar: 'فترات الدوام',    en: 'Shifts' },       path: '/hr/shifts',       permission: P.HR_VIEW_ALL },
    { id: 'holidays',     label: { ar: 'الإجازات الرسمية', en: 'Holidays' },     path: '/hr/holidays',     permission: P.HR_VIEW_ALL },
    { id: 'overtime',     label: { ar: 'الأوفرتايم',     en: 'Overtime' },     path: '/hr/overtime',     permission: P.HR_VIEW_ALL },
    // ── المالي
    { group: { ar: 'المالي', en: 'Financial' } },
    { id: 'payroll',      label: { ar: 'الرواتب',         en: 'Payroll' },      path: '/hr/payroll',      permission: P.PAYROLL_VIEW },
    { id: 'loans',        label: { ar: 'السلف والقروض',  en: 'Loans' },        path: '/hr/loans',        permission: P.PAYROLL_VIEW },
    { id: 'bonuses',      label: { ar: 'المكافآت',        en: 'Bonuses' },      path: '/hr/bonuses',      permission: P.PAYROLL_VIEW },
    { id: 'expense-claims', label: { ar: 'طلبات المصروفات', en: 'Expenses' },   path: '/hr/expense-claims', permission: P.HR_VIEW_OWN },
    // ── الإجازات
    { group: { ar: 'الإجازات', en: 'Leave' } },
    { id: 'leave',        label: { ar: 'الإجازات',        en: 'Leave' },        path: '/hr/leave',        permission: P.LEAVE_REQUEST },
    { id: 'leave-carry',  label: { ar: 'ترحيل الإجازات', en: 'Carry-over' },   path: '/hr/leave-carryover', permission: P.HR_VIEW_ALL },
    // ── التطوير
    { group: { ar: 'التطوير', en: 'Development' } },
    { id: 'perf-reviews', label: { ar: 'تقييم الأداء',    en: 'Reviews' },      path: '/hr/reviews',      permission: P.HR_VIEW_ALL },
    { id: 'performance',  label: { ar: 'الأداء',          en: 'Performance' },  path: '/hr/performance',  permission: P.HR_VIEW_OWN },
    { id: 'goals',        label: { ar: 'الأهداف',         en: 'Goals & OKRs' }, path: '/hr/goals',        permission: P.HR_VIEW_OWN },
    { id: 'competencies', label: { ar: 'الكفاءات',        en: 'Competencies' }, path: '/hr/competencies', permission: P.HR_VIEW_OWN },
    { id: 'training',     label: { ar: 'التدريب',         en: 'Training' },     path: '/hr/training',     permission: P.HR_VIEW_ALL },
    // ── إدارة
    { group: { ar: 'إدارة', en: 'Admin' } },
    { id: 'contracts',    label: { ar: 'العقود',          en: 'Contracts' },    path: '/hr/contracts',    permission: P.HR_VIEW_ALL },
    { id: 'ats',          label: { ar: 'التوظيف',         en: 'Recruitment' },  path: '/hr/ats',          permission: P.HR_VIEW_ALL },
    { id: 'onboarding',   label: { ar: 'الاستقبال',       en: 'Onboarding' },   path: '/hr/onboarding',   permission: P.HR_VIEW_ALL },
    { id: 'disciplinary', label: { ar: 'التأديبية',       en: 'Disciplinary' }, path: '/hr/disciplinary', permission: P.HR_VIEW_ALL },
    { id: 'assets',       label: { ar: 'الأصول',          en: 'Assets' },       path: '/hr/assets',       permission: P.HR_VIEW_ALL },
    { id: 'policies',     label: { ar: 'السياسات',        en: 'Policies' },     path: '/hr/policies',     permission: P.HR_VIEW_ALL },
    { id: 'hr-reports',   label: { ar: 'التقارير',        en: 'Reports' },      path: '/hr/reports',      permission: P.PAYROLL_VIEW },
    { id: 'self-service', label: { ar: 'بوابة الموظف',    en: 'Self-Service' }, path: '/hr/self-service', permission: P.HR_VIEW_OWN },
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

/**
 * Role-based sidebar: only show these nav group IDs for each role.
 * If a role is not listed, all permitted items are shown (admin default).
 */
export const ROLE_NAV_GROUPS = {
  sales_agent:    ['dashboard', 'crm', 'sales', 'real-estate', 'workspace', 'communication', 'help-center'],
  team_leader:    ['dashboard', 'crm', 'sales', 'real-estate', 'workspace', 'communication', 'reports', 'help-center'],
  sales_manager:  ['dashboard', 'crm', 'sales', 'real-estate', 'workspace', 'communication', 'reports', 'help-center'],
  sales_director: ['dashboard', 'crm', 'sales', 'real-estate', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  marketing:      ['dashboard', 'crm', 'marketing', 'workspace', 'communication', 'reports', 'help-center'],
  hr:             ['dashboard', 'hr', 'workspace', 'communication', 'help-center'],
  finance:        ['dashboard', 'finance', 'sales', 'operations', 'workspace', 'communication', 'help-center'],
  operations:     ['dashboard', 'operations', 'sales', 'crm', 'real-estate', 'workspace', 'communication', 'help-center'],
};
