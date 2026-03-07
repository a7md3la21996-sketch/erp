import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, Play, Download, Eye, X, ChevronLeft, ChevronRight,
  CheckCircle, Clock, AlertTriangle, FileText, Users, TrendingUp, Calendar,
  BarChart2, PieChart, Award
} from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth, calcPayrollFromAttendance } from '../../data/attendanceStore';

const MONTH_NAMES = {
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

function fmt(n) { return Math.round(n).toLocaleString(); }

// ── Mock historical data for charts ──────────────────────────
const HIST_MONTHS = [1,2,3,4,5,6];
function getHistoricalPayroll(month, year) {
  return MOCK_EMPLOYEES.map(emp => calcPayrollFromAttendance(emp, year, month));
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ emp, size = 34 }) {
  const initials = emp.full_name_ar.split('').slice(0,2).map(w=>w[0]).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Stacked Bar Chart ─────────────────────────────────────────
function StackedBarChart({ data, lang, isRTL, c, isDark }) {
  const [hovered, setHovered] = useState(null);
  const maxVal = Math.max(...data.map(d => d.base + d.ot));
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, padding: '0 4px' }}>
        {data.map((d, i) => {
          const totalH = ((d.base + d.ot) / maxVal) * 140;
          const baseH  = (d.base / (d.base + d.ot)) * totalH;
          const otH    = totalH - baseH;
          const isHov  = hovered === i;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {isHov && (
                <div style={{ position: 'absolute', marginTop: -40, background: isDark ? '#1a2234' : '#fff', border: '1px solid ' + c.border, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: c.text, whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                  <div>{lang === 'ar' ? 'أساسي: ': 'Base: '}{fmt(d.base)}</div>
                  {d.ot > 0 && <div style={{ color: '#4A7AAB' }}>{lang === 'ar' ? 'OT: ': 'OT: '}{fmt(d.ot)}</div>}
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 140, position: 'relative' }}>
                <div style={{ width: '100%', height: otH, background: '#4A7AAB', borderRadius: otH > 0 ? '4px 4px 0 0' : 0, transition: 'all 0.3s', opacity: isHov ? 1 : 0.85 }} />
                <div style={{ width: '100%', height: baseH, background: isDark ? '#2B4C6F' : '#4A7AAB', borderRadius: otH > 0 ? 0 : '4px 4px 0 0', transition: 'all 0.3s', opacity: isHov ? 1 : 0.85 }} />
              </div>
              <div style={{ fontSize: 10, color: c.textMuted }}>{MONTH_NAMES[lang][d.month - 1].slice(0,3)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, justifyContent: 'center' }}>
        {[
          { color: isDark ? '#2B4C6F' : '#4A7AAB', label: lang === 'ar' ? 'راتب أساسي' : 'Base Salary' },
          { color: '#4A7AAB', label: lang === 'ar' ? 'أوفرتايم' : 'Overtime' },
        ].map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
            <span style={{ fontSize: 11, color: c.textMuted }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pie Chart (SVG) ───────────────────────────────────────────
function DeptPieChart({ deptData, lang, isRTL, c }) {
  const [hovered, setHovered] = useState(null);
  const COLORS = ['#1B3347','#4A7AAB','#6B8DB5','#4A7AAB','#EF4444','#4A7AAB'];
  const total = deptData.reduce((s, d) => s + d.net, 0);
  let cumAngle = 0;
  const slices = deptData.map((d, i) => {
    const pct = d.net / total;
    const startAngle = cumAngle;
    cumAngle += pct * 2 * Math.PI;
    const endAngle = cumAngle;
    const x1 = 50 + 40 * Math.cos(startAngle - Math.PI / 2);
    const y1 = 50 + 40 * Math.sin(startAngle - Math.PI / 2);
    const x2 = 50 + 40 * Math.cos(endAngle - Math.PI / 2);
    const y2 = 50 + 40 * Math.sin(endAngle - Math.PI / 2);
    const largeArc = pct > 0.5 ? 1 : 0;
    return { ...d, pct, path: `M50,50 L${x1},${y1} A40,40 0 ${largeArc},1 ${x2},${y2} Z`, color: COLORS[i % COLORS.length] };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={110} height={110} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.5}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
        <circle cx="50" cy="50" r="22" fill={c.cardBg} />
        <text x="50" y="46" textAnchor="middle" fontSize="8" fill={c.textMuted}>إجمالي</text>
        <text x="50" y="57" textAnchor="middle" fontSize="7" fill={c.text} fontWeight="700">{(total / 1000).toFixed(0)}K</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: hovered === null || hovered === i ? 1 : 0.5, transition: 'opacity 0.2s', cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: c.text }}>{lang === 'ar' ? s.nameAr : s.nameEn}</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: c.textMuted }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Payslip Modal ─────────────────────────────────────────────
function PayslipModal({ data, month, year, onClose, isDark, isRTL, lang, c }) {
  const { emp } = data;
  const monthName = lang === 'ar' ? MONTH_NAMES.ar[month-1] : MONTH_NAMES.en[month-1];

  const Row = ({ label, value, color, bold }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
      <span style={{ fontSize: 13, color: c.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || c.text }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ padding: '0', background: 'linear-gradient(135deg,#1B3347,#2B4C6F)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', marginBottom: 4 }}>{lang === 'ar' ? 'قسيمة راتب' : 'PAY SLIP'}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{lang === 'ar' ? emp.job_title_ar : emp.job_title_en} · {emp.employee_number}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{monthName} {year}</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ margin: '0 24px 24px', padding: '16px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{lang === 'ar' ? 'صافي الراتب' : 'NET SALARY'}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>{fmt(data.netSalary)}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{lang === 'ar' ? 'جنيه مصري' : 'EGP'}</div>
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
            {[
              { label: lang === 'ar' ? 'حضور' : 'Present', value: data.presentDays, color: '#4A7AAB' },
              { label: lang === 'ar' ? 'غياب' : 'Absent',  value: data.absentDays,  color: '#EF4444' },
              { label: lang === 'ar' ? 'تأخير' : 'Late',   value: data.lateDays,    color: '#6B8DB5' },
              { label: lang === 'ar' ? 'OT' : 'OT',        value: `${data.otHours}h`, color: '#4A7AAB' },
            ].map((s,i) => (
              <div key={i} style={{ padding: '10px 8px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4A7AAB', marginBottom: 8, textTransform: 'uppercase' }}>{lang === 'ar' ? '+ المستحقات' : '+ EARNINGS'}</div>
            <Row label={lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'} value={`${fmt(data.baseSalary)} ${lang==='ar'?'ج.م':'EGP'}`} />
            {data.otEarnings > 0 && <Row label={lang === 'ar' ? `أوفرتايم (${data.otHours}h)` : `OT (${data.otHours}h)`} value={`+ ${fmt(data.otEarnings)} ${lang==='ar'?'ج.م':'EGP'}`} color="#4A7AAB" />}
          </div>
          {data.totalDeductions > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 8, textTransform: 'uppercase' }}>{lang === 'ar' ? '- الخصومات' : '- DEDUCTIONS'}</div>
              {data.lateDeduction > 0 && <Row label={lang === 'ar' ? 'خصم التأخير' : 'Late Deduction'} value={`- ${fmt(data.lateDeduction)} ${lang==='ar'?'ج.م':'EGP'}`} color="#EF4444" />}
              {data.absenceDeduction > 0 && <Row label={lang === 'ar' ? 'خصم الغياب' : 'Absence Deduction'} value={`- ${fmt(data.absenceDeduction)} ${lang==='ar'?'ج.م':'EGP'}`} color="#EF4444" />}
            </div>
          )}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.08)', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.2)'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'صافي الراتب' : 'Net Salary'}</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: c.accent }}>{fmt(data.netSalary)} {lang==='ar'?'ج.م':'EGP'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 16 }}>
            {[
              { label: lang === 'ar' ? 'أجر ساعي' : 'Hourly Rate', value: `${data.hourlyRate} ${lang==='ar'?'ج.م':'EGP'}` },
              { label: lang === 'ar' ? 'أجر يومي' : 'Daily Rate',  value: `${data.dailyRate} ${lang==='ar'?'ج.م':'EGP'}` },
              { label: lang === 'ar' ? 'OT' : 'OT Rate',    value: emp.ot_multiplier },
            ].map((r,i) => (
              <div key={i} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                <div style={{ fontSize: 10, color: c.textMuted }}>{r.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{r.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid ' + c.border, display: 'flex', gap: 10, justifyContent: isRTL ? 'flex-start' : 'flex-end', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, fontSize: 13 }}>
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Download size={14} /> {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PayrollPage() {
  const { theme } = useTheme();
  const { i18n }  = useTranslation();
  const isDark = theme === 'dark';
  const isRTL  = i18n.language === 'ar';
  const lang   = i18n.language;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [runStatus, setRunStatus] = useState('idle');
  const [payrollData, setPayrollData] = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [deptFilter, setDeptFilter] = useState('all');
  const [activeView, setActiveView] = useState('table'); // table | analytics

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

  const prevMonth = () => { if (month === 1) { setYear(y=>y-1); setMonth(12); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y=>y+1); setMonth(1); } else setMonth(m=>m+1); };

  const runPayroll = () => {
    setRunStatus('running');
    setTimeout(() => {
      const data = MOCK_EMPLOYEES.map(emp => calcPayrollFromAttendance(emp, year, month));
      setPayrollData(data);
      setRunStatus('done');
    }, 1200);
  };

  const filtered = useMemo(() => {
    if (!payrollData) return [];
    return payrollData.filter(d => deptFilter === 'all' || d.emp.department === deptFilter);
  }, [payrollData, deptFilter]);

  const totals = useMemo(() => {
    if (!filtered.length) return null;
    return {
      base:       filtered.reduce((s,d) => s + d.baseSalary, 0),
      deductions: filtered.reduce((s,d) => s + d.totalDeductions, 0),
      ot:         filtered.reduce((s,d) => s + d.otEarnings, 0),
      net:        filtered.reduce((s,d) => s + d.netSalary, 0),
    };
  }, [filtered]);

  // Historical data for charts (last 6 months)
  const historicalData = useMemo(() => {
    return HIST_MONTHS.map(m => {
      const data = MOCK_EMPLOYEES.map(emp => calcPayrollFromAttendance(emp, year, m));
      return {
        month: m,
        base: data.reduce((s,d) => s + d.baseSalary, 0),
        ot:   data.reduce((s,d) => s + d.otEarnings, 0),
        net:  data.reduce((s,d) => s + d.netSalary, 0),
      };
    });
  }, [year]);

  // Dept breakdown for pie
  const deptBreakdown = useMemo(() => {
    if (!payrollData) return [];
    const map = {};
    payrollData.forEach(d => {
      const dept = DEPARTMENTS.find(dep => dep.id === d.emp.department);
      if (!dept) return;
      if (!map[dept.id]) map[dept.id] = { nameAr: dept.name_ar, nameEn: dept.name_en, net: 0 };
      map[dept.id].net += d.netSalary;
    });
    return Object.values(map).sort((a,b) => b.net - a.net);
  }, [payrollData]);

  // Top earners
  const topEarners = useMemo(() => {
    if (!payrollData) return [];
    return [...payrollData].sort((a,b) => b.netSalary - a.netSalary).slice(0, 5);
  }, [payrollData]);

  // Forecast (next 6 months simple projection)
  const forecast = useMemo(() => {
    if (!payrollData) return [];
    const baseNet = payrollData.reduce((s,d) => s + d.netSalary, 0);
    const growthRate = 0.017;
    return [1,2,3,4,5,6].map(i => ({
      month: ((month - 1 + i) % 12) + 1,
      value: Math.round(baseNet * Math.pow(1 + growthRate, i)),
      growth: (growthRate * 100).toFixed(1),
    }));
  }, [payrollData, month]);

  const monthName = lang === 'ar' ? MONTH_NAMES.ar[month-1] : MONTH_NAMES.en[month-1];

  const exportCSV = () => {
    if (!payrollData) return;
    const headers = ['Employee', 'Number', 'Base Salary', 'Late Deduction', 'Absence Deduction', 'OT Earnings', 'Net Salary'];
    const rows = payrollData.map(d => [
      lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en,
      d.emp.employee_number, d.baseSalary, d.lateDeduction, d.absenceDeduction, d.otEarnings, d.netSalary
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `payroll-${year}-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'مسير الرواتب' : 'Payroll'}</h1>
            <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>{lang === 'ar' ? 'حساب وإدارة رواتب الموظفين' : 'Calculate & manage employee salaries'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {runStatus === 'done' && (
            <>
              {/* View Toggle */}
              <div style={{ display: 'flex', borderRadius: 8, border: '1px solid ' + c.border, overflow: 'hidden' }}>
                {[
                  { key: 'table',     icon: <FileText size={14} />,  label: lang === 'ar' ? 'الجدول' : 'Table' },
                  { key: 'analytics', icon: <BarChart2 size={14} />, label: lang === 'ar' ? 'التحليل' : 'Analytics' },
                ].map(v => (
                  <button key={v.key} onClick={() => setActiveView(v.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                      background: activeView === v.key ? 'linear-gradient(135deg,#2B4C6F,#4A7AAB)' : 'transparent',
                      color: activeView === v.key ? '#fff' : c.textMuted }}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
              <button onClick={exportCSV}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: isDark ? 'rgba(74,122,171,0.1)' : '#F8FAFC', color: c.text, fontSize: 13, fontWeight: 500 }}>
                <Download size={15} /> {lang === 'ar' ? 'تصدير' : 'Export'}
              </button>
            </>
          )}
          <button onClick={runPayroll} disabled={runStatus === 'running'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: runStatus === 'running' ? 'not-allowed' : 'pointer', background: runStatus === 'done' ? '#4A7AAB' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600, opacity: runStatus === 'running' ? 0.7 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            {runStatus === 'running' ? <Clock size={16} /> : runStatus === 'done' ? <CheckCircle size={16} /> : <Play size={16} />}
            {runStatus === 'running' ? (lang === 'ar' ? 'جاري الحساب...' : 'Calculating...') : runStatus === 'done' ? (lang === 'ar' ? 'تم التشغيل ' : 'Complete ') : (lang === 'ar' ? 'تشغيل المسير' : 'Run Payroll')}
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px 20px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Calendar size={16} color={c.textMuted} />
          <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>{lang === 'ar' ? 'فترة المسير:': 'Payroll Period:'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <span style={{ fontSize: 16, fontWeight: 700, color: c.text, minWidth: 160, textAlign: 'center' }}>{monthName} {year}</span>
          <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          <Users size={14} color={c.textMuted} />
          <span style={{ fontSize: 13, color: c.textMuted }}>{MOCK_EMPLOYEES.length} {lang === 'ar' ? 'موظف' : 'employees'}</span>
        </div>
      </div>

      {/* Idle */}
      {runStatus === 'idle' && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: c.cardBg, borderRadius: 16, border: '2px dashed ' + c.border }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#2B4C6F20,#4A7AAB20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <DollarSign size={28} color={c.accent} />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'جاهز لتشغيل المسير' : 'Ready to Run Payroll'}</h3>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: c.textMuted, maxWidth: 400, marginInline: 'auto' }}>
            {lang === 'ar' ? `سيتم حساب رواتب ${MOCK_EMPLOYEES.length} موظف لشهر ${monthName} ${year}` : `Will calculate salaries for ${MOCK_EMPLOYEES.length} employees for ${monthName} ${year}`}
          </p>
          <button onClick={runPayroll} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 15, fontWeight: 700 }}>
            <Play size={18} /> {lang === 'ar' ? 'تشغيل المسير الآن' : 'Run Payroll Now'}
          </button>
        </div>
      )}

      {/* Running */}
      {runStatus === 'running' && (
        <div style={{ textAlign: 'center', padding: '60px 24px', background: c.cardBg, borderRadius: 16, border: '1px solid ' + c.border }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${c.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'جاري حساب الرواتب...' : 'Calculating payroll...'}</h3>
        </div>
      )}

      {/* Done */}
      {runStatus === 'done' && payrollData && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: lang === 'ar' ? 'إجمالي الرواتب' : 'Total Base',    value: `${fmt(totals.base)} ${lang==='ar'?'ج.م':'EGP'}`,        icon: <DollarSign size={20} />,    color: '#2B4C6F', bg: '#2B4C6F15', trend: '+3.5%' },
              { label: lang === 'ar' ? 'إجمالي الخصومات' : 'Deductions',   value: `${fmt(totals.deductions)} ${lang==='ar'?'ج.م':'EGP'}`,  icon: <AlertTriangle size={20} />, color: '#EF4444', bg: '#EF444415', trend: '-1.5%' },
              { label: lang === 'ar' ? 'إجمالي الأوفرتايم' : 'Total OT',   value: `${fmt(totals.ot)} ${lang==='ar'?'ج.م':'EGP'}`,          icon: <TrendingUp size={20} />,    color: '#4A7AAB', bg: '#4A7AAB15', trend: '+8.7%' },
              { label: lang === 'ar' ? 'إجمالي الصافي' : 'Total Net',      value: `${fmt(totals.net)} ${lang==='ar'?'ج.م':'EGP'}`,          icon: <CheckCircle size={20} />,   color: '#4A7AAB', bg: '#4A7AAB15', trend: '+5.2%' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '18px 20px', borderRadius: 12, background: s.bg, border: `1px solid ${s.color}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
                  <div style={{ color: s.color }}>{s.icon}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: s.trend.startsWith('+') ? '#4A7AAB' : '#EF4444', background: s.trend.startsWith('+') ? '#4A7AAB15' : '#EF444415', padding: '2px 6px', borderRadius: 10 }}>{s.trend}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* TABLE VIEW */}
          {activeView === 'table' && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none' }}>
                  <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
                  {DEPARTMENTS.map(d => <option key={d.id} value={d.id}>{lang==='ar'?d.name_ar:d.name_en}</option>)}
                </select>
              </div>
              <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: c.thBg }}>
                      {[
                        { ar: 'الموظف', en: 'Employee', w: 'auto' },
                        { ar: 'الراتب الأساسي', en: 'Base', w: '120px' },
                        { ar: 'خصم التأخير', en: 'Late Ded.', w: '110px' },
                        { ar: 'خصم الغياب', en: 'Absence', w: '110px' },
                        { ar: 'أوفرتايم', en: 'OT', w: '110px' },
                        { ar: 'إجمالي الخصم', en: 'Total Ded.', w: '110px' },
                        { ar: 'صافي الراتب', en: 'Net', w: '120px' },
                        { ar: '', en: '', w: '50px' },
                      ].map((col, i) => (
                        <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', width: col.w, whiteSpace: 'nowrap' }}>
                          {lang === 'ar' ? col.ar : col.en}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((data, idx) => {
                      const { emp } = data;
                      return (
                        <tr key={emp.id} style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => setSelectedPayslip(data)}>
                          <td style={{ padding: '13px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                              <Avatar emp={emp} size={36} />
                              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                                <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '13px 14px' }}><span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{fmt(data.baseSalary)}</span></td>
                          <td style={{ padding: '13px 14px' }}>{data.lateDeduction > 0 ? <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>- {fmt(data.lateDeduction)}</span> : <span style={{ color: '#4A7AAB' }}></span>}</td>
                          <td style={{ padding: '13px 14px' }}>{data.absenceDeduction > 0 ? <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>- {fmt(data.absenceDeduction)}</span> : <span style={{ color: '#4A7AAB' }}></span>}</td>
                          <td style={{ padding: '13px 14px' }}>{data.otEarnings > 0 ? <span style={{ fontSize: 13, fontWeight: 600, color: '#4A7AAB' }}>+ {fmt(data.otEarnings)}</span> : <span style={{ color: c.textMuted }}>—</span>}</td>
                          <td style={{ padding: '13px 14px' }}>
                            {data.totalDeductions > 0
                              ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#EF444420', color: '#EF4444' }}>- {fmt(data.totalDeductions)}</span>
                              : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#4A7AAB20', color: '#4A7AAB' }}></span>}
                          </td>
                          <td style={{ padding: '13px 14px' }}><span style={{ fontSize: 15, fontWeight: 800, color: c.accent }}>{fmt(data.netSalary)}</span></td>
                          <td style={{ padding: '13px 14px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={() => setSelectedPayslip(data)}
                              style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; }}>
                              <FileText size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {totals && (
                    <tfoot>
                      <tr style={{ background: isDark ? 'rgba(74,122,171,0.1)' : 'rgba(74,122,171,0.08)', borderTop: '2px solid ' + c.accent + '40' }}>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: c.accent }}>{lang === 'ar' ? `الإجمالي (${filtered.length} موظف)` : `Total (${filtered.length} employees)`}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: c.text }}>{fmt(totals.base)}</td>
                        <td /><td /><td />
                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>- {fmt(totals.deductions)}</td>
                        <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: c.accent }}>{fmt(totals.net)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          )}

          {/* ANALYTICS VIEW */}
          {activeView === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Row 1: Stacked Bar + Pie */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Stacked Bar */}
                <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                     {lang === 'ar' ? 'اتجاهات الرواتب الشهرية' : 'Monthly Payroll Trends'}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'الراتب الأساسي والأوفرتايم' : 'Base salary + overtime'}
                  </div>
                  <StackedBarChart data={historicalData} lang={lang} isRTL={isRTL} c={c} isDark={isDark} />
                </div>

                {/* Pie */}
                <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                     {lang === 'ar' ? 'توزيع الرواتب حسب القسم' : 'Salary Distribution by Dept'}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'نسبة كل قسم من إجمالي الرواتب' : 'Each department share of total payroll'}
                  </div>
                  <DeptPieChart deptData={deptBreakdown} lang={lang} isRTL={isRTL} c={c} />
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {deptBreakdown.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ color: c.textMuted }}>{lang === 'ar' ? d.nameAr : d.nameEn}</span>
                        <span style={{ fontWeight: 600, color: c.text }}>{fmt(d.net)} {lang==='ar'?'ج.م':'EGP'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Top Earners + Forecast */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* Top Earners */}
                <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                     {lang === 'ar' ? `أعلى الموظفين أجراً` : 'Top Earners'}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'الموظفون الأعلى صافي راتب هذا الشهر' : 'Highest net salary this month'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {topEarners.map((d, i) => {
                      const maxNet = topEarners[0].netSalary;
                      const pct = (d.netSalary / maxNet) * 100;
                      const MEDALS = ['','','','4️⃣','5️⃣'];
                      const dept = DEPARTMENTS.find(dep => dep.id === d.emp.department);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                          <span style={{ fontSize: 16, flexShrink: 0 }}>{MEDALS[i]}</span>
                          <Avatar emp={d.emp} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                              <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                                  {lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en}
                                </div>
                                <div style={{ fontSize: 10, color: c.textMuted }}>{dept ? (lang==='ar'?dept.name_ar:dept.name_en) : ''}</div>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>{fmt(d.netSalary)}</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 2, background: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb' }}>
                              <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: 'linear-gradient(90deg,#2B4C6F,#4A7AAB)', transition: 'width 0.5s' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Forecast */}
                <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                     {lang === 'ar' ? 'نمذجة تنبؤية' : 'Payroll Forecast'}
                  </div>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'توقعات تكاليف الرواتب للأشهر الستة القادمة' : 'Expected payroll costs for next 6 months'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {forecast.map((f, i) => (
                      <div key={i} style={{ padding: '12px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>
                          {MONTH_NAMES[lang][f.month - 1].slice(0, 3)}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: c.text }}>
                          {(f.value / 1000).toFixed(0)}K
                        </div>
                        <div style={{ fontSize: 10, color: '#4A7AAB', marginTop: 2 }}>+{f.growth}%</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.08)', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.2)') }}>
                    <div style={{ fontSize: 12, color: isDark ? '#8BA8C8' : '#4A7AAB', textAlign: isRTL ? 'right' : 'left' }}>
                       {lang === 'ar' ? `بناءً على معدل نمو شهري 1.7% — يشمل الزيادات المتوقعة والتوظيف الجديد` : 'Based on 1.7% monthly growth rate — includes expected raises & new hires'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                   {lang === 'ar' ? 'تفصيل الاستقطاعات' : 'Deductions Breakdown'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[
                    { label: lang === 'ar' ? 'خصم التأخير' : 'Late Deductions',    value: payrollData.reduce((s,d)=>s+d.lateDeduction,0),     color: '#6B8DB5', icon: '' },
                    { label: lang === 'ar' ? 'خصم الغياب' : 'Absence Deductions',  value: payrollData.reduce((s,d)=>s+d.absenceDeduction,0),   color: '#EF4444', icon: '' },
                    { label: lang === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions', value: payrollData.reduce((s,d)=>s+d.totalDeductions,0),  color: '#4A7AAB', icon: '' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: '16px', borderRadius: 10, background: item.color + '10', border: '1px solid ' + item.color + '30', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{fmt(item.value)}</div>
                      <div style={{ fontSize: 11, color: c.textMuted, marginTop: 4 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : 'rgba(74,122,171,0.08)', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : 'rgba(74,122,171,0.2)'), display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 18 }}></span>
            <p style={{ margin: 0, fontSize: 13, color: isDark ? '#8BA8C8' : '#4A7AAB' }}>
              {lang === 'ar' ? `بعد اعتماد المسير، بيتصدّر تلقائياً للمالية — كل موظف بيتبعتله إشعار بقسيمة راتبه.` : 'After payroll approval, it exports automatically to Finance. Each employee gets notified with their payslip.'}
            </p>
          </div>
        </>
      )}

      {selectedPayslip && (
        <PayslipModal data={selectedPayslip} month={month} year={year} onClose={() => setSelectedPayslip(null)} isDark={isDark} isRTL={isRTL} lang={lang} c={c} />
      )}
    </div>
  );
}
