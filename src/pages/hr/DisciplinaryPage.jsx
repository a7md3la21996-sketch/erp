import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, Plus, X, Save, Eye,
  Shield, FileText, CheckCircle, XCircle, Search
} from 'lucide-react';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

// ── Constants ─────────────────────────────────────────────────
const VIOLATION_TYPES = [
  { id: 'late',        ar: 'التأخير المتكرر',       en: 'Repeated Lateness',    severity: 1, icon: '⏰' },
  { id: 'absence',     ar: 'الغياب بدون إذن',       en: 'Unauthorized Absence', severity: 2, icon: '🚫' },
  { id: 'behavior',    ar: 'سلوك غير لائق',          en: 'Misconduct',           severity: 2, icon: '⚠️' },
  { id: 'performance', ar: 'ضعف الأداء المستمر',     en: 'Poor Performance',     severity: 2, icon: '📉' },
  { id: 'policy',      ar: 'مخالفة السياسات',        en: 'Policy Violation',     severity: 2, icon: '📋' },
  { id: 'harassment',  ar: 'تحرش أو تنمر',           en: 'Harassment/Bullying',  severity: 3, icon: '🚨' },
  { id: 'fraud',       ar: 'غش أو سرقة',             en: 'Fraud/Theft',          severity: 3, icon: '💰' },
  { id: 'other',       ar: 'أخرى',                   en: 'Other',                severity: 1, icon: '📌' },
];

const ACTION_TYPES = [
  { id: 'verbal',     ar: 'إنذار شفهي',     en: 'Verbal Warning',    color: '#F59E0B', bg: '#F59E0B18', icon: '💬', weight: 1 },
  { id: 'written1',   ar: 'إنذار كتابي أول', en: '1st Written Warning', color: '#F97316', bg: '#F9731618', icon: '📝', weight: 2 },
  { id: 'written2',   ar: 'إنذار كتابي ثاني', en: '2nd Written Warning', color: '#EF4444', bg: '#EF444418', icon: '📄', weight: 3 },
  { id: 'deduction',  ar: 'خصم من الراتب',   en: 'Salary Deduction',  color: '#8B5CF6', bg: '#8B5CF618', icon: '💸', weight: 2 },
  { id: 'suspension', ar: 'إيقاف مؤقت',      en: 'Suspension',        color: '#EC4899', bg: '#EC489918', icon: '⏸️', weight: 3 },
  { id: 'termination',ar: 'إنهاء الخدمة',    en: 'Termination',       color: '#991B1B', bg: '#991B1B18', icon: '🔴', weight: 5 },
];

const RECORD_STATUS = {
  open:     { ar: 'مفتوحة',   en: 'Open',     color: '#F59E0B', bg: '#F59E0B18' },
  resolved: { ar: 'محلولة',   en: 'Resolved', color: '#10B981', bg: '#10B98118' },
  appealed: { ar: 'مستأنفة',  en: 'Appealed', color: '#3B82F6', bg: '#3B82F618' },
  closed:   { ar: 'مغلقة',    en: 'Closed',   color: '#94A3B8', bg: '#94A3B818' },
};

// ── Mock Data ─────────────────────────────────────────────────
const MOCK_RECORDS = [
  { id: 'd1', emp_id: 'e6', violation: 'late',        action: 'verbal',     status: 'resolved', date: '2026-01-15', desc_ar: 'تأخر أكثر من 5 مرات خلال شهر يناير',          desc_en: 'Late more than 5 times in January',         penalty_amount: 0,    issued_by: 'e5', notes: '' },
  { id: 'd2', emp_id: 'e7', violation: 'absence',     action: 'written1',   status: 'open',     date: '2026-02-10', desc_ar: 'غياب يومين بدون إذن مسبق',                    desc_en: 'Absent 2 days without prior approval',      penalty_amount: 0,    issued_by: 'e1', notes: 'في انتظار رد الموظف' },
  { id: 'd3', emp_id: 'e3', violation: 'performance', action: 'written1',   status: 'open',     date: '2026-02-20', desc_ar: 'لم يحقق أهداف المبيعات للربع الأول',           desc_en: 'Did not meet Q1 sales targets',              penalty_amount: 0,    issued_by: 'e1', notes: '' },
  { id: 'd4', emp_id: 'e8', violation: 'late',        action: 'written2',   status: 'open',     date: '2026-03-01', desc_ar: 'تكرار التأخير رغم الإنذار السابق',             desc_en: 'Repeated lateness despite prior warning',    penalty_amount: 500,  issued_by: 'e2', notes: 'مطلوب اجتماع مع HR' },
  { id: 'd5', emp_id: 'e6', violation: 'behavior',    action: 'deduction',  status: 'resolved', date: '2026-02-05', desc_ar: 'سلوك غير لائق مع أحد الزملاء',               desc_en: 'Inappropriate behavior towards a colleague', penalty_amount: 1000, issued_by: 'e5', notes: 'تم الحسم من راتب فبراير' },
  { id: 'd6', emp_id: 'e4', violation: 'policy',      action: 'verbal',     status: 'closed',   date: '2026-01-20', desc_ar: 'مخالفة سياسة استخدام الإنترنت',              desc_en: 'Internet usage policy violation',            penalty_amount: 0,    issued_by: 'e2', notes: '' },
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

// ── New Record Modal ───────────────────────────────────────
function NewRecordModal({ onClose, onSave, employees, isDark, isRTL, lang, c }) {
  const [form, setForm] = useState({
    emp_id: employees[0]?.id || '',
    violation: 'late',
    action: 'verbal',
    date: new Date().toISOString().split('T')[0],
    desc_ar: '',
    desc_en: '',
    penalty_amount: 0,
    notes: '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  const selectedAction  = ACTION_TYPES.find(a => a.id === form.action);
  const selectedViol    = VIOLATION_TYPES.find(v => v.id === form.violation);

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  const handleSave = () => {
    if (!form.desc_ar && !form.desc_en) { setErr(lang === 'ar' ? 'أدخل وصف المخالفة' : 'Enter violation description'); return; }
    onSave({ ...form, id: `d${Date.now()}`, status: 'open', issued_by: 'e1' });
  };

  // warn if termination
  const isTermination = form.action === 'termination';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, direction: isRTL ? 'rtl' : 'ltr', maxHeight: '92vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <AlertTriangle size={18} color="#fff" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{lang === 'ar' ? 'إجراء تأديبي جديد' : 'New Disciplinary Action'}</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Employee */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
            <select value={form.emp_id} onChange={e => set('emp_id', e.target.value)} style={inp}>
              {employees.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
            </select>
          </div>

          {/* Violation Type */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'نوع المخالفة' : 'Violation Type'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {VIOLATION_TYPES.map(v => (
                <button key={v.id} onClick={() => set('violation', v.id)}
                  style={{ padding: '8px 6px', borderRadius: 8, border: `2px solid ${form.violation === v.id ? (v.severity === 3 ? '#EF4444' : v.severity === 2 ? '#F97316' : '#F59E0B') : c.border}`, cursor: 'pointer', background: form.violation === v.id ? (v.severity === 3 ? '#EF444415' : v.severity === 2 ? '#F9731615' : '#F59E0B15') : 'transparent', textAlign: 'center' }}>
                  <div style={{ fontSize: 18 }}>{v.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: form.violation === v.id ? (v.severity === 3 ? '#EF4444' : v.severity === 2 ? '#F97316' : '#F59E0B') : c.textMuted, marginTop: 2, lineHeight: 1.3 }}>
                    {lang === 'ar' ? v.ar : v.en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Type */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'نوع الإجراء' : 'Action Type'}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ACTION_TYPES.map(a => (
                <button key={a.id} onClick={() => set('action', a.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${form.action === a.id ? a.color : c.border}`, cursor: 'pointer', background: form.action === a.id ? a.bg : 'transparent', textAlign: isRTL ? 'right' : 'left', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: form.action === a.id ? 700 : 500, color: form.action === a.id ? a.color : c.text, flex: 1 }}>
                    {lang === 'ar' ? a.ar : a.en}
                  </span>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {Array.from({ length: a.weight }).map((_, i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: a.color }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Termination Warning */}
          {isTermination && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: '#7F1D1D18', border: '1px solid #DC262630', display: 'flex', alignItems: 'flex-start', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: 13, color: '#DC2626', fontWeight: 500 }}>
                {lang === 'ar'
                  ? 'تحذير: إجراء إنهاء الخدمة لا يمكن التراجع عنه. تأكد من اتباع الإجراءات القانونية قبل المتابعة.'
                  : 'Warning: Termination cannot be undone. Ensure all legal procedures are followed before proceeding.'}
              </p>
            </div>
          )}

          {/* Deduction Amount */}
          {form.action === 'deduction' && (
            <div>
              <label style={lbl}>{lang === 'ar' ? 'مبلغ الخصم (ج.م)' : 'Deduction Amount (EGP)'}</label>
              <input type="number" value={form.penalty_amount} onChange={e => set('penalty_amount', +e.target.value)} style={inp} placeholder="500" />
            </div>
          )}

          {/* Date */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'تاريخ الإجراء' : 'Action Date'}</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inp} />
          </div>

          {/* Description */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'وصف المخالفة' : 'Violation Description'}</label>
            <textarea value={lang === 'ar' ? form.desc_ar : form.desc_en}
              onChange={e => set(lang === 'ar' ? 'desc_ar' : 'desc_en', e.target.value)}
              rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={lang === 'ar' ? 'اوصف المخالفة بالتفصيل...' : 'Describe the violation in detail...'} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} style={inp}
              placeholder={lang === 'ar' ? 'أي ملاحظات إضافية...' : 'Any additional notes...'} />
          </div>

          {err && <div style={{ padding: '8px 12px', borderRadius: 7, background: '#EF444415', color: '#EF4444', fontSize: 13 }}>{err}</div>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isTermination ? 'linear-gradient(135deg,#7F1D1D,#DC2626)' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} /> {isTermination ? (lang === 'ar' ? 'تأكيد إنهاء الخدمة' : 'Confirm Termination') : (lang === 'ar' ? 'حفظ الإجراء' : 'Save Action')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────
function DetailModal({ record, emp, issuer, onClose, onStatusChange, isDark, isRTL, lang, c }) {
  const viol   = VIOLATION_TYPES.find(v => v.id === record.violation);
  const action = ACTION_TYPES.find(a => a.id === record.action);
  const status = RECORD_STATUS[record.status];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, direction: isRTL ? 'rtl' : 'ltr', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', background: action?.bg?.replace('18',''), borderRadius: '16px 16px 0 0', borderBottom: '1px solid ' + c.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 12 }}>
            <span style={{ fontSize: 36 }}>{action?.icon}</span>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid ' + c.border, cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} />
            </button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: action?.color }}>{lang === 'ar' ? action?.ar : action?.en}</div>
          <div style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{record.date} · {viol?.icon} {lang === 'ar' ? viol?.ar : viol?.en}</div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Employee */}
          {emp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <Avatar emp={emp} size={42} />
              <div style={{ textAlign: isRTL ? 'right' : 'left', flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
              </div>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: status.bg, color: status.color }}>
                {lang === 'ar' ? status.ar : status.en}
              </span>
            </div>
          )}

          {/* Description */}
          <div style={{ padding: '12px 14px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC', border: '1px solid ' + c.border }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {lang === 'ar' ? 'وصف المخالفة' : 'Violation Description'}
            </div>
            <div style={{ fontSize: 14, color: c.text, lineHeight: 1.6 }}>{lang === 'ar' ? record.desc_ar : record.desc_en}</div>
          </div>

          {/* Details */}
          {[
            ...(record.penalty_amount > 0 ? [{ label: lang === 'ar' ? 'مبلغ الخصم' : 'Deduction', value: `${record.penalty_amount.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, color: '#EF4444' }] : []),
            ...(issuer ? [{ label: lang === 'ar' ? 'صدر بواسطة' : 'Issued by', value: lang === 'ar' ? issuer.full_name_ar : issuer.full_name_en }] : []),
            ...(record.notes ? [{ label: lang === 'ar' ? 'ملاحظات' : 'Notes', value: record.notes }] : []),
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color || c.text }}>{row.value}</span>
            </div>
          ))}

          {/* Status Change Buttons */}
          {record.status === 'open' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => onStatusChange(record.id, 'resolved')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#10B98120', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
                <CheckCircle size={15} /> {lang === 'ar' ? `حُلّت` : 'Mark Resolved'}
              </button>
              <button onClick={() => onStatusChange(record.id, 'appealed')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#3B82F620', color: '#3B82F6', fontSize: 13, fontWeight: 600 }}>
                <FileText size={15} /> {lang === 'ar' ? 'مستأنفة' : 'Mark Appealed'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function DisciplinaryPage() {
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

  const [records, setRecords]   = useState(MOCK_RECORDS);
  const [showForm, setShowForm] = useState(false);
  const [selRecord, setSelRec]  = useState(null);
  const [searchQ, setSearchQ]   = useState('');
  const [statusF, setStatusF]   = useState('all');
  const [actionF, setActionF]   = useState('all');
  const [tab, setTab]           = useState('records');

  const addRecord = (rec) => { setRecords(prev => [rec, ...prev]); setShowForm(false); };
  const changeStatus = (id, status) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSelRec(null);
  };

  const enriched = useMemo(() => records.map(r => ({
    ...r,
    emp:    MOCK_EMPLOYEES.find(e => e.id === r.emp_id),
    issuer: MOCK_EMPLOYEES.find(e => e.id === r.issued_by),
    viol:   VIOLATION_TYPES.find(v => v.id === r.violation),
    action: ACTION_TYPES.find(a => a.id === r.action),
    status: RECORD_STATUS[r.status],
  })), [records]);

  const filtered = useMemo(() => enriched.filter(r => {
    const matchStatus = statusF === 'all' || r.status_key === statusF || r.status === r.status;
    const matchAction = actionF === 'all' || r.action?.id === actionF;
    const matchSearch = !searchQ || (r.emp?.full_name_ar + r.emp?.full_name_en).toLowerCase().includes(searchQ.toLowerCase());
    return matchStatus && matchAction && matchSearch;
  }).filter(r => {
    if (statusF === 'all') return true;
    return records.find(rec => rec.id === r.id)?.status === statusF;
  }), [enriched, statusF, actionF, searchQ, records]);

  const openCount   = records.filter(r => r.status === 'open').length;
  const totalPenalty = records.reduce((s, r) => s + (r.penalty_amount || 0), 0);
  const termCount   = records.filter(r => r.action === 'termination').length;

  // Employee risk summary
  const empRisk = useMemo(() => {
    const risk = {};
    records.forEach(r => {
      if (!risk[r.emp_id]) risk[r.emp_id] = { count: 0, weight: 0 };
      const a = ACTION_TYPES.find(a => a.id === r.action);
      risk[r.emp_id].count++;
      risk[r.emp_id].weight += a?.weight || 1;
    });
    return Object.entries(risk)
      .map(([emp_id, data]) => ({ emp: MOCK_EMPLOYEES.find(e => e.id === emp_id), ...data }))
      .filter(r => r.emp)
      .sort((a, b) => b.weight - a.weight);
  }, [records]);

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الإجراءات التأديبية' : 'Disciplinary Actions'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'المخالفات والإنذارات والجزاءات' : 'Violations, warnings & penalties'}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', color: '#fff', fontSize: 14, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={16} /> {lang === 'ar' ? 'إجراء جديد' : 'New Action'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'قيد المتابعة'   : 'Open Cases',     value: openCount,                     icon: '⚠️', color: '#F59E0B' },
          { label: lang === 'ar' ? 'إجمالي الجزاءات': 'Total Records',  value: records.length,                icon: '📋', color: '#4A7AAB' },
          { label: lang === 'ar' ? 'إجمالي الخصومات': 'Total Penalties',value: `${totalPenalty.toLocaleString()} ج.م`, icon: '💸', color: '#EF4444' },
          { label: lang === 'ar' ? 'إنهاء خدمة'     : 'Terminations',   value: termCount,                     icon: '🔴', color: '#991B1B' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: typeof s.value === 'number' ? 24 : 16, fontWeight: 700, color: s.color }}>{s.value}</div>
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
          { id: 'records', ar: 'السجلات',      en: 'Records'    },
          { id: 'risk',    ar: 'موظفون في خطر', en: 'Risk Watch' },
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

      {/* ── RECORDS TAB ── */}
      {tab === 'records' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} color={c.textMuted} style={{ position: 'absolute', [isRTL?'right':'left']: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ padding: isRTL ? '9px 36px 9px 12px' : '9px 12px 9px 36px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                placeholder={lang === 'ar' ? 'بحث بالموظف...' : 'Search employee...'} />
            </div>
            <select value={statusF} onChange={e => setStatusF(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              {Object.entries(RECORD_STATUS).map(([k,v]) => <option key={k} value={k}>{lang==='ar'?v.ar:v.en}</option>)}
            </select>
            <select value={actionF} onChange={e => setActionF(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الإجراءات' : 'All Actions'}</option>
              {ACTION_TYPES.map(a => <option key={a.id} value={a.id}>{a.icon} {lang==='ar'?a.ar:a.en}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[
                    { ar: 'الموظف',     en: 'Employee',   w: 'auto'  },
                    { ar: 'المخالفة',   en: 'Violation',  w: '140px' },
                    { ar: 'الإجراء',    en: 'Action',     w: '150px' },
                    { ar: 'التاريخ',    en: 'Date',       w: '110px' },
                    { ar: 'الخصم',      en: 'Penalty',    w: '100px' },
                    { ar: 'الحالة',     en: 'Status',     w: '110px' },
                    { ar: '',           en: '',           w: '50px'  },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                      {lang === 'ar' ? col.ar : col.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => (
                  <tr key={r.id}
                    style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => setSelRec(r)}>

                    <td style={{ padding: '12px 14px' }}>
                      {r.emp ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <Avatar emp={r.emp} size={34} />
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? r.emp.full_name_ar : r.emp.full_name_en}</div>
                            <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? r.emp.job_title_ar : r.emp.job_title_en}</div>
                          </div>
                        </div>
                      ) : '—'}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                        {r.viol?.icon} <span style={{ color: c.textMuted }}>{lang === 'ar' ? r.viol?.ar : r.viol?.en}</span>
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.action?.bg, color: r.action?.color }}>
                        {r.action?.icon} {lang === 'ar' ? r.action?.ar : r.action?.en}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px', fontSize: 12, color: c.textMuted }}>{r.date}</td>

                    <td style={{ padding: '12px 14px' }}>
                      {r.penalty_amount > 0
                        ? <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>- {r.penalty_amount.toLocaleString()}</span>
                        : <span style={{ color: c.textMuted, fontSize: 12 }}>—</span>}
                    </td>

                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: r.status?.bg, color: r.status?.color }}>
                        {lang === 'ar' ? r.status?.ar : r.status?.en}
                      </span>
                    </td>

                    <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setSelRec(r)}
                        style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: c.textMuted }}>
                <Shield size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
                <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا توجد سجلات' : 'No records found'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── RISK WATCH TAB ── */}
      {tab === 'risk' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB', border: '1px solid ' + (isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A'), display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <AlertTriangle size={16} color="#F59E0B" />
            <span style={{ fontSize: 13, color: '#F59E0B', fontWeight: 500 }}>
              {lang === 'ar' ? `يُصنَّف الموظفون حسب مجموع أوزان الإجراءات التأديبية المتخذة ضدهم` : 'Employees ranked by cumulative weight of disciplinary actions taken against them'}
            </span>
          </div>

          {empRisk.map(({ emp, count, weight }, idx) => {
            const riskLevel = weight >= 8 ? { ar: `خطر عالٍ`, en: 'High Risk', color: '#EF4444', bg: '#EF444415' }
                            : weight >= 4 ? { ar: 'خطر متوسط', en: 'Medium Risk', color: '#F97316', bg: '#F9731615' }
                            : { ar: 'خطر منخفض', en: 'Low Risk', color: '#F59E0B', bg: '#F59E0B15' };
            const empRecords = records.filter(r => r.emp_id === emp.id);
            const lastAction = ACTION_TYPES.find(a => a.id === empRecords[empRecords.length - 1]?.action);

            return (
              <div key={emp.id} style={{ background: c.cardBg, borderRadius: 12, border: `1px solid ${riskLevel.color}30`, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ position: 'relative' }}>
                      <Avatar emp={emp} size={42} />
                      <div style={{ position: 'absolute', bottom: -2, [isRTL?'left':'right']: -2, width: 14, height: 14, borderRadius: '50%', background: riskLevel.color, border: '2px solid ' + c.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 800 }}>
                        {idx + 1}
                      </div>
                    </div>
                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                      <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: riskLevel.bg, color: riskLevel.color }}>
                    {lang === 'ar' ? riskLevel.ar : riskLevel.en}
                  </span>
                </div>

                {/* Risk bar */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'مؤشر الخطورة' : 'Risk Score'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: riskLevel.color }}>{weight} / 15</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(74,122,171,0.15)' : '#E2E8F0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (weight / 15) * 100)}%`, borderRadius: 3, background: riskLevel.color, transition: 'width 0.6s ease' }} />
                  </div>
                </div>

                {/* Summary */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 12, color: c.textMuted }}>{count} {lang === 'ar' ? `إجراء مسجّل` : 'recorded actions'}</span>
                  {lastAction && (
                    <span style={{ fontSize: 12, color: c.textMuted }}>·</span>
                  )}
                  {lastAction && (
                    <span style={{ fontSize: 12, padding: '1px 8px', borderRadius: 10, background: lastAction.bg, color: lastAction.color, fontWeight: 500 }}>
                      {lastAction.icon} {lang === 'ar' ? lastAction.ar : lastAction.en}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <NewRecordModal
          employees={MOCK_EMPLOYEES}
          onClose={() => setShowForm(false)}
          onSave={addRecord}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
      {selRecord && (
        <DetailModal
          record={selRecord}
          emp={selRecord.emp}
          issuer={selRecord.issuer}
          onClose={() => setSelRec(null)}
          onStatusChange={changeStatus}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
