import { useState, useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import {
    DollarSign, Play, Download, Eye, X, ChevronLeft, ChevronRight,
    CheckCircle, Clock, AlertTriangle, FileText, Users, TrendingUp, Calendar
} from 'lucide-react';
import { MOCK_EMPLOYEES } from '../../data/hr_mock_data';
import { getAttendanceForMonth, calcPayrollFromAttendance } from '../../data/attendanceStore';
// ✅ Payroll الآن بيستخدم نفس بيانات الحضور اللي في AttendancePage

const MONTH_NAMES = {
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

function fmt(n) { return Math.round(n).toLocaleString(); }

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ emp, size = 34 }) {
    const initials = emp.full_name_ar.split(' ').slice(0, 2).map(w => w[0]).join('');
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: emp.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}>
            {initials}
        </div>
    );
}

// ── Payslip Modal ─────────────────────────────────────────────
function PayslipModal({ data, month, year, onClose, isDark, isRTL, lang, c }) {
    const { emp } = data;
    const monthName = lang === 'ar' ? MONTH_NAMES.ar[month - 1] : MONTH_NAMES.en[month - 1];

    const Row = ({ label, value, color, bold }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 13, color: c.textMuted }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: color || c.text }}>{value}</span>
        </div>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', direction: isRTL ? 'rtl' : 'ltr' }}>

                {/* Header */}
                <div style={{ padding: '0', background: 'linear-gradient(135deg,#1B3347,#2B4C6F)', borderRadius: '16px 16px 0 0' }}>
                    <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', marginBottom: 4 }}>
                                {lang === 'ar' ? 'قسيمة راتب' : 'PAY SLIP'}
                            </div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                                {lang === 'ar' ? emp.full_name_ar : emp.full_name_en}
                            </div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                                {lang === 'ar' ? emp.job_title_ar : emp.job_title_en} · {emp.employee_number}
                            </div>
                            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                {monthName} {year}
                            </div>
                        </div>
                        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <X size={16} />
                        </button>
                    </div>

                    {/* Net Salary Hero */}
                    <div style={{ margin: '0 24px 24px', padding: '16px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                            {lang === 'ar' ? 'صافي الراتب' : 'NET SALARY'}
                        </div>
                        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
                            {fmt(data.netSalary)}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{lang === 'ar' ? 'جنيه مصري' : 'EGP'}</div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 24px' }}>

                    {/* Attendance Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                        {[
                            { label: lang === 'ar' ? 'حضور' : 'Present', value: data.presentDays, color: '#10B981' },
                            { label: lang === 'ar' ? 'غياب' : 'Absent', value: data.absentDays, color: '#EF4444' },
                            { label: lang === 'ar' ? 'تأخير' : 'Late', value: data.lateDays, color: '#F59E0B' },
                            { label: lang === 'ar' ? 'أوفرتايم' : 'OT', value: `${data.otHours}h`, color: '#6366F1' },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '10px 8px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC', border: '1px solid ' + c.border, textAlign: 'center' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Earnings */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#10B981', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {lang === 'ar' ? '+ المستحقات' : '+ EARNINGS'}
                        </div>
                        <Row label={lang === 'ar' ? 'الراتب الأساسي' : 'Base Salary'} value={`${fmt(data.baseSalary)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} />
                        {data.otEarnings > 0 && (
                            <Row label={lang === 'ar' ? `أوفرتايم (${data.otHours}h × ${emp.ot_multiplier})` : `OT (${data.otHours}h × ${emp.ot_multiplier})`} value={`+ ${fmt(data.otEarnings)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} color="#10B981" />
                        )}
                    </div>

                    {/* Deductions */}
                    {data.totalDeductions > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {lang === 'ar' ? '- الخصومات' : '- DEDUCTIONS'}
                            </div>
                            {data.lateDeduction > 0 && (
                                <Row label={lang === 'ar' ? 'خصم التأخير' : 'Late Deduction'} value={`- ${fmt(data.lateDeduction)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} color="#EF4444" />
                            )}
                            {data.absenceDeduction > 0 && (
                                <Row label={lang === 'ar' ? 'خصم الغياب' : 'Absence Deduction'} value={`- ${fmt(data.absenceDeduction)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`} color="#EF4444" />
                            )}
                        </div>
                    )}

                    {/* Net */}
                    <div style={{ padding: '14px 16px', borderRadius: 10, background: isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : '#BFDBFE'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'صافي الراتب' : 'Net Salary'}</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: c.accent }}>{fmt(data.netSalary)} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>

                    {/* Attendance Summary */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: c.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {lang === 'ar' ? 'ملخص الحضور' : 'ATTENDANCE SUMMARY'}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                            {[
                                { label: lang === 'ar' ? 'أيام الحضور' : 'Present', value: data.presentDays, color: '#10B981' },
                                { label: lang === 'ar' ? 'أيام الغياب' : 'Absent', value: data.absentDays, color: '#EF4444' },
                                { label: lang === 'ar' ? 'أيام التأخير' : 'Late', value: data.lateDays, color: '#F59E0B' },
                                { label: lang === 'ar' ? 'ساعات OT' : 'OT Hours', value: `${data.otHours}h`, color: '#6366F1' },
                            ].map((s, i) => (
                                <div key={i} style={{ padding: '10px 8px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,0.03)' : '#F9FAFB', border: '1px solid ' + c.border, textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                                    <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                        {data.totalLateMinutes > 0 && (
                            <div style={{ marginTop: 8, fontSize: 11, color: c.textMuted, textAlign: isRTL ? 'right' : 'left' }}>
                                {lang === 'ar'
                                    ? `إجمالي التأخير: ${Math.floor(data.totalLateMinutes / 60)}س ${data.totalLateMinutes % 60}د — tolerance مستخدم: ${data.usedTolerance}h / ${data.toleranceCap}h`
                                    : `Total late: ${Math.floor(data.totalLateMinutes / 60)}h ${data.totalLateMinutes % 60}m — Tolerance used: ${data.usedTolerance}h / ${data.toleranceCap}h`}
                            </div>
                        )}
                    </div>
                    {[
                        { label: lang === 'ar' ? 'أجر ساعي' : 'Hourly Rate', value: `${data.hourlyRate} ${lang === 'ar' ? 'ج.م' : 'EGP'}` },
                        { label: lang === 'ar' ? 'أجر يومي' : 'Daily Rate', value: `${data.dailyRate} ${lang === 'ar' ? 'ج.م' : 'EGP'}` },
                        { label: lang === 'ar' ? 'OT' : 'OT Rate', value: emp.ot_multiplier },
                    ].map((r, i) => (
                        <div key={i} style={{ textAlign: isRTL ? 'right' : 'left' }}>
                            <div style={{ fontSize: 10, color: c.textMuted }}>{r.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{r.value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
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
    const { i18n } = useTranslation();
    const isDark = theme === 'dark';
    const isRTL = i18n.language === 'ar';
    const lang = i18n.language;

    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [runStatus, setRunStatus] = useState('idle'); // idle | running | done
    const [payrollData, setPayrollData] = useState(null);
    const [selectedPayslip, setSelectedPayslip] = useState(null);
    const [deptFilter, setDeptFilter] = useState('all');

    const c = {
        bg: isDark ? '#152232' : '#f9fafb',
        cardBg: isDark ? '#1a2234' : '#ffffff',
        border: isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
        text: isDark ? '#E2EAF4' : '#111827',
        textMuted: isDark ? '#8BA8C8' : '#6b7280',
        inputBg: isDark ? '#0F1E2D' : '#ffffff',
        thBg: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC',
        rowHover: isDark ? 'rgba(74,122,171,0.06)' : '#F8FAFC',
        accent: '#4A7AAB',
        primary: '#2B4C6F',
    };

    const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

    const runPayroll = () => {
        setRunStatus('running');
        setTimeout(() => {
            // ✅ بيستخدم نفس بيانات الحضور اللي في AttendancePage — مش random
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
            base: filtered.reduce((s, d) => s + d.baseSalary, 0),
            deductions: filtered.reduce((s, d) => s + d.totalDeductions, 0),
            ot: filtered.reduce((s, d) => s + d.otEarnings, 0),
            net: filtered.reduce((s, d) => s + d.netSalary, 0),
        };
    }, [filtered]);

    const monthName = lang === 'ar' ? MONTH_NAMES.ar[month - 1] : MONTH_NAMES.en[month - 1];

    // Export to CSV
    const exportCSV = () => {
        if (!payrollData) return;
        const headers = ['Employee', 'Number', 'Base Salary', 'Late Deduction', 'Absence Deduction', 'OT Earnings', 'Net Salary'];
        const rows = payrollData.map(d => [
            lang === 'ar' ? d.emp.full_name_ar : d.emp.full_name_en,
            d.emp.employee_number,
            d.baseSalary, d.lateDeduction, d.absenceDeduction, d.otEarnings, d.netSalary
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
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
                        <button onClick={exportCSV}
                            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 8, border: '1px solid ' + c.border, cursor: 'pointer', background: isDark ? 'rgba(74,122,171,0.1)' : '#F8FAFC', color: c.text, fontSize: 13, fontWeight: 500 }}>
                            <Download size={15} /> {lang === 'ar' ? 'تصدير Excel' : 'Export Excel'}
                        </button>
                    )}
                    <button
                        onClick={runPayroll}
                        disabled={runStatus === 'running'}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: runStatus === 'running' ? 'not-allowed' : 'pointer', background: runStatus === 'done' ? '#10B981' : 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600, opacity: runStatus === 'running' ? 0.7 : 1, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        {runStatus === 'running' ? <Clock size={16} /> : runStatus === 'done' ? <CheckCircle size={16} /> : <Play size={16} />}
                        {runStatus === 'running' ? (lang === 'ar' ? 'جاري الحساب...' : 'Calculating...') : runStatus === 'done' ? (lang === 'ar' ? 'تم التشغيل ✓' : 'Run Complete ✓') : (lang === 'ar' ? 'تشغيل المسير' : 'Run Payroll')}
                    </button>
                </div>
            </div>

            {/* Month Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px 20px', borderRadius: 12, background: c.cardBg, border: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <Calendar size={16} color={c.textMuted} />
                    <span style={{ fontSize: 13, color: c.textMuted, fontWeight: 500 }}>{lang === 'ar' ? 'فترة المسير:' : 'Payroll Period:'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isRTL ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                    </button>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.text, minWidth: 160, textAlign: 'center' }}>
                        {monthName} {year}
                    </span>
                    <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid ' + c.border, background: 'transparent', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isRTL ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                    </button>
                </div>

                <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <Users size={14} color={c.textMuted} />
                    <span style={{ fontSize: 13, color: c.textMuted }}>{MOCK_EMPLOYEES.length} {lang === 'ar' ? 'موظف' : 'employees'}</span>
                </div>
            </div>

            {/* Idle State */}
            {runStatus === 'idle' && (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: c.cardBg, borderRadius: 16, border: '2px dashed ' + c.border }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#2B4C6F20,#4A7AAB20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <DollarSign size={28} color={c.accent} />
                    </div>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: c.text }}>
                        {lang === 'ar' ? 'جاهز لتشغيل المسير' : 'Ready to Run Payroll'}
                    </h3>
                    <p style={{ margin: '0 0 20px', fontSize: 14, color: c.textMuted, maxWidth: 400, marginInline: 'auto' }}>
                        {lang === 'ar'
                            ? `سيتم حساب رواتب ${MOCK_EMPLOYEES.length} موظف لشهر ${monthName} ${year} بناءً على بيانات الحضور والإجازات والسياسات`
                            : `Will calculate salaries for ${MOCK_EMPLOYEES.length} employees for ${monthName} ${year} based on attendance, leaves & policies`}
                    </p>
                    <button onClick={runPayroll}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 15, fontWeight: 700 }}>
                        <Play size={18} /> {lang === 'ar' ? 'تشغيل المسير الآن' : 'Run Payroll Now'}
                    </button>
                </div>
            )}

            {/* Running State */}
            {runStatus === 'running' && (
                <div style={{ textAlign: 'center', padding: '60px 24px', background: c.cardBg, borderRadius: 16, border: '1px solid ' + c.border }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${c.accent}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: c.text }}>
                        {lang === 'ar' ? 'جاري حساب الرواتب...' : 'Calculating payroll...'}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: c.textMuted }}>
                        {lang === 'ar' ? 'يتم معالجة بيانات الحضور وحساب الخصومات والأوفرتايم' : 'Processing attendance data, calculating deductions & OT'}
                    </p>
                </div>
            )}

            {/* Done State */}
            {runStatus === 'done' && payrollData && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                        {[
                            { label: lang === 'ar' ? 'إجمالي الرواتب الأساسية' : 'Total Base', value: `${fmt(totals.base)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: <DollarSign size={20} />, color: '#2B4C6F', bg: '#2B4C6F15' },
                            { label: lang === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions', value: `${fmt(totals.deductions)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: <AlertTriangle size={20} />, color: '#EF4444', bg: '#EF444415' },
                            { label: lang === 'ar' ? 'إجمالي الأوفرتايم' : 'Total OT', value: `${fmt(totals.ot)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: <TrendingUp size={20} />, color: '#10B981', bg: '#10B98115' },
                            { label: lang === 'ar' ? 'إجمالي الصافي' : 'Total Net', value: `${fmt(totals.net)} ${lang === 'ar' ? 'ج.م' : 'EGP'}`, icon: <CheckCircle size={20} />, color: '#4A7AAB', bg: '#4A7AAB15' },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '18px 20px', borderRadius: 12, background: s.bg, border: `1px solid ${s.color}30` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row', marginBottom: 8 }}>
                                    <div style={{ color: s.color }}>{s.icon}</div>
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                                <div style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Filter */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                            <option value="all">{lang === 'ar' ? 'كل الأقسام' : 'All Departments'}</option>
                            {[{ id: 'sales', ar: 'المبيعات', en: 'Sales' }, { id: 'marketing', ar: 'التسويق', en: 'Marketing' }, { id: 'hr', ar: 'الموارد البشرية', en: 'HR' }, { id: 'finance', ar: 'المالية', en: 'Finance' }].map(d =>
                                <option key={d.id} value={d.id}>{lang === 'ar' ? d.ar : d.en}</option>
                            )}
                        </select>
                    </div>

                    {/* Table */}
                    <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                            <thead>
                                <tr style={{ background: c.thBg }}>
                                    {[
                                        { ar: 'الموظف', en: 'Employee', w: 'auto' },
                                        { ar: 'الراتب الأساسي', en: 'Base Salary', w: '130px' },
                                        { ar: 'خصم التأخير', en: 'Late Ded.', w: '110px' },
                                        { ar: 'خصم الغياب', en: 'Absence Ded.', w: '110px' },
                                        { ar: 'أوفرتايم', en: 'OT Earnings', w: '110px' },
                                        { ar: 'إجمالي الخصم', en: 'Total Ded.', w: '110px' },
                                        { ar: 'صافي الراتب', en: 'Net Salary', w: '120px' },
                                        { ar: '', en: '', w: '50px' },
                                    ].map((col, i) => (
                                        <th key={i} style={{ padding: '11px 14px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', width: col.w, whiteSpace: 'nowrap' }}>
                                            {lang === 'ar' ? col.ar : col.en}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((data, idx) => {
                                    const { emp } = data;
                                    const hasDeductions = data.totalDeductions > 0;
                                    return (
                                        <tr key={emp.id}
                                            style={{ borderTop: idx > 0 ? '1px solid ' + c.border : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = c.rowHover}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            onClick={() => setSelectedPayslip(data)}>

                                            {/* Employee */}
                                            <td style={{ padding: '13px 14px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                                                    <Avatar emp={emp} size={36} />
                                                    <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                                        <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{lang === 'ar' ? emp.full_name_ar : emp.full_name_en}</div>
                                                        <div style={{ fontSize: 11, color: c.textMuted }}>{emp.employee_number} · {lang === 'ar' ? emp.job_title_ar : emp.job_title_en}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Base */}
                                            <td style={{ padding: '13px 14px' }}>
                                                <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{fmt(data.baseSalary)}</span>
                                                <span style={{ fontSize: 11, color: c.textMuted }}> {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                                            </td>

                                            {/* Late Ded */}
                                            <td style={{ padding: '13px 14px' }}>
                                                {data.lateDeduction > 0
                                                    ? <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>- {fmt(data.lateDeduction)}</span>
                                                    : <span style={{ color: '#10B981', fontSize: 13 }}>✓</span>}
                                            </td>

                                            {/* Absence Ded */}
                                            <td style={{ padding: '13px 14px' }}>
                                                {data.absenceDeduction > 0
                                                    ? <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>- {fmt(data.absenceDeduction)}</span>
                                                    : <span style={{ color: '#10B981', fontSize: 13 }}>✓</span>}
                                            </td>

                                            {/* OT */}
                                            <td style={{ padding: '13px 14px' }}>
                                                {data.otEarnings > 0
                                                    ? <span style={{ fontSize: 13, fontWeight: 600, color: '#10B981' }}>+ {fmt(data.otEarnings)}</span>
                                                    : <span style={{ fontSize: 13, color: c.textMuted }}>—</span>}
                                            </td>

                                            {/* Total Ded */}
                                            <td style={{ padding: '13px 14px' }}>
                                                {hasDeductions
                                                    ? <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#EF444420', color: '#EF4444' }}>- {fmt(data.totalDeductions)}</span>
                                                    : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#10B98120', color: '#10B981' }}>✓ صفر</span>}
                                            </td>

                                            {/* Net */}
                                            <td style={{ padding: '13px 14px' }}>
                                                <span style={{ fontSize: 15, fontWeight: 800, color: c.accent }}>{fmt(data.netSalary)}</span>
                                                <span style={{ fontSize: 11, color: c.textMuted }}> {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                                            </td>

                                            {/* Action */}
                                            <td style={{ padding: '13px 14px' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => setSelectedPayslip(data)}
                                                    style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid ' + c.border, cursor: 'pointer', background: 'transparent', color: c.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = c.accent; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = c.accent; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.textMuted; e.currentTarget.style.borderColor = c.border; }}>
                                                    <FileText size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>

                            {/* Totals Row */}
                            {totals && (
                                <tfoot>
                                    <tr style={{ background: isDark ? 'rgba(74,122,171,0.1)' : '#EFF6FF', borderTop: '2px solid ' + c.accent + '40' }}>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: c.accent }} colSpan={1}>
                                            {lang === 'ar' ? `الإجمالي (${filtered.length} موظف)` : `Total (${filtered.length} employees)`}
                                        </td>
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: c.text }}>{fmt(totals.base)}</td>
                                        <td style={{ padding: '12px 14px' }} />
                                        <td style={{ padding: '12px 14px' }} />
                                        <td style={{ padding: '12px 14px' }} />
                                        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#EF4444' }}>- {fmt(totals.deductions)}</td>
                                        <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: c.accent }}>{fmt(totals.net)} {lang === 'ar' ? 'ج.م' : 'EGP'}</td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Finance export note */}
                    <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 8, background: isDark ? 'rgba(74,122,171,0.08)' : '#EFF6FF', border: '1px solid ' + (isDark ? 'rgba(74,122,171,0.2)' : '#BFDBFE'), display: 'flex', alignItems: 'center', gap: 10, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ fontSize: 18 }}>💡</span>
                        <p style={{ margin: 0, fontSize: 13, color: isDark ? '#8BA8C8' : '#1D4ED8' }}>
                            {lang === 'ar'
                                ? `بعد اعتماد المسير، بيتصدّر تلقائياً للمالية — Read Only. كل موظف بيتبعتله إشعار بقسيمة راتبه.`
                                : 'After payroll approval, it exports automatically to Finance (Read Only). Each employee gets notified with their payslip.'}
                        </p>
                    </div>
                </>
            )}

            {/* Payslip Modal */}
            {selectedPayslip && (
                <PayslipModal
                    data={selectedPayslip}
                    month={month}
                    year={year}
                    onClose={() => setSelectedPayslip(null)}
                    isDark={isDark} isRTL={isRTL} lang={lang} c={c}
                />
            )}
        </div>
    );
}
