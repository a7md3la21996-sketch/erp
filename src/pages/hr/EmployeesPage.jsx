import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import {
  Users, Plus, Search, Eye, Edit2, FileText,
  AlertTriangle, Clock, ChevronDown, Building2,
  UserCheck, Briefcase, Shield, X, Check
} from 'lucide-react';

/* ─── shared design tokens ─── */
function useDS() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    bg:        dark ? '#152232' : '#F0F4F8',
    card:      dark ? '#1a2234' : '#ffffff',
    border:    dark ? 'rgba(74,122,171,0.2)' : '#E2E8F0',
    text:      dark ? '#E2EAF4' : '#1A2B3C',
    muted:     dark ? '#8BA8C8' : '#64748B',
    input:     dark ? '#0F1E2D' : '#ffffff',
    rowHover:  dark ? 'rgba(74,122,171,0.07)' : '#F8FAFC',
    thBg:      dark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };
}

/* ─── Hover-aware row ─── */
function TR({ children, onClick, style = {} }) {
  const ds = useDS();
  const [hov, setHov] = useState(false);
  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        borderBottom: `1px solid ${ds.border}`,
        background: hov ? ds.rowHover : 'transparent',
        transition: 'background 0.15s',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >{children}</tr>
  );
}

/* ─── KPI Card ─── */
function KpiCard({ icon: Icon, label, value, sub, color = '#4A7AAB' }) {
  const ds = useDS();
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: ds.card,
        borderRadius: 14,
        border: `1px solid ${hov ? color + '60' : ds.border}`,
        padding: '18px 20px',
        position: 'relative',
        overflow: 'hidden',
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov ? `0 8px 24px ${color}22` : '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* accent bar */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 4, height: '100%',
        background: `linear-gradient(180deg, ${color}, transparent)`,
        borderRadius: '14px 0 0 14px',
        opacity: hov ? 1 : 0.6,
        transition: 'opacity 0.2s',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: ds.muted, fontWeight: 500 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: ds.text, lineHeight: 1 }}>{value}</p>
          {sub && <p style={{ margin: '3px 0 0', fontSize: 11, color: ds.muted }}>{sub}</p>}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 11,
          background: color + (hov ? '25' : '15'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

/* ─── Icon Button ─── */
function IconBtn({ icon: Icon, onClick, color = '#4A7AAB', title }) {
  const ds = useDS();
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: 8,
        border: `1px solid ${hov ? color + '60' : ds.border}`,
        background: hov ? color + '15' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transform: hov ? 'scale(1.08)' : 'scale(1)',
        transition: 'all 0.15s ease',
      }}
    >
      <Icon size={14} color={hov ? color : ds.muted} />
    </button>
  );
}

/* ─── Badge ─── */
function Badge({ label, color = '#4A7AAB' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: color + '18', color,
      border: `1px solid ${color}35`,
    }}>{label}</span>
  );
}

/* ─── Select ─── */
function Select({ value, onChange, options, ds, isRTL }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          appearance: 'none', padding: '8px 32px 8px 12px',
          borderRadius: 9, border: `1px solid ${hov ? ds.accent + '60' : ds.border}`,
          background: ds.input, color: ds.text, fontSize: 13,
          cursor: 'pointer', outline: 'none', direction: isRTL ? 'rtl' : 'ltr',
          transition: 'border-color 0.15s',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} color={ds.muted} style={{ position: 'absolute', [isRTL ? 'left' : 'right']: 10, pointerEvents: 'none' }} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function EmployeesPage() {
  const { i18n } = useTranslation();
  const ds = useDS();
  const isRTL = i18n.language === 'ar';
  const lang  = i18n.language;

  const [search,  setSearch]  = useState('');
  const [deptF,   setDeptF]   = useState('all');
  const [contractF, setContractF] = useState('all');
  const [view,    setView]    = useState('list');
  const [selected, setSelected] = useState(null);

  /* stats */
  const today = new Date();
  const expiring = MOCK_EMPLOYEES.filter(e => {
    if (!e.contract_end) return false;
    const days = Math.ceil((new Date(e.contract_end) - today) / 864e5);
    return days > 0 && days <= 30;
  });
  const probation = MOCK_EMPLOYEES.filter(e => e.employment_type === 'probation');
  const active    = MOCK_EMPLOYEES.filter(e => e.status === 'active');

  const filtered = useMemo(() => MOCK_EMPLOYEES.filter(e => {
    const name = (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar || '';
    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) ||
                        (e.employee_id || '').toLowerCase().includes(search.toLowerCase());
    const matchDept   = deptF === 'all' || e.department === deptF;
    const matchCont   = contractF === 'all' || e.employment_type === contractF;
    return matchSearch && matchDept && matchCont;
  }), [search, deptF, contractF, isRTL]);

  const deptOptions  = [{ value: 'all', label: lang === 'ar' ? 'كل الأقسام' : 'All Departments' }, ...DEPARTMENTS.map(d => ({ value: d.id, label: isRTL ? d.name_ar : d.name_en }))];
  const contractOpts = [{ value: 'all', label: lang === 'ar' ? 'كل العقود' : 'All Contracts' }, { value: 'full_time', label: lang === 'ar' ? 'دوام كامل' : 'Full Time' }, { value: 'part_time', label: lang === 'ar' ? 'دوام جزئي' : 'Part Time' }, { value: 'probation', label: lang === 'ar' ? 'فترة تجربة' : 'Probation' }];

  const statusColor = s => s === 'active' ? '#4A7AAB' : s === 'on_leave' ? '#6B8DB5' : '#94a3b8';
  const statusLabel = s => ({ active: lang === 'ar' ? 'نشط' : 'Active', on_leave: lang === 'ar' ? 'إجازة' : 'On Leave', inactive: lang === 'ar' ? 'غير نشط' : 'Inactive' }[s] || s);

  const th = { fontSize: 11, fontWeight: 700, color: ds.muted, padding: '10px 14px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' };
  const td = { fontSize: 13, color: ds.text, padding: '12px 14px', verticalAlign: 'middle' };

  return (
    <div style={{ padding: '24px 28px', background: ds.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg, #1B3347, #4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(74,122,171,0.3)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: ds.text }}>{lang === 'ar' ? 'الموظفين' : 'Employees'}</h1>
            <p style={{ margin: 0, fontSize: 12, color: ds.muted }}>{MOCK_EMPLOYEES.length} {lang === 'ar' ? 'موظف' : 'employees'}</p>
          </div>
        </div>
        <AddButton label={lang === 'ar' ? '+ موظف جديد' : '+ New Employee'} ds={ds} />
      </div>

      {/* ── KPI Strip ── */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <KpiCard icon={Users}     label={lang === 'ar' ? 'إجمالي الموظفين' : 'Total Employees'} value={MOCK_EMPLOYEES.length} color="#1B3347" />
        <KpiCard icon={UserCheck} label={lang === 'ar' ? 'نشط'             : 'Active'}           value={active.length}         color="#4A7AAB" />
        <KpiCard icon={Clock}     label={lang === 'ar' ? 'فترة تجربة'      : 'Probation'}        value={probation.length}      color="#6B8DB5" />
        <KpiCard icon={AlertTriangle} label={lang === 'ar' ? 'عقود تنتهي قريباً' : 'Expiring Soon'} value={expiring.length} color="#EF4444" />
      </div>

      {/* ── Alert Banner ── */}
      {expiring.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <AlertTriangle size={16} color="#EF4444" />
          <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>
            {lang === 'ar' ? `${expiring.length} عقد ينتهي خلال 30 يوم` : `${expiring.length} contract(s) expiring within 30 days`}
            {expiring.map(e => (isRTL ? e.full_name_ar : e.full_name_en) || e.full_name_ar).join('، ')}
          </span>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ background: ds.card, borderRadius: 14, border: `1px solid ${ds.border}`, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} color={ds.muted} style={{ position: 'absolute', top: '50%', [isRTL ? 'right' : 'left']: 12, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث عن موظف...' : 'Search employees...'}
            style={{ width: '100%', padding: isRTL ? '8px 36px 8px 12px' : '8px 12px 8px 36px', borderRadius: 9, border: `1px solid ${ds.border}`, background: ds.input, color: ds.text, fontSize: 13, outline: 'none', boxSizing: 'border-box', direction: isRTL ? 'rtl' : 'ltr' }}
          />
        </div>
        <Select value={deptF}     onChange={setDeptF}     options={deptOptions}  ds={ds} isRTL={isRTL} />
        <Select value={contractF} onChange={setContractF} options={contractOpts} ds={ds} isRTL={isRTL} />
        <span style={{ fontSize: 12, color: ds.muted, marginInlineStart: 'auto' }}>
          {filtered.length} {lang === 'ar' ? 'نتيجة' : 'results'}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: ds.card, borderRadius: 14, border: `1px solid ${ds.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: ds.thBg, borderBottom: `2px solid ${ds.border}` }}>
              {[
                lang === 'ar' ? 'الموظف' : 'Employee',
                lang === 'ar' ? 'القسم'  : 'Department',
                lang === 'ar' ? 'نوع العقد' : 'Contract',
                lang === 'ar' ? 'الراتب' : 'Salary',
                lang === 'ar' ? 'رصيد الإجازة' : 'Leave Bal.',
                lang === 'ar' ? 'الحالة' : 'Status',
                '',
              ].map((h, i) => <th key={i} style={{ ...th, textAlign: isRTL ? 'right' : 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map(emp => {
              const name   = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
              const dept   = DEPARTMENTS.find(d => d.id === emp.department);
              const deptName = dept ? (isRTL ? dept.name_ar : dept.name_en) : '—';
              const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
              const avatarColors = ['#1B3347','#2B4C6F','#4A7AAB','#6B8DB5','#8BA8C8'];
              const avatarBg = avatarColors[name?.charCodeAt(0) % avatarColors.length] || '#4A7AAB';

              return (
                <TR key={emp.id} onClick={() => setSelected(emp)}>
                  <td style={{ ...td }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{initials}</span>
                      </div>
                      <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: ds.text }}>{name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: ds.muted }}>{emp.employee_id || emp.id?.toString().slice(0,6)}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <Building2 size={13} color={ds.muted} />
                      <span style={{ color: ds.muted, fontSize: 13 }}>{deptName}</span>
                    </div>
                  </td>
                  <td style={{ ...td }}>
                    <Badge label={emp.employment_type === 'full_time' ? (lang === 'ar' ? 'دوام كامل' : 'Full Time') : emp.employment_type === 'probation' ? (lang === 'ar' ? 'تجربة' : 'Probation') : (lang === 'ar' ? 'جزئي' : 'Part Time')} color={emp.employment_type === 'probation' ? '#6B8DB5' : '#4A7AAB'} />
                  </td>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {emp.salary ? emp.salary.toLocaleString() + ' ج.م' : '—'}
                  </td>
                  <td style={{ ...td }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <div style={{ height: 4, width: 50, borderRadius: 2, background: ds.dark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: Math.min((emp.leave_balance || 21) / 21 * 100, 100) + '%', background: '#4A7AAB' }} />
                      </div>
                      <span style={{ fontSize: 12, color: ds.muted }}>{emp.leave_balance ?? 21}</span>
                    </div>
                  </td>
                  <td style={{ ...td }}>
                    <Badge label={statusLabel(emp.status)} color={statusColor(emp.status)} />
                  </td>
                  <td style={{ ...td }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <IconBtn icon={Eye}     onClick={() => setSelected(emp)} title={lang === 'ar' ? 'عرض' : 'View'} />
                      <IconBtn icon={Edit2}   onClick={() => {}} title={lang === 'ar' ? 'تعديل' : 'Edit'} />
                      <IconBtn icon={FileText} onClick={() => {}} title={lang === 'ar' ? 'Payslip' : 'Payslip'} color="#6B8DB5" />
                    </div>
                  </td>
                </TR>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, rgba(27,51,71,0.08), rgba(74,122,171,0.12))', border: '1.5px dashed rgba(74,122,171,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Users size={28} color="#4A7AAB" strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: ds.text, margin: '0 0 6px' }}>{lang === 'ar' ? 'لا توجد نتائج' : 'No results found'}</p>
            <p style={{ fontSize: 13, color: ds.muted, margin: 0 }}>{lang === 'ar' ? 'جرّب البحث بكلمات مختلفة' : 'Try different search terms'}</p>
          </div>
        )}
      </div>

      {/* ── Employee Detail Modal ── */}
      {selected && <EmployeeModal emp={selected} onClose={() => setSelected(null)} ds={ds} isRTL={isRTL} lang={lang} />}
    </div>
  );
}

function AddButton({ label, ds }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 20px', borderRadius: 10,
        background: hov ? '#2B4C6F' : '#1B3347',
        border: 'none', cursor: 'pointer',
        color: '#fff', fontSize: 13, fontWeight: 700,
        transform: hov ? 'translateY(-1px)' : 'none',
        boxShadow: hov ? '0 6px 16px rgba(27,51,71,0.35)' : '0 2px 6px rgba(27,51,71,0.2)',
        transition: 'all 0.2s ease',
      }}
    >
      <Plus size={16} />{label}
    </button>
  );
}

function EmployeeModal({ emp, onClose, ds, isRTL, lang }) {
  const name = (isRTL ? emp.full_name_ar : emp.full_name_en) || emp.full_name_ar;
  const initials = name?.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || '??';
  const rows = [
    [lang === 'ar' ? 'كود الموظف' : 'Employee ID', emp.employee_id || '—'],
    [lang === 'ar' ? 'الإيميل' : 'Email', emp.email || '—'],
    [lang === 'ar' ? 'الموبايل' : 'Phone', emp.phone || '—'],
    [lang === 'ar' ? 'الراتب' : 'Salary', emp.salary ? emp.salary.toLocaleString() + ' ج.م' : '—'],
    [lang === 'ar' ? 'نوع العمل' : 'Work Type', emp.work_type || '—'],
    [lang === 'ar' ? 'تاريخ الانضمام' : 'Join Date', emp.hire_date || '—'],
    [lang === 'ar' ? 'انتهاء العقد' : 'Contract End', emp.contract_end || '—'],
    [lang === 'ar' ? 'رصيد الإجازة' : 'Leave Balance', (emp.leave_balance ?? 21) + (lang === 'ar' ? ' يوم' : ' days')],
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: ds.card, borderRadius: 18, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', direction: isRTL ? 'rtl' : 'ltr' }} onClick={e => e.stopPropagation()}>
        {/* header */}
        <div style={{ background: 'linear-gradient(135deg, #1B3347, #4A7AAB)', padding: '24px', borderRadius: '18px 18px 0 0', display: 'flex', alignItems: 'center', gap: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{initials}</span>
          </div>
          <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{emp.job_title || (lang === 'ar' ? 'موظف' : 'Employee')}</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} color="#fff" />
          </button>
        </div>
        {/* body */}
        <div style={{ padding: 20 }}>
          {rows.map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < rows.length - 1 ? `1px solid ${ds.border}` : 'none', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 13, color: ds.muted }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: ds.text }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
