import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import {
  Sparkles, Zap, Bug, Shield, Star, ChevronDown, ChevronUp, Gift,
} from 'lucide-react';

const SEEN_KEY = 'platform_changelog_seen';

const CATEGORIES = {
  feature: { icon: Sparkles, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', en: 'Feature', ar: 'ميزة جديدة' },
  improvement: { icon: Zap, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', en: 'Improvement', ar: 'تحسين' },
  fix: { icon: Bug, color: '#eab308', bg: 'rgba(234,179,8,0.1)', en: 'Fix', ar: 'إصلاح' },
  security: { icon: Shield, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', en: 'Security', ar: 'أمان' },
};

const CHANGELOG = [
  // ── March 2026 ──
  {
    version: '2.8.0',
    date: '2026-03-15',
    category: 'security',
    title: { en: 'Security Settings Page', ar: 'صفحة إعدادات الأمان' },
    bullets: {
      en: ['IP Whitelist with enable/disable toggle', 'Password policy configuration with real-time validation', 'Export restrictions by role, format, and row limits'],
      ar: ['قائمة IP المسموح بها مع تبديل التفعيل', 'إعدادات سياسة كلمات المرور مع التحقق الفوري', 'قيود التصدير حسب الدور والصيغة وعدد الصفوف'],
    },
  },
  {
    version: '2.8.0',
    date: '2026-03-15',
    category: 'feature',
    title: { en: 'Changelog Page (What\'s New)', ar: 'صفحة ما الجديد' },
    bullets: {
      en: ['Timeline view of all platform updates', 'Category badges and new-item indicators', 'Bilingual AR/EN content with RTL support'],
      ar: ['عرض زمني لجميع تحديثات المنصة', 'شارات الفئات ومؤشرات العناصر الجديدة', 'محتوى ثنائي اللغة عربي/إنجليزي مع دعم RTL'],
    },
  },
  {
    version: '2.7.0',
    date: '2026-03-10',
    category: 'feature',
    title: { en: 'Edit Contact Modal', ar: 'نافذة تعديل جهة الاتصال' },
    bullets: {
      en: ['Full edit modal for contacts with all fields', 'Edit button in drawer header for quick access', 'Stage selector in opportunity cards'],
      ar: ['نافذة تعديل كاملة لجهات الاتصال', 'زر التعديل في رأس الدرج للوصول السريع', 'محدد المرحلة في بطاقات الفرص'],
    },
  },
  {
    version: '2.6.0',
    date: '2026-03-08',
    category: 'feature',
    title: { en: 'Advanced Filters & Chips', ar: 'فلاتر متقدمة وشرائح' },
    bullets: {
      en: ['New type chips for contacts', 'Count filter and department filter logic', 'Created_at field tracking', 'Drawer edit button'],
      ar: ['شرائح نوع جديدة لجهات الاتصال', 'فلتر العدد ومنطق فلتر الأقسام', 'تتبع حقل تاريخ الإنشاء', 'زر تعديل الدرج'],
    },
  },
  {
    version: '2.5.0',
    date: '2026-03-05',
    category: 'improvement',
    title: { en: 'Progress Bar & Dynamic Titles', ar: 'شريط التقدم والعناوين الديناميكية' },
    bullets: {
      en: ['Progress bar for opportunities', 'Dynamic page titles', 'Department and type filters', 'Company column in table', 'Invoices tab'],
      ar: ['شريط تقدم الفرص', 'عناوين صفحات ديناميكية', 'فلاتر الأقسام والأنواع', 'عمود الشركة في الجدول', 'تبويب الفواتير'],
    },
  },
  {
    version: '2.4.0',
    date: '2026-03-03',
    category: 'improvement',
    title: { en: 'Modal Steps & Conditional Fields', ar: 'خطوات النافذة والحقول الشرطية' },
    bullets: {
      en: ['Improved modal step navigation', 'Conditional fields based on contact_type', 'Better form validation'],
      ar: ['تحسين التنقل بين خطوات النافذة', 'حقول شرطية حسب نوع جهة الاتصال', 'تحسين التحقق من النماذج'],
    },
  },
  // ── February 2026 ──
  {
    version: '2.3.0',
    date: '2026-02-25',
    category: 'feature',
    title: { en: 'Announcements System', ar: 'نظام الإعلانات' },
    bullets: {
      en: ['Company-wide announcements page', 'Pin and prioritize important announcements', 'Rich text content support'],
      ar: ['صفحة إعلانات على مستوى الشركة', 'تثبيت وترتيب الإعلانات المهمة', 'دعم المحتوى النصي الغني'],
    },
  },
  {
    version: '2.2.0',
    date: '2026-02-20',
    category: 'feature',
    title: { en: 'Goals & OKRs Module', ar: 'الأهداف ونتائج رئيسية' },
    bullets: {
      en: ['Set and track team goals', 'OKR framework with progress tracking', 'Goal alignment and cascading'],
      ar: ['تحديد وتتبع أهداف الفريق', 'إطار OKR مع تتبع التقدم', 'محاذاة الأهداف والتسلسل'],
    },
  },
  {
    version: '2.1.0',
    date: '2026-02-15',
    category: 'feature',
    title: { en: 'Chart Builder', ar: 'منشئ الرسوم البيانية' },
    bullets: {
      en: ['Drag-and-drop chart creation', 'Multiple chart types: bar, line, pie, area', 'Export charts as images'],
      ar: ['إنشاء رسوم بيانية بالسحب والإفلات', 'أنواع متعددة: أعمدة، خطوط، دائري، مساحة', 'تصدير الرسوم كصور'],
    },
  },
  {
    version: '2.0.5',
    date: '2026-02-12',
    category: 'fix',
    title: { en: 'Dashboard Date Fix', ar: 'إصلاح تاريخ لوحة التحكم' },
    bullets: {
      en: ['Fixed date display on dashboard widgets', 'Corrected timezone handling for reports'],
      ar: ['إصلاح عرض التاريخ في أدوات لوحة التحكم', 'تصحيح معالجة المنطقة الزمنية للتقارير'],
    },
  },
  {
    version: '2.0.4',
    date: '2026-02-10',
    category: 'improvement',
    title: { en: 'Analytics Dashboard', ar: 'لوحة التحليلات' },
    bullets: {
      en: ['Advanced analytics with custom date ranges', 'Funnel analysis and conversion tracking', 'Performance benchmarks'],
      ar: ['تحليلات متقدمة مع نطاقات زمنية مخصصة', 'تحليل القمع وتتبع التحويل', 'مقاييس الأداء'],
    },
  },
  // ── January 2026 ──
  {
    version: '2.0.3',
    date: '2026-01-28',
    category: 'feature',
    title: { en: 'Chat Inbox', ar: 'صندوق المحادثات' },
    bullets: {
      en: ['Internal team messaging', 'Real-time chat with notifications', 'File sharing in conversations'],
      ar: ['رسائل الفريق الداخلية', 'محادثة فورية مع إشعارات', 'مشاركة الملفات في المحادثات'],
    },
  },
  {
    version: '2.0.2',
    date: '2026-01-22',
    category: 'feature',
    title: { en: 'SMS Templates', ar: 'قوالب الرسائل القصيرة' },
    bullets: {
      en: ['Create and manage SMS templates', 'Variable substitution for personalization', 'Template categorization'],
      ar: ['إنشاء وإدارة قوالب الرسائل', 'استبدال المتغيرات للتخصيص', 'تصنيف القوالب'],
    },
  },
  {
    version: '2.0.1',
    date: '2026-01-18',
    category: 'feature',
    title: { en: 'Print Settings', ar: 'إعدادات الطباعة' },
    bullets: {
      en: ['Custom print templates for invoices and reports', 'Company branding on printed documents', 'PDF export with formatting'],
      ar: ['قوالب طباعة مخصصة للفواتير والتقارير', 'العلامة التجارية على المستندات المطبوعة', 'تصدير PDF مع التنسيق'],
    },
  },
  {
    version: '2.0.0',
    date: '2026-01-15',
    category: 'feature',
    title: { en: 'Scheduled Reports', ar: 'التقارير المجدولة' },
    bullets: {
      en: ['Automatic report generation on schedule', 'Email delivery of reports', 'Custom report configurations'],
      ar: ['توليد تقارير تلقائية حسب الجدول', 'إرسال التقارير عبر البريد', 'إعدادات تقارير مخصصة'],
    },
  },
  {
    version: '1.9.0',
    date: '2026-01-10',
    category: 'feature',
    title: { en: 'Backup & Restore', ar: 'النسخ الاحتياطي والاستعادة' },
    bullets: {
      en: ['Full data backup to JSON', 'Selective restore with preview', 'Storage usage monitoring'],
      ar: ['نسخ احتياطي كامل إلى JSON', 'استعادة انتقائية مع معاينة', 'مراقبة استخدام التخزين'],
    },
  },
  {
    version: '1.8.0',
    date: '2026-01-05',
    category: 'feature',
    title: { en: 'Custom Fields Engine', ar: 'محرك الحقول المخصصة' },
    bullets: {
      en: ['Add custom fields to any entity', 'Support for text, number, date, dropdown types', 'Field visibility and required rules'],
      ar: ['إضافة حقول مخصصة لأي كيان', 'دعم أنواع النص والرقم والتاريخ والقائمة', 'قواعد الظهور والإلزامية'],
    },
  },
  // ── December 2025 ──
  {
    version: '1.7.0',
    date: '2025-12-28',
    category: 'feature',
    title: { en: 'Triggers & Automation', ar: 'المشغلات والأتمتة' },
    bullets: {
      en: ['Event-based automation triggers', 'Conditional actions and notifications', 'Workflow automation builder'],
      ar: ['مشغلات أتمتة مبنية على الأحداث', 'إجراءات وإشعارات شرطية', 'منشئ أتمتة سير العمل'],
    },
  },
  {
    version: '1.6.0',
    date: '2025-12-20',
    category: 'feature',
    title: { en: 'User Tracking & Activity', ar: 'تتبع المستخدمين والنشاط' },
    bullets: {
      en: ['Track user login history', 'Session monitoring', 'Activity heatmaps'],
      ar: ['تتبع سجل دخول المستخدمين', 'مراقبة الجلسات', 'خرائط حرارية للنشاط'],
    },
  },
  {
    version: '1.5.0',
    date: '2025-12-15',
    category: 'feature',
    title: { en: 'Operations Module', ar: 'وحدة العمليات' },
    bullets: {
      en: ['Deal processing workflow', 'Payment tracking', 'Handover management', 'After-sales service'],
      ar: ['سير عمل معالجة الصفقات', 'تتبع المدفوعات', 'إدارة التسليمات', 'خدمة ما بعد البيع'],
    },
  },
  {
    version: '1.4.0',
    date: '2025-12-10',
    category: 'feature',
    title: { en: 'Sales Forecast', ar: 'توقعات المبيعات' },
    bullets: {
      en: ['AI-assisted sales forecasting', 'Pipeline value projections', 'Monthly and quarterly targets'],
      ar: ['توقعات مبيعات بمساعدة الذكاء الاصطناعي', 'إسقاطات قيمة خط الأنابيب', 'أهداف شهرية وربعية'],
    },
  },
  {
    version: '1.3.0',
    date: '2025-12-05',
    category: 'improvement',
    title: { en: 'Global Search (Cmd+K)', ar: 'البحث العام (Cmd+K)' },
    bullets: {
      en: ['Search across all entities with Cmd+K', 'Fuzzy matching and recent items', 'Quick navigation to any page'],
      ar: ['بحث عبر جميع الكيانات بـ Cmd+K', 'مطابقة تقريبية وعناصر أخيرة', 'تنقل سريع لأي صفحة'],
    },
  },
];

// Group by month
function groupByMonth(items) {
  const groups = {};
  items.forEach(item => {
    const d = new Date(item.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

function getSeenVersions() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}

function markAllSeen() {
  const ids = CHANGELOG.map((c, i) => `${c.version}_${i}`);
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event('changelog_seen'));
}

export function getUnseenCount() {
  const seen = getSeenVersions();
  return CHANGELOG.filter((c, i) => !seen.includes(`${c.version}_${i}`)).length;
}

function isNew(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

export default function ChangelogPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  const [expandedMonths, setExpandedMonths] = useState({});
  const [filter, setFilter] = useState('all');

  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const pageBg = isDark ? '#0a1929' : '#f8fafc';
  const accent = '#4A7AAB';

  // Mark all as seen on mount
  useEffect(() => {
    markAllSeen();
  }, []);

  const filtered = filter === 'all' ? CHANGELOG : CHANGELOG.filter(c => c.category === filter);
  const grouped = groupByMonth(filtered);

  // Expand all months by default
  useEffect(() => {
    const map = {};
    grouped.forEach(([key]) => { map[key] = true; });
    setExpandedMonths(map);
  }, [filter]);

  const toggleMonth = (key) => {
    setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatMonth = (key) => {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1);
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
  };

  const seen = getSeenVersions();

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 24px 60px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Gift size={24} color={accent} />
          {isRTL ? 'ما الجديد' : "What's New"}
        </h1>
        <p style={{ fontSize: 14, color: textSecondary, margin: '6px 0 0' }}>
          {isRTL ? 'آخر التحديثات والميزات الجديدة في المنصة' : 'Latest updates and new features in the platform'}
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'all', en: 'All', ar: 'الكل' },
          { id: 'feature', en: 'Features', ar: 'ميزات' },
          { id: 'improvement', en: 'Improvements', ar: 'تحسينات' },
          { id: 'fix', en: 'Fixes', ar: 'إصلاحات' },
          { id: 'security', en: 'Security', ar: 'أمان' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${filter === tab.id ? accent : cardBorder}`,
              background: filter === tab.id ? accent : 'transparent',
              color: filter === tab.id ? '#fff' : textSecondary,
              fontSize: 13,
              fontWeight: filter === tab.id ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {isRTL ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {grouped.map(([monthKey, items]) => (
        <div key={monthKey} style={{ marginBottom: 20 }}>
          {/* Month header */}
          <button
            onClick={() => toggleMonth(monthKey)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 0',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: textPrimary,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {expandedMonths[monthKey] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            {formatMonth(monthKey)}
            <span style={{ fontSize: 12, fontWeight: 400, color: textSecondary, marginInlineStart: 4 }}>
              ({items.length})
            </span>
          </button>

          {expandedMonths[monthKey] && (
            <div style={{ position: 'relative', paddingInlineStart: 24 }}>
              {/* Timeline line */}
              <div style={{
                position: 'absolute',
                [isRTL ? 'right' : 'left']: 7,
                top: 0,
                bottom: 0,
                width: 2,
                background: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)',
                borderRadius: 1,
              }} />

              {items.map((item, idx) => {
                const cat = CATEGORIES[item.category];
                const Icon = cat.icon;
                const itemIsNew = isNew(item.date);

                return (
                  <div key={idx} style={{ position: 'relative', marginBottom: 16 }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute',
                      [isRTL ? 'right' : 'left']: -20,
                      top: 18,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: cat.color,
                      border: `2px solid ${pageBg}`,
                    }} />

                    {/* Card */}
                    <div style={{
                      background: cardBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius: 10,
                      padding: 16,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {/* Category badge */}
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 12,
                          background: cat.bg,
                          color: cat.color,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          <Icon size={12} />
                          {isRTL ? cat.ar : cat.en}
                        </span>

                        {/* Version */}
                        <span style={{ fontSize: 11, color: textSecondary, fontFamily: 'monospace' }}>
                          v{item.version}
                        </span>

                        {/* Date */}
                        <span style={{ fontSize: 11, color: textSecondary }}>
                          {new Date(item.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}
                        </span>

                        {/* New badge */}
                        {itemIsNew && (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: 'rgba(34,197,94,0.15)',
                            color: '#22c55e',
                            fontSize: 10,
                            fontWeight: 700,
                          }}>
                            {isRTL ? 'جديد' : 'NEW'}
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: 14, fontWeight: 700, color: textPrimary, margin: '0 0 8px' }}>
                        {isRTL ? item.title.ar : item.title.en}
                      </h3>

                      <ul style={{ margin: 0, paddingInlineStart: 18, listStyle: 'disc' }}>
                        {(isRTL ? item.bullets.ar : item.bullets.en).map((b, bi) => (
                          <li key={bi} style={{ fontSize: 13, color: textSecondary, marginBottom: 3, lineHeight: 1.5 }}>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: textSecondary, fontSize: 14 }}>
          {isRTL ? 'لا توجد تحديثات في هذه الفئة' : 'No updates in this category'}
        </div>
      )}
    </div>
  );
}
