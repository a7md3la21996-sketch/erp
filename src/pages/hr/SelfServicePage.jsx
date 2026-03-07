import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { User, Calendar, DollarSign, Clock, TrendingUp, FileText, Award, Bell, ChevronRight, Download } from 'lucide-react';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../../data/hr_mock_data';
import { getAttendanceForMonth } from '../../data/attendanceStore';

const CURRENT_EMP = MOCK_EMPLOYEES[0];
const YEAR = 2026;
const MONTH = 3;

const MONTH_NAMES = {
  ar: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

const PAYSLIPS = [
  { month: 3, year: 2026, net: 14200, basic: 12000, deductions: 800, bonus: 3000 },
  { month: 2, year: 2026, net: 13500, basic: 12000, deductions: 500, bonus: 2000 },
  { month: 1, year: 2026, net: 12800, basic: 12000, deductions: 1200, bonus: 1000 },
];

const LEAVE_BALANCE = { annual: 21, used: 7, sick: 10, used_sick: 2, emergency: 3, used_emergency: 1 };

const NOTIFICATIONS = [
  { id: 1, type: 'payroll', ar: 'تم اعتماد مسير رواتب مارس', en: 'March payroll approved', time: '2h', icon: '💰', color: '#10B981' },
  { id: 2, type: 'leave',   ar: 'تمت الموافقة على طلب إجازتك', en: 'Your leave request approved', time: '1d', icon: '✅', color: '#3B82F6' },
  { id: 3, type: 'perf',    ar: 'موعد تقييم الأداء الربع سنوي', en: 'Quarterly review due soon', time: '3d', icon: '🎯', color: '#F59E0B' },
];

export default function SelfServicePage() {
  const { theme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const lang = i18n.language;
  const [activeTab, setActiveTab] = useState('overview');
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', days: 1, from: '', to: '', reason: '' });
  const [leaveSubmitted, setLeaveSubmitted] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState(null);

  const emp = CURRENT_EMP;
  const dept = DEPARTMENTS.find(d => d.id === emp.department);
  const attendance = getAttendanceForMonth(YEAR, MONTH);
  const myAtt = attendance.filter(r => r.employee_id === emp.id);
  const presentDays = myAtt.filter(r => r.status === 'present').length;
  const lateDays = myAtt.filter(r => r.status === 'late').length;
  const absentDays = myAtt.filter(r => r.status === 'absent').length;

  const c = {
    bg:        isDark ? '#152232' : '#f9fafb',
    cardBg:    isDark ? '#1a2234' : '#ffffff',
    border:    isDark ? 'rgba(74,122,171,0.2)' : '#e5e7eb',
    text:      isDark ? '#E2EAF4' : '#111827',
    textMuted: isDark ? '#8BA8C8' : '#6b7280',
    inputBg:   isDark ? '#0F1E2D' : '#ffffff',
    accent:    '#4A7AAB',
    primary:   '#2B4C6F',
  };

  const tabs = [
    { key: 'overview',  ar: 'نظرة عامة',  en: 'Overview'   },
    { key: 'payslips',  ar: 'الرواتب',    en: 'Payslips'   },
    { key: 'leave',     ar: 'الإجازات',   en: 'Leave'      },
    { key: 'attendance',ar: 'الحضور',     en: 'Attendance' },
    { key: 'performance',ar: 'الأداء',    en: 'Performance'},
  ];

  return (
    <div style={{ padding: 24, background: c.bg, minHeight: '100vh', direction: isRTL ? 'rtl' : 'ltr' }}>

      {/* Hero Card */}
      <div style={{ background: 'linear-gradient(135deg,#1B3347,#2B4C6F,#4A7AAB)', borderRadius: 16, padding: '28px 32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
          {(lang === 'ar' ? emp.full_name_ar : emp.full_name_en).charAt(0)}
        </div>
        <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
            {lang === 'ar' ? `مرحباً، ${emp.full_name_ar}` : `Welcome, ${emp.full_name_en}`}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {lang === 'ar' ? emp.job_title_ar : emp.job_title_en} · {dept ? (lang === 'ar' ? dept.name_ar : dept.name_en) : ''} · {emp.employee_number}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
          {[
            { label: lang === 'ar' ? 'سنوات الخدمة' : 'Years', value: '3.2' },
            { label: lang === 'ar' ? 'الراتب' : 'Salary', value: `${(emp.base_salary / 1000).toFixed(0)}K` },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '11px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: 'transparent', color: activeTab === t.key ? c.accent : c.textMuted,
            borderBottom: activeTab === t.key ? '2px solid ' + c.accent : '2px solid transparent',
          }}>
            {lang === 'ar' ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {[
              { icon: '✅', label: lang === 'ar' ? 'أيام حضور' : 'Present Days', value: presentDays, color: '#10B981' },
              { icon: '⏰', label: lang === 'ar' ? 'أيام تأخير' : 'Late Days', value: lateDays, color: '#F59E0B' },
              { icon: '🏖️', label: lang === 'ar' ? 'رصيد إجازة' : 'Leave Balance', value: LEAVE_BALANCE.annual - LEAVE_BALANCE.used, color: '#3B82F6' },
              { icon: '⭐', label: lang === 'ar' ? 'تقييم الأداء' : 'Performance', value: '4.2/5', color: '#6366F1' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '16px 18px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: c.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Latest Payslip + Notifications */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Latest Payslip */}
            <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                💰 {lang === 'ar' ? 'آخر قسيمة راتب' : 'Latest Payslip'}
              </div>
              {PAYSLIPS.slice(0, 1).map(p => (
                <div key={p.month}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#10B981', marginBottom: 4, textAlign: isRTL ? 'right' : 'left' }}>
                    {p.net.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                    {lang === 'ar' ? 'ج.م' : 'EGP'} · {MONTH_NAMES[lang][p.month - 1]} {p.year}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: lang === 'ar' ? 'راتب أساسي' : 'Basic', value: p.basic, color: '#10B981' },
                      { label: lang === 'ar' ? 'بونص' : 'Bonus', value: p.bonus, color: '#6366F1' },
                      { label: lang === 'ar' ? 'خصومات' : 'Deductions', value: -p.deductions, color: '#EF4444' },
                    ].map((r, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                        <span style={{ color: c.textMuted }}>{r.label}</span>
                        <span style={{ fontWeight: 600, color: r.color }}>{r.value > 0 ? '+' : ''}{r.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Notifications */}
            <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textMuted, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
                🔔 {lang === 'ar' ? 'الإشعارات' : 'Notifications'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {NOTIFICATIONS.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: n.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{n.icon}</div>
                    <div style={{ flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                      <div style={{ fontSize: 13, color: c.text }}>{lang === 'ar' ? n.ar : n.en}</div>
                      <div style={{ fontSize: 11, color: c.textMuted }}>{n.time} {lang === 'ar' ? 'مضت' : 'ago'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYSLIPS */}
      {activeTab === 'payslips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PAYSLIPS.map(p => (
            <div key={p.month} onClick={() => setSelectedPayslip(p)} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.15s', flexDirection: isRTL ? 'row-reverse' : 'row' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = c.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = c.border}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#10B98115', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💰</div>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{MONTH_NAMES[lang][p.month - 1]} {p.year}</div>
                  <div style={{ fontSize: 12, color: c.textMuted }}>{lang === 'ar' ? 'راتب أساسي: ' : 'Basic: '}{p.basic.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <div style={{ textAlign: isRTL ? 'left' : 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#10B981' }}>{p.net.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{lang === 'ar' ? 'صافي الراتب' : 'Net Salary'}</div>
                </div>
                <ChevronRight size={16} color={c.textMuted} style={{ transform: isRTL ? 'rotate(180deg)' : 'none' }} />
              </div>
            </div>
          ))}

          {/* Payslip Detail Modal */}
          {selectedPayslip && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: c.cardBg, borderRadius: 16, width: '100%', maxWidth: 420, direction: isRTL ? 'rtl' : 'ltr' }}>
                <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg,#1B3347,#4A7AAB)', borderRadius: '16px 16px 0 0', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{lang === 'ar' ? 'قسيمة راتب' : 'PAY SLIP'} · {MONTH_NAMES[lang][selectedPayslip.month - 1]} {selectedPayslip.year}</div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>{selectedPayslip.net.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{lang === 'ar' ? 'جنيه مصري' : 'EGP'}</div>
                </div>
                <div style={{ padding: '20px 24px' }}>
                  {[
                    { label: lang === 'ar' ? 'الراتب الأساسي' : 'Basic Salary', value: selectedPayslip.basic, color: '#10B981' },
                    { label: lang === 'ar' ? 'البونص' : 'Bonus', value: selectedPayslip.bonus, color: '#6366F1' },
                    { label: lang === 'ar' ? 'الخصومات' : 'Deductions', value: -selectedPayslip.deductions, color: '#EF4444' },
                  ].map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid ' + c.border, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: 14, color: c.textMuted }}>{r.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: r.color }}>{r.value > 0 ? '+' : ''}{r.value.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'الصافي' : 'Net'}</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#10B981' }}>{selectedPayslip.net.toLocaleString()} {lang === 'ar' ? 'ج.م' : 'EGP'}</span>
                  </div>
                  <button onClick={() => setSelectedPayslip(null)} style={{ width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {lang === 'ar' ? 'إغلاق' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LEAVE */}
      {activeTab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              { label: lang === 'ar' ? 'إجازة سنوية' : 'Annual Leave', total: LEAVE_BALANCE.annual, used: LEAVE_BALANCE.used, color: '#3B82F6' },
              { label: lang === 'ar' ? 'إجازة مرضية' : 'Sick Leave', total: LEAVE_BALANCE.sick, used: LEAVE_BALANCE.used_sick, color: '#F59E0B' },
              { label: lang === 'ar' ? 'طارئة' : 'Emergency', total: LEAVE_BALANCE.emergency, used: LEAVE_BALANCE.used_emergency, color: '#EF4444' },
            ].map((lb, i) => {
              const remaining = lb.total - lb.used;
              const pct = Math.round((lb.used / lb.total) * 100);
              return (
                <div key={i} style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '18px 20px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>{lb.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: lb.color, textAlign: isRTL ? 'right' : 'left' }}>{remaining}</div>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'يوم متبقي' : 'days remaining'}</div>
                  <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                    <div style={{ height: '100%', borderRadius: 3, width: pct + '%', background: lb.color }} />
                  </div>
                  <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6, textAlign: isRTL ? 'right' : 'left' }}>{lb.used}/{lb.total} {lang === 'ar' ? 'مستخدم' : 'used'}</div>
                </div>
              );
            })}
          </div>
          {/* Leave Request Form */}
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '20px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text, marginBottom: 16, textAlign: isRTL ? 'right' : 'left' }}>
              📋 {lang === 'ar' ? 'طلب إجازة جديد' : 'New Leave Request'}
            </div>
            {leaveSubmitted ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#10B981', marginBottom: 6 }}>{lang === 'ar' ? 'تم إرسال الطلب!' : 'Request Submitted!'}</div>
                <div style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>{lang === 'ar' ? 'سيتم مراجعته من المدير المباشر' : 'Your manager will review it shortly'}</div>
                <button onClick={() => setLeaveSubmitted(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid ' + c.border, background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 13 }}>
                  {lang === 'ar' ? 'طلب آخر' : 'New Request'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'نوع الإجازة' : 'Leave Type'}</label>
                  <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({ ...f, type: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13 }}>
                    <option value="annual">{lang === 'ar' ? 'سنوية' : 'Annual'}</option>
                    <option value="sick">{lang === 'ar' ? 'مرضية' : 'Sick'}</option>
                    <option value="emergency">{lang === 'ar' ? 'طارئة' : 'Emergency'}</option>
                    <option value="unpaid">{lang === 'ar' ? 'بدون راتب' : 'Unpaid'}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'عدد الايام' : 'Days Count'}</label>
                  <input type="number" min="1" max="30" value={leaveForm.days} onChange={e => setLeaveForm(f => ({ ...f, days: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'من تاريخ' : 'From Date'}</label>
                  <input type="date" value={leaveForm.from} onChange={e => setLeaveForm(f => ({ ...f, from: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'الى تاريخ' : 'To Date'}</label>
                  <input type="date" value={leaveForm.to} onChange={e => setLeaveForm(f => ({ ...f, to: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 5, textAlign: isRTL ? 'right' : 'left' }}>{lang === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}</label>
                  <textarea value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid ' + c.border, background: c.inputBg, color: c.text, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
                  <button onClick={() => { if (leaveForm.from && leaveForm.to) setLeaveSubmitted(true); }}
                    style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#2B4C6F,#4A7AAB)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {lang === 'ar' ? 'ارسال الطلب' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + c.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'سجل الحضور — مارس 2026' : 'Attendance — March 2026'}</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <span style={{ color: '#10B981' }}>✅ {presentDays} {lang === 'ar' ? 'حضور' : 'present'}</span>
              <span style={{ color: '#F59E0B' }}>⏰ {lateDays} {lang === 'ar' ? 'تأخير' : 'late'}</span>
              <span style={{ color: '#EF4444' }}>❌ {absentDays} {lang === 'ar' ? 'غياب' : 'absent'}</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(74,122,171,0.08)' : '#F8FAFC' }}>
                {[lang === 'ar' ? 'التاريخ' : 'Date', lang === 'ar' ? 'دخول' : 'In', lang === 'ar' ? 'خروج' : 'Out', lang === 'ar' ? 'الحالة' : 'Status'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: isRTL ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {myAtt.slice(0, 15).map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid ' + c.border }}>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: c.text }}>{r.date}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: c.text }}>{r.check_in || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: c.text }}>{r.check_out || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: r.status === 'present' ? '#10B98115' : r.status === 'late' ? '#F59E0B15' : '#EF444415',
                      color: r.status === 'present' ? '#10B981' : r.status === 'late' ? '#F59E0B' : '#EF4444',
                    }}>
                      {r.status === 'present' ? (lang === 'ar' ? 'حضور' : 'Present') : r.status === 'late' ? (lang === 'ar' ? 'تأخير' : 'Late') : (lang === 'ar' ? 'غياب' : 'Absent')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PERFORMANCE */}
      {activeTab === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: c.cardBg, borderRadius: 12, border: '1px solid ' + c.border, padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lang === 'ar' ? 'تقييم Q1 2026' : 'Q1 2026 Review'}</div>
              <div style={{ padding: '6px 16px', borderRadius: 20, background: '#10B98115', color: '#10B981', fontSize: 13, fontWeight: 700 }}>4.2 / 5 ⭐</div>
            </div>
            {[
              { label: lang === 'ar' ? 'التواصل' : 'Communication', score: 4 },
              { label: lang === 'ar' ? 'جودة العمل' : 'Work Quality', score: 5 },
              { label: lang === 'ar' ? 'المبادرة' : 'Initiative', score: 4 },
              { label: lang === 'ar' ? 'العمل الجماعي' : 'Teamwork', score: 4 },
              { label: lang === 'ar' ? 'حل المشكلات' : 'Problem Solving', score: 3 },
            ].map((comp, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <span style={{ fontSize: 13, color: c.text }}>{comp.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ['#EF4444','#F97316','#F59E0B','#3B82F6','#10B981'][comp.score - 1] }}>{comp.score}/5</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }}>
                  <div style={{ height: '100%', borderRadius: 3, width: (comp.score / 5 * 100) + '%', background: ['#EF4444','#F97316','#F59E0B','#3B82F6','#10B981'][comp.score - 1], transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
