import { useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  Search, ChevronDown, ChevronRight, Printer, LayoutDashboard, Users, TrendingUp, Target,
  Activity, CheckSquare, Award, Percent, BarChart3, UserCheck, Clock, CalendarOff, Banknote,
  Receipt, DollarSign, Settings, Megaphone, FileText, PieChart, HelpCircle, Lightbulb,
  Shield, Database, UserCog, Columns, GitBranch, Timer, Zap, Printer as PrinterIcon,
  MessageSquare, Archive, Eye, Calendar, Lock, Menu, X, BookOpen, ArrowUp,
} from 'lucide-react';

// ─── Help Data ───────────────────────────────────────────────────────────────

const HELP_DATA = [
  // ── General ──
  {
    id: 'dashboard',
    category: 'general',
    icon: LayoutDashboard,
    title: { ar: 'لوحة التحكم', en: 'Dashboard' },
    overview: {
      ar: 'لوحة التحكم الرئيسية هي مركز القيادة لعملياتك اليومية. تعرض مؤشرات الأداء الرئيسية (KPIs) والرسوم البيانية والأدوات المصغرة القابلة للتخصيص لمنحك نظرة شاملة فورية على أداء المؤسسة.',
      en: 'The main Dashboard is your command center for daily operations. It displays key performance indicators (KPIs), charts, and customizable widgets that give you an instant overview of organizational performance.',
    },
    features: {
      ar: ['أدوات مصغرة قابلة للتخصيص', 'سحب وإفلات لإعادة الترتيب', 'لوحة الاقتراحات الذكية', 'الإعلانات والتنبيهات', 'خريطة حرارية للنشاط', 'مؤشرات أداء ديناميكية'],
      en: ['Customizable widgets', 'Drag & drop to reorder', 'Smart suggestions panel', 'Announcements & alerts', 'Activity heatmap', 'Dynamic KPI indicators'],
    },
    howTo: {
      ar: [
        'لإضافة أداة مصغرة: اضغط على زر "إضافة أداة" واختر من القائمة المتاحة.',
        'لإزالة أداة: اضغط على أيقونة الإغلاق (×) في زاوية الأداة.',
        'لإعادة الترتيب: اسحب الأداة من شريط العنوان وأفلتها في الموضع المطلوب.',
        'لعرض مؤشرات الأداء: راجع البطاقات العلوية لمؤشرات المبيعات والعملاء والمهام.',
        'للاطلاع على الإعلانات: راجع قسم الإعلانات في أسفل اللوحة.',
      ],
      en: [
        'To add a widget: Click the "Add Widget" button and choose from the available list.',
        'To remove a widget: Click the close icon (×) in the widget corner.',
        'To reorder: Drag the widget by its title bar and drop in the desired position.',
        'To view KPIs: Check the top cards for sales, contacts, and task indicators.',
        'To check announcements: Review the announcements section at the bottom of the dashboard.',
      ],
    },
    tips: {
      ar: 'يتم حفظ تخطيط الأدوات المصغرة تلقائيًا. يمكنك تخصيص اللوحة حسب احتياجاتك وستظل كما هي في كل مرة تسجل فيها الدخول.',
      en: 'Widget layout is saved automatically. You can customize the dashboard to your needs and it will persist across login sessions.',
    },
    relatedSettings: { ar: 'إعدادات عامة > تخطيط اللوحة', en: 'General Settings > Dashboard Layout' },
  },
  // ── CRM ──
  {
    id: 'contacts',
    category: 'crm',
    icon: Users,
    title: { ar: 'جهات الاتصال', en: 'Contacts' },
    overview: {
      ar: 'إدارة جميع جهات الاتصال بما في ذلك العملاء المحتملين والعملاء الحاليين والموردين وغيرهم. يوفر النظام أدوات متقدمة للبحث والتصفية والإدارة الجماعية.',
      en: 'Manage all contacts including leads, clients, suppliers, and more. The system provides advanced tools for searching, filtering, and bulk management.',
    },
    features: {
      ar: ['إضافة/تعديل/حذف جهات الاتصال', 'إجراءات جماعية', 'استيراد/تصدير من Excel', 'فلاتر ذكية', 'سجل التدقيق', 'المفضلة والقائمة السوداء', 'دمج جهات الاتصال المكررة'],
      en: ['Add/edit/delete contacts', 'Bulk actions', 'Import/export from Excel', 'Smart filters', 'Audit trail', 'Favorites & blacklist', 'Merge duplicate contacts'],
    },
    howTo: {
      ar: [
        'لإضافة جهة اتصال: اضغط "إضافة جهة اتصال" واملأ النموذج المطلوب.',
        'للاستيراد من Excel: اضغط "استيراد" وارفع ملف Excel بالتنسيق المطلوب.',
        'لاستخدام الفلاتر الذكية: اضغط على أيقونة الفلتر واختر المعايير (النوع، القسم، المصدر، إلخ).',
        'لإرسال SMS جماعي: حدد جهات الاتصال المطلوبة ثم اضغط "إرسال SMS".',
        'لتغيير نوع جهة الاتصال: افتح بطاقة جهة الاتصال واضغط على حقل النوع لتغييره.',
        'لتعيين وكيل: افتح جهة الاتصال واختر الوكيل المسؤول من القائمة المنسدلة.',
      ],
      en: [
        'To add a contact: Click "Add Contact" and fill in the required form.',
        'To import from Excel: Click "Import" and upload an Excel file in the required format.',
        'To use smart filters: Click the filter icon and select criteria (type, department, source, etc.).',
        'To send bulk SMS: Select the desired contacts then click "Send SMS".',
        'To change contact type: Open the contact card and click the type field to change it.',
        'To assign an agent: Open the contact and select the responsible agent from the dropdown.',
      ],
    },
    tips: {
      ar: 'استخدم الفلاتر المحفوظة للوصول السريع إلى مجموعات جهات الاتصال التي تتعامل معها بشكل متكرر. يمكنك أيضًا تثبيت جهات الاتصال المهمة في المفضلة.',
      en: 'Use saved filters for quick access to contact groups you frequently work with. You can also pin important contacts to favorites.',
    },
    relatedSettings: { ar: 'حقول مخصصة، أنواع جهات الاتصال، الأقسام', en: 'Custom Fields, Contact Types, Departments' },
  },
  {
    id: 'opportunities',
    category: 'crm',
    icon: TrendingUp,
    title: { ar: 'الفرص البيعية', en: 'Opportunities' },
    overview: {
      ar: 'تتبع الفرص البيعية عبر مراحل خط الأنابيب المختلفة. إدارة الصفقات من الاكتشاف حتى الإغلاق مع تتبع الأنشطة والمستندات والتعليقات.',
      en: 'Track sales opportunities through different pipeline stages. Manage deals from discovery to closure with activity tracking, documents, and comments.',
    },
    features: {
      ar: ['إدارة المراحل', 'درجة الحرارة والأولوية', 'عرض كانبان', 'تحويل إلى صفقة', 'الأنشطة والمتابعات', 'المستندات والتعليقات'],
      en: ['Stage management', 'Temperature & priority', 'Kanban view', 'Deal conversion', 'Activities & follow-ups', 'Documents & comments'],
    },
    howTo: {
      ar: [
        'لإنشاء فرصة: اضغط "فرصة جديدة" واملأ البيانات الأساسية.',
        'للتحريك بين المراحل: اسحب البطاقة في عرض كانبان أو غيّر المرحلة من التفاصيل.',
        'للتحويل إلى صفقة: عند وصول الفرصة لمرحلة "تم الربح"، اضغط "تحويل إلى صفقة".',
        'لتسجيل نشاط: اضغط "إضافة نشاط" واختر النوع (مكالمة، اجتماع، إلخ).',
        'لإضافة متابعة: حدد تاريخ المتابعة القادم من تقويم المتابعات.',
      ],
      en: [
        'To create an opportunity: Click "New Opportunity" and fill in the basic details.',
        'To move between stages: Drag the card in Kanban view or change the stage from details.',
        'To convert to deal: When the opportunity reaches "Won" stage, click "Convert to Deal".',
        'To log an activity: Click "Add Activity" and select the type (call, meeting, etc.).',
        'To add a follow-up: Set the next follow-up date from the follow-up calendar.',
      ],
    },
    tips: {
      ar: 'يمكن تخصيص المراحل حسب كل قسم. استخدم أسباب الخسارة لتحليل لماذا تفشل بعض الفرص وتحسين معدل التحويل.',
      en: 'Stages can be customized per department. Use lost reasons to analyze why some opportunities fail and improve your conversion rate.',
    },
    relatedSettings: { ar: 'إعدادات النظام > المراحل، أسباب الخسارة', en: 'System Config > Stages, Lost Reasons' },
  },
  {
    id: 'lead-pool',
    category: 'crm',
    icon: Target,
    title: { ar: 'بركة الليدز', en: 'Lead Pool' },
    overview: {
      ar: 'العملاء المحتملون غير المعينين في انتظار التوزيع على فريق المبيعات. يمكن للوكلاء المطالبة بالليدز أو يمكن للمدير توزيعها.',
      en: 'Unassigned leads waiting to be distributed to the sales team. Agents can claim leads or managers can assign them.',
    },
    howTo: {
      ar: [
        'للمطالبة بعميل محتمل: اضغط على "مطالبة" بجانب العميل المحتمل المطلوب.',
        'لتعيين لوكيل: اختر العملاء المحتملين وحدد الوكيل من قائمة التعيين.',
        'للتصفية حسب المصدر: استخدم فلتر المصدر لعرض العملاء من قناة معينة.',
      ],
      en: [
        'To claim a lead: Click "Claim" next to the desired lead.',
        'To assign to an agent: Select leads and choose an agent from the assignment dropdown.',
        'To filter by source: Use the source filter to view leads from a specific channel.',
      ],
    },
    tips: {
      ar: 'تحقق من بركة الليدز بانتظام لضمان عدم ترك أي عميل محتمل دون متابعة لفترة طويلة.',
      en: 'Check the lead pool regularly to ensure no lead is left without follow-up for too long.',
    },
    relatedSettings: { ar: 'إعدادات النظام > قواعد التوزيع', en: 'System Config > Distribution Rules' },
  },
  // ── Activities ──
  {
    id: 'activities',
    category: 'general',
    icon: Activity,
    title: { ar: 'الأنشطة', en: 'Activities' },
    overview: {
      ar: 'تتبع جميع التفاعلات مع العملاء بما في ذلك المكالمات والاجتماعات والبريد الإلكتروني ورسائل واتساب وزيارات الموقع.',
      en: 'Track all customer interactions including calls, meetings, emails, WhatsApp messages, and site visits.',
    },
    howTo: {
      ar: [
        'لتسجيل نشاط: اضغط "نشاط جديد" واختر النوع وأدخل التفاصيل.',
        'لتحديد تاريخ متابعة: حدد تاريخ المتابعة القادم عند إنشاء أو تعديل النشاط.',
        'لعرض الجدول الزمني: انتقل إلى عرض الجدول الزمني لرؤية كل الأنشطة مرتبة زمنيًا.',
      ],
      en: [
        'To log an activity: Click "New Activity", choose the type, and enter details.',
        'To set a follow-up date: Set the next follow-up date when creating or editing an activity.',
        'To view timeline: Switch to timeline view to see all activities in chronological order.',
      ],
    },
    tips: {
      ar: 'سجل كل تفاعل مع العميل لبناء سجل كامل يساعد الفريق بأكمله على فهم تاريخ العلاقة.',
      en: 'Log every customer interaction to build a complete record that helps the entire team understand the relationship history.',
    },
    relatedSettings: { ar: 'أنواع الأنشطة في إعدادات النظام', en: 'Activity Types in System Config' },
  },
  // ── Tasks ──
  {
    id: 'tasks',
    category: 'general',
    icon: CheckSquare,
    title: { ar: 'المهام', en: 'Tasks' },
    overview: {
      ar: 'إدارة المهام مع الأولويات والتعيينات وتواريخ الاستحقاق. تتبع تقدم العمل وأنجز المهام بكفاءة.',
      en: 'Task management with priorities, assignments, and due dates. Track work progress and complete tasks efficiently.',
    },
    features: {
      ar: ['إنشاء مهام وتعيينها', 'تحديد الأولويات', 'تواريخ الاستحقاق', 'المهام المتكررة', 'التصفية حسب الحالة والأولوية'],
      en: ['Create and assign tasks', 'Set priorities', 'Due dates', 'Recurring tasks', 'Filter by status & priority'],
    },
    howTo: {
      ar: [
        'لإنشاء مهمة: اضغط "مهمة جديدة" واملأ العنوان والوصف والأولوية.',
        'لوضع علامة مكتملة: اضغط على مربع الاختيار بجانب المهمة أو غيّر الحالة.',
        'للتصفية: استخدم أزرار التصفية لعرض المهام حسب الحالة أو الأولوية أو المعين.',
      ],
      en: [
        'To create a task: Click "New Task" and fill in the title, description, and priority.',
        'To mark complete: Click the checkbox next to the task or change the status.',
        'To filter: Use filter buttons to view tasks by status, priority, or assignee.',
      ],
    },
    tips: {
      ar: 'استخدم المهام المتكررة للأعمال الروتينية مثل التقارير الأسبوعية أو المتابعات الدورية.',
      en: 'Use recurring tasks for routine work like weekly reports or periodic follow-ups.',
    },
    relatedSettings: { ar: 'إعدادات المهام', en: 'Task Settings' },
  },
  // ── Sales ──
  {
    id: 'deals',
    category: 'sales',
    icon: Award,
    title: { ar: 'الصفقات', en: 'Deals' },
    overview: {
      ar: 'تتبع الصفقات المغلقة والمكسوبة. عرض تفاصيل كل صفقة والإيرادات المحققة.',
      en: 'Track closed/won deals. View details of each deal and revenue generated.',
    },
    howTo: {
      ar: [
        'لعرض الصفقات: انتقل إلى صفحة الصفقات لرؤية جميع الصفقات النشطة والمغلقة.',
        'لتتبع الإيرادات: راجع ملخص الإيرادات في أعلى الصفحة.',
        'للتصدير: اضغط "تصدير" لتنزيل بيانات الصفقات بصيغة Excel أو CSV.',
      ],
      en: [
        'To view deals: Navigate to the Deals page to see all active and closed deals.',
        'To track revenue: Review the revenue summary at the top of the page.',
        'To export: Click "Export" to download deal data in Excel or CSV format.',
      ],
    },
    tips: {
      ar: 'استخدم الفلاتر لعرض الصفقات حسب الفترة الزمنية أو الوكيل أو القسم لتحليل الأداء.',
      en: 'Use filters to view deals by time period, agent, or department for performance analysis.',
    },
    relatedSettings: { ar: 'إعدادات الصفقات', en: 'Deal Settings' },
  },
  {
    id: 'commissions',
    category: 'sales',
    icon: Percent,
    title: { ar: 'العمولات', en: 'Commissions' },
    overview: {
      ar: 'حساب وتتبع عمولات المبيعات. عرض تقارير العمولات وتحديد نسب العمولة.',
      en: 'Calculate and track sales commissions. View commission reports and set commission rates.',
    },
    howTo: {
      ar: [
        'لعرض تقارير العمولات: انتقل إلى صفحة العمولات واختر الفترة الزمنية.',
        'لتحديد النسب: اذهب إلى الإعدادات وحدد نسبة العمولة لكل مستوى أو قسم.',
      ],
      en: [
        'To view commission reports: Navigate to the Commissions page and select the time period.',
        'To set rates: Go to settings and set the commission rate for each level or department.',
      ],
    },
    tips: {
      ar: 'يمكن تخصيص نسب العمولة حسب المنتج أو القسم أو مستوى الوكيل.',
      en: 'Commission rates can be customized by product, department, or agent level.',
    },
    relatedSettings: { ar: 'إعدادات العمولات', en: 'Commission Settings' },
  },
  {
    id: 'forecast',
    category: 'sales',
    icon: BarChart3,
    title: { ar: 'توقعات المبيعات', en: 'Sales Forecast' },
    overview: {
      ar: 'التنبؤ بالمبيعات وعرض التوقعات المستقبلية بناءً على البيانات الحالية والتاريخية.',
      en: 'Sales forecasting and projections based on current and historical data.',
    },
    howTo: {
      ar: [
        'لعرض التوقعات: انتقل إلى صفحة التوقعات لرؤية الرسوم البيانية والتحليلات.',
        'لتحليل الاتجاهات: استخدم فلاتر الفترة الزمنية لمقارنة الأداء عبر الفترات.',
      ],
      en: [
        'To view forecasts: Navigate to the Forecast page to see charts and analysis.',
        'To analyze trends: Use time period filters to compare performance across periods.',
      ],
    },
    tips: {
      ar: 'قارن التوقعات بالنتائج الفعلية بانتظام لتحسين دقة التنبؤ.',
      en: 'Compare forecasts with actual results regularly to improve prediction accuracy.',
    },
    relatedSettings: { ar: 'إعدادات التوقعات', en: 'Forecast Settings' },
  },
  // ── HR ──
  {
    id: 'employees',
    category: 'hr',
    icon: UserCheck,
    title: { ar: 'الموظفين', en: 'Employees' },
    overview: {
      ar: 'دليل الموظفين وإدارة بياناتهم. عرض الملفات الشخصية والمستندات والأقسام.',
      en: 'Employee directory and management. View profiles, documents, and departments.',
    },
    features: {
      ar: ['ملفات الموظفين الشخصية', 'إدارة المستندات', 'هيكل الأقسام', 'البحث والتصفية'],
      en: ['Employee profiles', 'Document management', 'Department structure', 'Search & filter'],
    },
    howTo: {
      ar: [
        'لإضافة موظف: اضغط "إضافة موظف" واملأ البيانات الشخصية والوظيفية.',
        'لإدارة السجلات: افتح ملف الموظف وعدّل أي قسم من البيانات.',
      ],
      en: [
        'To add an employee: Click "Add Employee" and fill in personal and job details.',
        'To manage records: Open the employee file and edit any data section.',
      ],
    },
    tips: {
      ar: 'حافظ على تحديث بيانات الموظفين لضمان دقة التقارير والإحصائيات.',
      en: 'Keep employee data updated to ensure accurate reports and statistics.',
    },
    relatedSettings: { ar: 'إعدادات الموارد البشرية', en: 'HR Settings' },
  },
  {
    id: 'attendance',
    category: 'hr',
    icon: Clock,
    title: { ar: 'الحضور', en: 'Attendance' },
    overview: {
      ar: 'تتبع حضور وانصراف الموظفين. عرض سجلات الحضور والتقارير.',
      en: 'Track employee attendance and check-in/out. View attendance records and reports.',
    },
    howTo: {
      ar: [
        'لعرض الحضور: انتقل إلى صفحة الحضور لرؤية سجل الحضور اليومي.',
        'لتسجيل الحضور/الانصراف: اضغط "تسجيل حضور" أو "تسجيل انصراف".',
      ],
      en: [
        'To view attendance: Navigate to the Attendance page to see daily records.',
        'To mark check-in/out: Click "Check In" or "Check Out".',
      ],
    },
    tips: {
      ar: 'يمكن ربط نظام الحضور بأجهزة البصمة لتسجيل تلقائي.',
      en: 'The attendance system can be integrated with biometric devices for automatic recording.',
    },
    relatedSettings: { ar: 'سياسات الحضور', en: 'Attendance Policies' },
  },
  {
    id: 'leave',
    category: 'hr',
    icon: CalendarOff,
    title: { ar: 'الإجازات', en: 'Leave' },
    overview: {
      ar: 'نظام طلب واعتماد الإجازات. تقديم طلبات الإجازة والموافقة عليها أو رفضها وعرض الرصيد.',
      en: 'Leave request and approval system. Submit leave requests, approve/reject, and view balance.',
    },
    howTo: {
      ar: [
        'لطلب إجازة: اضغط "طلب إجازة" واختر النوع والتواريخ.',
        'للموافقة/الرفض: راجع الطلبات المعلقة واضغط "موافقة" أو "رفض".',
        'لعرض الرصيد: راجع رصيد الإجازات في الشريط العلوي من الصفحة.',
      ],
      en: [
        'To request leave: Click "Request Leave" and choose the type and dates.',
        'To approve/reject: Review pending requests and click "Approve" or "Reject".',
        'To view balance: Check the leave balance in the top bar of the page.',
      ],
    },
    tips: {
      ar: 'يتم تحديث رصيد الإجازات تلقائيًا عند الموافقة على الطلبات.',
      en: 'Leave balance is automatically updated when requests are approved.',
    },
    relatedSettings: { ar: 'أنواع الإجازات، سياسات الإجازة', en: 'Leave Types, Leave Policies' },
  },
  {
    id: 'payroll',
    category: 'hr',
    icon: Banknote,
    title: { ar: 'الرواتب', en: 'Payroll' },
    overview: {
      ar: 'معالجة الرواتب وعرض كشوف المرتبات. حساب الراتب الصافي مع الاستقطاعات والبدلات.',
      en: 'Salary processing and payslip generation. Calculate net salary with deductions and allowances.',
    },
    howTo: {
      ar: [
        'لمعالجة الرواتب: اضغط "معالجة الرواتب" واختر الشهر والسنة.',
        'لعرض كشوف المرتبات: اضغط على اسم الموظف لعرض كشف الراتب التفصيلي.',
      ],
      en: [
        'To process payroll: Click "Process Payroll" and select the month and year.',
        'To view payslips: Click on the employee name to view detailed payslip.',
      ],
    },
    tips: {
      ar: 'تأكد من تحديث بيانات الحضور والإجازات قبل معالجة الرواتب.',
      en: 'Ensure attendance and leave data is updated before processing payroll.',
    },
    relatedSettings: { ar: 'هيكل الرواتب، الاستقطاعات', en: 'Salary Structure, Deductions' },
  },
  {
    id: 'expense-claims',
    category: 'hr',
    icon: Receipt,
    title: { ar: 'طلبات المصروفات', en: 'Expense Claims' },
    overview: {
      ar: 'تقديم طلبات المصروفات واعتمادها. إرفاق الإيصالات وتتبع حالة الموافقة.',
      en: 'Submit and approve expense claims. Attach receipts and track approval status.',
    },
    howTo: {
      ar: [
        'لتقديم طلب: اضغط "طلب مصروفات" واملأ التفاصيل وأرفق الإيصالات.',
        'لإرفاق إيصال: اضغط "إرفاق" وارفع صورة الإيصال.',
        'لتتبع الموافقة: راجع حالة الطلب في قائمة طلباتك.',
      ],
      en: [
        'To submit a claim: Click "Expense Claim" and fill in details with attached receipts.',
        'To attach a receipt: Click "Attach" and upload the receipt image.',
        'To track approval: Review the request status in your claims list.',
      ],
    },
    tips: {
      ar: 'أرفق دائمًا إيصالات واضحة لتسريع عملية الموافقة.',
      en: 'Always attach clear receipts to speed up the approval process.',
    },
    relatedSettings: { ar: 'سياسات المصروفات، حدود الموافقة', en: 'Expense Policies, Approval Limits' },
  },
  // ── Finance ──
  {
    id: 'finance',
    category: 'finance',
    icon: DollarSign,
    title: { ar: 'المالية', en: 'Finance' },
    overview: {
      ar: 'الإدارة المالية الشاملة بما في ذلك الفواتير والمدفوعات والتقارير المالية. إدارة دليل الحسابات والقيود اليومية.',
      en: 'Comprehensive financial management including invoices, payments, and financial reports. Manage chart of accounts and journal entries.',
    },
    features: {
      ar: ['إنشاء فواتير', 'تتبع المدفوعات', 'التقارير المالية', 'دليل الحسابات', 'القيود اليومية', 'إدارة الموازنة'],
      en: ['Create invoices', 'Track payments', 'Financial reports', 'Chart of accounts', 'Journal entries', 'Budget management'],
    },
    howTo: {
      ar: [
        'لإنشاء فاتورة: اضغط "فاتورة جديدة" واملأ بيانات العميل والبنود.',
        'لتسجيل دفعة: اضغط "تسجيل دفعة" وحدد الفاتورة والمبلغ.',
        'لإنشاء تقرير: اذهب إلى التقارير المالية واختر نوع التقرير والفترة.',
      ],
      en: [
        'To create an invoice: Click "New Invoice" and fill in customer and line item details.',
        'To record a payment: Click "Record Payment" and specify the invoice and amount.',
        'To generate a report: Go to Financial Reports and choose the report type and period.',
      ],
    },
    tips: {
      ar: 'طابق المدفوعات مع الفواتير بانتظام لضمان دقة السجلات المالية.',
      en: 'Reconcile payments with invoices regularly to ensure accurate financial records.',
    },
    relatedSettings: { ar: 'إعدادات المالية، العملات، الضرائب', en: 'Finance Settings, Currencies, Taxes' },
  },
  // ── Operations ──
  {
    id: 'operations',
    category: 'operations',
    icon: Settings,
    title: { ar: 'العمليات', en: 'Operations' },
    overview: {
      ar: 'إدارة المشاريع والعمليات. تتبع تقدم المشاريع ومراحل التسليم وخدمة ما بعد البيع.',
      en: 'Project and operations management. Track project progress, handover stages, and after-sales service.',
    },
    howTo: {
      ar: [
        'لإدارة المشاريع: انتقل إلى نظرة عامة لعرض جميع المشاريع والحالات.',
        'لتتبع التقدم: راجع شريط التقدم لكل مشروع أو صفقة.',
      ],
      en: [
        'To manage projects: Go to Overview to see all projects and their statuses.',
        'To track progress: Review the progress bar for each project or deal.',
      ],
    },
    tips: {
      ar: 'استخدم مراحل العمليات لضمان عدم تفويت أي خطوة في عملية التسليم.',
      en: 'Use operation stages to ensure no step is missed in the delivery process.',
    },
    relatedSettings: { ar: 'مراحل العمليات', en: 'Operation Stages' },
  },
  // ── Marketing ──
  {
    id: 'marketing',
    category: 'marketing',
    icon: Megaphone,
    title: { ar: 'التسويق', en: 'Marketing' },
    overview: {
      ar: 'إدارة الحملات التسويقية وتتبع أدائها. إنشاء حملات وتحليل النتائج وإدارة القنوات.',
      en: 'Campaign management and performance tracking. Create campaigns, analyze results, and manage channels.',
    },
    howTo: {
      ar: [
        'لإنشاء حملة: اضغط "حملة جديدة" وحدد القناة والميزانية والجمهور المستهدف.',
        'لتتبع الأداء: راجع لوحة التحكم التسويقية لمؤشرات الحملات.',
      ],
      en: [
        'To create a campaign: Click "New Campaign" and set the channel, budget, and target audience.',
        'To track performance: Review the marketing dashboard for campaign metrics.',
      ],
    },
    tips: {
      ar: 'ربط الحملات بمصادر جهات الاتصال لقياس العائد على الاستثمار بدقة.',
      en: 'Link campaigns to contact sources to accurately measure ROI.',
    },
    relatedSettings: { ar: 'القنوات التسويقية، المصادر', en: 'Marketing Channels, Sources' },
  },
  // ── Reports & Analytics ──
  {
    id: 'reports',
    category: 'reports',
    icon: FileText,
    title: { ar: 'التقارير', en: 'Reports' },
    overview: {
      ar: 'إنشاء وتصدير التقارير الشاملة. اختيار نوع التقرير وتطبيق الفلاتر والتصدير بصيغ مختلفة.',
      en: 'Generate and export comprehensive reports. Select report type, apply filters, and export in various formats.',
    },
    howTo: {
      ar: [
        'لاختيار نوع التقرير: اضغط على التبويب المطلوب (مبيعات، عملاء، أنشطة، إلخ).',
        'لتطبيق فلاتر: استخدم أزرار التصفية لتحديد الفترة والقسم والوكيل.',
        'للتصدير: اضغط "تصدير" واختر الصيغة (Excel أو CSV).',
      ],
      en: [
        'To select report type: Click on the desired tab (sales, contacts, activities, etc.).',
        'To apply filters: Use filter buttons to set period, department, and agent.',
        'To export: Click "Export" and choose the format (Excel or CSV).',
      ],
    },
    tips: {
      ar: 'استخدم التقارير المجدولة لإرسال تقارير تلقائية في مواعيد محددة.',
      en: 'Use scheduled reports to send automatic reports at specified times.',
    },
    relatedSettings: { ar: 'تقارير مجدولة', en: 'Scheduled Reports' },
  },
  {
    id: 'analytics',
    category: 'reports',
    icon: PieChart,
    title: { ar: 'تحليلات متقدمة', en: 'Analytics' },
    overview: {
      ar: 'تحليلات متقدمة مع قمع التحويل وعائد الاستثمار وأداء الوكلاء. رسوم بيانية تفاعلية وتصدير البيانات.',
      en: 'Advanced analytics with conversion funnel, ROI, and agent performance. Interactive charts and data export.',
    },
    howTo: {
      ar: [
        'للتنقل بين التبويبات: اضغط على تبويبات التحليل المختلفة (القمع، الأداء، العائد).',
        'للتصفية حسب التاريخ: استخدم منتقي التاريخ لتحديد الفترة المطلوبة.',
        'لتصدير البيانات: اضغط "تصدير" لتنزيل بيانات التحليل.',
      ],
      en: [
        'To switch tabs: Click on different analysis tabs (funnel, performance, ROI).',
        'To filter by date: Use the date picker to set the desired period.',
        'To export data: Click "Export" to download analysis data.',
      ],
    },
    tips: {
      ar: 'استخدم تحليلات القمع لتحديد نقاط الضعف في عملية المبيعات وتحسينها.',
      en: 'Use funnel analytics to identify and improve weak points in your sales process.',
    },
    relatedSettings: { ar: 'إعدادات التحليلات', en: 'Analytics Settings' },
  },
  // ── Settings ──
  {
    id: 'settings-roles',
    category: 'settings',
    icon: Shield,
    title: { ar: 'الأدوار والصلاحيات', en: 'Roles & Permissions' },
    overview: {
      ar: 'إدارة أدوار المستخدمين وتعيين الصلاحيات لكل وحدة. تحكم كامل في من يستطيع الوصول لأي جزء من النظام.',
      en: 'Manage user roles and assign permissions per module. Full control over who can access any part of the system.',
    },
    howTo: {
      ar: ['لإنشاء دور: اضغط "دور جديد" وحدد الصلاحيات المطلوبة.', 'لتعيين دور لمستخدم: افتح ملف المستخدم واختر الدور المناسب.'],
      en: ['To create a role: Click "New Role" and select the required permissions.', 'To assign a role: Open the user profile and select the appropriate role.'],
    },
    tips: { ar: 'اتبع مبدأ الحد الأدنى من الصلاحيات - امنح كل مستخدم فقط ما يحتاجه.', en: 'Follow the principle of least privilege - give each user only what they need.' },
    relatedSettings: { ar: 'إدارة المستخدمين', en: 'User Management' },
  },
  {
    id: 'settings-system',
    category: 'settings',
    icon: Settings,
    title: { ar: 'إعدادات النظام', en: 'System Config' },
    overview: {
      ar: 'إعدادات النظام الشاملة بما في ذلك أسباب الخسارة والمصادر وإعدادات عامة.',
      en: 'System-wide settings including lost reasons, sources, and general configuration.',
    },
    howTo: {
      ar: ['لتعديل الإعدادات: انتقل إلى إعدادات النظام وعدّل القيم المطلوبة.'],
      en: ['To modify settings: Navigate to System Config and edit the required values.'],
    },
    tips: { ar: 'احتفظ بنسخة احتياطية قبل إجراء تغييرات كبيرة على إعدادات النظام.', en: 'Take a backup before making major changes to system settings.' },
    relatedSettings: { ar: 'النسخ الاحتياطي', en: 'Backup & Restore' },
  },
  {
    id: 'settings-users',
    category: 'settings',
    icon: UserCog,
    title: { ar: 'المستخدمين', en: 'Users' },
    overview: {
      ar: 'إدارة المستخدمين ودعوة مستخدمين جدد. تعيين الأدوار وإدارة الوصول.',
      en: 'User management and inviting new users. Assign roles and manage access.',
    },
    howTo: {
      ar: ['لدعوة مستخدم: اضغط "دعوة مستخدم" وأدخل البريد الإلكتروني والدور.', 'لتعطيل مستخدم: افتح ملف المستخدم واضغط "تعطيل".'],
      en: ['To invite a user: Click "Invite User" and enter email and role.', 'To deactivate: Open user profile and click "Deactivate".'],
    },
    tips: { ar: 'راجع قائمة المستخدمين بانتظام وعطّل الحسابات غير النشطة.', en: 'Review user list regularly and deactivate inactive accounts.' },
    relatedSettings: { ar: 'الأدوار والصلاحيات', en: 'Roles & Permissions' },
  },
  {
    id: 'settings-custom-fields',
    category: 'settings',
    icon: Columns,
    title: { ar: 'حقول مخصصة', en: 'Custom Fields' },
    overview: {
      ar: 'إضافة حقول مخصصة لأي كيان في النظام لتتبع بيانات إضافية خاصة بعملك.',
      en: 'Add custom fields to any entity in the system to track additional data specific to your business.',
    },
    howTo: {
      ar: ['لإضافة حقل: اختر الكيان (جهة اتصال، فرصة، إلخ) ثم اضغط "إضافة حقل" وحدد النوع والاسم.'],
      en: ['To add a field: Select the entity (contact, opportunity, etc.) then click "Add Field" and set type and name.'],
    },
    tips: { ar: 'خطط للحقول المخصصة مسبقًا لتجنب الفوضى. استخدم أسماء واضحة ومتسقة.', en: 'Plan custom fields in advance to avoid clutter. Use clear, consistent names.' },
    relatedSettings: { ar: 'إعدادات النظام', en: 'System Config' },
  },
  {
    id: 'settings-workflows',
    category: 'settings',
    icon: GitBranch,
    title: { ar: 'سير العمل', en: 'Workflow Builder' },
    overview: {
      ar: 'إنشاء قواعد أتمتة لتبسيط العمليات. تحديد شروط وإجراءات تلقائية.',
      en: 'Create automation rules to streamline processes. Define conditions and automatic actions.',
    },
    howTo: {
      ar: ['لإنشاء سير عمل: اضغط "سير عمل جديد" وحدد المشغل والشروط والإجراءات.'],
      en: ['To create a workflow: Click "New Workflow" and define the trigger, conditions, and actions.'],
    },
    tips: { ar: 'ابدأ بسير عمل بسيط ثم أضف التعقيد تدريجيًا. اختبر دائمًا قبل التفعيل.', en: 'Start with simple workflows and add complexity gradually. Always test before activating.' },
    relatedSettings: { ar: 'المشغلات التلقائية', en: 'Triggers' },
  },
  {
    id: 'settings-sla',
    category: 'settings',
    icon: Timer,
    title: { ar: 'اتفاقيات مستوى الخدمة', en: 'SLA Management' },
    overview: {
      ar: 'تحديد سياسات وقت الاستجابة والحل. مراقبة الالتزام بمعايير الخدمة.',
      en: 'Set response/resolution time policies. Monitor service level compliance.',
    },
    howTo: {
      ar: ['لإنشاء SLA: اضغط "SLA جديد" وحدد أوقات الاستجابة والحل لكل أولوية.'],
      en: ['To create an SLA: Click "New SLA" and set response and resolution times per priority.'],
    },
    tips: { ar: 'راقب تقارير SLA بانتظام لتحديد مجالات التحسين.', en: 'Monitor SLA reports regularly to identify areas for improvement.' },
    relatedSettings: { ar: 'إعدادات النظام', en: 'System Config' },
  },
  {
    id: 'settings-triggers',
    category: 'settings',
    icon: Zap,
    title: { ar: 'المشغلات التلقائية', en: 'Triggers' },
    overview: {
      ar: 'إجراءات تلقائية يتم تنفيذها عند حدوث أحداث معينة في النظام.',
      en: 'Automated actions executed when specific events occur in the system.',
    },
    howTo: {
      ar: ['لإنشاء مشغل: حدد الحدث (إنشاء، تعديل، إلخ) والشروط والإجراء التلقائي.'],
      en: ['To create a trigger: Define the event (create, update, etc.), conditions, and automatic action.'],
    },
    tips: { ar: 'استخدم المشغلات لإرسال إشعارات تلقائية عند الأحداث المهمة.', en: 'Use triggers to send automatic notifications for important events.' },
    relatedSettings: { ar: 'سير العمل', en: 'Workflows' },
  },
  {
    id: 'settings-print',
    category: 'settings',
    icon: PrinterIcon,
    title: { ar: 'إعدادات الطباعة', en: 'Print Settings' },
    overview: {
      ar: 'تكوين قوالب الطباعة للفواتير والتقارير والمستندات.',
      en: 'Configure print templates for invoices, reports, and documents.',
    },
    howTo: {
      ar: ['لتعديل قالب: اختر القالب وعدّل التصميم والمحتوى.'],
      en: ['To edit a template: Select the template and modify the design and content.'],
    },
    tips: { ar: 'أضف شعار الشركة وبيانات التواصل لجميع قوالب الطباعة.', en: 'Add company logo and contact details to all print templates.' },
    relatedSettings: { ar: 'إعدادات عامة', en: 'General Settings' },
  },
  {
    id: 'settings-sms',
    category: 'settings',
    icon: MessageSquare,
    title: { ar: 'قوالب الرسائل', en: 'SMS Templates' },
    overview: {
      ar: 'إدارة قوالب الرسائل النصية مع المتغيرات الديناميكية.',
      en: 'Manage SMS templates with dynamic variables.',
    },
    howTo: {
      ar: ['لإنشاء قالب: اضغط "قالب جديد" واكتب النص مع إدراج المتغيرات مثل {name} و{company}.'],
      en: ['To create a template: Click "New Template" and write text with variables like {name} and {company}.'],
    },
    tips: { ar: 'استخدم المتغيرات لتخصيص الرسائل تلقائيًا لكل مستلم.', en: 'Use variables to automatically personalize messages for each recipient.' },
    relatedSettings: { ar: 'إعدادات النظام', en: 'System Config' },
  },
  {
    id: 'settings-backup',
    category: 'settings',
    icon: Archive,
    title: { ar: 'النسخ الاحتياطي والاستعادة', en: 'Backup & Restore' },
    overview: {
      ar: 'نسخ احتياطي واستعادة بيانات النظام. حماية البيانات من الفقدان.',
      en: 'Backup and restore system data. Protect data from loss.',
    },
    howTo: {
      ar: ['لإنشاء نسخة احتياطية: اضغط "نسخ احتياطي الآن" وانتظر اكتمال العملية.', 'للاستعادة: اختر النسخة واضغط "استعادة".'],
      en: ['To create a backup: Click "Backup Now" and wait for completion.', 'To restore: Select the backup and click "Restore".'],
    },
    tips: { ar: 'أنشئ نسخًا احتياطية بانتظام خاصة قبل التحديثات الكبيرة.', en: 'Create backups regularly, especially before major updates.' },
    relatedSettings: { ar: 'إعدادات النظام', en: 'System Config' },
  },
  {
    id: 'settings-audit',
    category: 'settings',
    icon: Eye,
    title: { ar: 'سجل التدقيق', en: 'Audit Log' },
    overview: {
      ar: 'عرض جميع إجراءات النظام والتغييرات. تتبع من فعل ماذا ومتى.',
      en: 'View all system actions and changes. Track who did what and when.',
    },
    howTo: {
      ar: ['لعرض السجل: انتقل إلى سجل التدقيق وصفّي حسب المستخدم أو الإجراء أو التاريخ.'],
      en: ['To view the log: Navigate to Audit Log and filter by user, action, or date.'],
    },
    tips: { ar: 'راجع سجل التدقيق بانتظام لاكتشاف أي أنشطة غير عادية.', en: 'Review the audit log regularly to detect any unusual activities.' },
    relatedSettings: { ar: 'الأمان', en: 'Security' },
  },
  {
    id: 'settings-export-import',
    category: 'settings',
    icon: Database,
    title: { ar: 'سجل التصدير والاستيراد', en: 'Export/Import History' },
    overview: {
      ar: 'تتبع جميع عمليات التصدير والاستيراد في النظام.',
      en: 'Track all export and import operations in the system.',
    },
    howTo: {
      ar: ['لعرض السجل: انتقل إلى الصفحة لرؤية جميع العمليات مع التاريخ والحالة.'],
      en: ['To view history: Navigate to the page to see all operations with date and status.'],
    },
    tips: { ar: 'تحقق من سجل الاستيراد بعد كل عملية للتأكد من نجاحها.', en: 'Check import history after each operation to confirm success.' },
    relatedSettings: { ar: 'النسخ الاحتياطي', en: 'Backup & Restore' },
  },
  {
    id: 'settings-scheduled-reports',
    category: 'settings',
    icon: Calendar,
    title: { ar: 'تقارير مجدولة', en: 'Scheduled Reports' },
    overview: {
      ar: 'إعداد تقارير تلقائية يتم إرسالها في مواعيد محددة.',
      en: 'Set up automatic report generation sent at specified times.',
    },
    howTo: {
      ar: ['لجدولة تقرير: اضغط "تقرير جديد" وحدد النوع والتكرار والمستلمين.'],
      en: ['To schedule a report: Click "New Report" and set the type, frequency, and recipients.'],
    },
    tips: { ar: 'أرسل تقارير أسبوعية للإدارة لإبقائهم على اطلاع بالأداء.', en: 'Send weekly reports to management to keep them informed of performance.' },
    relatedSettings: { ar: 'التقارير', en: 'Reports' },
  },
  {
    id: 'settings-security',
    category: 'settings',
    icon: Lock,
    title: { ar: 'الأمان', en: 'Security' },
    overview: {
      ar: 'إعدادات الأمان بما في ذلك قائمة IP المسموح بها وسياسات كلمات المرور وقيود التصدير.',
      en: 'Security settings including IP whitelist, password policies, and export restrictions.',
    },
    howTo: {
      ar: ['لتعديل سياسة كلمات المرور: انتقل إلى إعدادات الأمان وحدد متطلبات الحد الأدنى.', 'لإضافة IP مسموح: أدخل عنوان IP في قائمة السماح.'],
      en: ['To modify password policy: Go to Security settings and set minimum requirements.', 'To add allowed IP: Enter the IP address in the whitelist.'],
    },
    tips: { ar: 'فعّل المصادقة الثنائية لجميع الحسابات الإدارية.', en: 'Enable two-factor authentication for all admin accounts.' },
    relatedSettings: { ar: 'المستخدمين، الأدوار', en: 'Users, Roles' },
  },
];

const CATEGORIES = [
  { id: 'general', label: { ar: 'عام', en: 'General' }, icon: LayoutDashboard },
  { id: 'crm', label: { ar: 'إدارة العملاء', en: 'CRM' }, icon: Users },
  { id: 'sales', label: { ar: 'المبيعات', en: 'Sales' }, icon: DollarSign },
  { id: 'hr', label: { ar: 'الموارد البشرية', en: 'HR' }, icon: UserCheck },
  { id: 'finance', label: { ar: 'المالية', en: 'Finance' }, icon: DollarSign },
  { id: 'operations', label: { ar: 'العمليات', en: 'Operations' }, icon: Settings },
  { id: 'marketing', label: { ar: 'التسويق', en: 'Marketing' }, icon: Megaphone },
  { id: 'reports', label: { ar: 'التقارير والتحليلات', en: 'Reports & Analytics' }, icon: BarChart3 },
  { id: 'settings', label: { ar: 'الإعدادات', en: 'Settings' }, icon: Settings },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = isRTL ? 'ar' : 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeModule, setActiveModule] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const contentRef = useRef(null);

  // Filter modules by search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return HELP_DATA;
    const q = searchQuery.toLowerCase();
    return HELP_DATA.filter(m => {
      const titleMatch = m.title[lang].toLowerCase().includes(q) || m.title[isRTL ? 'en' : 'ar'].toLowerCase().includes(q);
      const overviewMatch = m.overview[lang].toLowerCase().includes(q);
      const featureMatch = m.features?.[lang]?.some(f => f.toLowerCase().includes(q));
      const howToMatch = m.howTo?.[lang]?.some(s => s.toLowerCase().includes(q));
      return titleMatch || overviewMatch || featureMatch || howToMatch;
    });
  }, [searchQuery, lang, isRTL]);

  // Group filtered data by category
  const groupedData = useMemo(() => {
    const groups = {};
    CATEGORIES.forEach(cat => {
      const items = filteredData.filter(m => m.category === cat.id);
      if (items.length > 0) groups[cat.id] = items;
    });
    return groups;
  }, [filteredData]);

  const toggleSection = useCallback((moduleId, section) => {
    setExpandedSections(prev => ({ ...prev, [`${moduleId}-${section}`]: !prev[`${moduleId}-${section}`] }));
  }, []);

  const handleModuleClick = useCallback((moduleId) => {
    setActiveModule(moduleId);
    setSidebarOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`help-module-${moduleId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const scrollToTop = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // ─── Colors ──────────────────────────────────────────────────────────────
  const colors = {
    bg: isDark ? '#1a1a2e' : '#f8f9fc',
    cardBg: isDark ? '#16213e' : '#ffffff',
    sidebarBg: isDark ? '#0f1129' : '#ffffff',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#e4e4e7' : '#1a1a2e',
    textMuted: isDark ? '#a0a0b4' : '#6b7280',
    accent: '#6366f1',
    accentLight: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
    accentBg: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.05)',
    tipBg: isDark ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.08)',
    tipBorder: isDark ? 'rgba(234,179,8,0.3)' : 'rgba(234,179,8,0.4)',
    tipText: isDark ? '#fbbf24' : '#92400e',
    hoverBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    searchBg: isDark ? '#0f1129' : '#f1f5f9',
    activeSidebar: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
    sectionHeaderBg: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  };

  // ─── Render Section Toggle ────────────────────────────────────────────────
  const renderSectionHeader = (moduleId, sectionKey, label) => {
    const isExpanded = expandedSections[`${moduleId}-${sectionKey}`] !== false; // default open
    return (
      <button
        onClick={() => toggleSection(moduleId, sectionKey)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
          background: colors.sectionHeaderBg, border: `1px solid ${colors.borderColor}`,
          borderRadius: 8, cursor: 'pointer', color: colors.text,
          fontSize: 14, fontWeight: 600, transition: 'background 0.15s',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
        onMouseEnter={e => e.currentTarget.style.background = colors.hoverBg}
        onMouseLeave={e => e.currentTarget.style.background = colors.sectionHeaderBg}
      >
        {isExpanded ? <ChevronDown size={16} /> : (isRTL ? <ChevronRight size={16} style={{ transform: 'scaleX(-1)' }} /> : <ChevronRight size={16} />)}
        <span>{label}</span>
      </button>
    );
  };

  // ─── Render Module Card ───────────────────────────────────────────────────
  const renderModule = (module) => {
    const Icon = module.icon;
    const isActive = activeModule === module.id;
    return (
      <div
        key={module.id}
        id={`help-module-${module.id}`}
        style={{
          background: colors.cardBg,
          border: `1px solid ${isActive ? colors.accent : colors.borderColor}`,
          borderRadius: 14,
          padding: 0,
          marginBottom: 20,
          overflow: 'hidden',
          boxShadow: isActive ? `0 0 0 2px ${colors.accentLight}` : `0 1px 3px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}`,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px',
          borderBottom: `1px solid ${colors.borderColor}`,
          background: colors.accentBg,
          direction: isRTL ? 'rtl' : 'ltr',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${colors.accent}, ${isDark ? '#818cf8' : '#4f46e5'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={22} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>{module.title[lang]}</h3>
            {isRTL && <p style={{ margin: '2px 0 0', fontSize: 12, color: colors.textMuted }}>{module.title.en}</p>}
          </div>
        </div>

        <div style={{ padding: '20px 24px', direction: isRTL ? 'rtl' : 'ltr' }}>
          {/* Overview */}
          <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.8, color: colors.textMuted }}>
            {module.overview[lang]}
          </p>

          {/* Features */}
          {module.features && (
            <div style={{ marginBottom: 18 }}>
              {renderSectionHeader(module.id, 'features', isRTL ? 'المميزات' : 'Features')}
              {expandedSections[`${module.id}-features`] !== false && (
                <ul style={{
                  margin: '10px 0 0', padding: isRTL ? '0 24px 0 0' : '0 0 0 24px',
                  listStyleType: 'disc', display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '6px 20px',
                }}>
                  {module.features[lang].map((f, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: colors.text }}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* How To */}
          {module.howTo && (
            <div style={{ marginBottom: 18 }}>
              {renderSectionHeader(module.id, 'howTo', isRTL ? 'كيفية الاستخدام' : 'How To')}
              {expandedSections[`${module.id}-howTo`] !== false && (
                <ol style={{
                  margin: '10px 0 0', padding: isRTL ? '0 24px 0 0' : '0 0 0 24px',
                  listStyleType: 'decimal',
                }}>
                  {module.howTo[lang].map((step, i) => (
                    <li key={i} style={{ fontSize: 13, lineHeight: 1.8, color: colors.text, marginBottom: 6 }}>{step}</li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {/* Tips */}
          {module.tips && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
              background: colors.tipBg, border: `1px solid ${colors.tipBorder}`,
              borderRadius: 10, marginBottom: 14,
            }}>
              <Lightbulb size={18} color={colors.tipText} style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: colors.tipText }}>
                <strong>{isRTL ? 'نصيحة: ' : 'Tip: '}</strong>{module.tips[lang]}
              </p>
            </div>
          )}

          {/* Related Settings */}
          {module.relatedSettings && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 12px', background: colors.accentBg,
              borderRadius: 8, fontSize: 12, color: colors.textMuted,
            }}>
              <Settings size={14} />
              <span><strong>{isRTL ? 'إعدادات ذات صلة: ' : 'Related Settings: '}</strong>{module.relatedSettings[lang]}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Sidebar ──────────────────────────────────────────────────────────────
  const renderSidebar = () => (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0',
    }}>
      {CATEGORIES.map(cat => {
        const items = filteredData.filter(m => m.category === cat.id);
        if (items.length === 0) return null;
        const CatIcon = cat.icon;
        return (
          <div key={cat.id}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5,
              color: colors.textMuted, direction: isRTL ? 'rtl' : 'ltr',
            }}>
              <CatIcon size={14} />
              <span>{cat.label[lang]}</span>
            </div>
            {items.map(m => {
              const MIcon = m.icon;
              const isActive = activeModule === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleModuleClick(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '9px 16px 9px 28px',
                    background: isActive ? colors.activeSidebar : 'transparent',
                    border: 'none', borderRadius: 0, cursor: 'pointer',
                    color: isActive ? colors.accent : colors.text,
                    fontSize: 13, fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s',
                    direction: isRTL ? 'rtl' : 'ltr',
                    ...(isRTL ? { paddingRight: 28, paddingLeft: 16 } : {}),
                    borderLeft: !isRTL && isActive ? `3px solid ${colors.accent}` : !isRTL ? '3px solid transparent' : undefined,
                    borderRight: isRTL && isActive ? `3px solid ${colors.accent}` : isRTL ? '3px solid transparent' : undefined,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = colors.hoverBg; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <MIcon size={15} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title[lang]}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: colors.bg, color: colors.text, fontFamily: 'inherit',
    }}>
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
        borderBottom: `1px solid ${colors.borderColor}`, background: colors.cardBg,
        flexWrap: 'wrap',
      }}>
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            display: 'none', background: 'none', border: `1px solid ${colors.borderColor}`,
            borderRadius: 8, padding: 8, cursor: 'pointer', color: colors.text,
            '@media (max-width: 768px)': { display: 'flex' },
          }}
          className="help-sidebar-toggle"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${colors.accent}, #818cf8)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>
              {isRTL ? 'دليل الاستخدام' : 'Help Center'}
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>
              {isRTL ? 'دليل شامل لاستخدام جميع وحدات النظام' : 'Comprehensive guide for all system modules'}
            </p>
          </div>
        </div>

        {/* Search */}
        <div style={{
          flex: 1, minWidth: 200, maxWidth: 480,
          position: 'relative',
          ...(isRTL ? { marginRight: 'auto' } : { marginLeft: 'auto' }),
        }}>
          <Search size={16} style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            ...(isRTL ? { right: 12 } : { left: 12 }),
            color: colors.textMuted, pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder={isRTL ? 'ابحث في دليل الاستخدام...' : 'Search help guide...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px',
              ...(isRTL ? { paddingRight: 38 } : { paddingLeft: 38 }),
              background: colors.searchBg, border: `1px solid ${colors.borderColor}`,
              borderRadius: 10, color: colors.text, fontSize: 14,
              outline: 'none', transition: 'border-color 0.2s',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
            onFocus={e => e.target.style.borderColor = colors.accent}
            onBlur={e => e.target.style.borderColor = colors.borderColor}
          />
        </div>

        {/* Print */}
        <button
          onClick={handlePrint}
          title={isRTL ? 'طباعة' : 'Print'}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: colors.accentBg,
            border: `1px solid ${colors.borderColor}`, borderRadius: 8,
            cursor: 'pointer', color: colors.accent, fontSize: 13, fontWeight: 500,
          }}
        >
          <Printer size={16} />
          <span className="help-print-label">{isRTL ? 'طباعة' : 'Print'}</span>
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar */}
        <aside
          className="help-sidebar"
          style={{
            width: 260, minWidth: 260, background: colors.sidebarBg,
            borderRight: isRTL ? 'none' : `1px solid ${colors.borderColor}`,
            borderLeft: isRTL ? `1px solid ${colors.borderColor}` : 'none',
            overflowY: 'auto', flexShrink: 0,
          }}
        >
          {renderSidebar()}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="help-sidebar-overlay"
            style={{
              display: 'none', position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.4)', zIndex: 99,
            }}
          />
        )}
        <aside
          className="help-sidebar-mobile"
          style={{
            display: 'none', position: 'fixed', top: 0, bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 280, background: colors.sidebarBg, zIndex: 100,
            overflowY: 'auto', boxShadow: '4px 0 20px rgba(0,0,0,0.2)',
            transform: sidebarOpen ? 'translateX(0)' : (isRTL ? 'translateX(100%)' : 'translateX(-100%)'),
            transition: 'transform 0.3s ease',
          }}
        >
          <div style={{ padding: '16px', borderBottom: `1px solid ${colors.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: colors.text }}>{isRTL ? 'الأقسام' : 'Modules'}</span>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          {renderSidebar()}
        </aside>

        {/* Main content */}
        <main ref={contentRef} style={{
          flex: 1, overflowY: 'auto', padding: '24px 32px', position: 'relative',
        }}>
          {filteredData.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '80px 20px', color: colors.textMuted,
            }}>
              <Search size={48} style={{ marginBottom: 16, opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 8px', color: colors.text, fontWeight: 600 }}>
                {isRTL ? 'لا توجد نتائج' : 'No results found'}
              </h3>
              <p style={{ margin: 0, fontSize: 14 }}>
                {isRTL ? 'جرب كلمات بحث مختلفة' : 'Try different search terms'}
              </p>
            </div>
          ) : (
            Object.entries(groupedData).map(([catId, items]) => {
              const cat = CATEGORIES.find(c => c.id === catId);
              if (!cat) return null;
              return (
                <div key={catId} style={{ marginBottom: 36 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 18, paddingBottom: 10,
                    borderBottom: `2px solid ${colors.accent}`,
                  }}>
                    <cat.icon size={20} color={colors.accent} />
                    <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: colors.text }}>
                      {cat.label[lang]}
                    </h2>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 12,
                      background: colors.accentLight, color: colors.accent, fontWeight: 600,
                    }}>
                      {items.length}
                    </span>
                  </div>
                  {items.map(renderModule)}
                </div>
              );
            })
          )}

          {/* Scroll to top */}
          <button
            onClick={scrollToTop}
            style={{
              position: 'sticky', bottom: 20, float: isRTL ? 'left' : 'right',
              width: 40, height: 40, borderRadius: '50%',
              background: colors.accent, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            title={isRTL ? 'العودة للأعلى' : 'Scroll to top'}
          >
            <ArrowUp size={18} color="#fff" />
          </button>
        </main>
      </div>

      {/* ── Responsive Styles ─────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .help-sidebar { display: none !important; }
          .help-sidebar-toggle { display: flex !important; }
          .help-sidebar-mobile { display: block !important; }
          .help-sidebar-overlay { display: block !important; }
          .help-print-label { display: none; }
        }
        @media print {
          .help-sidebar, .help-sidebar-toggle, .help-sidebar-mobile,
          .help-sidebar-overlay, button { display: none !important; }
          main { padding: 20px !important; overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}
