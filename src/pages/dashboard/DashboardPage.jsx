import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS } from '../../config/roles';
import { Users, Target, DollarSign, Clock, AlertTriangle, Award } from 'lucide-react';

const STATS = [
  { key: 'totalLeads', icon: Users, value: '—', bg: '#dbeafe', color: '#3b82f6' },
  { key: 'activeOpps', icon: Target, value: '—', bg: '#fef3c7', color: '#f59e0b' },
  { key: 'closedDeals', icon: DollarSign, value: '—', bg: '#d1fae5', color: '#10b981' },
  { key: 'totalRevenue', icon: DollarSign, value: '—', bg: '#ede9fe', color: '#8b5cf6' },
];

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const isRTL = i18n.language === 'ar';
  const name = isRTL ? profile?.full_name_ar : (profile?.full_name_en || profile?.full_name_ar);
  const roleLabel = ROLE_LABELS[profile?.role]?.[i18n.language] || '';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>{t('dashboard.welcome')}، {name} 👋</h1>
        <p style={{ color: '#6b7280', marginTop: 4 }}>{roleLabel} • {new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {STATS.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.key} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={20} style={{ color: s.color }} />
                </div>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{t('dashboard.thisMonth')}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{s.value}</div>
              <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>{t('dashboard.' + s.key)}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>
            <Clock size={18} style={{ color: '#4A7AAB' }} /> {t('dashboard.recentActivities')}
          </h3>
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>{t('common.noData')}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20 }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 600, margin: '0 0 16px' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> {t('dashboard.slaAlerts')}
          </h3>
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>{t('common.noData')}</div>
        </div>
      </div>
    </div>
  );
}
