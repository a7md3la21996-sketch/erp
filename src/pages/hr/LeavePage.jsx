import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Calendar, Plus, X, Save, CheckCircle, XCircle,
  Clock, ChevronLeft, ChevronRight, AlertTriangle,
  Filter, Download, Eye
} from 'lucide-react';
import {
  MOCK_EMPLOYEES, DEPARTMENTS, MOCK_HR_POLICIES
} from '../../data/hr_mock_data';

// ── Helpers ───────────────────────────────────────────────────
function getPol(key) {
  const p = MOCK_HR_POLICIES.find(p => p.key === key);
  return p ? parseFloat(p.value) : null;
}

const LEAVE_TYPES = {
  annual:       { ar: 'سنوية',          en: 'Annual',        color: '#3B82F6', icon: '🏖️',  paid: true,  fromBalance: true  },
  sick:         { ar: 'مرضية',          en: 'Sick',          color: '#10B981', icon: '🏥',  paid: true,  fromBalance: true  },
  marriage:     { ar: 'زواج',           en: 'Marriage',      color: '#EC4899', icon: '💍',  paid: true,  fromBalance: true  },
  maternity:    { ar: 'أمومة',          en: 'Maternity',     color: '#8B5CF6', icon: '👶',  paid: true,  fromBalance: true  },
  paternity:    { ar: 'أبوة',           en: 'Paternity',     color: '#6366F1', icon: '👨‍👧',  paid: true,  fromBalance: true  },
  unpaid:       { ar: 'بدون راتب',      en: 'Unpaid',        color: '#F59E0B', icon: '💸',  paid: false, fromBalance: false },
  exception:    { ar: 'استثناء',        en: 'Exception',     color: '#14B8A6', icon: '⚡',  paid: true,  fromBalance: false },
  notice:       { ar: 'بإشعار مسبق',   en: 'With Notice',   color: '#94A3B8', icon: '📋',  paid: false, fromBalance: false },
};

const STATUS = {
  pending:  { ar: 'قيد الانتظار', en: 'Pending',  color: '#F59E0B', bg: '#F59E0B20' },
  approved: { ar: 'معتمدة',       en: 'Approved', color: '#10B981', bg: '#10B98120' },
  rejected: { ar: 'مرفوضة',      en: 'Rejected', color: '#EF4444', bg: '#EF444420' },
  cancelled:{ ar: 'ملغاة',        en: 'Cancelled',color: '#94A3B8', bg: '#94A3B820' },
};

function calcBalance(emp, leaveType) {
  const hireDate = new Date(emp.hire_date);
  const now = new Date();
  const months = (now - hireDate) / (1000 * 60 * 60 * 24 * 30.44);
  const probMonths = getPol('probation_months') || 3;
  if (months < probMonths) return { balance: 0, inProbation: true };
  const years = months / 12;

  if (leaveType === 'annual') {
    const y1 = getPol('annual_leave_year1') || 15;
    const y2 = getPol('annual_leave_year2') || 21;
    if (years < 1) return { balance: Math.round((y1 / 12) * (months - probMonths)), inProbation: false };
    return { balance: y2, inProbation: false };
  }
  if (leaveType === 'sick')      return { balance: getPol('sick_leave_days') || 7, inProbation: false };
  if (leaveType === 'marriage')  return { balance: getPol('marriage_leave_days') || 3, inProbation: false };
  if (leaveType === 'maternity') return { balance: getPol('maternity_leave_days') || 90, inProbation: false };
  if (leaveType === 'paternity') return { balance: getPol('paternity_leave_days') || 3, inProbation: false };
  return { balance: null, inProbation: false };
}

function daysBetween(from, to) {
  if (!from || !to) return 0;
  const d = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(d) + 1);
}

// Mock leave requests
const MOCK_LEAVES = [
  { id: 'l1', employee_id: 'e6', leave_type: 'annual',   from_date: '2026-03-10', to_date: '2026-03-12', days: 3, status: 'approved', reason: 'راحة شخصية', manager_note: '', created_at: '2026-03-05', approved_by: 'e5' },
  { id: 'l2', employee_id: 'e8', leave_type: 'sick',     from_date: '2026-03-07', to_date: '2026-03-08', days: 2, status: 'pending',  reason: 'مرض',         manager_note: '', created_at: '2026-03-06', approved_by: null },
  { id: 'l3', employee_id: 'e5', leave_type: 'annual',   from_date: '2026-03-15', to_date: '2026-03-18', days: 4, status: 'pending',  reason: 'إجازة عيد',   manager_note: '', created_at: '2026-03-05', approved_by: null },
  { id: 'l4', employee_id: 'e3', leave_type: 'marriage', from_date: '2026-02-20', to_date: '2026-02-22', days: 3, status: 'approved', reason: 'زواج',         manager_note: 'مبروك!', created_at: '2026-02-15', approved_by: 'e1' },
  { id: 'l5', employee_id: 'e7', leave_type: 'unpaid',   from_date: '2026-03-20', to_date: '2026-03-21', days: 2, status: 'rejected', reason: 'ظروف شخصية',  manager_note: 'لا يمكن الموافقة في هذا التوقيت', created_at: '2026-03-04', approved_by: null },
];

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ emp, size = 32 }) {
  const initials = emp.full_name_ar.split(' ').slice(0,2).map(w=>w[0]).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Request Modal ─────────────────────────────────────────────
function RequestModal({ onClose, onSave, employees, isDark, isRTL, lang, c }) {
  const [form, setForm] = useState({
    employee_id: employees[0]?.id || '',
    leave_type: 'annual',
    from_date: '',
    to_date: '',
    reason: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const days = daysBetween(form.from_date, form.to_date);
  const emp  = employees.find(e => e.id === form.employee_id);
  const bal  = emp ? calcBalance(emp, form.leave_type) : null;
  const lt   = LEAVE_TYPES[form.leave_type];
  const [err, setErr] = useState('');

  const handleSave = () => {
    if (!form.from_date || !form.to_date) { setErr(lang === 'ar' ? 'حدد التاريخ' : 'Select dates'); return; }
    if (new Date(form.to_date) < new Date(form.from_date)) { setErr(lang === 'ar' ? 'تاريخ النهاية قبل البداية!' : 'End before start!'); return; }
    onSave({
      ...form, days,
      id: `l${Date.now()}`,
      status: 'pending',
      manager_note: '',
      created_at: new Date().toISOString().split('T')[0],
      approved_by: null,
    });
  };

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 500, direction: isRTL ? 'rtl' : 'ltr', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Calendar size={18} color="#fff" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
              {lang === 'ar' ? 'طلب إجازة جديد' : 'New Leave Request'}
            </h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Employee */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'الموظف' : 'Employee'}</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} style={inp}>
              {employees.map(e => <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>)}
            </select>
          </div>

          {/* Leave Type */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'نوع الإجازة' : 'Leave Type'}</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {Object.entries(LEAVE_TYPES).map(([key, val]) => (
                <button key={key} onClick={() => set('leave_type', key)}
                  style={{ padding: '8px 4px', borderRadius: 8, border: `2px solid ${form.leave_type === key ? val.color : c.border}`, cursor: 'pointer', background: form.leave_type === key ? val.color + '20' : 'transparent', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 18 }}>{val.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: form.leave_type === key ? val.color : c.textMuted, marginTop: 2 }}>
                    {lang === 'ar' ? val.ar : val.en}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Balance info */}
          {bal && lt.fromBalance && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: bal.inProbation ? '#F59E0B15' : '#3B82F615', border: '1px solid ' + (bal.inProbation ? '#F59E0B30' : '#3B82F630'), display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {bal.inProbation
                ? <><AlertTriangle size={14} color="#F59E0B" /><span style={{ fontSize: 13, color: '#F59E0B' }}>{lang === 'ar' ? 'الموظف في فترة التجربة — لا يوجد رصيد' : 'Employee in probation — no balance'}</span></>
                : <><CheckCircle size={14} color="#3B82F6" /><span style={{ fontSize: 13, color: '#3B82F6' }}>{lang === 'ar' ? `الرصيد المتاح: ${bal.balance} يوم` : `Available balance: ${bal.balance} days`}</span></>
              }
            </div>
          )}

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'من' : 'From'}</label>
              <input type="date" value={form.from_date} onChange={e => set('from_date', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>{lang === 'ar' ? 'إلى' : 'To'}</label>
              <input type="date" value={form.to_date} onChange={e => set('to_date', e.target.value)} style={inp} />
            </div>
          </div>

          {/* Days summary */}
          {days > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : '#BFDBFE'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'عدد الأيام' : 'Number of days'}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{days} {lang === 'ar' ? 'أيام' : 'days'}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={lbl}>{lang === 'ar' ? 'السبب' : 'Reason'}</label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={2}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={lang === 'ar' ? 'اختياري...' : 'Optional...'} />
          </div>

          {err && <div style={{ padding: '8px 12px', borderRadius: 7, background: '#EF444415', color: '#EF4444', fontSize: 13 }}>{err}</div>}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Save size={14} />
            {lang === 'ar' ? 'إرسال الطلب' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────
function DetailModal({ leave, employees, onClose, onApprove, onReject, isDark, isRTL, lang, c }) {
  const emp = employees.find(e => e.id === leave.employee_id);
  const approver = employees.find(e => e.id === leave.approved_by);
  const lt = LEAVE_TYPES[leave.leave_type];
  const st = STATUS[leave.status];
  const [note, setNote] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, direction: isRTL ? 'rtl' : 'ltr', overflow: 'hidden' }}>

        {/* Colored Header */}
        <div style={{ padding: '20px 24px', background: lt.color + '20', borderBottom: '1px solid ' + lt.color + '30', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 32 }}>{lt.icon}</span>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: c.text }}>{lang === 'ar' ? lt.ar : lt.en}</div>
              <div style={{ fontSize: 13, color: c.textMuted }}>{leave.days} {lang === 'ar' ? 'أيام' : 'days'} · {leave.from_date} → {leave.to_date}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Employee */}
          {emp && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <Avatar emp={emp} size={40} />
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
              </div>
              <div style={{ marginInlineStart: 'auto' }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>
                  {lang === 'ar' ? st.ar : st.en}
                </span>
              </div>
            </div>
          )}

          {/* Info rows */}
          {[
            { label: lang === 'ar' ? 'مدفوعة' : 'Paid', value: lt.paid ? (lang === 'ar' ? '✅ نعم' : '✅ Yes') : (lang === 'ar' ? '❌ لا (خصم)' : '❌ No (deducted)') },
            { label: lang === 'ar' ? 'من الرصيد' : 'From Balance', value: lt.fromBalance ? (lang === 'ar' ? 'نعم' : 'Yes') : (lang === 'ar' ? 'لا' : 'No') },
            { label: lang === 'ar' ? 'تاريخ الطلب' : 'Requested', value: leave.created_at },
            ...(leave.reason ? [{ label: lang === 'ar' ? 'السبب' : 'Reason', value: leave.reason }] : []),
            ...(approver ? [{ label: lang === 'ar' ? 'اعتمد بواسطة' : 'Approved by', value: lang === 'ar' ? approver.full_name_ar : approver.full_name_en }] : []),
            ...(leave.manager_note ? [{ label: lang === 'ar' ? 'ملاحظة المدير' : 'Manager note', value: leave.manager_note }] : []),
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>{row.label}</span>
              <span style={{ fontSize: 13, color: c.text, fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}

          {/* Approval actions */}
          {leave.status === 'pending' && (
            <>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 4, display: 'block', textAlign: isRTL ? 'right' : 'left' }}>
                  {lang === 'ar' ? 'ملاحظة (اختياري)' : 'Note (optional)'}
                </label>
                <input value={note} onChange={e => setNote(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  placeholder={lang === 'ar' ? 'ملاحظة للموظف...' : 'Note for employee...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => onReject(leave.id, note)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#EF444420', color: '#EF4444', fontSize: 13, fontWeight: 600 }}>
                  <XCircle size={15} /> {lang === 'ar' ? 'رفض' : 'Reject'}
                </button>
                <button onClick={() => onApprove(leave.id, note)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#10B98120', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
                  <CheckCircle size={15} /> {lang === 'ar' ? 'موافقة' : 'Approve'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function LeavePage() {
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

  const [tab, setTab]           = useState('requests');
  const [leaves, setLeaves]     = useState(MOCK_LEAVES);
  const [showRequest, setShowRequest] = useState(false);
  const [detailLeave, setDetail]      = useState(null);
  const [statusFilter, setStatusF]    = useState('all');
  const [typeFilter, setTypeF]        = useState('all');
  const [calMonth, setCalMonth]       = useState(new Date().getMonth());
  const [calYear, setCalYear]         = useState(new Date().getFullYear());

  const monthNames = {
    ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  };

  const filtered = useMemo(() => leaves.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchType   = typeFilter === 'all'   || l.leave_type === typeFilter;
    return matchStatus && matchType;
  }), [leaves, statusFilter, typeFilter]);

  const pendingCount   = leaves.filter(l => l.status === 'pending').length;
  const approvedCount  = leaves.filter(l => l.status === 'approved').length;
  const totalDaysThisMonth = leaves.filter(l => l.status === 'approved' && l.from_date?.startsWith(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`)).reduce((s, l) => s + l.days, 0);

  const addLeave = (leave) => { setLeaves(prev => [leave, ...prev]); setShowRequest(false); };

  const approveLeave = (id, note) => {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'approved', manager_note: note, approved_by: 'e2' } : l));
    setDetail(null);
  };

  const rejectLeave = (id, note) => {
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status: 'rejected', manager_note: note } : l));
    setDetail(null);
  };

  // ── Calendar helpers ──
  const prevCalMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11); } else setCalMonth(m=>m-1); };
  const nextCalMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0); } else setCalMonth(m=>m+1); };

  const calDays = useMemo(() => {
    const days = [];
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    // offset for Saturday-start Arabic calendar
    const offset = (firstDay + 1) % 7;
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [calYear, calMonth]);

  const leavesOnDay = (day) => {
    if (!day) return [];
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return leaves.filter(l => l.status === 'approved' && l.from_date <= dateStr && l.to_date >= dateStr);
  };

  // ── Balances ──
  const balanceData = useMemo(() => MOCK_EMPLOYEES.map(emp => {
    return {
      emp,
      annual:    calcBalance(emp, 'annual'),
      sick:      calcBalance(emp, 'sick'),
      marriage:  calcBalance(emp, 'marriage'),
    };
  }), []);

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الإجازات' : 'Leave Management'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'طلبات الإجازة والرصيد والتقويم' : 'Leave requests, balances & calendar'}</p>
          </div>
        </div>
        <button onClick={() => setShowRequest(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Plus size={16} /> {lang === 'ar' ? 'طلب إجازة' : 'New Request'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: lang === 'ar' ? 'قيد الانتظار' : 'Pending',      value: pendingCount,          icon: '⏳', color: '#F59E0B' },
          { label: lang === 'ar' ? 'معتمدة' : 'Approved',           value: approvedCount,         icon: '✅', color: '#10B981' },
          { label: lang === 'ar' ? 'هذا الشهر (أيام)' : 'This Month (days)', value: totalDaysThisMonth, icon: '📅', color: '#6366F1' },
          { label: lang === 'ar' ? 'إجمالي الطلبات' : 'Total',      value: leaves.length,         icon: '📋', color: '#4A7AAB' },
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

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', border: '1px solid ' + (isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A'), display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <AlertTriangle size={16} color="#F59E0B" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B' }}>
            {lang === 'ar' ? `${pendingCount} طلب إجازة ينتظر الموافقة` : `${pendingCount} leave request(s) pending approval`}
          </span>
          <button onClick={() => { setTab('requests'); setStatusF('pending'); }}
            style={{ marginInlineStart: 'auto', padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#F59E0B', color: '#fff', fontSize: 12, fontWeight: 600 }}>
            {lang === 'ar' ? 'عرض' : 'View'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: isDark ? 'rgba(74,122,171,0.08)' : '#F1F5F9', padding: 4, borderRadius: 10, width: 'fit-content', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {[
          { id: 'requests', ar: 'الطلبات', en: 'Requests' },
          { id: 'balances', ar: 'الأرصدة', en: 'Balances' },
          { id: 'calendar', ar: 'التقويم', en: 'Calendar' },
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

      {/* ── REQUESTS TAB ── */}
      {tab === 'requests' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <select value={statusFilter} onChange={e => setStatusF(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Status'}</option>
              {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeF(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
              <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
              {Object.entries(LEAVE_TYPES).map(([k,v]) => <option key={k} value={k}>{v.icon} {lang === 'ar' ? v.ar : v.en}</option>)}
            </select>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: 'transparent', color: c.textMuted, fontSize: 13, cursor: 'pointer', marginInlineStart: 'auto' }}>
              <Download size={14} /> {lang === 'ar' ? 'تصدير' : 'Export'}
            </button>
          </div>

          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: c.thBg }}>
                  {[
                    { ar: 'الموظف',    en: 'Employee',  w: 'auto' },
                    { ar: 'النوع',     en: 'Type',      w: '120px' },
                    { ar: 'من',        en: 'From',      w: '100px' },
                    { ar: 'إلى',       en: 'To',        w: '100px' },
                    { ar: 'الأيام',    en: 'Days',      w: '70px' },
                    { ar: 'الحالة',    en: 'Status',    w: '110px' },
                    { ar: 'تاريخ الطلب', en: 'Requested', w: '110px' },
                    { ar: '',          en: '',          w: '50px' },
                  ].map((col, i) => (
                    <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                      {lang === 'ar' ? col.ar : col.en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((leave, idx) => {
                  const emp = MOCK_EMPLOYEES.find(e => e.id === leave.employee_id);
                  const lt  = LEAVE_TYPES[leave.leave_type];
                  const st  = STATUS[leave.status];
                  if (!emp) return null;
                  return (
                    <tr key={leave.id}
                      style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setDetail(leave)}>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <Avatar emp={emp} size={34} />
                          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                            <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: lt.color + '20', color: lt.color }}>
                          {lt.icon} {lang === 'ar' ? lt.ar : lt.en}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: 13, color: c.text }}>{leave.from_date}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: c.text }}>{leave.to_date}</td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: c.accent }}>{leave.days}</span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: st.bg, color: st.color }}>
                          {lang === 'ar' ? st.ar : st.en}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', fontSize: 12, color: c.textMuted }}>{leave.created_at}</td>

                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setDetail(leave)}
                          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: c.textMuted }}>
                <Calendar size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
                <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا توجد طلبات' : 'No requests found'}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── BALANCES TAB ── */}
      {tab === 'balances' && (
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: c.thBg }}>
                {[
                  { ar: 'الموظف', en: 'Employee', w: 'auto' },
                  { ar: 'سنوية 🏖️', en: 'Annual 🏖️', w: '110px' },
                  { ar: 'مرضية 🏥', en: 'Sick 🏥', w: '110px' },
                  { ar: 'زواج 💍', en: 'Marriage 💍', w: '110px' },
                  { ar: 'الحالة', en: 'Status', w: '120px' },
                ].map((col, i) => (
                  <th key={i} style={{ padding: '11px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                    {lang === 'ar' ? col.ar : col.en}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balanceData.map(({ emp, annual, sick, marriage }, idx) => (
                <tr key={emp.id} style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <Avatar emp={emp} size={34} />
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number}</div>
                      </div>
                    </div>
                  </td>

                  {[annual, sick, marriage].map((bal, i) => (
                    <td key={i} style={{ padding: '12px 16px' }}>
                      {bal.inProbation
                        ? <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 500 }}>{lang === 'ar' ? 'في التجربة' : 'Probation'}</span>
                        : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 16, fontWeight: 800, color: c.accent }}>{bal.balance}</span>
                            <span style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'يوم' : 'days'}</span>
                          </div>
                      }
                    </td>
                  ))}

                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#10B98120', color: '#10B981' }}>
                      ✓ {lang === 'ar' ? 'نشط' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CALENDAR TAB ── */}
      {tab === 'calendar' && (
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
          {/* Cal Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button onClick={prevCalMonth} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
            <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? monthNames.ar[calMonth] : monthNames.en[calMonth]} {calYear}
            </span>
            <button onClick={nextCalMonth} style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid ' + c.border }}>
            {(lang === 'ar' ? ['أح','إث','ث','أر','خ','ج','س'] : ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']).map((d, i) => (
              <div key={i} style={{ padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: i === 5 || i === 6 ? '#EF4444' : c.textMuted }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {calDays.map((day, i) => {
              const leavesThisDay = leavesOnDay(day);
              const isToday = day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
              const isWeekend = day && [0, 6].includes(new Date(calYear, calMonth, day).getDay());
              return (
                <div key={i} style={{
                  minHeight: 80, padding: '6px 8px',
                  borderRight: (i + 1) % 7 !== 0 ? '1px solid ' + c.border : 'none',
                  borderBottom: '1px solid ' + c.border,
                  background: isWeekend && day ? (isDark ? 'rgba(239,68,68,0.04)' : '#FFF5F5') : 'transparent',
                }}>
                  {day && (
                    <>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: isToday ? 700 : 400,
                        background: isToday ? c.accent : 'transparent',
                        color: isToday ? '#fff' : isWeekend ? '#EF4444' : c.text,
                        marginBottom: 4,
                      }}>
                        {day}
                      </div>
                      {leavesThisDay.slice(0, 2).map((l, li) => {
                        const emp = MOCK_EMPLOYEES.find(e => e.id === l.employee_id);
                        const lt  = LEAVE_TYPES[l.leave_type];
                        return (
                          <div key={li} style={{ marginBottom: 2, padding: '2px 5px', borderRadius: 4, background: lt.color + '25', borderLeft: `2px solid ${lt.color}`, fontSize: 10, fontWeight: 500, color: lt.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {emp ? emp.full_name_ar.split(' ')[0] : ''}
                          </div>
                        );
                      })}
                      {leavesThisDay.length > 2 && (
                        <div style={{ fontSize: 10, color: c.textMuted }}>+{leavesThisDay.length - 2} {lang === 'ar' ? 'أكثر' : 'more'}</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 16, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {Object.entries(LEAVE_TYPES).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: v.color }} />
                <span style={{ fontSize: 11, color: c.textMuted }}>{v.icon} {lang === 'ar' ? v.ar : v.en}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showRequest && (
        <RequestModal
          employees={MOCK_EMPLOYEES}
          onClose={() => setShowRequest(false)}
          onSave={addLeave}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
      {detailLeave && (
        <DetailModal
          leave={detailLeave}
          employees={MOCK_EMPLOYEES}
          onClose={() => setDetail(null)}
          onApprove={approveLeave}
          onReject={rejectLeave}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
