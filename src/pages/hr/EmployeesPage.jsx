import { useState } from 'react';
import { Users, Plus, Search, Eye, Edit2, AlertTriangle, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

export default function EmployeesPage() {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [contractFilter, setContractFilter] = useState('all');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  const c = {
    bg: isDark ? '#0F1E2D' : '#F0F4F8',
    cardBg: isDark ? '#1a2234' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text: isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    thBg: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover: isDark ? 'rgba(74,122,171,0.08)' : '#EEF4FF',
    accent: '#4A7AAB',
    shadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(27,51,71,0.08)',
    shadowHover: isDark ? '0 6px 24px rgba(0,0,0,0.5)' : '0 6px 24px rgba(27,51,71,0.15)',
  };

  const employees = MOCK_EMPLOYEES || [];
  const filtered = employees.filter(e => {
    const name = isRTL ? (e.full_name_ar || '') : (e.full_name_en || '');
    return name.toLowerCase().includes(search.toLowerCase()) &&
      (deptFilter === 'all' || e.department === deptFilter) &&
      (contractFilter === 'all' || e.contract_type === contractFilter);
  });

  const stats = [
    { label: isRTL ? 'إجمالي الموظفين' : 'Total Employees', value: employees.length, color: '#4A7AAB' },
    { label: isRTL ? 'نشط' : 'Active', value: employees.filter(e => e.status === 'active').length, color: '#22c55e' },
    { label: isRTL ? 'فترة تجربة' : 'Probation', value: employees.filter(e => e.contract_type === 'probation').length, color: '#f59e0b' },
    { label: isRTL ? 'تنبيهات' : 'Alerts', value: employees.filter(e => (e.leave_balance || 0) < 5).length, color: '#EF4444' },
  ];
  const alerts = employees.filter(e => (e.leave_balance || 0) < 5);
  const getInitials = (emp) => {
    const name = isRTL ? (emp.full_name_ar || '') : (emp.full_name_en || '');
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };
  const avatarColors = ['#4A7AAB', '#6B8DB5', '#1B3347', '#2B4C6F', '#8BA8C8'];

  return (
    <div style={{ background: c.bg, minHeight: '100vh', padding: '24px', direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #1B3347 0%, #4A7AAB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(74,122,171,0.3)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: c.text, margin: 0 }}>{isRTL ? 'الموظفون' : 'Employees'}</h1>
            <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>{filtered.length} {isRTL ? 'موظف' : 'employees'}</p>
          </div>
        </div>
        <button onMouseEnter={() => setHoveredBtn('add')} onMouseLeave={() => setHoveredBtn(null)}
          style={{ background: hoveredBtn === 'add' ? '#2B4C6F' : '#1B3347', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transform: hoveredBtn === 'add' ? 'translateY(-2px)' : 'translateY(0)', boxShadow: hoveredBtn === 'add' ? '0 6px 20px rgba(27,51,71,0.35)' : '0 2px 8px rgba(27,51,71,0.2)', transition: 'all 0.2s ease' }}>
          <Plus size={16} />{isRTL ? 'موظف جديد' : 'New Employee'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {stats.map((s, i) => (
          <div key={i} onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}
            style={{ background: c.cardBg, borderRadius: '14px', padding: '18px 20px', boxShadow: hoveredCard === i ? c.shadowHover : c.shadow, transform: hoveredCard === i ? 'translateY(-3px)' : 'translateY(0)', transition: 'all 0.25s ease', borderRight: isRTL ? '4px solid ' + s.color : 'none', borderLeft: !isRTL ? '4px solid ' + s.color : 'none', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: 'radial-gradient(circle at top right, ' + s.color + '22, transparent 70%)', opacity: hoveredCard === i ? 1 : 0.5, transition: 'opacity 0.25s' }} />
            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: c.textMuted, marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div style={{ background: isDark ? 'rgba(239,68,68,0.1)' : '#FFF5F5', border: '1px solid ' + (isDark ? 'rgba(239,68,68,0.25)' : '#FECACA'), borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={16} color="#EF4444" />
          </div>
          <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '14px' }}>{alerts.length} {isRTL ? 'موظف بحاجة لانتباهك' : 'employees need attention'}</span>
        </div>
      )}

      <div style={{ background: c.cardBg, borderRadius: '14px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', boxShadow: c.shadow, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} color={c.textMuted} style={{ position: 'absolute', right: isRTL ? '12px' : 'auto', left: isRTL ? 'auto' : '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={isRTL ? 'ابحث عن موظف...' : 'Search employee...'}
            style={{ width: '100%', padding: isRTL ? '9px 36px 9px 12px' : '9px 12px 9px 36px', background: c.inputBg, border: '1px solid ' + c.border, borderRadius: '8px', color: c.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#4A7AAB'} onBlur={e => e.target.style.borderColor = c.border}
          />
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ background: c.inputBg, border: '1px solid ' + c.border, borderRadius: '8px', color: c.text, fontSize: '13px', padding: '9px 12px', outline: 'none', cursor: 'pointer' }}>
          <option value="all">{isRTL ? 'كل الأقسام' : 'All Depts'}</option>
          <option value="المبيعات">{isRTL ? 'المبيعات' : 'Sales'}</option>
          <option value="الموارد البشرية">{isRTL ? 'الموارد البشرية' : 'HR'}</option>
          <option value="التسويق">{isRTL ? 'التسويق' : 'Marketing'}</option>
        </select>
        <select value={contractFilter} onChange={e => setContractFilter(e.target.value)} style={{ background: c.inputBg, border: '1px solid ' + c.border, borderRadius: '8px', color: c.text, fontSize: '13px', padding: '9px 12px', outline: 'none', cursor: 'pointer' }}>
          <option value="all">{isRTL ? 'كل العقود' : 'All Contracts'}</option>
          <option value="full_time">{isRTL ? 'دوام كامل' : 'Full Time'}</option>
          <option value="part_time">{isRTL ? 'دوام جزئي' : 'Part Time'}</option>
          <option value="probation">{isRTL ? 'فترة تجربة' : 'Probation'}</option>
        </select>
      </div>

      <div style={{ background: c.cardBg, borderRadius: '14px', boxShadow: c.shadow, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[isRTL ? 'الموظف' : 'Employee', isRTL ? 'القسم' : 'Dept', isRTL ? 'العقد' : 'Contract', isRTL ? 'الراتب' : 'Salary', isRTL ? 'الإجازة' : 'Leave', isRTL ? 'الحالة' : 'Status', ''].map((h, i) => (
                <th key={i} style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: '12px', fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid ' + c.border }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => {
              const name = isRTL ? emp.full_name_ar : emp.full_name_en;
              const isHovered = hoveredRow === emp.id;
              return (
                <tr key={emp.id} onMouseEnter={() => setHoveredRow(emp.id)} onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: isHovered ? c.rowHover : 'transparent', transition: 'background 0.15s ease', borderBottom: idx < filtered.length - 1 ? '1px solid ' + c.border : 'none' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarColors[idx % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13px', fontWeight: 700, flexShrink: 0, transform: isHovered ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s ease' }}>
                        {getInitials(emp)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: c.text, fontSize: '14px' }}>{name}</div>
                        <div style={{ fontSize: '12px', color: c.textMuted }}>{emp.employee_id || ('EMP-00' + (idx + 1))} · {emp.position || emp.role}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: c.textMuted, fontSize: '13px' }}>{emp.department}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: isDark ? 'rgba(74,122,171,0.15)' : '#EEF4FF', color: '#4A7AAB', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 }}>
                      {emp.contract_type === 'full_time' ? (isRTL ? 'دوام كامل' : 'Full Time') : emp.contract_type === 'probation' ? (isRTL ? 'تجربة' : 'Probation') : (isRTL ? 'جزئي' : 'Part Time')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: c.text, fontSize: '13px', fontWeight: 500 }}>{(emp.salary || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '5px', background: isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: Math.min(100, ((emp.leave_balance || 0) / 21) * 100) + '%', background: (emp.leave_balance || 0) < 5 ? '#EF4444' : '#4A7AAB', borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '12px', color: c.textMuted }}>{emp.leave_balance || 0}d</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: emp.status === 'active' ? (isDark ? 'rgba(74,122,171,0.15)' : '#EEF4FF') : 'rgba(239,68,68,0.1)', color: emp.status === 'active' ? '#4A7AAB' : '#EF4444', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>
                      {emp.status === 'active' ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px', opacity: isHovered ? 1 : 0.3, transition: 'opacity 0.2s ease' }}>
                      {[Eye, Edit2].map((Icon, i) => (
                        <button key={i} style={{ width: '30px', height: '30px', borderRadius: '7px', background: isDark ? 'rgba(74,122,171,0.15)' : '#F0F4F8', border: '1px solid ' + c.border, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#4A7AAB'; e.currentTarget.style.borderColor = '#4A7AAB'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isDark ? 'rgba(74,122,171,0.15)' : '#F0F4F8'; e.currentTarget.style.borderColor = c.border; }}>
                          <Icon size={13} color={c.textMuted} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: c.textMuted }}>
            <Users size={40} color={c.textMuted} style={{ opacity: 0.3, marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '15px' }}>{isRTL ? 'لا يوجد موظفون' : 'No employees found'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
