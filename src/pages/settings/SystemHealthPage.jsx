import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Activity, Database, AlertTriangle, Clock, Server,
  Trash2, RefreshCw, HardDrive, Shield, Wifi,
  Monitor, ChevronDown, ChevronUp, ExternalLink,
  CheckCircle, XCircle, Info,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { getSystemHealth, getErrorLog, clearErrorLog } from '../../services/healthService';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#4A7AAB', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#06b6d4', '#84cc16'];

export default function SystemHealthPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const [health, setHealth] = useState(null);
  const [errorLog, setErrorLog] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [loading, setLoading] = useState(true);

  const t = useCallback((en, ar) => isRTL ? ar : en, [isRTL]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSystemHealth();
      setHealth(data);
      setErrorLog(getErrorLog());
    } catch (e) {
      if (import.meta.env.DEV) console.error('Health check failed:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleClearErrors = () => {
    clearErrorLog();
    setErrorLog([]);
    refresh();
  };

  const handleClearCache = async () => {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    refresh();
  };

  // ── Styles ─────────────────────────────────────────────────────────────

  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const surfaceBg = isDark ? '#0a1929' : '#f8fafc';
  const innerBg = isDark ? '#132337' : '#f8fafc';

  const cardStyle = {
    background: cardBg,
    border: cardBorder,
    borderRadius: 16,
    padding: 20,
  };

  if (loading && !health) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={24} style={{ color: '#4A7AAB', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!health) return null;

  const statusConfig = {
    healthy: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: t('System Healthy', 'النظام يعمل بشكل طبيعي'), icon: CheckCircle },
    warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: t('System Warning', 'تحذيرات في النظام'), icon: AlertTriangle },
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: t('System Critical', 'حالة حرجة'), icon: XCircle },
  };
  const sc = statusConfig[health.status];

  const storageColor = health.storage.percentage < 60 ? '#10b981' : health.storage.percentage < 80 ? '#f59e0b' : '#ef4444';

  // Pie chart data
  const pieData = health.storage.breakdown
    .filter(b => b.sizeKB > 0)
    .slice(0, 12)
    .map(b => ({ name: b.key.replace('platform_', ''), value: b.sizeKB }));

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Activity size={22} style={{ color: '#4A7AAB' }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
            {t('System Health', 'حالة النظام')}
          </h1>
        </div>
        <button
          onClick={refresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.3)',
            borderRadius: 10, cursor: 'pointer', color: '#4A7AAB', fontSize: 13, fontWeight: 500,
          }}
        >
          <RefreshCw size={14} />
          {t('Refresh', 'تحديث')}
        </button>
      </div>

      {/* Status Banner */}
      <div style={{
        ...cardStyle,
        background: sc.bg,
        border: `1px solid ${sc.color}30`,
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `${sc.color}20`, border: `2px solid ${sc.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <sc.icon size={28} style={{ color: sc.color }} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: sc.color }}>{sc.label}</div>
          <div style={{ fontSize: 13, color: textSecondary, marginTop: 2 }}>
            {t(`Last checked: just now`, `آخر فحص: الآن`)}
            {' • '}
            {t(`Uptime: ${health.session.uptime}`, `مدة التشغيل: ${health.session.uptime}`)}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          {
            icon: HardDrive, color: storageColor,
            label: t('Storage Used', 'التخزين المستخدم'),
            value: `${health.storage.percentage}%`,
            sub: `${health.storage.used.toFixed(1)} / ${(health.storage.total / 1024).toFixed(0)} MB`,
          },
          {
            icon: AlertTriangle, color: health.errors.today > 0 ? '#ef4444' : '#10b981',
            label: t('Errors Today', 'أخطاء اليوم'),
            value: health.errors.today,
            sub: t(`${health.errors.thisWeek} this week`, `${health.errors.thisWeek} هذا الأسبوع`),
          },
          {
            icon: Clock, color: '#4A7AAB',
            label: t('Uptime', 'مدة التشغيل'),
            value: health.session.uptime,
            sub: health.session.browser,
          },
          {
            icon: Database, color: '#6366f1',
            label: t('Total Records', 'إجمالي السجلات'),
            value: health.totalRecords.toLocaleString(),
            sub: t(`${health.dataStats.filter(d => d.count > 0).length} entities`, `${health.dataStats.filter(d => d.count > 0).length} كيان`),
          },
        ].map((kpi, idx) => (
          <div key={idx} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <kpi.icon size={18} style={{ color: kpi.color }} />
              </div>
              <span style={{ fontSize: 12, color: textSecondary, fontWeight: 500 }}>{kpi.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: textPrimary }}>{kpi.value}</div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Storage Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginBottom: 20 }}>
        {/* Storage Progress */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <HardDrive size={16} style={{ color: '#4A7AAB' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
              {t('Storage Usage', 'استخدام التخزين')}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ background: innerBg, borderRadius: 8, height: 20, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{
              height: '100%', borderRadius: 8, background: storageColor,
              width: `${health.storage.percentage}%`, transition: 'width 0.5s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {health.storage.percentage > 15 && (
                <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{health.storage.percentage}%</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: textSecondary }}>
            <span>{t('Used', 'مستخدم')}: {health.storage.used.toFixed(2)} KB</span>
            <span>{t('Available', 'متاح')}: ~{((health.storage.total - health.storage.used) / 1024).toFixed(2)} MB</span>
          </div>
        </div>

        {/* Pie Chart */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Database size={16} style={{ color: '#4A7AAB' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
              {t('Storage Breakdown', 'تفصيل التخزين')}
            </span>
          </div>
          {pieData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value.toFixed(2)} KB`}
                    contentStyle={{ background: cardBg, border: cardBorder, borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: textPrimary }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ color: textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                    <span style={{ color: textPrimary, fontWeight: 500 }}>{d.value.toFixed(1)}KB</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: textSecondary, fontSize: 13 }}>
              {t('No storage data', 'لا توجد بيانات تخزين')}
            </div>
          )}
        </div>
      </div>

      {/* Data Stats Table */}
      <div style={{ ...cardStyle, marginBottom: 20, overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Server size={16} style={{ color: '#4A7AAB' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
            {t('Data Statistics', 'إحصائيات البيانات')}
          </span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                t('Entity', 'الكيان'),
                t('Records', 'السجلات'),
                t('Storage', 'التخزين'),
                t('Key', 'المفتاح'),
              ].map((h, i) => (
                <th key={i} style={{
                  textAlign: isRTL ? 'right' : 'left', padding: '10px 12px',
                  fontSize: 11, fontWeight: 600, color: textSecondary,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {health.dataStats.map((stat, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}` }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: textPrimary, fontWeight: 500 }}>
                  {isRTL ? stat.label.ar : stat.label.en}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: stat.count > 0 ? textPrimary : textSecondary, fontWeight: 600 }}>
                  {stat.count.toLocaleString()}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: textSecondary }}>
                  {stat.sizeKB > 0 ? `${stat.sizeKB.toFixed(2)} KB` : '—'}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: textSecondary, fontFamily: 'monospace' }}>
                  {stat.key}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warnings */}
      {health.warnings.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
              {t('Warnings', 'تحذيرات')}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {health.warnings.map((w, i) => {
              const wColor = w.type === 'error' ? '#ef4444' : w.type === 'warning' ? '#f59e0b' : '#4A7AAB';
              const WIcon = w.type === 'error' ? XCircle : w.type === 'warning' ? AlertTriangle : Info;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 10, background: `${wColor}10`, border: `1px solid ${wColor}25`,
                }}>
                  <WIcon size={16} style={{ color: wColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: textPrimary }}>{isRTL ? w.msg.ar : w.msg.en}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Log */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div
          onClick={() => setShowErrors(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
              {t('Error Log', 'سجل الأخطاء')}
            </span>
            <span style={{
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            }}>
              {errorLog.length}
            </span>
          </div>
          {showErrors ? <ChevronUp size={16} style={{ color: textSecondary }} /> : <ChevronDown size={16} style={{ color: textSecondary }} />}
        </div>

        {showErrors && (
          <div style={{ marginTop: 14 }}>
            {errorLog.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <button
                  onClick={handleClearErrors}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 500,
                  }}
                >
                  <Trash2 size={12} />
                  {t('Clear Log', 'مسح السجل')}
                </button>
              </div>
            )}
            {errorLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: textSecondary, fontSize: 13 }}>
                {t('No errors recorded', 'لا توجد أخطاء مسجلة')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflow: 'auto' }}>
                {errorLog.slice(0, 50).map((err, i) => (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 8, background: innerBg,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{err.context || 'Error'}</span>
                      <span style={{ fontSize: 11, color: textSecondary }}>
                        {new Date(err.timestamp).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: textPrimary, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {err.message}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* System Info */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Monitor size={16} style={{ color: '#4A7AAB' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
            {t('System Information', 'معلومات النظام')}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[
            { label: t('Browser', 'المتصفح'), value: health.session.browser },
            { label: t('Platform', 'النظام'), value: health.session.platform },
            { label: t('Screen', 'الشاشة'), value: health.session.screenRes },
            { label: t('Service Worker', 'خدمة التشغيل'), value: health.pwa.serviceWorkerStatus },
            { label: t('Cache Entries', 'عناصر الكاش'), value: health.pwa.cacheEntries },
            { label: t('Page Load', 'تحميل الصفحة'), value: health.performance.pageLoadTime ? `${health.performance.pageLoadTime}ms` : 'N/A' },
            { label: t('DOM Ready', 'جاهزية DOM'), value: health.performance.domReady ? `${health.performance.domReady}ms` : 'N/A' },
            { label: t('Last Backup', 'آخر نسخة احتياطية'), value: health.lastBackup ? new Date(health.lastBackup).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US') : t('Never', 'لم يتم') },
          ].map((item, i) => (
            <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: innerBg }}>
              <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, fontWeight: 500 }}>{item.label}</div>
              <div style={{ fontSize: 13, color: textPrimary, fontWeight: 600 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ ...cardStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Shield size={16} style={{ color: '#4A7AAB' }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
            {t('Actions', 'إجراءات')}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            onClick={handleClearErrors}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, cursor: 'pointer', color: '#ef4444', fontSize: 13, fontWeight: 500,
            }}
          >
            <Trash2 size={14} />
            {t('Clear Error Log', 'مسح سجل الأخطاء')}
          </button>
          <button
            onClick={() => navigate('/settings/backup')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              background: 'rgba(74,122,171,0.1)', border: '1px solid rgba(74,122,171,0.3)',
              borderRadius: 10, cursor: 'pointer', color: '#4A7AAB', fontSize: 13, fontWeight: 500,
            }}
          >
            <ExternalLink size={14} />
            {t('Run Backup', 'نسخ احتياطي')}
          </button>
          <button
            onClick={handleClearCache}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 10, cursor: 'pointer', color: '#f59e0b', fontSize: 13, fontWeight: 500,
            }}
          >
            <Wifi size={14} />
            {t('Clear Cache', 'مسح الكاش')}
          </button>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
