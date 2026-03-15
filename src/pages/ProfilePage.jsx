import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ROLE_LABELS } from '../config/roles';
import { MOCK_EMPLOYEES, DEPARTMENTS } from '../data/hr_mock_data';
import { ensureTargets, computeActuals, METRIC_CONFIG, METRICS } from '../services/kpiTargetsService';
import { getObjectives, computeObjectiveProgress, STATUS_COLORS, KR_STATUS_OPTIONS } from '../services/okrService';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  User, Mail, Phone, Calendar, Edit3, Save, X, Award, Trophy, Flame, PhoneCall,
  Target, TrendingUp, Shield, Bell, Lock, Eye, EyeOff, Check, Globe, Moon, Sun, Star,
} from 'lucide-react';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 3;
const CURRENT_QUARTER = 'Q1';

// Which quarter from month
function getQuarter(m) {
  if (m <= 3) return 'Q1';
  if (m <= 6) return 'Q2';
  if (m <= 9) return 'Q3';
  return 'Q4';
}

// Mock performance data for last 6 months
const PERF_DATA = [
  { month_en: 'Oct', month_ar: 'أكتوبر', calls: 22, deals: 6, revenue: 820000 },
  { month_en: 'Nov', month_ar: 'نوفمبر', calls: 30, deals: 8, revenue: 950000 },
  { month_en: 'Dec', month_ar: 'ديسمبر', calls: 25, deals: 7, revenue: 1100000 },
  { month_en: 'Jan', month_ar: 'يناير', calls: 25, deals: 7, revenue: 1100000 },
  { month_en: 'Feb', month_ar: 'فبراير', calls: 32, deals: 11, revenue: 1380000 },
  { month_en: 'Mar', month_ar: 'مارس', calls: 28, deals: 9, revenue: 1250000 },
];

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';

  // Find this employee in MOCK_EMPLOYEES
  const employee = useMemo(() => {
    return MOCK_EMPLOYEES.find(e => e.id === 'e1') || MOCK_EMPLOYEES[0];
  }, []);

  const dept = DEPARTMENTS.find(d => d.id === employee.department);
  const roleLabel = ROLE_LABELS[employee.role]?.[i18n.language] || employee.role;

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    full_name_ar: employee.full_name_ar,
    full_name_en: employee.full_name_en,
    phone: employee.phone,
    email: employee.email,
  });

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({ email: true, push: true, sms: false });

  // Password change
  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwSuccess, setPwSuccess] = useState(false);

  // KPI Targets
  const kpiData = useMemo(() => {
    ensureTargets(employee.id, employee.role, CURRENT_MONTH, CURRENT_YEAR);
    const actuals = computeActuals(employee.id, CURRENT_MONTH, CURRENT_YEAR);
    return METRICS.map(metric => {
      const cfg = METRIC_CONFIG[metric];
      const targets = ensureTargets(employee.id, employee.role, CURRENT_MONTH, CURRENT_YEAR);
      const tgt = targets.find(t => t.metric === metric);
      const targetVal = tgt?.target_value || 0;
      const actualVal = actuals[metric] || 0;
      const pct = targetVal > 0 ? Math.round((actualVal / targetVal) * 100) : 0;
      return { metric, label: cfg[i18n.language] || cfg.en, color: cfg.color, target: targetVal, actual: actualVal, pct };
    });
  }, [employee, i18n.language]);

  // Stats
  const stats = useMemo(() => {
    const actuals = computeActuals(employee.id, CURRENT_MONTH, CURRENT_YEAR);
    return {
      calls: actuals.calls,
      opportunities: actuals.new_opportunities,
      deals: actuals.closed_deals,
      revenue: actuals.revenue,
    };
  }, [employee]);

  // OKRs
  const objectives = useMemo(() => {
    return getObjectives({ quarter: CURRENT_QUARTER, year: CURRENT_YEAR }).filter(
      o => o.owner_id === employee.id
    );
  }, [employee]);

  // Achievements / Badges
  const badges = useMemo(() => {
    const list = [];
    if (stats.revenue >= 1000000) list.push({ id: 'top_seller', label_en: 'Top Seller', label_ar: 'أفضل بائع', icon: Trophy, color: '#F59E0B' });
    if (stats.calls >= 25) list.push({ id: 'call_champion', label_en: 'Call Champion', label_ar: 'بطل المكالمات', icon: PhoneCall, color: '#10B981' });
    // Streak: deals 3 months in a row (mock check)
    const hasStreak = PERF_DATA.slice(-3).every(m => m.deals >= 5);
    if (hasStreak) list.push({ id: 'streak', label_en: '3-Month Streak', label_ar: 'سلسلة 3 أشهر', icon: Flame, color: '#EF4444' });
    if (stats.deals >= 8) list.push({ id: 'deal_closer', label_en: 'Deal Closer', label_ar: 'مغلق صفقات', icon: Target, color: '#4A7AAB' });
    list.push({ id: 'rising_star', label_en: 'Rising Star', label_ar: 'نجم صاعد', icon: Star, color: '#8B5CF6' });
    return list;
  }, [stats]);

  // Initials
  const initials = (employee.full_name_en || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const handleSaveProfile = () => {
    // In a real app: call API
    setEditing(false);
  };

  const handlePasswordChange = () => {
    if (pwForm.newPw && pwForm.newPw === pwForm.confirm && pwForm.current) {
      setPwSuccess(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 3000);
    }
  };

  // Shared styles
  const cardStyle = {
    background: isDark ? '#1a2332' : '#ffffff',
    borderRadius: 16,
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}`,
    padding: 24,
  };

  const sectionTitle = {
    fontSize: 18,
    fontWeight: 700,
    color: isDark ? '#e2e8f0' : '#1e293b',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: isDark ? '#94a3b8' : '#64748b',
    marginBottom: 4,
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)'}`,
    background: isDark ? '#0a1929' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const toggleStyle = (active) => ({
    width: 44,
    height: 24,
    borderRadius: 12,
    background: active ? '#4A7AAB' : (isDark ? '#334155' : '#cbd5e1'),
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
  });

  const toggleDotStyle = (active) => ({
    width: 18,
    height: 18,
    borderRadius: 9,
    background: '#fff',
    position: 'absolute',
    top: 3,
    [active ? (isRTL ? 'left' : 'right') : (isRTL ? 'right' : 'left')]: 3,
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  });

  function formatCurrency(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(0) + 'K';
    return v.toString();
  }

  function ChartTooltipCustom({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: isDark ? 'rgba(26,35,50,0.95)' : 'rgba(255,255,255,0.95)',
        border: `1px solid ${isDark ? 'rgba(74,122,171,0.3)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 10,
        padding: '10px 14px',
        fontSize: 12,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, fontWeight: 600 }}>
            {p.name}: {typeof p.value === 'number' && p.value >= 1000 ? formatCurrency(p.value) : p.value}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      {/* ═══ HEADER SECTION ═══ */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', marginBottom: 24 }}>
        {/* Avatar */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: `linear-gradient(135deg, ${employee.avatar_color || '#4A7AAB'}, #1B3347)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={labelStyle}>{isRTL ? 'الاسم بالعربي' : 'Name (AR)'}</div>
                  <input style={inputStyle} value={editData.full_name_ar} onChange={e => setEditData(p => ({ ...p, full_name_ar: e.target.value }))} />
                </div>
                <div>
                  <div style={labelStyle}>{isRTL ? 'الاسم بالإنجليزي' : 'Name (EN)'}</div>
                  <input style={inputStyle} value={editData.full_name_en} onChange={e => setEditData(p => ({ ...p, full_name_en: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={labelStyle}>{isRTL ? 'البريد الإلكتروني' : 'Email'}</div>
                  <input style={inputStyle} value={editData.email} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <div style={labelStyle}>{isRTL ? 'الهاتف' : 'Phone'}</div>
                  <input style={inputStyle} value={editData.phone} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSaveProfile} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10,
                  background: '#4A7AAB', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                }}>
                  <Save size={15} /> {isRTL ? 'حفظ' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 10,
                  background: isDark ? '#334155' : '#e2e8f0', color: isDark ? '#e2e8f0' : '#1e293b',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                }}>
                  <X size={15} /> {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {isRTL ? employee.full_name_ar : employee.full_name_en}
                </h1>
                <span style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
                  color: '#4A7AAB',
                }}>
                  {roleLabel}
                </span>
                <span style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  background: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                  color: '#10B981',
                }}>
                  {isRTL ? dept?.name_ar : dept?.name_en}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                  <Mail size={15} /> {employee.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                  <Phone size={15} /> {employee.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: isDark ? '#94a3b8' : '#64748b', fontSize: 13 }}>
                  <Calendar size={15} /> {isRTL ? 'تاريخ الالتحاق:' : 'Joined:'} {employee.hire_date}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Edit button */}
        {!editing && (
          <button onClick={() => setEditing(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', borderRadius: 12,
            background: isDark ? 'rgba(74,122,171,0.15)' : 'rgba(74,122,171,0.1)',
            color: '#4A7AAB', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
          }}>
            <Edit3 size={16} /> {isRTL ? 'تعديل الملف' : 'Edit Profile'}
          </button>
        )}
      </div>

      {/* ═══ STATS CARDS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: isRTL ? 'المكالمات' : 'Calls', value: stats.calls, icon: PhoneCall, color: '#10B981' },
          { label: isRTL ? 'الفرص' : 'Opportunities', value: stats.opportunities, icon: TrendingUp, color: '#4A7AAB' },
          { label: isRTL ? 'الصفقات المغلقة' : 'Deals Closed', value: stats.deals, icon: Trophy, color: '#2B4C6F' },
          { label: isRTL ? 'الإيرادات' : 'Revenue', value: formatCurrency(stats.revenue), icon: Target, color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} style={{
            ...cardStyle, padding: 20,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: `${s.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <s.icon size={22} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#94a3b8' : '#64748b' }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginTop: 2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
        {/* ═══ KPI TARGETS ═══ */}
        <div style={cardStyle}>
          <div style={sectionTitle}>
            <Target size={20} style={{ color: '#4A7AAB' }} />
            {isRTL ? 'أهداف الأداء - مارس 2026' : 'KPI Targets - March 2026'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {kpiData.map(kpi => {
              const pctColor = kpi.pct >= 80 ? '#10B981' : kpi.pct >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <div key={kpi.metric}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>{kpi.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pctColor }}>
                      {kpi.actual.toLocaleString()} / {kpi.target.toLocaleString()} ({kpi.pct}%)
                    </span>
                  </div>
                  <div style={{
                    height: 8, borderRadius: 4,
                    background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${Math.min(kpi.pct, 100)}%`,
                      background: pctColor,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ GOALS / OKRs ═══ */}
        <div style={cardStyle}>
          <div style={sectionTitle}>
            <Award size={20} style={{ color: '#8B5CF6' }} />
            {isRTL ? `أهداف ${CURRENT_QUARTER} ${CURRENT_YEAR}` : `${CURRENT_QUARTER} ${CURRENT_YEAR} Goals`}
          </div>
          {objectives.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: isDark ? '#64748b' : '#94a3b8', fontSize: 14 }}>
              {isRTL ? 'لا توجد أهداف لهذا الربع' : 'No goals for this quarter'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {objectives.map(obj => {
                const progress = computeObjectiveProgress(obj);
                return (
                  <div key={obj.id} style={{
                    padding: 16, borderRadius: 12,
                    background: isDark ? 'rgba(10,25,41,0.5)' : '#f8fafc',
                    border: `1px solid ${isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                        {isRTL ? obj.titleAr : obj.title}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#4A7AAB' }}>{progress}%</span>
                    </div>
                    {/* Overall progress bar */}
                    <div style={{
                      height: 6, borderRadius: 3, marginBottom: 12,
                      background: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        width: `${progress}%`,
                        background: '#4A7AAB',
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                    {/* Key Results */}
                    {(obj.keyResults || []).map(kr => {
                      const krPct = kr.target > 0 ? Math.min(100, Math.round((kr.current / kr.target) * 100)) : 0;
                      const statusOpt = KR_STATUS_OPTIONS.find(s => s.value === kr.status);
                      return (
                        <div key={kr.id} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>
                              {isRTL ? kr.titleAr : kr.title}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                              background: `${statusOpt?.color || '#94a3b8'}18`,
                              color: statusOpt?.color || '#94a3b8',
                            }}>
                              {krPct}%
                            </span>
                          </div>
                          <div style={{
                            height: 4, borderRadius: 2,
                            background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.04)',
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 2,
                              width: `${krPct}%`,
                              background: statusOpt?.color || '#94a3b8',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ PERFORMANCE CHART ═══ */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={sectionTitle}>
          <TrendingUp size={20} style={{ color: '#4A7AAB' }} />
          {isRTL ? 'أداء آخر 6 أشهر' : 'Last 6 Months Performance'}
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={PERF_DATA.map(d => ({ name: isRTL ? d.month_ar : d.month_en, ...d }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(148,163,184,0.08)' : 'rgba(0,0,0,0.06)'} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v)} />
              <Tooltip content={<ChartTooltipCustom />} />
              <Bar yAxisId="left" dataKey="calls" name={isRTL ? 'مكالمات' : 'Calls'} fill="#4A7AAB" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar yAxisId="left" dataKey="deals" name={isRTL ? 'صفقات' : 'Deals'} fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="revenue" name={isRTL ? 'إيرادات' : 'Revenue'} stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: '#F59E0B' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ ACHIEVEMENTS ═══ */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={sectionTitle}>
          <Award size={20} style={{ color: '#F59E0B' }} />
          {isRTL ? 'الإنجازات والأوسمة' : 'Achievements & Badges'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {badges.map(b => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', borderRadius: 14,
              background: `${b.color}12`,
              border: `1px solid ${b.color}25`,
            }}>
              <b.icon size={18} style={{ color: b.color }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: b.color }}>
                {isRTL ? b.label_ar : b.label_en}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ ACCOUNT SETTINGS ═══ */}
      <div style={cardStyle}>
        <div style={sectionTitle}>
          <Shield size={20} style={{ color: '#4A7AAB' }} />
          {isRTL ? 'إعدادات الحساب' : 'Account Settings'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          {/* Language & Theme */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 16 }}>
              {isRTL ? 'التخصيص' : 'Preferences'}
            </div>

            {/* Language Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Globe size={18} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {isRTL ? 'اللغة' : 'Language'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, background: isDark ? '#0a1929' : '#f1f5f9', borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => { if (i18n.language !== 'en') { i18n.changeLanguage('en').then(() => window.location.reload()); } }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: i18n.language === 'en' ? '#4A7AAB' : 'transparent',
                    color: i18n.language === 'en' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                >EN</button>
                <button
                  onClick={() => { if (i18n.language !== 'ar') { i18n.changeLanguage('ar').then(() => window.location.reload()); } }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: i18n.language === 'ar' ? '#4A7AAB' : 'transparent',
                    color: i18n.language === 'ar' ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                  }}
                >عربي</button>
              </div>
            </div>

            {/* Theme Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isDark ? <Moon size={18} style={{ color: '#94a3b8' }} /> : <Sun size={18} style={{ color: '#64748b' }} />}
                <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
                  {isRTL ? 'المظهر' : 'Theme'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4, background: isDark ? '#0a1929' : '#f1f5f9', borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => { if (isDark) toggleTheme(); }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: !isDark ? '#4A7AAB' : 'transparent',
                    color: !isDark ? '#fff' : '#94a3b8',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                ><Sun size={13} /> {isRTL ? 'فاتح' : 'Light'}</button>
                <button
                  onClick={() => { if (!isDark) toggleTheme(); }}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: isDark ? '#4A7AAB' : 'transparent',
                    color: isDark ? '#fff' : '#64748b',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                ><Moon size={13} /> {isRTL ? 'داكن' : 'Dark'}</button>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 16 }}>
              {isRTL ? 'الإشعارات' : 'Notifications'}
            </div>
            {[
              { key: 'email', label: isRTL ? 'البريد الإلكتروني' : 'Email Notifications', icon: Mail },
              { key: 'push', label: isRTL ? 'إشعارات الدفع' : 'Push Notifications', icon: Bell },
              { key: 'sms', label: isRTL ? 'الرسائل النصية' : 'SMS Notifications', icon: Phone },
            ].map(n => (
              <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <n.icon size={18} style={{ color: isDark ? '#94a3b8' : '#64748b' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>{n.label}</span>
                </div>
                <button
                  onClick={() => setNotifPrefs(p => ({ ...p, [n.key]: !p[n.key] }))}
                  style={toggleStyle(notifPrefs[n.key])}
                >
                  <div style={toggleDotStyle(notifPrefs[n.key])} />
                </button>
              </div>
            ))}
          </div>

          {/* Change Password */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={16} /> {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
            </div>
            {pwSuccess && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(16,185,129,0.1)', color: '#10B981',
                fontSize: 13, fontWeight: 600,
              }}>
                <Check size={16} /> {isRTL ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully'}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={labelStyle}>{isRTL ? 'كلمة المرور الحالية' : 'Current Password'}</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    style={inputStyle}
                    value={pwForm.current}
                    onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                    [isRTL ? 'left' : 'right']: 10,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: isDark ? '#94a3b8' : '#64748b',
                  }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <div style={labelStyle}>{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</div>
                <input type="password" style={inputStyle} value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} />
              </div>
              <div>
                <div style={labelStyle}>{isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}</div>
                <input type="password" style={inputStyle} value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
              <button
                onClick={handlePasswordChange}
                disabled={!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 20px', borderRadius: 10,
                  background: (!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm) ? (isDark ? '#334155' : '#e2e8f0') : '#4A7AAB',
                  color: (!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm) ? (isDark ? '#64748b' : '#94a3b8') : '#fff',
                  border: 'none', cursor: (!pwForm.current || !pwForm.newPw || pwForm.newPw !== pwForm.confirm) ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit', width: '100%',
                }}
              >
                <Lock size={15} /> {isRTL ? 'تحديث كلمة المرور' : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
