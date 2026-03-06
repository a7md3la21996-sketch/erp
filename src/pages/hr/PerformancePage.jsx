import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Star, Target, TrendingUp, X, Save, Plus,
  Award, Users, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

// ── Data ──────────────────────────────────────────────────────
const COMPETENCIES = [
  { id: 'c1', key: 'communication',   ar: 'التواصل',            en: 'Communication',      icon: '💬', weight: 20 },
  { id: 'c2', key: 'teamwork',        ar: 'العمل الجماعي',      en: 'Teamwork',            icon: '🤝', weight: 15 },
  { id: 'c3', key: 'initiative',      ar: 'المبادرة',           en: 'Initiative',          icon: '⚡', weight: 15 },
  { id: 'c4', key: 'problem_solving', ar: 'حل المشكلات',        en: 'Problem Solving',     icon: '🧠', weight: 20 },
  { id: 'c5', key: 'attendance',      ar: 'الالتزام والحضور',   en: 'Commitment',          icon: '📅', weight: 15 },
  { id: 'c6', key: 'quality',         ar: 'جودة العمل',         en: 'Work Quality',        icon: '✨', weight: 15 },
];

const KPIS = {
  sales:     [
    { id: 'k1', ar: 'عدد الصفقات المغلقة', en: 'Deals Closed',    unit: 'deals', target: 10 },
    { id: 'k2', ar: 'إجمالي المبيعات',     en: 'Total Sales',     unit: 'EGP',   target: 500000 },
    { id: 'k3', ar: 'معدل التحويل',         en: 'Conversion Rate', unit: '%',     target: 30 },
  ],
  marketing: [
    { id: 'k4', ar: 'عدد العملاء المحتملين', en: 'Leads Generated', unit: 'leads', target: 50 },
    { id: 'k5', ar: 'معدل التفاعل',           en: 'Engagement Rate', unit: '%',     target: 5 },
  ],
  hr: [
    { id: 'k6', ar: 'دوران الموظفين',      en: 'Turnover Rate',    unit: '%',     target: 5 },
    { id: 'k7', ar: 'وقت التوظيف (أيام)', en: 'Time to Hire',     unit: 'days',  target: 30 },
  ],
  finance: [
    { id: 'k8', ar: 'دقة التقارير',       en: 'Report Accuracy',  unit: '%',     target: 99 },
    { id: 'k9', ar: 'إغلاق الشهر (أيام)', en: 'Month Close Days', unit: 'days',  target: 3 },
  ],
};

const RATING_LABELS = {
  ar: { 1: 'ضعيف', 2: 'أقل من المتوسط', 3: 'متوسط', 4: 'جيد', 5: 'ممتاز' },
  en: { 1: 'Poor', 2: 'Below Average', 3: 'Average', 4: 'Good', 5: 'Excellent' },
};

const RATING_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#3B82F6', 5: '#10B981' };

function genScores(empId) {
  const seed = empId.charCodeAt(empId.length - 1);
  return COMPETENCIES.reduce((acc, c, i) => {
    acc[c.key] = Math.min(5, Math.max(1, Math.round(2.5 + ((seed * (i + 3)) % 25) / 10)));
    return acc;
  }, {});
}

function genKpiActuals(dept) {
  const kpis = KPIS[dept] || [];
  return kpis.reduce((acc, k) => {
    const pct = 0.6 + Math.random() * 0.6;
    acc[k.id] = Math.round(k.target * pct);
    return acc;
  }, {});
}

const MOCK_REVIEWS = MOCK_EMPLOYEES.map(emp => ({
  emp_id:   emp.id,
  period:   'Q1 2026',
  scores:   genScores(emp.id),
  kpi_actuals: genKpiActuals(emp.department),
  manager_note: '',
  status: Math.random() > 0.4 ? 'completed' : 'pending',
}));

function calcWeightedScore(scores) {
  const total = COMPETENCIES.reduce((sum, c) => sum + (scores[c.key] || 3) * c.weight, 0);
  return Math.round((total / 100) * 10) / 10;
}

function nineBoxPos(perfScore, potentialScore) {
  const p = perfScore <= 2 ? 0 : perfScore <= 3.5 ? 1 : 2;
  const q = potentialScore <= 2 ? 0 : potentialScore <= 3.5 ? 1 : 2;
  return { col: p, row: 2 - q };
}

const NINE_BOX_LABELS = {
  ar: [
    ['نجم صاعد 🌟', 'عالي الأداء 💎', 'قائد المستقبل 🚀'],
    ['لغز 🤔',       'موظف أساسي 🔑',  'ملهم عالٍ 🔥'],
    ['مخاطرة ⚠️',    'موظف جيد ✅',    'أداء عالٍ 🎯'],
  ],
  en: [
    ['Rising Star 🌟', 'High Performer 💎', 'Future Leader 🚀'],
    ['Enigma 🤔',       'Core Player 🔑',    'High Potential 🔥'],
    ['Risk ⚠️',         'Solid Performer ✅', 'High Performer 🎯'],
  ],
};

const NINE_BOX_COLORS = [
  ['#3B82F6', '#10B981', '#6366F1'],
  ['#F59E0B', '#4A7AAB', '#EC4899'],
  ['#EF4444', '#94A3B8', '#F97316'],
];

// ── Avatar ─────────────────────────────────────────────────
function Avatar({ emp, size = 34 }) {
  const initials = emp.full_name_ar.split(' ').slice(0,2).map(w=>w[0]).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Star Rating ────────────────────────────────────────────
function StarRating({ value, onChange, size = 18 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {[1,2,3,4,5].map(n => (
        <Star key={n} size={size}
          fill={(hovered || value) >= n ? RATING_COLORS[hovered || value] : 'none'}
          color={(hovered || value) >= n ? RATING_COLORS[hovered || value] : '#CBD5E1'}
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'all 0.1s' }}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          onClick={() => onChange && onChange(n)}
        />
      ))}
    </div>
  );
}

// ── Review Modal ───────────────────────────────────────────
function ReviewModal({ review, emp, onClose, onSave, isDark, isRTL, lang, c }) {
  const [scores, setScores]   = useState({ ...review.scores });
  const [note, setNote]       = useState(review.manager_note || '');
  const weightedScore = calcWeightedScore(scores);
  const kpis = KPIS[emp.department] || [];

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 600, direction: isRTL ? 'rtl' : 'ltr', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Avatar emp={emp} size={38} />
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{review.period} · {lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Weighted Score Banner */}
          <div style={{ padding: '14px 20px', borderRadius: 12, background: `${RATING_COLORS[Math.round(weightedScore)]}15`, border: `1px solid ${RATING_COLORS[Math.round(weightedScore)]}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 4 }}>{lang === 'ar' ? 'الدرجة المرجحة الإجمالية' : 'Weighted Overall Score'}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: RATING_COLORS[Math.round(weightedScore)] }}>{weightedScore} / 5</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <StarRating value={Math.round(weightedScore)} size={22} />
              <div style={{ fontSize: 12, fontWeight: 600, color: RATING_COLORS[Math.round(weightedScore)], marginTop: 6 }}>
                {RATING_LABELS[lang][Math.round(weightedScore)]}
              </div>
            </div>
          </div>

          {/* Competencies */}
          <div>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الكفاءات' : 'Competencies'}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COMPETENCIES.map(comp => (
                <div key={comp.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{comp.icon}</span>
                  <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? comp.ar : comp.en}</div>
                    <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? `وزن: ${comp.weight}%` : `Weight: ${comp.weight}%`}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <StarRating value={scores[comp.key] || 3} onChange={v => setScores(s => ({ ...s, [comp.key]: v }))} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: RATING_COLORS[scores[comp.key] || 3], minWidth: 70, textAlign: isRTL ? 'right' : 'left' }}>
                      {RATING_LABELS[lang][scores[comp.key] || 3]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* KPIs */}
          {kpis.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'مؤشرات الأداء (KPIs)' : 'KPIs'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {kpis.map(kpi => {
                  const actual = review.kpi_actuals?.[kpi.id] || 0;
                  const pct    = Math.min(100, Math.round((actual / kpi.target) * 100));
                  const color  = pct >= 100 ? '#10B981' : pct >= 75 ? '#3B82F6' : pct >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <div key={kpi.id} style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', border: '1px solid ' + c.border }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? kpi.ar : kpi.en}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color }}>
                          {actual.toLocaleString()} / {kpi.target.toLocaleString()} {kpi.unit}
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? `الهدف: ${kpi.target.toLocaleString()}` : `Target: ${kpi.target.toLocaleString()}`}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Manager Note */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'ملاحظات المدير' : 'Manager Notes'}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={lang === 'ar' ? 'أضف ملاحظاتك...' : 'Add your notes...'} />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={() => onSave({ ...review, scores, manager_note: note, status: 'completed' })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} /> {lang === 'ar' ? 'حفظ التقييم' : 'Save Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function PerformancePage() {
  const { theme } = useTheme();
  const { i18n }  = useTranslation();
  const isDark = theme === 'dark';
  const isRTL  = i18n.language === 'ar';
  const lang   = i18n.language;

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  const [tab, setTab]               = useState('overview');
  const [reviews, setReviews]       = useState(MOCK_REVIEWS);
  const [selectedReview, setSelRev] = useState(null);
  const [selectedEmp, setSelEmp]    = useState(null);
  const [expandedDept, setExpDept]  = useState(null);

  const reviewMap = useMemo(() => {
    return reviews.reduce((acc, r) => { acc[r.emp_id] = r; return acc; }, {});
  }, [reviews]);

  const enriched = useMemo(() => MOCK_EMPLOYEES.map(emp => {
    const r   = reviewMap[emp.id];
    const ws  = r ? calcWeightedScore(r.scores) : null;
    const pot = ws ? Math.min(5, Math.max(1, Math.round(ws * (0.8 + Math.random() * 0.4)))) : 3;
    return { emp, review: r, weightedScore: ws, potential: pot };
  }), [reviewMap]);

  const completedCount = reviews.filter(r => r.status === 'completed').length;
  const avgScore = useMemo(() => {
    const scores = enriched.filter(e => e.weightedScore).map(e => e.weightedScore);
    if (!scores.length) return 0;
    return Math.round((scores.reduce((s,v) => s+v, 0) / scores.length) * 10) / 10;
  }, [enriched]);

  const saveReview = (updated) => {
    setReviews(prev => prev.map(r => r.emp_id === updated.emp_id ? updated : r));
    setSelRev(null);
    setSelEmp(null);
  };

  // Group by dept for overview
  const byDept = useMemo(() => {
    const groups = {};
    enriched.forEach(e => {
      const d = e.emp.department;
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    });
    return groups;
  }, [enriched]);

  const deptNames = { sales: { ar: 'المبيعات', en: 'Sales' }, marketing: { ar: 'التسويق', en: 'Marketing' }, hr: { ar: 'الموارد البشرية', en: 'HR' }, finance: { ar: 'المالية', en: 'Finance' } };

  // 9-box data
  const nineBoxData = useMemo(() => {
    const grid = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => []));
    enriched.forEach(e => {
      if (!e.weightedScore) return;
      const { col, row } = nineBoxPos(e.weightedScore, e.potential);
      grid[row][col].push(e);
    });
    return grid;
  }, [enriched]);

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Star size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'إدارة الأداء' : 'Performance Management'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'الكفاءات · الـ KPIs · مصفوفة 9-Box' : 'Competencies · KPIs · 9-Box Matrix'}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'التقييمات المكتملة' : 'Reviews Done',    value: `${completedCount}/${reviews.length}`, icon: '✅', color: '#10B981' },
          { label: lang === 'ar' ? 'متوسط الأداء'       : 'Avg. Performance', value: `${avgScore}/5`,                      icon: '⭐', color: '#F59E0B' },
          { label: lang === 'ar' ? 'الفترة الحالية'     : 'Current Period',   value: 'Q1 2026',                            icon: '📅', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'الكفاءات المقيّمة'  : 'Competencies',     value: COMPETENCIES.length,                  icon: '🎯', color: '#6366F1' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
              <span style={{ fontSize: 26 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isDark ? 'rgba(74,122,171,0.08)' : '#F1F5F9', padding: 4, borderRadius: 10, width: 'fit-content', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {[
          { id: 'overview', ar: 'نظرة عامة', en: 'Overview' },
          { id: 'reviews',  ar: 'التقييمات', en: 'Reviews'  },
          { id: 'ninebox',  ar: 'مصفوفة 9-Box', en: '9-Box Matrix' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              background: tab === t.id ? (isDark ? '#1a2234' : '#fff') : 'transparent',
              color: tab === t.id ? c.accent : c.textMuted,
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(byDept).map(([deptId, members]) => {
            const deptAvg = members.filter(m => m.weightedScore).reduce((s,m,_,a) => s + m.weightedScore/a.length, 0);
            const isOpen  = expandedDept === deptId;
            return (
              <div key={deptId} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
                <div
                  onClick={() => setExpDept(isOpen ? null : deptId)}
                  style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexDirection: isRTL ? 'row-reverse' : 'row' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? deptNames[deptId]?.ar : deptNames[deptId]?.en}</div>
                      <div style={{ fontSize: 12, color: c.textMuted }}>{members.length} {lang === 'ar' ? 'موظف' : 'employees'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    {deptAvg > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <StarRating value={Math.round(deptAvg)} size={14} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: RATING_COLORS[Math.round(deptAvg)] }}>{Math.round(deptAvg * 10) / 10}</span>
                      </div>
                    )}
                    {isOpen ? <ChevronUp size={16} color={c.textMuted} /> : <ChevronDown size={16} color={c.textMuted} />}
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid ' + c.border }}>
                    {members.map((m, idx) => {
                      const ws = m.weightedScore;
                      return (
                        <div key={m.emp.id}
                          style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: idx > 0 ? '1px solid ' + c.border : 'none', flexDirection: isRTL ? 'row-reverse' : 'row', cursor: 'pointer', transition: 'background 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => { setSelRev(m.review); setSelEmp(m.emp); }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            <Avatar emp={m.emp} size={36} />
                            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? m.emp.full_name_ar : m.emp.full_name_en}</div>
                              <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? m.emp.job_title_ar : m.emp.job_title_en}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                            {ws ? (
                              <>
                                <StarRating value={Math.round(ws)} size={14} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: RATING_COLORS[Math.round(ws)], minWidth: 30, textAlign: 'center' }}>{ws}</span>
                                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: m.review?.status === 'completed' ? '#10B98120' : '#F59E0B20', color: m.review?.status === 'completed' ? '#10B981' : '#F59E0B' }}>
                                  {m.review?.status === 'completed' ? (lang === 'ar' ? 'مكتمل' : 'Done') : (lang === 'ar' ? 'معلق' : 'Pending')}
                                </span>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? 'لم يُقيَّم بعد' : 'Not reviewed yet'}</span>
                            )}
                            <Eye size={14} color={c.accent} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── REVIEWS TAB ── */}
      {tab === 'reviews' && (
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: c.thBg }}>
                {[
                  { ar: 'الموظف',       en: 'Employee',      w: 'auto' },
                  { ar: 'الكفاءات',    en: 'Competencies',  w: '180px' },
                  { ar: 'الدرجة',      en: 'Score',         w: '90px' },
                  { ar: 'الإمكانية',   en: 'Potential',     w: '100px' },
                  { ar: 'الحالة',      en: 'Status',        w: '100px' },
                  { ar: '',            en: '',              w: '50px' },
                ].map((col, i) => (
                  <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                    {lang === 'ar' ? col.ar : col.en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enriched.map(({ emp, review, weightedScore, potential }, idx) => (
                <tr key={emp.id}
                  style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => { setSelRev(review); setSelEmp(emp); }}>

                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <Avatar emp={emp} size={34} />
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number}</div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {COMPETENCIES.slice(0,3).map(comp => (
                        <span key={comp.id} title={lang==='ar'?comp.ar:comp.en}
                          style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: RATING_COLORS[review?.scores?.[comp.key]||3] + '20', color: RATING_COLORS[review?.scores?.[comp.key]||3], fontWeight: 600 }}>
                          {comp.icon} {review?.scores?.[comp.key] || '—'}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    {weightedScore
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: RATING_COLORS[Math.round(weightedScore)] }}>{weightedScore}</span>
                          <Star size={13} fill={RATING_COLORS[Math.round(weightedScore)]} color={RATING_COLORS[Math.round(weightedScore)]} />
                        </div>
                      : <span style={{ color: c.textMuted, fontSize: 12 }}>—</span>}
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(n => (
                        <div key={n} style={{ width: 12, height: 12, borderRadius: 2, background: n <= potential ? RATING_COLORS[potential] : (isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0') }} />
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: review?.status === 'completed' ? '#10B98120' : '#F59E0B20', color: review?.status === 'completed' ? '#10B981' : '#F59E0B' }}>
                      {review?.status === 'completed' ? (lang === 'ar' ? '✓ مكتمل' : '✓ Done') : (lang === 'ar' ? '⏳ معلق' : '⏳ Pending')}
                    </span>
                  </td>

                  <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setSelRev(review); setSelEmp(emp); }}
                      style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                      <Star size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 9-BOX TAB ── */}
      {tab === 'ninebox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Axis Labels */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

            {/* Y Label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 28, paddingTop: 28 }}>
              <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.08em' }}>
                {lang === 'ar' ? 'الإمكانية ↑' : 'POTENTIAL ↑'}
              </span>
            </div>

            <div style={{ flex: 1 }}>
              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(3,auto)', gap: 8 }}>
                {nineBoxData.map((row, ri) =>
                  row.map((cell, ci) => {
                    const boxColor  = NINE_BOX_COLORS[ri][ci];
                    const boxLabel  = (lang === 'ar' ? NINE_BOX_LABELS.ar : NINE_BOX_LABELS.en)[ri][ci];
                    return (
                      <div key={`${ri}-${ci}`}
                        style={{ minHeight: 100, padding: '10px 12px', borderRadius: 10, background: boxColor + '18', border: `1.5px solid ${boxColor}35`, position: 'relative' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: boxColor, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }}>{boxLabel}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {cell.map(({ emp }) => (
                            <div key={emp.id}
                              title={lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
                              onClick={() => { const e = enriched.find(x => x.emp.id === emp.id); setSelRev(e?.review); setSelEmp(emp); }}
                              style={{ cursor: 'pointer' }}>
                              <Avatar emp={emp} size={30} />
                            </div>
                          ))}
                          {cell.length === 0 && (
                            <span style={{ fontSize: 11, color: c.textMuted, opacity: 0.5 }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* X Label */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <span style={{ fontSize: 11, color: c.textMuted, fontWeight: 700, letterSpacing: '0.08em' }}>
                  {lang === 'ar' ? '← الأداء →' : '← PERFORMANCE →'}
                </span>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '14px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 12 }}>{lang === 'ar' ? 'دليل المصفوفة' : 'Matrix Legend'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {nineBoxData.map((row, ri) =>
                row.map((_, ci) => {
                  const boxColor = NINE_BOX_COLORS[ri][ci];
                  const boxLabel = (lang === 'ar' ? NINE_BOX_LABELS.ar : NINE_BOX_LABELS.en)[ri][ci];
                  const count = nineBoxData[ri][ci].length;
                  return (
                    <div key={`l-${ri}-${ci}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: boxColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: c.text, fontWeight: 500 }}>{boxLabel}</span>
                      <span style={{ fontSize: 11, color: c.textMuted, marginInlineStart: 'auto' }}>({count})</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && selectedEmp && (
        <ReviewModal
          review={selectedReview}
          emp={selectedEmp}
          onClose={() => { setSelRev(null); setSelEmp(null); }}
          onSave={saveReview}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
