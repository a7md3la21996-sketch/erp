import { P } from './roles';
import {
  LayoutDashboard, Users, Target, Building2,
  DollarSign, Megaphone, UserCog, CalendarDays,
  ClipboardList, MessageSquare, Settings, BarChart3, Wallet,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'dashboard', label: { ar: 'لوحة التحكم', en: 'Dashboard' }, icon: LayoutDashboard, path: '/dashboard', permission: P.DASHBOARD },
  { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users, permission: P.CONTACTS_VIEW_OWN, children: [
    { id: 'contacts', label: { ar: 'جهات الاتصال', en: 'Contacts' }, path: '/crm/contacts', permission: P.CONTACTS_VIEW_OWN },
    { id: 'opportunities', label: { ar: 'الفرص البيعية', en: 'Opportunities' }, path: '/crm/opportunities', permission: P.OPPS_VIEW_OWN },
    { id: 'lead-pool', label: { ar: 'بركة الليدز', en: 'Lead Pool' }, path: '/crm/lead-pool', permission: P.POOL_VIEW },
  ]},
  { id: 'real-estate', label: { ar: 'العقارات', en: 'Real Estate' }, icon: Building2, permission: P.PROJECTS_VIEW, children: [
    { id: 'projects', label: { ar: 'المشاريع', en: 'Projects' }, path: '/real-estate/projects', permission: P.PROJECTS_VIEW },
    { id: 'units', label: { ar: 'الوحدات', en: 'Units' }, path: '/real-estate/units', permission: P.UNITS_VIEW },
  ]},
  { id: 'sales', label: { ar: 'المبيعات', en: 'Sales' }, icon: DollarSign, permission: P.DEALS_VIEW_OWN, children: [
    { id: 'deals', label: { ar: 'الصفقات', en: 'Deals' }, path: '/sales/deals', permission: P.DEALS_VIEW_OWN },
    { id: 'commissions', label: { ar: 'العمولات', en: 'Commissions' }, path: '/sales/commissions', permission: P.COMM_VIEW_OWN },
    { id: 'targets', label: { ar: 'التارجت', en: 'Targets' }, path: '/sales/targets', permission: P.RPT_SALES },
  ]},
  { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone, permission: P.CAMPAIGNS_VIEW, children: [
    { id: 'campaigns', label: { ar: 'الحملات', en: 'Campaigns' }, path: '/marketing/campaigns', permission: P.CAMPAIGNS_VIEW },
  ]},
  { id: 'hr', label: { ar: 'الموارد البشرية', en: 'HR' }, icon: UserCog, permission: P.HR_VIEW_OWN, children: [
    { id: 'attendance', label: { ar: 'الحضور', en: 'Attendance' }, path: '/hr/attendance', permission: P.ATTEND_VIEW_OWN },
    { id: 'leave', label: { ar: 'الإجازات', en: 'Leave' }, path: '/hr/leave', permission: P.LEAVE_REQUEST },
    { id: 'payroll', label: { ar: 'الرواتب', en: 'Payroll' }, path: '/hr/payroll', permission: P.PAYROLL_VIEW },
  ]},
  { id: 'finance', label: { ar: 'المالية', en: 'Finance' }, icon: Wallet, permission: P.FINANCE_VIEW, children: [
    { id: 'expenses', label: { ar: 'المصروفات', en: 'Expenses' }, path: '/finance/expenses', permission: P.EXPENSES_VIEW_OWN },
  ]},
  { id: 'tasks', label: { ar: 'المهام', en: 'Tasks' }, icon: ClipboardList, path: '/tasks', permission: P.TASKS_VIEW_OWN },
  { id: 'calendar', label: { ar: 'التقويم', en: 'Calendar' }, icon: CalendarDays, path: '/calendar', permission: P.CALENDAR },
  { id: 'chat', label: { ar: 'الدردشة', en: 'Chat' }, icon: MessageSquare, path: '/chat', permission: P.CHAT_USE },
  { id: 'reports', label: { ar: 'التقارير', en: 'Reports' }, icon: BarChart3, path: '/reports', permission: P.RPT_SALES },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' }, icon: Settings, permission: P.SETTINGS_VIEW, children: [
    { id: 'general', label: { ar: 'إعدادات عامة', en: 'General' }, path: '/settings/general', permission: P.SETTINGS_MANAGE },
    { id: 'users-mgmt', label: { ar: 'المستخدمين', en: 'Users' }, path: '/settings/users', permission: P.USERS_MANAGE },
    { id: 'audit', label: { ar: 'سجل المراجعة', en: 'Audit Log' }, path: '/settings/audit-log', permission: P.AUDIT_VIEW },
  ]},
];
