const STORAGE_KEY = 'platform_knowledge_base';
const MAX_ARTICLES = 500;

// ── Categories ─────────────────────────────────────────────────────────
export const CATEGORIES = {
  sales_process:      { ar: 'عمليات المبيعات',    en: 'Sales Process',       color: '#4A7AAB', icon: 'TrendingUp' },
  product_info:       { ar: 'معلومات المنتجات',    en: 'Product Info',        color: '#10B981', icon: 'Package' },
  objection_handling: { ar: 'معالجة الاعتراضات',   en: 'Objection Handling',  color: '#F59E0B', icon: 'MessageCircle' },
  onboarding:         { ar: 'تأهيل الموظفين',      en: 'Onboarding',         color: '#8B5CF6', icon: 'UserPlus' },
  policies:           { ar: 'السياسات',            en: 'Policies',           color: '#EF4444', icon: 'Shield' },
  faq:                { ar: 'الأسئلة الشائعة',     en: 'FAQ',                color: '#06B6D4', icon: 'HelpCircle' },
};

// ── localStorage helpers ───────────────────────────────────────────────
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function save(list) {
  if (list.length > MAX_ARTICLES) list = list.slice(0, MAX_ARTICLES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      list = list.slice(0, Math.floor(MAX_ARTICLES / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* give up */ }
    }
  }
}

// ── Seed mock data ─────────────────────────────────────────────────────
function seedIfEmpty() {
  const list = load();
  if (list.length > 0) return list;

  const now = new Date().toISOString();
  const seed = [
    {
      id: 'kb_1',
      title: 'Sales Call Best Practices',
      title_ar: 'أفضل ممارسات مكالمات المبيعات',
      content: '## Introduction\n\nEffective sales calls require preparation, active listening, and clear communication.\n\n### Before the Call\n- Research the prospect\n- Prepare key talking points\n- Set a clear objective\n\n### During the Call\n- Start with a warm greeting\n- Ask open-ended questions\n- Listen more than you talk\n- Present solutions, not features\n\n### After the Call\n- Send a follow-up email within 24 hours\n- Log the call in the CRM\n- Schedule next steps',
      content_ar: '## مقدمة\n\nتتطلب مكالمات المبيعات الفعالة الإعداد والاستماع النشط والتواصل الواضح.\n\n### قبل المكالمة\n- ابحث عن العميل المحتمل\n- حضّر نقاط الحديث الرئيسية\n- حدد هدفًا واضحًا\n\n### أثناء المكالمة\n- ابدأ بتحية دافئة\n- اطرح أسئلة مفتوحة\n- استمع أكثر مما تتحدث\n- قدم حلولًا وليس مزايا\n\n### بعد المكالمة\n- أرسل بريدًا إلكترونيًا للمتابعة خلال 24 ساعة\n- سجل المكالمة في النظام\n- حدد الخطوات التالية',
      category: 'sales_process',
      tags: ['calls', 'best-practices', 'sales'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 24,
      pinned: true,
    },
    {
      id: 'kb_2',
      title: 'Handling Price Objections',
      title_ar: 'التعامل مع اعتراضات السعر',
      content: '## Common Price Objections\n\n### "It\'s too expensive"\n- Acknowledge the concern\n- Reframe the conversation around value\n- Compare total cost of ownership\n- Offer flexible payment options\n\n### "We found a cheaper option"\n- Ask what\'s included in the cheaper option\n- Highlight your unique value propositions\n- Emphasize long-term ROI\n\n### "We don\'t have the budget"\n- Understand their budget cycle\n- Offer a phased approach\n- Show cost savings from your solution',
      content_ar: '## اعتراضات السعر الشائعة\n\n### "هذا مكلف جدًا"\n- اعترف بالقلق\n- أعد صياغة المحادثة حول القيمة\n- قارن التكلفة الإجمالية للملكية\n- قدم خيارات دفع مرنة\n\n### "وجدنا خيارًا أرخص"\n- اسأل عما يتضمنه الخيار الأرخص\n- أبرز عروض القيمة الفريدة لديك\n- أكد على العائد على الاستثمار طويل المدى\n\n### "ليس لدينا الميزانية"\n- افهم دورة الميزانية لديهم\n- قدم نهجًا مرحليًا\n- أظهر التوفير في التكاليف من حلك',
      category: 'objection_handling',
      tags: ['objections', 'pricing', 'negotiation'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 18,
      pinned: true,
    },
    {
      id: 'kb_3',
      title: 'New Employee Onboarding Checklist',
      title_ar: 'قائمة تأهيل الموظف الجديد',
      content: '## First Day\n- [ ] Set up workstation\n- [ ] Create email and system accounts\n- [ ] Introduction to team members\n- [ ] Review company handbook\n\n## First Week\n- [ ] Complete HR paperwork\n- [ ] Attend orientation sessions\n- [ ] Shadow a team member\n- [ ] Set up CRM access\n\n## First Month\n- [ ] Complete all training modules\n- [ ] Set 90-day goals with manager\n- [ ] First 1:1 meeting\n- [ ] Review company policies',
      content_ar: '## اليوم الأول\n- [ ] إعداد محطة العمل\n- [ ] إنشاء حسابات البريد الإلكتروني والنظام\n- [ ] التعريف بأعضاء الفريق\n- [ ] مراجعة دليل الشركة\n\n## الأسبوع الأول\n- [ ] إكمال أوراق الموارد البشرية\n- [ ] حضور جلسات التوجيه\n- [ ] متابعة أحد أعضاء الفريق\n- [ ] إعداد الوصول لنظام CRM\n\n## الشهر الأول\n- [ ] إكمال جميع وحدات التدريب\n- [ ] تحديد أهداف 90 يومًا مع المدير\n- [ ] أول اجتماع فردي\n- [ ] مراجعة سياسات الشركة',
      category: 'onboarding',
      tags: ['onboarding', 'checklist', 'new-hire'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 32,
      pinned: false,
    },
    {
      id: 'kb_4',
      title: 'Leave & Attendance Policy',
      title_ar: 'سياسة الإجازات والحضور',
      content: '## Working Hours\n- Standard working hours: 9:00 AM - 6:00 PM\n- Lunch break: 1 hour\n- Flexible start time: 8:00 AM - 10:00 AM\n\n## Leave Entitlement\n- Annual leave: 21 days per year\n- Sick leave: 15 days per year\n- Personal leave: 3 days per year\n\n## Leave Request Process\n1. Submit request through HR Self-Service portal\n2. Manager approval required\n3. Minimum 3 days notice for planned leave\n4. Emergency leave: notify manager immediately',
      content_ar: '## ساعات العمل\n- ساعات العمل القياسية: 9:00 صباحًا - 6:00 مساءً\n- استراحة الغداء: ساعة واحدة\n- وقت بدء مرن: 8:00 صباحًا - 10:00 صباحًا\n\n## استحقاق الإجازات\n- إجازة سنوية: 21 يومًا في السنة\n- إجازة مرضية: 15 يومًا في السنة\n- إجازة شخصية: 3 أيام في السنة\n\n## عملية طلب الإجازة\n1. تقديم الطلب من خلال بوابة الخدمة الذاتية للموارد البشرية\n2. موافقة المدير مطلوبة\n3. إشعار 3 أيام كحد أدنى للإجازة المخططة\n4. إجازة طارئة: إخطار المدير فورًا',
      category: 'policies',
      tags: ['leave', 'attendance', 'hr', 'policy'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 45,
      pinned: false,
    },
    {
      id: 'kb_5',
      title: 'CRM Quick Start Guide',
      title_ar: 'دليل البدء السريع للنظام',
      content: '## Getting Started\n\n### Adding a Contact\n1. Click "Add Contact" button\n2. Fill in required fields (name, phone, email)\n3. Select contact type (lead, client, etc.)\n4. Assign to a department\n\n### Creating an Opportunity\n1. Open a contact record\n2. Click "Create Opportunity"\n3. Set the stage, value, and expected close date\n4. Add notes and next steps\n\n### Logging Activities\n- Use the activity log for calls, meetings, and emails\n- Set reminders for follow-ups\n- Track all interactions in the timeline',
      content_ar: '## البدء\n\n### إضافة جهة اتصال\n1. اضغط زر "إضافة جهة اتصال"\n2. املأ الحقول المطلوبة (الاسم، الهاتف، البريد الإلكتروني)\n3. اختر نوع جهة الاتصال (عميل محتمل، عميل، إلخ)\n4. عيّن القسم\n\n### إنشاء فرصة\n1. افتح سجل جهة الاتصال\n2. اضغط "إنشاء فرصة"\n3. حدد المرحلة والقيمة وتاريخ الإغلاق المتوقع\n4. أضف الملاحظات والخطوات التالية\n\n### تسجيل الأنشطة\n- استخدم سجل الأنشطة للمكالمات والاجتماعات والبريد الإلكتروني\n- عيّن تذكيرات للمتابعة\n- تتبع جميع التفاعلات في الجدول الزمني',
      category: 'faq',
      tags: ['crm', 'guide', 'getting-started'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 56,
      pinned: false,
    },
    {
      id: 'kb_6',
      title: 'Product Features Overview',
      title_ar: 'نظرة عامة على مزايا المنتج',
      content: '## Core Features\n\n### CRM Module\n- Contact management with smart filters\n- Opportunity pipeline tracking\n- Activity logging and reminders\n\n### Sales Module\n- Deal management\n- Commission tracking\n- Sales forecasting\n\n### HR Module\n- Employee management\n- Leave and attendance\n- Payroll processing\n\n### Finance Module\n- Chart of accounts\n- Invoice management\n- Budget tracking',
      content_ar: '## المزايا الأساسية\n\n### وحدة CRM\n- إدارة جهات الاتصال مع فلاتر ذكية\n- تتبع خط أنابيب الفرص\n- تسجيل الأنشطة والتذكيرات\n\n### وحدة المبيعات\n- إدارة الصفقات\n- تتبع العمولات\n- توقعات المبيعات\n\n### وحدة الموارد البشرية\n- إدارة الموظفين\n- الإجازات والحضور\n- معالجة الرواتب\n\n### وحدة المالية\n- دليل الحسابات\n- إدارة الفواتير\n- تتبع الميزانية',
      category: 'product_info',
      tags: ['features', 'overview', 'product'],
      author: 'Admin',
      created_at: now,
      updated_at: now,
      views: 12,
      pinned: false,
    },
  ];

  save(seed);
  return seed;
}

// ── CRUD ───────────────────────────────────────────────────────────────

export function getAll() {
  const list = seedIfEmpty();
  return [...list].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

export function getById(id) {
  return load().find(a => a.id === id) || null;
}

export function create(data) {
  const list = load();
  const article = {
    id: `kb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: data.title || '',
    title_ar: data.title_ar || '',
    content: data.content || '',
    content_ar: data.content_ar || '',
    category: data.category || 'faq',
    tags: data.tags || [],
    author: data.author || 'Unknown',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    views: 0,
    pinned: data.pinned || false,
  };
  list.unshift(article);
  save(list);
  return article;
}

export function update(id, data) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...data,
    id, // preserve id
    updated_at: new Date().toISOString(),
  };
  save(list);
  return list[idx];
}

export function remove(id) {
  const list = load().filter(a => a.id !== id);
  save(list);
  return true;
}

// ── Queries ────────────────────────────────────────────────────────────

export function searchArticles(query) {
  if (!query || !query.trim()) return getAll();
  const q = query.toLowerCase().trim();
  return getAll().filter(a => {
    return (
      a.title.toLowerCase().includes(q) ||
      a.title_ar.includes(q) ||
      a.content.toLowerCase().includes(q) ||
      a.content_ar.includes(q) ||
      a.tags.some(t => t.toLowerCase().includes(q))
    );
  });
}

export function getByCategory(cat) {
  return getAll().filter(a => a.category === cat);
}

export function incrementViews(id) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return;
  list[idx].views = (list[idx].views || 0) + 1;
  save(list);
  return list[idx];
}

export function togglePin(id) {
  const list = load();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return null;
  list[idx].pinned = !list[idx].pinned;
  list[idx].updated_at = new Date().toISOString();
  save(list);
  return list[idx];
}
