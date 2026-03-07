import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Briefcase, Plus, X, Save, Eye, Search,
  User, Phone, Mail, MapPin, ChevronRight,
  CheckCircle, Clock, XCircle, Filter, Download
} from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';

// ── Constants ─────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'applied',    ar: `تقدّم`,          en: 'Applied',       color: '#94A3B8', icon: '📥' },
  { id: 'screening',  ar: 'فرز أولي',       en: 'Screening',     color: '#3B82F6', icon: '🔍' },
  { id: 'interview1', ar: 'مقابلة أولى',    en: '1st Interview', color: '#8B5CF6', icon: '💬' },
  { id: 'interview2', ar: 'مقابلة تقنية',   en: 'Tech Interview', color: '#EC4899', icon: '⚙️' },
  { id: 'offer',      ar: 'عرض',            en: 'Offer',         color: '#F59E0B', icon: '📋' },
  { id: 'hired',      ar: 'تم التعيين',     en: 'Hired',         color: '#10B981', icon: '✅' },
];

const JOB_STATUS = {
  open:   { ar: 'مفتوح',   en: 'Open',   color: '#10B981', bg: '#10B98120' },
  closed: { ar: 'مغلق',    en: 'Closed', color: '#94A3B8', bg: '#94A3B820' },
  hold:   { ar: 'متوقف',   en: 'On Hold',color: '#F59E0B', bg: '#F59E0B20' },
};

const EXPERIENCE_LEVELS = [
  { id: 'junior',  ar: 'مبتدئ (0-2 سنة)',       en: 'Junior (0-2 yrs)'    },
  { id: 'mid',     ar: 'متوسط (2-5 سنوات)',      en: 'Mid-level (2-5 yrs)' },
  { id: 'senior',  ar: 'خبير (5+ سنوات)',        en: 'Senior (5+ yrs)'     },
  { id: 'lead',    ar: 'قيادي',                  en: 'Lead / Manager'      },
];

const CANDIDATE_SOURCES = [
  { id: 'linkedin',  ar: 'LinkedIn',  en: 'LinkedIn',  icon: '💼' },
  { id: 'referral',  ar: 'توصية',    en: 'Referral',  icon: '🤝' },
  { id: 'website',   ar: 'الموقع',   en: 'Website',   icon: '🌐' },
  { id: 'agency',    ar: 'وكالة',    en: 'Agency',    icon: '🏢' },
  { id: 'other',     ar: 'أخرى',     en: 'Other',     icon: '📌' },
];

// ── Mock Data ─────────────────────────────────────────────────
const MOCK_JOBS = [
  { id: 'j1', title_ar: 'مندوب مبيعات أول',      title_en: 'Senior Sales Rep',      department: 'sales',     experience: 'senior', openings: 2, status: 'open',   created_at: '2026-02-15', deadline: '2026-03-31', salary_min: 12000, salary_max: 18000, desc_ar: 'نبحث عن مندوب مبيعات خبرة في العقارات', desc_en: 'Looking for experienced real estate sales rep' },
  { id: 'j2', title_ar: 'مدير تسويق رقمي',       title_en: 'Digital Marketing Mgr', department: 'marketing', experience: 'mid',    openings: 1, status: 'open',   created_at: '2026-02-20', deadline: '2026-04-15', salary_min: 10000, salary_max: 15000, desc_ar: 'خبرة في التسويق الرقمي والسوشيال ميديا',   desc_en: 'Digital marketing and social media expertise needed' },
  { id: 'j3', title_ar: 'محاسب',                  title_en: 'Accountant',            department: 'finance',   experience: 'junior', openings: 1, status: 'closed', created_at: '2026-01-10', deadline: '2026-02-28', salary_min: 6000,  salary_max: 9000,  desc_ar: 'محاسب قانوني حديث التخرج',               desc_en: 'Fresh CPA graduate' },
  { id: 'j4', title_ar: 'أخصائي موارد بشرية',    title_en: 'HR Specialist',         department: 'hr',        experience: 'mid',    openings: 1, status: 'hold',   created_at: '2026-02-01', deadline: '2026-03-20', salary_min: 8000,  salary_max: 12000, desc_ar: 'خبرة في التوظيف وإدارة الأداء',          desc_en: 'Recruitment and performance management experience' },
];

const MOCK_CANDIDATES = [
  { id: 'c1', job_id: 'j1', name: 'أحمد سامي',       name_en: 'Ahmed Samy',       phone: '01012345678', email: 'ahmed@email.com',   source: 'linkedin', stage: 'interview1', rating: 4, note: 'خبرة 6 سنوات في المبيعات',         avatar_color: '#3B82F6', applied_at: '2026-02-16' },
  { id: 'c2', job_id: 'j1', name: 'محمد علي',        name_en: 'Mohamed Ali',      phone: '01098765432', email: 'moh@email.com',     source: 'referral', stage: 'offer',      rating: 5, note: `ممتاز جداً — أفضل مرشح`,          avatar_color: '#10B981', applied_at: '2026-02-18' },
  { id: 'c3', job_id: 'j1', name: 'كريم حسن',        name_en: 'Karim Hassan',     phone: '01055512345', email: 'karim@email.com',   source: 'website',  stage: 'screening',  rating: 3, note: 'يحتاج تقييم إضافي',               avatar_color: '#8B5CF6', applied_at: '2026-02-20' },
  { id: 'c4', job_id: 'j2', name: 'سارة خالد',       name_en: 'Sara Khaled',      phone: '01022334455', email: 'sara@email.com',    source: 'linkedin', stage: 'interview2', rating: 4, note: 'خبرة قوية في الإعلانات الرقمية',   avatar_color: '#EC4899', applied_at: '2026-02-22' },
  { id: 'c5', job_id: 'j2', name: 'نور محمود',       name_en: 'Nour Mahmoud',     phone: '01033445566', email: 'nour@email.com',    source: 'agency',   stage: 'applied',    rating: 3, note: '',                                 avatar_color: '#F59E0B', applied_at: '2026-02-25' },
  { id: 'c6', job_id: 'j1', name: 'عمر إبراهيم',     name_en: 'Omar Ibrahim',     phone: '01044556677', email: 'omar@email.com',    source: 'referral', stage: 'hired',      rating: 5, note: 'تم التعيين — يبدأ ١ مارس',        avatar_color: '#6366F1', applied_at: '2026-02-10' },
  { id: 'c7', job_id: 'j2', name: 'ريم عادل',        name_en: 'Reem Adel',        phone: '01055667788', email: 'reem@email.com',    source: 'website',  stage: 'screening',  rating: 4, note: 'Portfolio قوي',                    avatar_color: '#14B8A6', applied_at: '2026-02-28' },
];

const RATING_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#3B82F6', 5: '#10B981' };

function fmt(n) { return n?.toLocaleString() ?? '—'; }

// ── Avatar ─────────────────────────────────────────────────
function CandAvatar({ c: cand, size = 36 }) {
  const initials = cand.name.split(' ').slice(0,2).map(w=>w[0]).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: cand.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Job Form Modal ─────────────────────────────────────────
function JobFormModal({ onClose, onSave, isDark, isRTL, lang, c }) {
  const [form, setForm] = useState({ title_ar: '', title_en: '', department: 'sales', experience: 'mid', openings: 1, salary_min: '', salary_max: '', deadline: '', desc_ar: '', desc_en: '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  const handleSave = () => {
    if (!form.title_ar && !form.title_en) { setErr(lang === 'ar' ? 'أدخل اسم الوظيفة' : 'Enter job title'); return; }
    onSave({ ...form, id: `j${Date.now()}`, status: 'open', created_at: new Date().toISOString().split('T')[0] });
  };

  const deptOpts = [
    { id: 'sales', ar: 'المبيعات', en: 'Sales' },
    { id: 'marketing', ar: 'التسويق', en: 'Marketing' },
    { id: 'hr', ar: 'الموارد البشرية', en: 'HR' },
    { id: 'finance', ar: 'المالية', en: 'Finance' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 540, direction: isRTL ? 'rtl' : 'ltr', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Briefcase size={18} color="#fff" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{lang === 'ar' ? 'وظيفة جديدة' : 'New Job Opening'}</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'المسمى (عربي)' : 'Title (Arabic)'}</label>
              <input value={form.title_ar} onChange={e => set('title_ar', e.target.value)} style={inp} placeholder="مثال: مندوب مبيعات" />
            </div>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'المسمى (إنجليزي)' : 'Title (English)'}</label>
              <input value={form.title_en} onChange={e => set('title_en', e.target.value)} style={inp} placeholder="e.g. Sales Rep" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'القسم' : 'Department'}</label>
              <select value={form.department} onChange={e => set('department', e.target.value)} style={inp}>
                {deptOpts.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.ar : d.en}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'مستوى الخبرة' : 'Experience Level'}</label>
              <select value={form.experience} onChange={e => set('experience', e.target.value)} style={inp}>
                {EXPERIENCE_LEVELS.map(x => <option key={x.id} value={x.id}>{lang === 'ar' ? x.ar : x.en}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'عدد الشواغر' : 'Openings'}</label>
              <input type="number" min={1} value={form.openings} onChange={e => set('openings', +e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'الحد الأدنى (ج.م)' : 'Salary Min'}</label>
              <input type="number" value={form.salary_min} onChange={e => set('salary_min', +e.target.value)} style={inp} placeholder="8000" />
            </div>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'الحد الأقصى (ج.م)' : 'Salary Max'}</label>
              <input type="number" value={form.salary_max} onChange={e => set('salary_max', +e.target.value)} style={inp} placeholder="14000" />
            </div>
          </div>

          <div>
            <label style={lbl}>{lang === 'ar' ? 'آخر موعد للتقديم' : 'Application Deadline'}</label>
            <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} style={inp} />
          </div>

          <div>
            <label style={lbl}>{lang === 'ar' ? 'وصف الوظيفة' : 'Job Description'}</label>
            <textarea value={lang === 'ar' ? form.desc_ar : form.desc_en}
              onChange={e => set(lang === 'ar' ? 'desc_ar' : 'desc_en', e.target.value)}
              rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={lang === 'ar' ? 'اكتب وصف الوظيفة...' : 'Describe the role...'} />
          </div>

          {err && <div style={{ padding: '8px 12px', borderRadius: 7, background: '#EF444415', color: '#EF4444', fontSize: 13 }}>{err}</div>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} /> {lang === 'ar' ? 'نشر الوظيفة' : 'Post Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Candidate Detail Modal ─────────────────────────────────
function CandidateModal({ cand, job, onClose, onStageChange, isDark, isRTL, lang, c }) {
  const src = CANDIDATE_SOURCES.find(s => s.id === cand.source);
  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.id === cand.stage);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 500, direction: isRTL ? 'rtl' : 'ltr', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', background: `linear-gradient(135deg, ${cand.avatar_color}CC, ${cand.avatar_color}88)`, borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <CandAvatar c={cand} size={48} />
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{lang === 'ar' ? cand.name : cand.name_en}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{lang === 'ar' ? job?.title_ar : job?.title_en}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                {src?.icon} {lang === 'ar' ? src?.ar : src?.en} · {cand.applied_at}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.25)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: <Phone size={13} />, label: lang === 'ar' ? 'الهاتف' : 'Phone', value: cand.phone },
              { icon: <Mail size={13} />,  label: lang === 'ar' ? 'البريد' : 'Email',  value: cand.email },
            ].map((row, i) => (
              <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ color: c.accent }}>{row.icon}</div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 10, color: c.textMuted }}>{row.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'التقييم:' : 'Rating:'}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  background: n <= cand.rating ? RATING_COLORS[cand.rating] + '20' : 'transparent',
                  border: `1px solid ${n <= cand.rating ? RATING_COLORS[cand.rating] : c.border}`,
                }}>
                  {n <= cand.rating ? '⭐' : ''}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: RATING_COLORS[cand.rating] }}>{cand.rating}/5</span>
          </div>

          {/* Note */}
          {cand.note && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border }}>
              <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</div>
              <div style={{ fontSize: 13, color: c.text }}>{cand.note}</div>
            </div>
          )}

          {/* Pipeline Progress */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 10 }}>{lang === 'ar' ? 'مسار التوظيف' : 'Hiring Pipeline'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PIPELINE_STAGES.map((stage, idx) => {
                const isDone    = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                return (
                  <div key={stage.id}
                    onClick={() => onStageChange(cand.id, stage.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      background: isCurrent ? stage.color + '20' : 'transparent',
                      border: `1px solid ${isCurrent ? stage.color : isDone ? '#10B98130' : c.border}`,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    }}>
                    <span style={{ fontSize: 16 }}>{isDone ? '✅' : isCurrent ? stage.icon : '⬜'}</span>
                    <span style={{ fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? stage.color : isDone ? '#10B981' : c.textMuted, flex: 1 }}>
                      {lang === 'ar' ? stage.ar : stage.en}
                    </span>
                    {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, color: stage.color, padding: '2px 8px', borderRadius: 20, background: stage.color + '20' }}>
                      {lang === 'ar' ? 'الحالي' : 'Current'}
                    </span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
          {cand.stage !== 'hired' && (
            <button onClick={() => { const next = PIPELINE_STAGES[currentStageIdx + 1]; if (next) onStageChange(cand.id, next.id); }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <ChevronRight size={14} /> {lang === 'ar' ? `تقدّم للمرحلة التالية` : 'Advance to Next Stage'}
            </button>
          )}
          {cand.stage === 'hired' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, background: '#10B98120', color: '#10B981', fontSize: 13, fontWeight: 700 }}>
              <CheckCircle size={15} /> {lang === 'ar' ? 'تم التعيين ✓' : 'Hired ✓'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function RecruitmentPage() {
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

  const [tab, setTab]               = useState('jobs');
  const [jobs, setJobs]             = useState(MOCK_JOBS);
  const [candidates, setCandidates] = useState(MOCK_CANDIDATES);
  const [showJobForm, setShowJob]   = useState(false);
  const [selCand, setSelCand]       = useState(null);
  const [selJob, setSelJob]         = useState(null);
  const [pipelineJob, setPipeJob]   = useState(MOCK_JOBS[0]?.id);
  const [searchQ, setSearchQ]       = useState('');
  const [statusF, setStatusF]       = useState('all');

  const deptNames = { sales: { ar: 'المبيعات', en: 'Sales' }, marketing: { ar: 'التسويق', en: 'Marketing' }, hr: { ar: 'الموارد البشرية', en: 'HR' }, finance: { ar: 'المالية', en: 'Finance' } };

  const filteredJobs = useMemo(() => jobs.filter(j => {
    const matchStatus = statusF === 'all' || j.status === statusF;
    const matchSearch = !searchQ || (j.title_ar + j.title_en).toLowerCase().includes(searchQ.toLowerCase());
    return matchStatus && matchSearch;
  }), [jobs, statusF, searchQ]);

  const candByStage = useMemo(() => {
    const result = {};
    PIPELINE_STAGES.forEach(s => { result[s.id] = []; });
    candidates.filter(c => c.job_id === pipelineJob).forEach(c => {
      if (result[c.stage]) result[c.stage].push(c);
    });
    return result;
  }, [candidates, pipelineJob]);

  const openJobs   = jobs.filter(j => j.status === 'open').length;
  const totalCands = candidates.length;
  const hiredCount = candidates.filter(c => c.stage === 'hired').length;
  const pendingOffers = candidates.filter(c => c.stage === 'offer').length;

  const addJob = (job) => { setJobs(prev => [job, ...prev]); setShowJob(false); };

  const advanceStage = (candId, newStage) => {
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, stage: newStage } : c));
    if (selCand?.id === candId) setSelCand(prev => ({ ...prev, stage: newStage }));
  };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Briefcase size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'التوظيف' : 'Recruitment'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'إدارة الوظائف والمرشحين والمقابلات' : 'Manage jobs, candidates & interviews'}</p>
          </div>
        </div>
        <button onClick={() => setShowJob(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={16} /> {lang === 'ar' ? 'وظيفة جديدة' : 'New Job'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'وظائف مفتوحة'    : 'Open Jobs',       value: openJobs,       icon: '📢', color: '#10B981' },
          { label: lang === 'ar' ? 'إجمالي المرشحين' : 'Total Candidates', value: totalCands,     icon: '👥', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'تم التعيين'       : 'Hired',           value: hiredCount,     icon: '✅', color: '#6366F1' },
          { label: lang === 'ar' ? 'عروض معلقة'       : 'Pending Offers',  value: pendingOffers,  icon: '📋', color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
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
          { id: 'jobs',     ar: 'الوظائف',   en: 'Jobs'     },
          { id: 'pipeline', ar: 'البايبلاين', en: 'Pipeline' },
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

      {/* ── JOBS TAB ── */}
      {tab === 'jobs' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} color={c.textMuted} style={{ position: 'absolute', [isRTL?'right':'left']: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ padding: isRTL ? '9px 36px 9px 12px' : '9px 12px 9px 36px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                placeholder={lang === 'ar' ? 'بحث في الوظائف...' : 'Search jobs...'} />
            </div>
            <select value={statusF} onChange={e => setStatusF(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              {Object.entries(JOB_STATUS).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filteredJobs.map(job => {
              const st     = JOB_STATUS[job.status];
              const dept   = deptNames[job.department];
              const candCount = candidates.filter(ca => ca.job_id === job.id).length;
              const expLevel = EXPERIENCE_LEVELS.find(e => e.id === job.experience);
              return (
                <div key={job.id}
                  style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(74,122,171,0.15)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
                  onClick={() => { setSelJob(job); setTab('pipeline'); setPipeJob(job.id); }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{lang === 'ar' ? job.title_ar : job.title_en}</div>
                      <div style={{ fontSize: 12, color: c.textMuted, marginTop: 3 }}>{lang === 'ar' ? dept?.ar : dept?.en}</div>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color, flexShrink: 0 }}>
                      {lang === 'ar' ? st.ar : st.en}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {[
                      { icon: '🎓', label: lang === 'ar' ? expLevel?.ar : expLevel?.en },
                      { icon: '👥', label: `${job.openings} ${lang === 'ar' ? 'شاغر' : 'opening(s)'}` },
                      { icon: '💰', label: `${(job.salary_min / 1000).toFixed(0)}K - ${(job.salary_max / 1000).toFixed(0)}K ${lang==='ar'?'ج.م':'EGP'}` },
                    ].map((tag, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 11, background: isDark ? 'rgba(74,122,171,0.1)' : '#F1F5F9', color: c.textMuted, border: '1px solid ' + c.border }}>
                        {tag.icon} {tag.label}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <User size={13} color={c.accent} />
                      <span style={{ fontSize: 12, color: c.accent, fontWeight: 600 }}>{candCount} {lang === 'ar' ? 'مرشح' : 'candidates'}</span>
                    </div>
                    <div style={{ fontSize: 11, color: c.textMuted }}>
                      {lang === 'ar' ? `ينتهي: ${job.deadline}` : `Deadline: ${job.deadline}`}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add new job card */}
            <div onClick={() => setShowJob(true)}
              style={{ background: 'transparent', borderRadius: 12, border: `2px dashed ${c.border}`, padding: '18px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 140, transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = c.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = c.border}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} color={c.accent} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.accent }}>{lang === 'ar' ? 'إضافة وظيفة جديدة' : 'Add New Job'}</span>
            </div>
          </div>
        </>
      )}

      {/* ── PIPELINE TAB ── */}
      {tab === 'pipeline' && (
        <>
          {/* Job selector */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {jobs.filter(j => j.status !== 'closed').map(job => (
              <button key={job.id} onClick={() => setPipeJob(job.id)}
                style={{ padding: '7px 16px', borderRadius: 20, border: `1.5px solid ${pipelineJob === job.id ? c.accent : c.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: pipelineJob === job.id ? c.accent + '20' : 'transparent', color: pipelineJob === job.id ? c.accent : c.textMuted, transition: 'all 0.15s' }}>
                {lang === 'ar' ? job.title_ar : job.title_en}
                <span style={{ marginInlineStart: 6, fontSize: 11, background: pipelineJob === job.id ? c.accent : c.border, color: '#fff', padding: '1px 6px', borderRadius: 10 }}>
                  {candidates.filter(ca => ca.job_id === job.id).length}
                </span>
              </button>
            ))}
          </div>

          {/* Kanban */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${PIPELINE_STAGES.length}, minmax(160px, 1fr))`, gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {PIPELINE_STAGES.map(stage => {
              const stageCands = candByStage[stage.id] || [];
              return (
                <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Stage Header */}
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: stage.color + '18', border: `1px solid ${stage.color}30`, textAlign: 'center' }}>
                    <div style={{ fontSize: 16 }}>{stage.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: stage.color, marginTop: 2 }}>{lang === 'ar' ? stage.ar : stage.en}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: stage.color }}>{stageCands.length}</div>
                  </div>

                  {/* Cards */}
                  {stageCands.map(cand => {
                    const job = jobs.find(j => j.id === cand.job_id);
                    return (
                      <div key={cand.id}
                        onClick={() => { setSelCand(cand); setSelJob(job); }}
                        style={{ padding: '12px', borderRadius: 10, background: c.cardBg, border: '1px solid ' + c.border, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 3px 12px ${stage.color}25`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <CandAvatar c={cand} size={30} />
                          <div style={{ textAlign: isRTL ? 'right' : 'left', flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lang === 'ar' ? cand.name : cand.name_en}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <div style={{ display: 'flex', gap: 1 }}>
                            {[1,2,3,4,5].map(n => (
                              <span key={n} style={{ fontSize: 10, color: n <= cand.rating ? RATING_COLORS[cand.rating] : '#CBD5E1' }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontSize: 10, color: c.textMuted }}>
                            {CANDIDATE_SOURCES.find(s => s.id === cand.source)?.icon}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {stageCands.length === 0 && (
                    <div style={{ padding: '14px 8px', borderRadius: 8, border: `1px dashed ${c.border}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, opacity: 0.3 }}>—</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showJobForm && (
        <JobFormModal onClose={() => setShowJob(false)} onSave={addJob} isDark={isDark} isRTL={isRTL} lang={lang} c={c} />
      )}
      {selCand && selJob && (
        <CandidateModal
          cand={selCand} job={selJob}
          onClose={() => { setSelCand(null); setSelJob(null); }}
          onStageChange={advanceStage}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
