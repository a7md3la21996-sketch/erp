import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  BookOpen, Plus, X, Search, CheckCircle, Clock, Users,
  DollarSign, Calendar, Star, TrendingUp, Award, Filter,
  ChevronRight, Edit2, Trash2, AlertCircle, BarChart2
} from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';

// ── Mock Data ──────────────────────────────────────────────────

const INITIAL_COURSES = [
  {
    id: 'c1', type: 'internal',
    title_ar: 'مهارات التواصل الفعال', title_en: 'Effective Communication Skills',
    competency: 'communication', department: 'all',
    trainer_ar: 'أحمد سالم', trainer_en: 'Ahmed Salem',
    start_date: '2026-03-15', end_date: '2026-03-17',
    duration_days: 3, cost: 0, max_seats: 20,
    status: 'upcoming',
    enrollments: ['e1', 'e2', 'e3', 'e5'],
    completed: ['e1'],
    description_ar: 'تطوير مهارات التواصل والعرض والإقناع',
    description_en: 'Develop communication, presentation and persuasion skills',
  },
  {
    id: 'c2', type: 'external',
    title_ar: 'إدارة المشاريع PMP', title_en: 'PMP Project Management',
    competency: 'problem_solving', department: 'all',
    trainer_ar: 'معهد PMI', trainer_en: 'PMI Institute',
    start_date: '2026-04-01', end_date: '2026-04-05',
    duration_days: 5, cost: 15000, max_seats: 5,
    status: 'upcoming',
    enrollments: ['e4', 'e6'],
    completed: [],
    description_ar: 'شهادة إدارة المشاريع الاحترافية',
    description_en: 'Professional project management certification',
  },
  {
    id: 'c3', type: 'internal',
    title_ar: 'برنامج القيادة والإدارة', title_en: 'Leadership & Management Program',
    competency: 'initiative', department: 'all',
    trainer_ar: 'سارة محمود', trainer_en: 'Sara Mahmoud',
    start_date: '2026-02-01', end_date: '2026-02-10',
    duration_days: 10, cost: 0, max_seats: 15,
    status: 'completed',
    enrollments: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'],
    completed: ['e1', 'e2', 'e3', 'e4', 'e5'],
    description_ar: 'تطوير مهارات القيادة واتخاذ القرار',
    description_en: 'Develop leadership and decision-making skills',
  },
  {
    id: 'c4', type: 'external',
    title_ar: 'Excel المتقدم وتحليل البيانات', title_en: 'Advanced Excel & Data Analysis',
    competency: 'quality', department: 'finance',
    trainer_ar: 'مركز مايكروسوفت', trainer_en: 'Microsoft Center',
    start_date: '2026-03-20', end_date: '2026-03-22',
    duration_days: 3, cost: 5000, max_seats: 10,
    status: 'upcoming',
    enrollments: ['e7', 'e8'],
    completed: [],
    description_ar: 'تحليل البيانات المالية باستخدام Excel المتقدم',
    description_en: 'Financial data analysis using advanced Excel',
  },
  {
    id: 'c5', type: 'internal',
    title_ar: 'خدمة العملاء المتميزة', title_en: 'Excellence in Customer Service',
    competency: 'communication', department: 'sales',
    trainer_ar: 'محمد عادل', trainer_en: 'Mohamed Adel',
    start_date: '2026-01-10', end_date: '2026-01-12',
    duration_days: 3, cost: 0, max_seats: 20,
    status: 'completed',
    enrollments: ['e1', 'e2', 'e5', 'e9', 'e10'],
    completed: ['e1', 'e2', 'e5', 'e9', 'e10'],
    description_ar: 'مهارات التعامل مع العملاء وحل الشكاوى',
    description_en: 'Customer handling and complaint resolution skills',
  },
];

const BUDGET = { total: 80000, year: 2026 };

const STATUS_CONFIG = {
  upcoming:  { ar: 'قادم',    en: 'Upcoming',  color: '#3B82F6', bg: '#3B82F615' },
  ongoing:   { ar: 'جاري',    en: 'Ongoing',   color: '#F59E0B', bg: '#F59E0B15' },
  completed: { ar: 'منتهى',   en: 'Completed', color: '#10B981', bg: '#10B98115' },
  cancelled: { ar: 'ملغي',    en: 'Cancelled', color: '#EF4444', bg: '#EF444415' },
};

const TYPE_CONFIG = {
  internal: { ar: 'داخلي', en: 'Internal', color: '#6366F1', bg: '#6366F115', icon: '🏢' },
  external: { ar: 'خارجي', en: 'External', color: '#EC4899', bg: '#EC489915', icon: '🌐' },
};

const EMPTY_FORM = {
  type: 'internal', title_ar: '', title_en: '',
  competency: 'communication', department: 'all',
  trainer_ar: '', trainer_en: '',
  start_date: '', end_date: '', duration_days: 1,
  cost: 0, max_seats: 10, status: 'upcoming',
  description_ar: '', description_en: '',
};

// ── Course Card ────────────────────────────────────────────────
function CourseCard({ course, lang, isRTL, c, isDark, employees, onClick }) {
  const status = STATUS_CONFIG[course.status];
  const type = TYPE_CONFIG[course.type];
  const completionRate = course.enrollments.length > 0
    ? Math.round((course.completed.length / course.enrollments.length) * 100) : 0;
  const enrolled = employees.filter(e => course.enrollments.includes(e.id));

  return (
    <div
      onClick={onClick}
      style={{
        background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border,
        padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Top Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: type.bg, color: type.color }}>
            {type.icon} {lang === 'ar' ? type.ar : type.en}
          </span>
          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.bg, color: status.color }}>
            {lang === 'ar' ? status.ar : status.en}
          </span>
        </div>
        {course.cost > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
            {course.cost.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 4 }}>
        {lang === 'ar' ? course.title_ar : course.title_en}
      </div>
      <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 12 }}>
        👨‍🏫 {lang === 'ar' ? course.trainer_ar : course.trainer_en} · {course.duration_days} {lang === 'ar' ? 'يوم' : 'days'}
      </div>

      {/* Dates */}
      <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 12 }}>
        📅 {course.start_date} → {course.end_date}
      </div>

      {/* Progress */}
      {course.status === 'completed' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'نسبة الإتمام' : 'Completion'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: completionRate === 100 ? '#10B981' : '#F59E0B' }}>{completionRate}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
            <div style={{ height: '100%', borderRadius: 4, width: completionRate + '%', background: completionRate === 100 ? '#10B981' : '#F59E0B', transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {/* Avatars */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', gap: -4 }}>
          {enrolled.slice(0, 5).map((emp, i) => (
            <div key={emp.id} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: `hsl(${emp.id.charCodeAt(1) * 40}, 60%, 50%)`,
              border: '2px solid ' + c.cardBg, marginLeft: i > 0 ? -8 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
            </div>
          ))}
          {enrolled.length > 5 && (
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: c.border,
              border: '2px solid ' + c.cardBg, marginLeft: -8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, color: c.textMuted,
            }}>+{enrolled.length - 5}</div>
          )}
        </div>
        <span style={{ fontSize: 11, color: c.textMuted }}>
          {enrolled.length}/{course.max_seats} {lang === 'ar' ? 'مقعد' : 'seats'}
        </span>
      </div>
    </div>
  );
}

// ── Course Modal ───────────────────────────────────────────────
function CourseModal({ course, employees, onClose, onSave, onDelete, lang, isRTL, c, isDark }) {
  const [tab, setTab] = useState('details');
  const [enrolled, setEnrolled] = useState(course.enrollments || []);
  const [completed, setCompleted] = useState(course.completed || []);
  const [search, setSearch] = useState('');

  const status = STATUS_CONFIG[course.status];
  const type = TYPE_CONFIG[course.type];

  const filteredEmps = employees.filter(e =>
    !search ||
    (lang === 'ar' ? e.full_name_ar : e.full_name_en).toLowerCase().includes(search.toLowerCase())
  );

  const toggleEnroll = (empId) => {
    setEnrolled(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
    if (!enrolled.includes(empId)) return;
    setCompleted(prev => prev.filter(id => id !== empId));
  };

  const toggleComplete = (empId) => {
    if (!enrolled.includes(empId)) return;
    setCompleted(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
  };

  const handleSave = () => onSave({ ...course, enrollments: enrolled, completed });

  const comp = COMPETENCIES.find(c => c.key === course.competency);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: type.bg, color: type.color }}>
                {type.icon} {lang === 'ar' ? type.ar : type.en}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: status.bg, color: status.color }}>
                {lang === 'ar' ? status.ar : status.en}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? course.title_ar : course.title_en}
            </div>
            <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>
              👨‍🏫 {lang === 'ar' ? course.trainer_ar : course.trainer_en} · 📅 {course.start_date} → {course.end_date}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {[
            { key: 'details',   ar: 'التفاصيل',    en: 'Details'    },
            { key: 'enrollments', ar: 'المشاركون', en: 'Enrollments' },
            { key: 'completion', ar: 'الإتمام',    en: 'Completion'  },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '12px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: 'transparent',
              color: tab === t.key ? c.accent : c.textMuted,
              borderBottom: tab === t.key ? '2px solid ' + c.accent : '2px solid transparent',
              transition: 'all 0.15s',
            }}>
              {lang === 'ar' ? t.ar : t.en}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>

          {/* Details Tab */}
          {tab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: 16, borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border }}>
                <p style={{ margin: 0, fontSize: 14, color: c.text, lineHeight: 1.6 }}>
                  {lang === 'ar' ? course.description_ar : course.description_en}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: '🎯', label: lang === 'ar' ? 'الكفاءة المستهدفة' : 'Target Competency', value: comp ? (lang === 'ar' ? comp.ar : comp.en) : '-' },
                  { icon: '💰', label: lang === 'ar' ? 'التكلفة' : 'Cost', value: course.cost > 0 ? `${course.cost.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}` : (lang === 'ar' ? 'مجاني' : 'Free') },
                  { icon: '⏱️', label: lang === 'ar' ? 'المدة' : 'Duration', value: `${course.duration_days} ${lang === 'ar' ? 'يوم' : 'days'}` },
                  { icon: '💺', label: lang === 'ar' ? 'المقاعد' : 'Seats', value: `${enrolled.length} / ${course.max_seats}` },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 8, background: c.cardBg, border: '1px solid ' + c.border }}>
                    <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {course.status === 'completed' && (
                <div style={{ padding: 16, borderRadius: 10, background: '#10B98110', border: '1px solid #10B98130' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>
                    ✅ {lang === 'ar' ? 'نتائج التدريب' : 'Training Results'}
                  </div>
                  <div style={{ display: 'flex', gap: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#10B981' }}>{completed.length}</div>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'أتموا' : 'Completed'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#F59E0B' }}>{enrolled.length - completed.length}</div>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'لم يتموا' : 'Incomplete'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: c.accent }}>
                        {enrolled.length > 0 ? Math.round((completed.length / enrolled.length) * 100) : 0}%
                      </div>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'نسبة النجاح' : 'Success Rate'}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enrollments Tab */}
          {tab === 'enrollments' && (
            <div>
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
                  style={{ width: '100%', padding: isRTL ? '9px 38px 9px 12px' : '9px 12px 9px 38px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                {filteredEmps.map(emp => {
                  const isEnrolled = enrolled.includes(emp.id);
                  return (
                    <div key={emp.id} onClick={() => toggleEnroll(emp.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                      borderRadius: 8, border: '1px solid ' + (isEnrolled ? c.accent : c.border),
                      background: isEnrolled ? (isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF') : 'transparent',
                      cursor: 'pointer', transition: 'all 0.15s',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${emp.id.charCodeAt(1) * 40}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                      </div>
                      <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid ' + (isEnrolled ? c.accent : c.border), background: isEnrolled ? c.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isEnrolled && <CheckCircle size={12} color="#fff" />}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: c.textMuted, textAlign: isRTL ? 'right' : 'left' }}>
                {enrolled.length} {lang === 'ar' ? 'موظف مسجل' : 'enrolled'} / {course.max_seats} {lang === 'ar' ? 'مقعد' : 'seats'}
              </div>
            </div>
          )}

          {/* Completion Tab */}
          {tab === 'completion' && (
            <div>
              <p style={{ fontSize: 13, color: c.textMuted, margin: '0 0 16px', textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'حدد من أتم التدريب بنجاح' : 'Mark who successfully completed the training'}
              </p>
              {enrolled.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: c.textMuted }}>
                  <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا يوجد مشاركون بعد' : 'No enrollments yet'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                  {employees.filter(e => enrolled.includes(e.id)).map(emp => {
                    const isDone = completed.includes(emp.id);
                    return (
                      <div key={emp.id} onClick={() => toggleComplete(emp.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 8, border: '1px solid ' + (isDone ? '#10B981' : c.border),
                        background: isDone ? '#10B98110' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: `hsl(${emp.id.charCodeAt(1) * 40}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                        </div>
                        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                          <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isDone ? (
                            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>✅ {lang === 'ar' ? 'أتم' : 'Done'}</span>
                          ) : (
                            <span style={{ fontSize: 11, color: c.textMuted }}>⏳ {lang === 'ar' ? 'لم يتم' : 'Pending'}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={() => onDelete(course.id)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #EF444440', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trash2 size={13} /> {lang === 'ar' ? 'حذف' : 'Delete'}
          </button>
          <div style={{ display: 'flex', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button onClick={handleSave} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {lang === 'ar' ? 'حفظ' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Course Modal ───────────────────────────────────────────
function AddCourseModal({ onClose, onAdd, lang, isRTL, c, isDark }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.title_ar.trim()) e.title_ar = true;
    if (!form.title_en.trim()) e.title_en = true;
    if (!form.trainer_ar.trim()) e.trainer_ar = true;
    if (!form.start_date) e.start_date = true;
    if (!form.end_date) e.end_date = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputStyle = (err) => ({
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid ' + (err ? '#EF4444' : c.border),
    background: c.inputBg, color: c.text, fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
    direction: isRTL ? 'rtl' : 'ltr',
  });

  const Row2 = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
  );

  const Field = ({ label, children }) => (
    <div>
      <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: c.text }}>{lang === 'ar' ? '+ إضافة برنامج تدريبي' : '+ Add Training Program'}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Row2>
            <Field label={lang === 'ar' ? 'النوع' : 'Type'}>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle(false)}>
                <option value="internal">{lang === 'ar' ? 'داخلي' : 'Internal'}</option>
                <option value="external">{lang === 'ar' ? 'خارجي' : 'External'}</option>
              </select>
            </Field>
            <Field label={lang === 'ar' ? 'الكفاءة المستهدفة' : 'Target Competency'}>
              <select value={form.competency} onChange={e => set('competency', e.target.value)} style={inputStyle(false)}>
                {COMPETENCIES.map(c => <option key={c.key} value={c.key}>{lang === 'ar' ? c.ar : c.en}</option>)}
              </select>
            </Field>
          </Row2>

          <Field label={lang === 'ar' ? 'اسم البرنامج (عربي) *' : 'Program Name (Arabic) *'}>
            <input value={form.title_ar} onChange={e => set('title_ar', e.target.value)} style={inputStyle(errors.title_ar)} placeholder="مهارات القيادة" />
          </Field>
          <Field label={lang === 'ar' ? 'اسم البرنامج (انجليزي) *' : 'Program Name (English) *'}>
            <input value={form.title_en} onChange={e => set('title_en', e.target.value)} style={inputStyle(errors.title_en)} placeholder="Leadership Skills" />
          </Field>

          <Row2>
            <Field label={lang === 'ar' ? 'المدرب (عربي) *' : 'Trainer (Arabic) *'}>
              <input value={form.trainer_ar} onChange={e => set('trainer_ar', e.target.value)} style={inputStyle(errors.trainer_ar)} placeholder="أحمد محمد" />
            </Field>
            <Field label={lang === 'ar' ? 'المدرب (انجليزي)' : 'Trainer (English)'}>
              <input value={form.trainer_en} onChange={e => set('trainer_en', e.target.value)} style={inputStyle(false)} placeholder="Ahmed Mohamed" />
            </Field>
          </Row2>

          <Row2>
            <Field label={lang === 'ar' ? 'تاريخ البداية *' : 'Start Date *'}>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={inputStyle(errors.start_date)} />
            </Field>
            <Field label={lang === 'ar' ? 'تاريخ النهاية *' : 'End Date *'}>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={inputStyle(errors.end_date)} />
            </Field>
          </Row2>

          <Row2>
            <Field label={lang === 'ar' ? 'التكلفة (ج.م)' : 'Cost (EGP)'}>
              <input type="number" value={form.cost} onChange={e => set('cost', +e.target.value)} style={inputStyle(false)} min="0" />
            </Field>
            <Field label={lang === 'ar' ? 'عدد المقاعد' : 'Max Seats'}>
              <input type="number" value={form.max_seats} onChange={e => set('max_seats', +e.target.value)} style={inputStyle(false)} min="1" />
            </Field>
          </Row2>

          <Field label={lang === 'ar' ? 'الوصف (عربي)' : 'Description (Arabic)'}>
            <textarea value={form.description_ar} onChange={e => set('description_ar', e.target.value)} style={{ ...inputStyle(false), minHeight: 70, resize: 'vertical' }} />
          </Field>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => { if (validate()) onAdd({ ...form, id: 'c' + Date.now(), enrollments: [], completed: [] }); }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {lang === 'ar' ? 'إضافة' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TrainingPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [employees] = useState(MOCK_EMPLOYEES);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [activeTab, setActiveTab] = useState('courses'); // courses | budget | recommendations

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    primary:   '#2B4C6F',
    accent:    '#4A7AAB',
  };

  const filtered = useMemo(() => courses.filter(course => {
    const title = lang === 'ar' ? course.title_ar : course.title_en;
    const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || course.status === filterStatus;
    const matchType = filterType === 'all' || course.type === filterType;
    return matchSearch && matchStatus && matchType;
  }), [courses, search, filterStatus, filterType, lang]);

  // Budget stats
  const spent = courses.reduce((sum, c) => sum + (c.status === 'completed' || c.status === 'ongoing' ? c.cost : 0), 0);
  const committed = courses.reduce((sum, c) => sum + (c.status === 'upcoming' ? c.cost : 0), 0);
  const remaining = BUDGET.total - spent - committed;
  const spentPct = Math.round((spent / BUDGET.total) * 100);
  const committedPct = Math.round((committed / BUDGET.total) * 100);

  // Stats
  const totalEnrolled = courses.reduce((sum, c) => sum + c.enrollments.length, 0);
  const totalCompleted = courses.reduce((sum, c) => sum + c.completed.length, 0);
  const completionRate = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;

  // Recommendations: based on actual weakest competency score per employee
  const recommendations = useMemo(() => {
    return employees.map(emp => {
      const weakComp = getWeakestCompetency(emp.id);
      const scores   = genCompScores(emp.id);
      const weakScore = scores[weakComp.key] || 3;
      const suggested = courses.find(c => c.competency === weakComp.key) ||
                        courses.find(c => c.status === 'upcoming');
      return { emp, weakComp, weakScore, suggested };
    }).filter(r => r.suggested && r.weakScore <= 3);
  }, [employees, courses]);

  const handleSaveCourse = (updated) => {
    setCourses(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedCourse(null);
  };

  const handleDeleteCourse = (id) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    setSelectedCourse(null);
  };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
                {lang === 'ar' ? 'التدريب والتطوير' : 'Training & Development'}
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
                {lang === 'ar' ? 'برامج التدريب مرتبطة بالكفاءات والأداء' : 'Training programs linked to competencies & performance'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Plus size={16} /> {lang === 'ar' ? 'برنامج جديد' : 'New Program'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: lang === 'ar' ? 'البرامج' : 'Programs',     value: courses.length,    icon: '📚', color: '#6366F1' },
          { label: lang === 'ar' ? 'المسجلون' : 'Enrolled',    value: totalEnrolled,      icon: '👥', color: '#3B82F6' },
          { label: lang === 'ar' ? 'أتموا' : 'Completed',      value: totalCompleted,     icon: '✅', color: '#10B981' },
          { label: lang === 'ar' ? 'نسبة الإتمام' : 'Rate',    value: completionRate + '%', icon: '🎯', color: '#F59E0B' },
        ].map((stat, i) => (
          <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: c.textMuted }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {[
          { key: 'courses',         ar: 'البرامج',             en: 'Programs'       },
          { key: 'budget',          ar: 'الميزانية',           en: 'Budget'         },
          { key: 'recommendations', ar: 'توصيات التطوير',      en: 'Recommendations'},
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '11px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: activeTab === t.key ? c.accent : c.textMuted,
            borderBottom: activeTab === t.key ? '2px solid ' + c.accent : '2px solid transparent',
          }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* ── COURSES TAB ── */}
      {activeTab === 'courses' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث عن برنامج...' : 'Search programs...'}
                style={{ width: '100%', padding: isRTL ? '9px 38px 9px 12px' : '9px 12px 9px 38px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'داخلي وخارجي' : 'All Types'}</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(course => (
              <CourseCard
                key={course.id} course={course} lang={lang} isRTL={isRTL} c={c} isDark={isDark}
                employees={employees} onClick={() => setSelectedCourse(course)}
              />
            ))}
            {filtered.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: c.textMuted }}>
                <BookOpen size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا توجد برامج' : 'No programs found'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BUDGET TAB ── */}
      {activeTab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Budget Overview */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '24px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.text, marginBottom: 20, textAlign: isRTL ? 'right' : 'left' }}>
              💰 {lang === 'ar' ? `ميزانية التدريب ${BUDGET.year}` : `Training Budget ${BUDGET.year}`}
            </div>

            {/* Budget Bar */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'الإجمالي' : 'Total'}: {BUDGET.total.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                <span style={{ fontSize: 13, color: remaining >= 0 ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                  {lang === 'ar' ? 'المتبقي' : 'Remaining'}: {remaining.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}
                </span>
              </div>
              <div style={{ height: 12, borderRadius: 6, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', overflow: 'hidden' }}>
                <div style={{ height: '100%', display: 'flex' }}>
                  <div style={{ width: spentPct + '%', background: '#EF4444', transition: 'width 0.5s' }} />
                  <div style={{ width: committedPct + '%', background: '#F59E0B', transition: 'width 0.5s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: 11, color: '#EF4444' }}>■ {lang === 'ar' ? 'مصروف' : 'Spent'} {spentPct}%</span>
                <span style={{ fontSize: 11, color: '#F59E0B' }}>■ {lang === 'ar' ? 'ملتزم' : 'Committed'} {committedPct}%</span>
                <span style={{ fontSize: 11, color: '#10B981' }}>■ {lang === 'ar' ? 'متاح' : 'Available'} {100 - spentPct - committedPct}%</span>
              </div>
            </div>

            {/* Budget by Course */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'تكلفة البرامج الخارجية' : 'External Program Costs'}
              </div>
              {courses.filter(c => c.cost > 0).map(course => {
                const pct = Math.round((course.cost / BUDGET.total) * 100);
                const status = STATUS_CONFIG[course.status];
                return (
                  <div key={course.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{lang === 'ar' ? course.title_ar : course.title_en}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: status.bg, color: status.color }}>{lang === 'ar' ? status.ar : status.en}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{course.cost.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: pct + '%', background: course.status === 'completed' ? '#EF4444' : '#F59E0B' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: lang === 'ar' ? 'مصروف' : 'Spent', value: spent.toLocaleString(), color: '#EF4444', icon: '💸' },
              { label: lang === 'ar' ? 'ملتزم' : 'Committed', value: committed.toLocaleString(), color: '#F59E0B', icon: '📋' },
              { label: lang === 'ar' ? 'متاح' : 'Available', value: remaining.toLocaleString(), color: '#10B981', icon: '💚' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? 'ج.م' : 'EGP'} · {s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECOMMENDATIONS TAB ── */}
      {activeTab === 'recommendations' && (
        <div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(99,102,241,0.1)' : '#EEF2FF', border: '1px solid ' + (isDark ? 'rgba(99,102,241,0.2)' : '#C7D2FE'), marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <p style={{ margin: 0, fontSize: 13, color: isDark ? '#A5B4FC' : '#4338CA' }}>
              {lang === 'ar'
                ? 'التوصيات مبنية على تحليل الكفاءات الأضعف لكل موظف من تقييمات الأداء'
                : 'Recommendations are based on each employee\'s weakest competencies from performance reviews'}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendations.map(({ emp, weakComp, suggested }) => (
              <div key={emp.id} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: `hsl(${emp.id.charCodeAt(1) * 40}, 60%, 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
                </div>
                <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>
                    {lang === 'ar' ? 'كفاءة تحتاج تطوير: ' : 'Needs improvement: '}
                    <span style={{ color: '#F59E0B', fontWeight: 600 }}>{lang === 'ar' ? weakComp.ar : weakComp.en}</span>
                    <span style={{ fontSize: 11, color: '#EF4444', marginRight: 4, marginLeft: 4 }}>({weakScore}/5)</span>
                  </div>
                </div>
                <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 3 }}>{lang === 'ar' ? 'برنامج مقترح' : 'Suggested program'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.accent }}>{lang === 'ar' ? suggested.title_ar : suggested.title_en}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>📅 {suggested.start_date}</div>
                </div>
                <ChevronRight size={16} color={c.textMuted} style={{ transform: isRTL ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedCourse && (
        <CourseModal
          course={selectedCourse} employees={employees}
          onClose={() => setSelectedCourse(null)}
          onSave={handleSaveCourse} onDelete={handleDeleteCourse}
          lang={lang} isRTL={isRTL} c={c} isDark={isDark}
        />
      )}
      {showAdd && (
        <AddCourseModal
          onClose={() => setShowAdd(false)}
          onAdd={(newCourse) => { setCourses(prev => [...prev, newCourse]); setShowAdd(false); }}
          lang={lang} isRTL={isRTL} c={c} isDark={isDark}
        />
      )}
    </div>
  );
}
