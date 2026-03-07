import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  Users, Search, Plus, X, User, Mail, Phone,
  Building2, Briefcase, Clock, DollarSign,
  Calendar, Eye, Edit2, AlertTriangle, CheckCircle, Save,
  TrendingUp, ChevronRight, History
} from 'lucide-react';
import {
  MOCK_EMPLOYEES, DEPARTMENTS, CONTRACT_TYPES, WORK_TYPES, OT_MULTIPLIERS,
  calcYearsOfService, calcLeaveBalance,
  isProbationEndingSoon, isContractEndingSoon,
  MOCK_HR_POLICIES
} from '../../data/hr_mock_data';

// ── Helpers ───────────────────────────────────────────────────
function getPolicyValue(key) {
  const p = MOCK_HR_POLICIES.find(p => p.key === key);
  return p ? parseFloat(p.value) : null;
}

const AVATAR_COLORS = [
  '#2B4C6F','#6366F1','#10B981','#EC4899',
  '#F59E0B','#8B5CF6','#14B8A6','#EF4444',
  '#3B82F6','#84CC16',
];

function generateEmployeeNumber(employees) {
  const max = employees.reduce((m, e) => {
    const n = parseInt(e.employee_number.replace('EMP-', '')) || 0;
    return n > m ? n : m;
  }, 0);
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ employee, size = 40 }) {
  const initials = employee.full_name_ar.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: employee.avatar_color || '#2B4C6F',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontSize: size * 0.35, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ employee, lang }) {
  const probMonths = getPolicyValue('probation_months') || 3;
  const alertDays = getPolicyValue('probation_end_alert_days') || 7;
  const contractAlert = getPolicyValue('contract_expiry_alert_days') || 30;

  if (isProbationEndingSoon(employee.hire_date, probMonths, alertDays)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#F59E0B20', color: '#F59E0B' }}>
        <AlertTriangle size={10} /> {lang === 'ar' ? 'فترة تجربة تنتهي قريباً' : 'Probation Ending'}
      </span>
    );
  }
  if (isContractEndingSoon(employee.contract_end_date, contractAlert)) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#EF444420', color: '#EF4444' }}>
        <AlertTriangle size={10} /> {lang === 'ar' ? 'عقد ينتهي قريباً' : 'Contract Ending'}
      </span>
    );
  }
  if (employee.contract_type === 'probation') {
    return (
      <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#EF444420', color: '#EF4444' }}>
        {lang === 'ar' ? 'فترة تجربة' : 'Probation'}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#10B98120', color: '#10B981' }}>
      <CheckCircle size={10} /> {lang === 'ar' ? 'نشط' : 'Active'}
    </span>
  );
}

// ── Salary Raise Modal ────────────────────────────────────────
function SalaryRaiseModal({ employee, onClose, onSubmit, isDark, isRTL, lang, c }) {
  const [form, setForm] = useState({
    type: 'percentage', // percentage | fixed
    value: '',
    reason: '',
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const newSalary = useMemo(() => {
    if (!form.value || isNaN(form.value)) return null;
    const v = parseFloat(form.value);
    if (form.type === 'percentage') return Math.round(employee.base_salary * (1 + v / 100));
    return Math.round(employee.base_salary + v);
  }, [form.type, form.value, employee.base_salary]);

  const diff = newSalary ? newSalary - employee.base_salary : 0;

  const REASONS = {
    ar: ['مكافأة أداء','زيادة سنوية','ترقية','تعديل سوق','تميز استثنائي','أخرى'],
    en: ['Performance Bonus','Annual Increase','Promotion','Market Adjustment','Outstanding Achievement','Other'],
  };

  const handleSubmit = () => {
    if (!form.value || isNaN(form.value) || parseFloat(form.value) <= 0) {
      setError(lang === 'ar' ? 'أدخل قيمة صحيحة' : 'Enter a valid value'); return;
    }
    if (!form.reason) { setError(lang === 'ar' ? 'اختر سبب الزيادة' : 'Select raise reason'); return; }
    onSubmit({ ...form, value: parseFloat(form.value), new_salary: newSalary, old_salary: employee.base_salary, diff });
  };

  const inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color="#fff" />
            </div>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'طلب زيادة راتب' : 'Salary Raise Request'}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? employee.full_name_ar : employee.full_name_en}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Current Salary */}
          <div style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'الراتب الحالي' : 'Current Salary'}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{employee.base_salary.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
          </div>

          {/* Type Toggle */}
          <div>
            <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'نوع الزيادة' : 'Raise Type'}</label>
            <div style={{ display: 'flex', borderRadius: 8, border: '1px solid ' + c.border, overflow: 'hidden' }}>
              {[
                { val: 'percentage', ar: 'نسبة مئوية %', en: 'Percentage %' },
                { val: 'fixed',      ar: 'مبلغ ثابت',    en: 'Fixed Amount' },
              ].map(t => (
                <button key={t.val} onClick={() => set('type', t.val)}
                  style={{ flex: 1, padding: '9px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    background: form.type === t.val ? '#4A7AAB' : 'transparent',
                    color: form.type === t.val ? '#fff' : c.textMuted }}>
                  {lang === 'ar' ? t.ar : t.en}
                </button>
              ))}
            </div>
          </div>

          {/* Value Input */}
          <div>
            <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>
              {form.type === 'percentage' ? (lang === 'ar' ? 'نسبة الزيادة (%)' : 'Raise Percentage (%)') : (lang === 'ar' ? 'مبلغ الزيادة (ج.م)' : 'Raise Amount (EGP)')}
            </label>
            <input type="number" min="0" value={form.value} onChange={e => set('value', e.target.value)}
              placeholder={form.type === 'percentage' ? '10' : '500'}
              style={{ ...inp, borderColor: error && !form.value ? '#EF4444' : c.border }} />
          </div>

          {/* Preview */}
          {newSalary && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(16,185,129,0.08)' : '#ECFDF5', border: '1px solid ' + (isDark ? 'rgba(16,185,129,0.2)' : '#A7F3D0'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 11, color: '#059669' }}>{lang === 'ar' ? 'الراتب الجديد' : 'New Salary'}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>{newSalary.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</div>
              </div>
              <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                <div style={{ fontSize: 11, color: '#059669' }}>{lang === 'ar' ? 'قيمة الزيادة' : 'Increase'}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>
                  +{diff.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}
                  {form.type === 'fixed' && employee.base_salary > 0 && (
                    <span style={{ fontSize: 12, color: '#059669', marginInlineStart: 4 }}>
                      ({((diff / employee.base_salary) * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'سبب الزيادة *' : 'Reason *'}</label>
            <select value={form.reason} onChange={e => set('reason', e.target.value)}
              style={{ ...inp, cursor: 'pointer', borderColor: error && !form.reason ? '#EF4444' : c.border }}>
              <option value="">{lang === 'ar' ? 'اختر السبب...' : 'Select reason...'}</option>
              {REASONS[lang === 'ar' ? 'ar' : 'en'].map((r, i) => <option key={i} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Effective Date */}
          <div>
            <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'تاريخ التطبيق' : 'Effective Date'}</label>
            <input type="date" value={form.effective_date} onChange={e => set('effective_date', e.target.value)} style={inp} />
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder={lang === 'ar' ? 'أي تفاصيل إضافية...' : 'Additional details...'}
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {error && <p style={{ margin: 0, fontSize: 12, color: '#EF4444', textAlign: isRTL ? 'right' : 'left' }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button onClick={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: 13, fontWeight: 600, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <TrendingUp size={14} />
            {lang === 'ar' ? 'تقديم الطلب' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Salary History Modal ───────────────────────────────────────
function SalaryHistoryModal({ employee, history, onClose, isDark, isRTL, lang, c }) {
  const STATUS_MAP = {
    pending:  { ar: 'قيد المراجعة', en: 'Pending',  color: '#F59E0B', bg: '#FEF3C720' },
    approved: { ar: 'معتمد',        en: 'Approved', color: '#10B981', bg: '#D1FAE520' },
    rejected: { ar: 'مرفوض',        en: 'Rejected', color: '#EF4444', bg: '#FEE2E220' },
  };

  const empHistory = history.filter(h => h.employee_id === employee.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', position: 'sticky', top: 0, background: c.cardBg, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <History size={20} color="#4A7AAB" />
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'سجل الرواتب' : 'Salary History'}</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? employee.full_name_ar : employee.full_name_en}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {empHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: c.textMuted }}>
              <History size={36} style={{ opacity: 0.3, marginBottom: 10 }} />
              <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا يوجد سجل تغييرات' : 'No salary changes yet'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {empHistory.map((h, i) => {
                const st = STATUS_MAP[h.status] || STATUS_MAP.pending;
                return (
                  <div key={h.id} style={{ padding: 16, borderRadius: 12, background: isDark ? 'rgba(74,122,171,0.05)' : '#F8FAFC', border: '1px solid ' + c.border }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{h.reason}</div>
                        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>
                          {lang === 'ar' ? 'طلب في' : 'Requested'}: {new Date(h.created_at).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}
                          {h.effective_date && ` · ${lang === 'ar' ? 'يسري من' : 'Effective'}: ${new Date(h.effective_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}`}
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                        {lang === 'ar' ? st.ar : st.en}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 14, color: c.textMuted }}>{h.old_salary.toLocaleString()}</span>
                      <ChevronRight size={14} color={c.textMuted} style={{ transform: isRTL ? 'scaleX(-1)' : 'none' }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>{h.new_salary.toLocaleString()}</span>
                      <span style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#10B981', marginInlineStart: 4 }}>
                        (+{h.diff.toLocaleString()} · {((h.diff / h.old_salary) * 100).toFixed(1)}%)
                      </span>
                    </div>

                    {h.notes && <p style={{ margin: '8px 0 0', fontSize: 12, color: c.textMuted, textAlign: isRTL ? 'right' : 'left' }}>📝 {h.notes}</p>}

                    {/* Approval Actions */}
                    {h.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <button onClick={() => h.onApprove(h.id)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                          {lang === 'ar' ? '✓ اعتماد' : '✓ Approve'}
                        </button>
                        <button onClick={() => h.onReject(h.id)}
                          style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #EF4444', cursor: 'pointer', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 600 }}>
                          {lang === 'ar' ? '✕ رفض' : '✕ Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── View Modal ────────────────────────────────────────────────
function ViewModal({ employee, employees, onClose, onEdit, onRaise, onHistory, isDark, isRTL, lang, c }) {
  if (!employee) return null;
  const years = calcYearsOfService(employee.hire_date);
  const leaveInfo = calcLeaveBalance(
    employee.hire_date,
    getPolicyValue('annual_leave_year1') || 15,
    getPolicyValue('annual_leave_year2') || 21,
    getPolicyValue('probation_months') || 3
  );
  const hourlyRate = (employee.base_salary / (getPolicyValue('hourly_rate_divisor') || 240)).toFixed(2);
  const manager = employees.find(e => e.id === employee.direct_manager_id);

  const InfoRow = ({ icon: Icon, label, value }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.15)' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={15} color="#4A7AAB" />
      </div>
      <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
        <div style={{ fontSize: 11, color: c.textMuted }}>{label}</div>
        <div style={{ fontSize: 14, color: c.text, fontWeight: 500 }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <Avatar employee={employee} size={52} />
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: c.text }}>
                {lang === 'ar' ? employee.full_name_ar : employee.full_name_en}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
                {lang === 'ar' ? employee.job_title_ar : employee.job_title_en} · {employee.employee_number}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <button
              onClick={() => onRaise(employee)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#10B981', color: '#fff', fontSize: 13, fontWeight: 500, flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <TrendingUp size={13} />
              {lang === 'ar' ? 'زيادة راتب' : 'Raise'}
            </button>
            <button
              onClick={() => onHistory(employee)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13, fontWeight: 500, flexDirection: isRTL ? 'row-reverse' : 'row' }}
            >
              <History size={13} />
              {lang === 'ar' ? 'السجل' : 'History'}
            </button>
            <button
              onClick={() => { onClose(); onEdit(employee); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: c.accent, color: '#fff', fontSize: 13, fontWeight: 500 }}
            >
              <Edit2 size={13} />
              {lang === 'ar' ? 'تعديل' : 'Edit'}
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: '16px 24px' }}>
          {[
            { label: lang === 'ar' ? 'سنوات الخدمة' : 'Service Years', value: years < 1 ? (lang === 'ar' ? `${Math.floor(years * 12)} شهر` : `${Math.floor(years * 12)} mo`) : `${years.toFixed(1)}`, icon: '📅' },
            { label: lang === 'ar' ? 'رصيد الإجازة' : 'Leave Balance', value: leaveInfo.inProbation ? (lang === 'ar' ? 'في التجربة' : 'Probation') : `${leaveInfo.balance} ${lang === 'ar' ? 'يوم' : 'days'}`, icon: '🏖️' },
            { label: lang === 'ar' ? 'الأجر الساعي' : 'Hourly Rate', value: `${hourlyRate} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: '💰' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: 12, borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.text }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: c.textMuted }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ padding: '0 24px 24px' }}>
          <InfoRow icon={Mail}      label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}            value={employee.email} />
          <InfoRow icon={Phone}     label={lang === 'ar' ? 'الهاتف' : 'Phone'}                       value={employee.phone} />
          <InfoRow icon={Building2} label={lang === 'ar' ? 'القسم' : 'Department'}                  value={DEPARTMENTS.find(d => d.id === employee.department)?.[`name_${lang}`] || employee.department} />
          <InfoRow icon={Briefcase} label={lang === 'ar' ? 'نوع العقد' : 'Contract Type'}           value={CONTRACT_TYPES[employee.contract_type]?.[lang] || employee.contract_type} />
          <InfoRow icon={User}      label={lang === 'ar' ? 'نوع العمل' : 'Work Type'}                value={`${WORK_TYPES[employee.work_type]?.icon} ${WORK_TYPES[employee.work_type]?.[lang] || employee.work_type}`} />
          <InfoRow icon={Calendar}  label={lang === 'ar' ? 'تاريخ التعيين' : 'Hire Date'}           value={new Date(employee.hire_date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')} />
          <InfoRow icon={DollarSign} label={lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'}       value={`${employee.base_salary.toLocaleString()} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} />
          <InfoRow icon={Clock}     label={lang === 'ar' ? 'مضاعف الأوفرتايم' : 'OT Multiplier'}    value={employee.ot_multiplier} />
          <InfoRow icon={Clock}     label={lang === 'ar' ? 'ساعات التسامح' : 'Tolerance Hours'}      value={`${employee.tolerance_hours} ${lang === 'ar' ? 'ساعات' : 'hrs'}`} />
          {manager && <InfoRow icon={User} label={lang === 'ar' ? 'المدير المباشر' : 'Direct Manager'} value={lang === 'ar' ? manager.full_name_ar : manager.full_name_en} />}
          {employee.notes && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', border: '1px solid ' + (isDark ? 'rgba(245,158,11,0.2)' : '#FDE68A') }}>
              <p style={{ margin: 0, fontSize: 13, color: isDark ? '#F59E0B' : '#92400E' }}>📝 {employee.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Modal ──────────────────────────────────────────
const EMPTY_FORM = {
  full_name_ar: '', full_name_en: '', email: '', phone: '',
  national_id: '', department: 'sales', job_title_ar: '', job_title_en: '',
  role: 'sales_agent', work_type: 'office', contract_type: 'full_time',
  hire_date: '', contract_end_date: '', base_salary: '',
  ot_multiplier: '1x', tolerance_hours: 4,
  direct_manager_id: '', address: '', notes: '',
};

function EmployeeFormModal({ employee, employees, onClose, onSave, isDark, isRTL, lang, c }) {
  const isEdit = !!employee;
  const [form, setForm] = useState(isEdit ? { ...employee } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.full_name_ar.trim()) e.full_name_ar = true;
    if (!form.full_name_en.trim()) e.full_name_en = true;
    if (!form.email.trim()) e.email = true;
    if (!form.phone.trim()) e.phone = true;
    if (!form.job_title_ar.trim()) e.job_title_ar = true;
    if (!form.hire_date) e.hire_date = true;
    if (!form.base_salary || isNaN(form.base_salary)) e.base_salary = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const now = Date.now();
    const saved = {
      ...form,
      base_salary: parseFloat(form.base_salary),
      tolerance_hours: parseFloat(form.tolerance_hours) || 4,
      id: isEdit ? form.id : `e${now}`,
      employee_number: isEdit ? form.employee_number : generateEmployeeNumber(employees),
      status: 'active',
      avatar_color: isEdit ? form.avatar_color : AVATAR_COLORS[employees.length % AVATAR_COLORS.length],
      contract_end_date: form.contract_end_date || null,
      direct_manager_id: form.direct_manager_id || null,
    };
    onSave(saved);
  };

  const inputStyle = (hasErr) => ({
    width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 14,
    border: `1px solid ${hasErr ? '#EF4444' : c.border}`,
    background: c.inputBg, color: c.text, outline: 'none',
    boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr',
  });

  const labelStyle = { fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 5, display: 'block', textAlign: isRTL ? 'right' : 'left' };

  const Field = ({ label, children }) => (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );

  const SectionTitle = ({ title }) => (
    <div style={{ gridColumn: '1 / -1', paddingTop: 8, paddingBottom: 4, borderBottom: '1px solid ' + c.border, marginBottom: 4 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{title}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid ' + c.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row', position: 'sticky', top: 0, background: c.cardBg, zIndex: 10, borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isEdit ? <Edit2 size={16} color="#fff" /> : <Plus size={16} color="#fff" />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: c.text }}>
                {isEdit ? (lang === 'ar' ? 'تعديل بيانات الموظف' : 'Edit Employee') : (lang === 'ar' ? 'إضافة موظف جديد' : 'Add New Employee')}
              </h3>
              {isEdit && <p style={{ margin: 0, fontSize: 12, color: c.textMuted }}>{form.employee_number}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          <SectionTitle title={lang === 'ar' ? '👤 البيانات الشخصية' : '👤 Personal Info'} />

          <Field label={lang === 'ar' ? 'الاسم بالعربي *' : 'Name (Arabic) *'}>
            <input value={form.full_name_ar} onChange={e => set('full_name_ar', e.target.value)} style={inputStyle(errors.full_name_ar)} placeholder="أحمد محمد" />
          </Field>

          <Field label={lang === 'ar' ? 'الاسم بالإنجليزي *' : 'Name (English) *'}>
            <input value={form.full_name_en} onChange={e => set('full_name_en', e.target.value)} style={inputStyle(errors.full_name_en)} placeholder="Ahmed Mohamed" />
          </Field>

          <Field label={lang === 'ar' ? 'البريد الإلكتروني *' : 'Email *'}>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle(errors.email)} placeholder="ahmed@platform.com" />
          </Field>

          <Field label={lang === 'ar' ? 'الهاتف *' : 'Phone *'}>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle(errors.phone)} placeholder="+201001234567" />
          </Field>

          <Field label={lang === 'ar' ? 'الرقم القومي' : 'National ID'}>
            <input value={form.national_id} onChange={e => set('national_id', e.target.value)} style={inputStyle(false)} placeholder="29901011234567" />
          </Field>

          <Field label={lang === 'ar' ? 'العنوان' : 'Address'}>
            <input value={form.address} onChange={e => set('address', e.target.value)} style={inputStyle(false)} placeholder={lang === 'ar' ? 'القاهرة، مصر' : 'Cairo, Egypt'} />
          </Field>

          <SectionTitle title={lang === 'ar' ? '💼 البيانات الوظيفية' : '💼 Job Info'} />

          <Field label={lang === 'ar' ? 'المسمى الوظيفي (عربي) *' : 'Job Title (Arabic) *'}>
            <input value={form.job_title_ar} onChange={e => set('job_title_ar', e.target.value)} style={inputStyle(errors.job_title_ar)} placeholder="مستشار مبيعات" />
          </Field>

          <Field label={lang === 'ar' ? 'المسمى الوظيفي (إنجليزي)' : 'Job Title (English)'}>
            <input value={form.job_title_en} onChange={e => set('job_title_en', e.target.value)} style={inputStyle(false)} placeholder="Sales Agent" />
          </Field>

          <Field label={lang === 'ar' ? 'القسم' : 'Department'}>
            <select value={form.department} onChange={e => set('department', e.target.value)} style={inputStyle(false)}>
              {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
            </select>
          </Field>

          <Field label={lang === 'ar' ? 'الدور' : 'Role'}>
            <select value={form.role} onChange={e => set('role', e.target.value)} style={inputStyle(false)}>
              {[
                { id: 'admin',          ar: 'أدمن',              en: 'Admin' },
                { id: 'sales_director', ar: 'مدير المبيعات',    en: 'Sales Director' },
                { id: 'sales_manager',  ar: 'سيلز مانجر',       en: 'Sales Manager' },
                { id: 'team_leader',    ar: 'تيم ليدر',          en: 'Team Leader' },
                { id: 'sales_agent',    ar: 'مستشار مبيعات',    en: 'Sales Agent' },
                { id: 'marketing',      ar: 'تسويق',             en: 'Marketing' },
                { id: 'hr',             ar: 'موارد بشرية',       en: 'HR' },
                { id: 'finance',        ar: 'مالية',             en: 'Finance' },
              ].map(r => <option key={r.id} value={r.id}>{lang === 'ar' ? r.ar : r.en}</option>)}
            </select>
          </Field>

          <Field label={lang === 'ar' ? 'المدير المباشر' : 'Direct Manager'}>
            <select value={form.direct_manager_id || ''} onChange={e => set('direct_manager_id', e.target.value)} style={inputStyle(false)}>
              <option value="">{lang === 'ar' ? '— بدون مدير —' : '— No Manager —'}</option>
              {employees.filter(e => e.id !== form.id).map(e => (
                <option key={e.id} value={e.id}>{lang === 'ar' ? e.full_name_ar : e.full_name_en}</option>
              ))}
            </select>
          </Field>

          <Field label={lang === 'ar' ? 'نوع العمل' : 'Work Type'}>
            <select value={form.work_type} onChange={e => set('work_type', e.target.value)} style={inputStyle(false)}>
              {Object.entries(WORK_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {lang === 'ar' ? v.ar : v.en}</option>
              ))}
            </select>
          </Field>

          <SectionTitle title={lang === 'ar' ? '📋 العقد' : '📋 Contract'} />

          <Field label={lang === 'ar' ? 'نوع العقد' : 'Contract Type'}>
            <select value={form.contract_type} onChange={e => set('contract_type', e.target.value)} style={inputStyle(false)}>
              {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
              ))}
            </select>
          </Field>

          <Field label={lang === 'ar' ? 'تاريخ التعيين *' : 'Hire Date *'}>
            <input type="date" value={form.hire_date} onChange={e => set('hire_date', e.target.value)} style={inputStyle(errors.hire_date)} />
          </Field>

          <Field label={lang === 'ar' ? 'تاريخ انتهاء العقد' : 'Contract End Date'}>
            <input type="date" value={form.contract_end_date || ''} onChange={e => set('contract_end_date', e.target.value)} style={inputStyle(false)} />
          </Field>

          <SectionTitle title={lang === 'ar' ? '💰 الراتب والأوفرتايم' : '💰 Salary & OT'} />

          <Field label={lang === 'ar' ? 'الراتب الأساسي *' : 'Base Salary *'}>
            <input type="number" value={form.base_salary} onChange={e => set('base_salary', e.target.value)} style={inputStyle(errors.base_salary)} placeholder="10000" />
          </Field>

          <Field label={lang === 'ar' ? 'مضاعف الأوفرتايم' : 'OT Multiplier'}>
            <select value={form.ot_multiplier} onChange={e => set('ot_multiplier', e.target.value)} style={inputStyle(false)}>
              {OT_MULTIPLIERS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          <Field label={lang === 'ar' ? 'ساعات التسامح الشهرية' : 'Monthly Tolerance Hours'}>
            <input type="number" value={form.tolerance_hours} onChange={e => set('tolerance_hours', e.target.value)} style={inputStyle(false)} min="0" max="20" />
          </Field>

          {/* Notes — full width */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column' }}>
            <label style={labelStyle}>{lang === 'ar' ? 'ملاحظات' : 'Notes'}</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              style={{ ...inputStyle(false), resize: 'vertical', fontFamily: 'inherit' }}
              placeholder={lang === 'ar' ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}
            />
          </div>

          {/* Error message */}
          {Object.keys(errors).length > 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 8, background: '#EF444415', border: '1px solid #EF444430', fontSize: 13, color: '#EF4444' }}>
              {lang === 'ar' ? '⚠️ الحقول المميزة باللون الأحمر مطلوبة' : '⚠️ Please fill in all required fields'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row', position: 'sticky', bottom: 0, background: c.cardBg }}>
          <button
            onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 14, fontWeight: 500 }}
          >
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600 }}
          >
            <Save size={15} />
            {isEdit ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'إضافة الموظف' : 'Add Employee')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function EmployeesPage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;

  const [employees, setEmployees] = useState(MOCK_EMPLOYEES);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editEmployee, setEditEmployee] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showRaise, setShowRaise] = useState(false);
  const [raiseEmployee, setRaiseEmployee] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState(null);
  const [salaryHistory, setSalaryHistory] = useState([]);

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    thBg:      isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover:  isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
    primary:   '#2B4C6F',
    accent:    '#4A7AAB',
  };

  const filtered = employees.filter(emp => {
    const matchSearch = !search ||
      emp.full_name_ar.includes(search) ||
      emp.full_name_en.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_number.includes(search) ||
      emp.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || emp.department === deptFilter;
    const matchContract = contractFilter === 'all' || emp.contract_type === contractFilter;
    return matchSearch && matchDept && matchContract;
  });

  const probMonths = getPolicyValue('probation_months') || 3;
  const probAlertDays = getPolicyValue('probation_end_alert_days') || 7;
  const contractAlertDays = getPolicyValue('contract_expiry_alert_days') || 30;
  const alerts = employees.filter(e =>
    isProbationEndingSoon(e.hire_date, probMonths, probAlertDays) ||
    isContractEndingSoon(e.contract_end_date, contractAlertDays)
  );

  const stats = [
    { label: lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees', value: employees.length, icon: '👥', color: '#2B4C6F' },
    { label: lang === 'ar' ? 'نشط' : 'Active', value: employees.filter(e => e.status === 'active').length, icon: '✅', color: '#10B981' },
    { label: lang === 'ar' ? 'فترة تجربة' : 'Probation', value: employees.filter(e => e.contract_type === 'probation').length, icon: '⏳', color: '#F59E0B' },
    { label: lang === 'ar' ? 'تنبيهات' : 'Alerts', value: alerts.length, icon: '🔔', color: '#EF4444' },
  ];

  const handleSave = (savedEmp) => {
    setEmployees(prev => {
      const exists = prev.find(e => e.id === savedEmp.id);
      return exists ? prev.map(e => e.id === savedEmp.id ? savedEmp : e) : [...prev, savedEmp];
    });
    setShowForm(false);
    setEditEmployee(null);
  };

  const openRaise = (emp) => { setRaiseEmployee(emp); setShowRaise(true); setSelectedEmployee(null); };
  const openHistory = (emp) => { setHistoryEmployee(emp); setShowHistory(true); };

  const handleRaiseSubmit = (data) => {
    const newEntry = {
      id: Date.now().toString(),
      employee_id: raiseEmployee.id,
      ...data,
      status: 'pending',
      created_at: new Date().toISOString(),
      onApprove: (id) => {
        setSalaryHistory(prev => prev.map(h => {
          if (h.id !== id) return h;
          // تحديث الراتب الفعلي عند الاعتماد
          setEmployees(emps => emps.map(e =>
            e.id === h.employee_id ? { ...e, base_salary: h.new_salary } : e
          ));
          return { ...h, status: 'approved' };
        }));
      },
      onReject: (id) => setSalaryHistory(prev => prev.map(h => h.id === id ? { ...h, status: 'rejected' } : h)),
    };
    setSalaryHistory(prev => [newEntry, ...prev]);
    setShowRaise(false);
    setRaiseEmployee(null);
    // افتح السجل مباشرة بعد الطلب
    setHistoryEmployee(raiseEmployee);
    setShowHistory(true);
  };

  const openAdd = () => { setEditEmployee(null); setShowForm(true); };
  const openEdit = (emp) => { setEditEmployee(emp); setShowForm(true); };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>
              {lang === 'ar' ? 'الموظفين' : 'Employees'}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
              {employees.length} {lang === 'ar' ? 'موظف' : 'employees'}
            </p>
          </div>
        </div>
        <button
          onClick={openAdd}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #2B4C6F, #4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 500, flexDirection: isRTL ? 'row-reverse' : 'row' }}
        >
          <Plus size={16} />
          {lang === 'ar' ? 'موظف جديد' : 'New Employee'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ padding: '16px 20px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>{stat.label}</div>
              </div>
              <span style={{ fontSize: 28 }}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', borderRadius: 10, background: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.2)' : '#FECACA') }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <AlertTriangle size={16} color="#EF4444" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#EF4444' }}>
              {lang === 'ar' ? `${alerts.length} تنبيه يحتاج انتباهك` : `${alerts.length} alert(s) need attention`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {alerts.map(emp => (
              <button key={emp.id} onClick={() => setSelectedEmployee(emp)}
                style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#EF444420', color: '#EF4444', fontSize: 12, fontWeight: 500 }}>
                {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRTL ? 'right' : 'left']: 12, color: c.textMuted }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employee...'}
            style={{ width: '100%', padding: isRTL ? '10px 40px 10px 14px' : '10px 14px 10px 40px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}>
          <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
          {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang === 'ar' ? d.name_ar : d.name_en}</option>)}
        </select>
        <select value={contractFilter} onChange={e => setContractFilter(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 14, outline: 'none', cursor: 'pointer' }}>
          <option value="all">{lang === 'ar' ? 'كل العقود' : 'All Contracts'}</option>
          {Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[
                { ar: 'الموظف', en: 'Employee', w: 'auto' },
                { ar: 'القسم', en: 'Department', w: '130px' },
                { ar: 'نوع العقد', en: 'Contract', w: '120px' },
                { ar: 'نوع العمل', en: 'Work Type', w: '100px' },
                { ar: 'الراتب', en: 'Salary', w: '110px' },
                { ar: 'رصيد الإجازة', en: 'Leave', w: '100px' },
                { ar: 'الحالة', en: 'Status', w: '150px' },
                { ar: '', en: '', w: '80px' },
              ].map((col, i) => (
                <th key={i} style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w }}>
                  {lang === 'ar' ? col.ar : col.en}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => {
              const dept = DEPARTMENTS.find(d => d.id === emp.department);
              const contract = CONTRACT_TYPES[emp.contract_type];
              const workType = WORK_TYPES[emp.work_type];
              const leaveInfo = calcLeaveBalance(emp.hire_date, getPolicyValue('annual_leave_year1') || 15, getPolicyValue('annual_leave_year2') || 21, getPolicyValue('probation_months') || 3);

              return (
                <tr key={emp.id}
                  style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <Avatar employee={emp} size={38} />
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                        <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en} · {emp.employee_number}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}><span style={{ fontSize: 13, color: c.text }}>{lang === 'ar' ? dept?.name_ar : dept?.name_en}</span></td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: contract?.color + '20', color: contract?.color }}>
                      {lang === 'ar' ? contract?.ar : contract?.en}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}><span style={{ fontSize: 13, color: c.textMuted }}>{workType?.icon} {lang === 'ar' ? workType?.ar : workType?.en}</span></td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{emp.base_salary.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: c.textMuted }}> {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {leaveInfo.inProbation
                      ? <span style={{ fontSize: 12, color: c.textMuted }}>—</span>
                      : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#10B98120', color: '#10B981' }}>{leaveInfo.balance} {lang === 'ar' ? 'يوم' : 'days'}</span>
                    }
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge employee={emp} lang={lang} /></td>
                  <td style={{ padding: '14px 16px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <button onClick={() => setSelectedEmployee(emp)}
                        style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                        <Eye size={14} />
                      </button>
                      <button onClick={() => openEdit(emp)}
                        style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#F59E0B'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#F59E0B'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                        <Edit2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: c.textMuted }}>
            <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>{lang === 'ar' ? 'لا يوجد موظفين' : 'No employees found'}</p>
          </div>
        )}
      </div>

      {/* View Modal */}
      {selectedEmployee && (
        <ViewModal
          employee={selectedEmployee}
          employees={employees}
          onClose={() => setSelectedEmployee(null)}
          onEdit={openEdit}
          onRaise={openRaise}
          onHistory={openHistory}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}

      {/* Salary Raise Modal */}
      {showRaise && raiseEmployee && (
        <SalaryRaiseModal
          employee={raiseEmployee}
          onClose={() => { setShowRaise(false); setRaiseEmployee(null); }}
          onSubmit={handleRaiseSubmit}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}

      {/* Salary History Modal */}
      {showHistory && historyEmployee && (
        <SalaryHistoryModal
          employee={historyEmployee}
          history={salaryHistory}
          onClose={() => { setShowHistory(false); setHistoryEmployee(null); }}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}

      {/* Add / Edit Modal */}
      {showForm && (
        <EmployeeFormModal
          employee={editEmployee}
          employees={employees}
          onClose={() => { setShowForm(false); setEditEmployee(null); }}
          onSave={handleSave}
          isDark={isDark} isRTL={isRTL} lang={lang} c={c}
        />
      )}
    </div>
  );
}
