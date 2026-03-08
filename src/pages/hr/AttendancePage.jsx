import { useState } from 'react';
import { Clock, Plus, Download, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';

export default function AttendancePage() {
  const { isDark } = useTheme();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const [tab, setTab] = useState('monthly');
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');

  const c = {
    bg: isDark ? '#0F1E2D' : '#F0F4F8',
    cardBg: isDark ? '#1a2234' : '#ffffff',
    border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text: isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg: isDark ? '#0F1E2D' : '#ffffff',
    thBg: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
    rowHover: isDark ? 'rgba(74,122,171,0.08)' : '#EEF4FF',
    shadow: isDark ? '0 2px 12px rgba(0,0,0,0.4)' : '0 2px 12px rgba(27,51,71,0.08)',
    shadowHover: isDark ? '0 6px 24px rgba(0,0,0,0.5)' : '0 6px 24px rgba(27,51,71,0.15)',
    accent: '#4A7AAB',
  };

  const employees = MOCK_EMPLOYEES || [];
  const attendance = employees.map((e, i) => ({
    ...e,
    present: 13 + (i % 3), absent: i % 4 === 0 ? 1 : 0,
    late: 40 + (i * 10), overtime: 7 + (i % 5) + 0.3 * (i % 3),
    remote: i % 3, office: 5 - (i % 3),
    deduction: -(1823 - i * 200), tolerance: '4h / ' + (1 + i * 0.1).toFixed(1),
  }));

  const stats = [
    { label: isRTL ? 'أيام الحضور' : 'Attendance Days', value: 109, color: '#4A7AAB' },
    { label: isRTL ? 'أيام الغياب' : 'Absence Days', value: 3, color: '#EF4444' },
    { label: isRTL ? 'سجلات التأخر' : 'Late Records', value: 48, color: '#f59e0b' },
    { label: isRTL ? 'إجمالي الأوفرتايم' : 'Total Overtime', value: '74.4h', color: '#22c55e' },
  ];

  const tabs = [
    { k: 'analysis', label: isRTL ? 'التحليل' : 'Analysis' },
    { k: 'daily', label: isRTL ? 'اليومي' : 'Daily' },
    { k: 'monthly', label: isRTL ? 'الملخص الشهري' : 'Monthly Summary' },
  ];

  const filtered = deptFilter === 'all' ? attendance : attendance.filter(e => e.department === deptFilter);
  const avatarColors = ['#4A7AAB', '#6B8DB5', '#1B3347', '#2B4C6F', '#8BA8C8'];

  return (
    <div style={{ background: c.bg, minHeight: '100vh', padding: '24px', direction: isRTL ? 'rtl' : 'ltr' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #1B3347 0%, #4A7AAB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(74,122,171,0.3)' }}>
            <Clock size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: c.text, margin: 0 }}>{isRTL ? 'الحضور والانصراف' : 'Attendance'}</h1>
            <p style={{ fontSize: '13px', color: c.textMuted, margin: 0 }}>{isRTL ? 'متابعة حضور الموظفين وحساب الخصومات' : 'Track attendance & deductions'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {[
            { label: isRTL ? 'رفع Excel' : 'Upload Excel', id: 'excel', icon: Download, secondary: true },
            { label: isRTL ? 'تسجيل يدوي' : 'Manual Entry', id: 'manual', icon: Plus, secondary: false },
          ].map(btn => (
            <button key={btn.id} onMouseEnter={() => setHoveredBtn(btn.id)} onMouseLeave={() => setHoveredBtn(null)}
              style={{ background: btn.secondary ? (hoveredBtn === btn.id ? (isDark ? 'rgba(74,122,171,0.2)' : '#E8EFF7') : c.cardBg) : (hoveredBtn === btn.id ? '#2B4C6F' : '#1B3347'), color: btn.secondary ? c.text : '#fff', border: '1px solid ' + (btn.secondary ? c.border : 'transparent'), borderRadius: '10px', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transform: hoveredBtn === btn.id ? 'translateY(-1px)' : 'translateY(0)', boxShadow: hoveredBtn === btn.id ? c.shadowHover : c.shadow, transition: 'all 0.2s ease' }}>
              <btn.icon size={14} />{btn.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
        {stats.map((s, i) => (
          <div key={i} onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}
            style={{ background: c.cardBg, borderRadius: '14px', padding: '18px 20px', boxShadow: hoveredCard === i ? c.shadowHover : c.shadow, transform: hoveredCard === i ? 'translateY(-3px)' : 'translateY(0)', transition: 'all 0.25s ease', borderRight: isRTL ? '4px solid ' + s.color : 'none', borderLeft: !isRTL ? '4px solid ' + s.color : 'none', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: 'radial-gradient(circle at top right, ' + s.color + '18, transparent 70%)', opacity: hoveredCard === i ? 1 : 0.5, transition: 'opacity 0.25s' }} />
            <div style={{ fontSize: '28px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '13px', color: c.textMuted, marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: c.cardBg, borderRadius: '14px', padding: '6px', display: 'flex', gap: '4px', marginBottom: '16px', boxShadow: c.shadow, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ background: tab === t.k ? '#1B3347' : 'transparent', color: tab === t.k ? '#fff' : c.textMuted, border: 'none', borderRadius: '9px', padding: '8px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: tab === t.k ? 600 : 400, transition: 'all 0.2s ease' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: c.cardBg, borderRadius: '14px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', boxShadow: c.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: c.textMuted, fontSize: '13px' }}>
          <ChevronRight size={16} />
          <strong style={{ color: c.text, fontSize: '15px' }}>{isRTL ? 'مارس 2026' : 'March 2026'}</strong>
          <ChevronLeft size={16} />
        </div>
        <div style={{ position: 'relative' }}>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ background: c.inputBg, border: '1px solid ' + c.border, borderRadius: '8px', color: c.text, fontSize: '13px', padding: '8px 28px 8px 12px', outline: 'none', cursor: 'pointer', appearance: 'none' }}>
            <option value="all">{isRTL ? 'كل الأقسام' : 'All Departments'}</option>
            <option value="المبيعات">{isRTL ? 'المبيعات' : 'Sales'}</option>
            <option value="الموارد البشرية">HR</option>
          </select>
          <ChevronDown size={13} color={c.textMuted} style={{ position: 'absolute', right: isRTL ? 'auto' : '8px', left: isRTL ? '8px' : 'auto', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      <div style={{ background: c.cardBg, borderRadius: '14px', boxShadow: c.shadow, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: c.thBg }}>
              {[isRTL ? 'الموظف' : 'Employee', isRTL ? 'أيام الحضور' : 'Present', isRTL ? 'الغياب' : 'Absent', isRTL ? 'ريموت/ميداني' : 'Remote/Field', isRTL ? 'التأخر' : 'Late', isRTL ? 'أوفرتايم' : 'OT', isRTL ? 'الخصم' : 'Deduction'].map((h, i) => (
                <th key={i} style={{ padding: '12px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: '12px', fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid ' + c.border }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, idx) => {
              const isHov = hoveredRow === emp.id;
              const name = isRTL ? emp.full_name_ar : emp.full_name_en;
              return (
                <tr key={emp.id} onMouseEnter={() => setHoveredRow(emp.id)} onMouseLeave={() => setHoveredRow(null)}
                  style={{ background: isHov ? c.rowHover : 'transparent', transition: 'background 0.15s ease', borderBottom: idx < filtered.length - 1 ? '1px solid ' + c.border : 'none' }}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: avatarColors[idx % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700, flexShrink: 0, transform: isHov ? 'scale(1.08)' : 'scale(1)', transition: 'transform 0.2s' }}>
                        {(name || '').split(' ').map(w => w[0]).join('').substring(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px', color: c.text }}>{name}</div>
                        <div style={{ fontSize: '11px', color: c.textMuted }}>{emp.employee_id || ('EMP-00' + (idx + 1))}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', color: c.text, fontWeight: 600, fontSize: '13px' }}>{emp.present} {isRTL ? 'يوم' : 'd'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    {emp.absent > 0 ? <span style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>{emp.absent}</span> : <span style={{ color: c.textMuted }}>—</span>}
                  </td>
                  <td style={{ padding: '13px 16px', color: c.textMuted, fontSize: '13px' }}>{emp.remote} / {emp.office}</td>
                  <td style={{ padding: '13px 16px', color: emp.late > 60 ? '#f59e0b' : c.textMuted, fontSize: '13px', fontWeight: emp.late > 60 ? 600 : 400 }}>
                    {String(Math.floor(emp.late / 60)).padStart(2, '0')}:{String(emp.late % 60).padStart(2, '0')}
                  </td>
                  <td style={{ padding: '13px 16px', color: '#22c55e', fontSize: '13px', fontWeight: 600 }}>{emp.overtime.toFixed(1)}h</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '13px' }}>{(emp.deduction || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
