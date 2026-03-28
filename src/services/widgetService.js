import { reportError } from '../utils/errorReporter';
/**
 * Widget Layout Service
 * localStorage-based widget layout persistence (key: platform_widget_layout)
 */

const STORAGE_KEY = 'platform_widget_layout';

export const AVAILABLE_WIDGETS = [
  {
    id: 'kpi_overview',
    title_ar: 'نظرة عامة على الأداء',
    title_en: 'KPI Overview',
    description_ar: 'بطاقات مؤشرات الأداء الرئيسية',
    description_en: 'Main KPI indicator cards',
    category: 'general',
    defaultSize: 'lg',
  },
  {
    id: 'pipeline_chart',
    title_ar: 'خط الأنابيب',
    title_en: 'Sales Pipeline',
    description_ar: 'رسم بياني لمراحل البيع',
    description_en: 'Pipeline bar chart by stage',
    category: 'sales',
    defaultSize: 'lg',
  },
  {
    id: 'revenue_trend',
    title_ar: 'تطور الإيرادات',
    title_en: 'Revenue Trend',
    description_ar: 'رسم بياني لاتجاه الإيرادات',
    description_en: 'Revenue line/area chart',
    category: 'sales',
    defaultSize: 'md',
  },
  {
    id: 'top_sellers',
    title_ar: 'أفضل البائعين',
    title_en: 'Top Performers',
    description_ar: 'أفضل البائعين حسب الإيرادات',
    description_en: 'Top performers by revenue',
    category: 'sales',
    defaultSize: 'md',
  },
  {
    id: 'team_performance',
    title_ar: 'أداء الفريق — KPI',
    title_en: 'Team Performance — KPI',
    description_ar: 'ملخص أهداف الفريق',
    description_en: 'KPI targets summary',
    category: 'sales',
    defaultSize: 'md',
  },
  {
    id: 'today_tasks',
    title_ar: 'مهام اليوم المتكررة',
    title_en: "Today's Recurring Tasks",
    description_ar: 'المهام المتكررة المستحقة اليوم',
    description_en: 'Recurring tasks due today',
    category: 'general',
    defaultSize: 'md',
  },
  {
    id: 'today_followups',
    title_ar: 'متابعات اليوم',
    title_en: "Today's Follow-ups",
    description_ar: 'تذكيرات المتابعة',
    description_en: 'Follow-up reminders',
    category: 'general',
    defaultSize: 'md',
  },
  {
    id: 'my_day',
    title_ar: 'يومي',
    title_en: 'My Day',
    description_ar: 'ملخص يومك: متابعات + مهام متأخرة + ليدز جديدة + إجراءات سريعة',
    description_en: 'Your day: follow-ups + overdue + new leads + quick actions',
    category: 'general',
    defaultSize: 'lg',
  },
  {
    id: 'recent_activities',
    title_ar: 'أنشطة حديثة',
    title_en: 'Recent Activities',
    description_ar: 'آخر الأنشطة والمهام',
    description_en: 'Latest activities & tasks KPIs',
    category: 'general',
    defaultSize: 'md',
  },
  {
    id: 'recent_comments',
    title_ar: 'آخر التعليقات',
    title_en: 'Recent Comments',
    description_ar: 'آخر محادثات الفريق',
    description_en: 'Latest team chat',
    category: 'general',
    defaultSize: 'sm',
  },
  {
    id: 'pending_approvals',
    title_ar: 'موافقات معلقة',
    title_en: 'Pending Approvals',
    description_ar: 'عدد الموافقات المعلقة',
    description_en: 'Pending approval count',
    category: 'hr',
    defaultSize: 'sm',
  },
  {
    id: 'leave_summary',
    title_ar: 'ملخص الإجازات',
    title_en: 'Leave Summary',
    description_ar: 'نظرة عامة على طلبات الإجازة',
    description_en: 'Leave requests overview',
    category: 'hr',
    defaultSize: 'sm',
  },
  {
    id: 'expense_summary',
    title_ar: 'ملخص المصروفات',
    title_en: 'Expense Summary',
    description_ar: 'نظرة عامة على المصاريف',
    description_en: 'Expense claims overview',
    category: 'finance',
    defaultSize: 'sm',
  },
  {
    id: 'quick_stats',
    title_ar: 'إحصائيات سريعة',
    title_en: 'Quick Stats',
    description_ar: 'عدد جهات الاتصال والفرص والصفقات',
    description_en: 'Contacts/Opps/Deals counts',
    category: 'general',
    defaultSize: 'sm',
  },
  {
    id: 'hr_overview',
    title_ar: 'نظرة عامة HR',
    title_en: 'HR Overview',
    description_ar: 'مؤشرات الموارد البشرية',
    description_en: 'HR KPI cards and charts',
    category: 'hr',
    defaultSize: 'lg',
  },
  {
    id: 'announcements',
    title_ar: 'الإعلانات',
    title_en: 'Announcements',
    description_ar: 'آخر الإعلانات والتحديثات',
    description_en: 'Latest announcements & updates',
    category: 'general',
    defaultSize: 'md',
  },
  {
    id: 'activity_heatmap',
    title_ar: 'خريطة النشاط',
    title_en: 'Activity Heatmap',
    description_ar: 'خريطة حرارية للنشاط اليومي',
    description_en: 'Daily activity heatmap calendar',
    category: 'general',
    defaultSize: 'full',
  },
];

const CATEGORY_ROLES = {
  sales: ['admin', 'sales_director', 'sales_manager', 'team_leader', 'sales_agent', 'marketing'],
  hr: ['admin', 'hr'],
  finance: ['admin', 'finance'],
  general: null, // everyone
};

/**
 * Get the default layout based on user role
 */
export function getDefaultLayout(role = 'admin') {
  const visible = AVAILABLE_WIDGETS.filter(w => {
    const allowed = CATEGORY_ROLES[w.category];
    if (!allowed) return true; // general = everyone
    return allowed.includes(role);
  });

  return visible.map((w, i) => ({
    widgetId: w.id,
    visible: true,
    order: i,
    size: w.defaultSize,
  }));
}

/**
 * Get the user's saved layout, merging any new widgets that were added since last save
 */
export function getLayout(role = 'admin') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultLayout(role);

    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || saved.length === 0) return getDefaultLayout(role);

    // Merge: add any new widgets not in saved layout
    const savedIds = new Set(saved.map(s => s.widgetId));
    const defaults = getDefaultLayout(role);
    const missing = defaults.filter(d => !savedIds.has(d.widgetId));

    if (missing.length > 0) {
      const maxOrder = Math.max(...saved.map(s => s.order), 0);
      missing.forEach((m, i) => {
        saved.push({ ...m, order: maxOrder + i + 1, visible: false });
      });
    }

    // Remove widgets that no longer exist in registry
    const validIds = new Set(AVAILABLE_WIDGETS.map(w => w.id));
    const filtered = saved.filter(s => validIds.has(s.widgetId));

    return filtered.sort((a, b) => a.order - b.order);
  } catch (err) { reportError('widgetService', 'query', err);
    return getDefaultLayout(role);
  }
}

/**
 * Save the widget layout
 */
export function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch (err) { reportError('widgetService', 'query', err);
    return false;
  }
}

/**
 * Reset layout to defaults
 */
export function resetLayout(role = 'admin') {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return getDefaultLayout(role);
}

/**
 * Get widget metadata by id
 */
export function getWidgetMeta(widgetId) {
  return AVAILABLE_WIDGETS.find(w => w.id === widgetId) || null;
}

/**
 * Categories for grouping in the customization UI
 */
export const WIDGET_CATEGORIES = [
  { id: 'general', label_ar: 'عام', label_en: 'General' },
  { id: 'sales', label_ar: 'مبيعات', label_en: 'Sales' },
  { id: 'hr', label_ar: 'موارد بشرية', label_en: 'HR' },
  { id: 'finance', label_ar: 'مالية', label_en: 'Finance' },
];

export const SIZE_OPTIONS = [
  { value: 'sm', label_ar: 'صغير', label_en: 'Small' },
  { value: 'md', label_ar: 'متوسط', label_en: 'Medium' },
  { value: 'lg', label_ar: 'كبير', label_en: 'Large' },
  { value: 'full', label_ar: 'كامل', label_en: 'Full' },
];
