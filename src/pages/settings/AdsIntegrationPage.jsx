import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Save, RefreshCw, Wifi, WifiOff, Eye, EyeOff,
  ToggleLeft, ToggleRight, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import {
  getAdsConfig, saveAdsConfig, syncMetaCampaigns, syncGoogleCampaigns, importCampaignsToERP,
} from '../../services/adsIntegrationService';

export default function AdsIntegrationPage() {
  const { i18n } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isRTL = i18n.language === 'ar';
  const t = (ar, en) => isRTL ? ar : en;

  // State
  const [metaConfig, setMetaConfig] = useState({ enabled: false, token: '', account_id: '', last_sync: null });
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, token: '', account_id: '', last_sync: null });
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [showGoogleToken, setShowGoogleToken] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null); // null | 'testing' | 'connected' | 'error'
  const [googleStatus, setGoogleStatus] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [syncing, setSyncing] = useState({ meta: false, google: false });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load configs
  useEffect(() => {
    (async () => {
      const meta = await getAdsConfig('meta');
      const google = await getAdsConfig('google');
      setMetaConfig(meta);
      setGoogleConfig(google);
      if (meta.last_sync) setMetaStatus('connected');
      if (google.last_sync) setGoogleStatus('connected');
    })();
  }, []);

  // Styles
  const accent = '#4A7AAB';
  const cardBg = isDark ? '#1a2332' : '#ffffff';
  const cardBorder = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#e2e8f0' : '#1e293b';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0a1929' : '#f8fafc';
  const inputBorder = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.12)';

  const cardStyle = {
    background: cardBg,
    border: `1px solid ${cardBorder}`,
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  };

  const inputStyle = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: 8,
    padding: '8px 12px',
    color: textPrimary,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    direction: 'ltr',
    textAlign: 'left',
  };

  const btnPrimary = {
    background: accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  const btnOutline = {
    background: 'transparent',
    color: accent,
    border: `1px solid ${accent}`,
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  // Handlers
  async function handleSave() {
    setSaving(true);
    try {
      await saveAdsConfig('meta', metaConfig);
      await saveAdsConfig('google', googleConfig);
      showToast(t('تم حفظ الإعدادات', 'Settings saved'));
    } catch {
      showToast(t('فشل الحفظ', 'Save failed'), 'error');
    }
    setSaving(false);
  }

  async function handleTestMeta() {
    setMetaStatus('testing');
    setMetaError('');
    try {
      await syncMetaCampaigns(metaConfig);
      setMetaStatus('connected');
      showToast(t('تم الاتصال بنجاح', 'Connection successful'));
    } catch (err) {
      setMetaStatus('error');
      setMetaError(err.message);
      showToast(err.message, 'error');
    }
  }

  async function handleTestGoogle() {
    setGoogleStatus('testing');
    setGoogleError('');
    try {
      await syncGoogleCampaigns(googleConfig);
      setGoogleStatus('connected');
    } catch (err) {
      setGoogleStatus('error');
      setGoogleError(err.message);
      showToast(err.message, 'error');
    }
  }

  async function handleSyncMeta() {
    setSyncing(s => ({ ...s, meta: true }));
    try {
      const campaigns = await syncMetaCampaigns(metaConfig);
      const imported = await importCampaignsToERP(campaigns, 'meta');
      const updated = { ...metaConfig, last_sync: new Date().toISOString() };
      setMetaConfig(updated);
      await saveAdsConfig('meta', updated);
      setMetaStatus('connected');
      showToast(t(`تم مزامنة ${imported.length} حملة`, `Synced ${imported.length} campaigns`));
    } catch (err) {
      showToast(err.message, 'error');
    }
    setSyncing(s => ({ ...s, meta: false }));
  }

  async function handleSyncGoogle() {
    setSyncing(s => ({ ...s, google: true }));
    try {
      const campaigns = await syncGoogleCampaigns(googleConfig);
      const imported = await importCampaignsToERP(campaigns, 'google');
      const updated = { ...googleConfig, last_sync: new Date().toISOString() };
      setGoogleConfig(updated);
      await saveAdsConfig('google', updated);
      setGoogleStatus('connected');
      showToast(t(`تم مزامنة ${imported.length} حملة`, `Synced ${imported.length} campaigns`));
    } catch (err) {
      showToast(err.message, 'error');
    }
    setSyncing(s => ({ ...s, google: false }));
  }

  function StatusBadge({ status }) {
    if (!status) return null;
    if (status === 'testing') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: accent }}>
        <Loader2 size={14} className="animate-spin" /> {t('جاري الاختبار...', 'Testing...')}
      </span>
    );
    if (status === 'connected') return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#22c55e' }}>
        <CheckCircle2 size={14} /> {t('متصل', 'Connected')}
      </span>
    );
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#ef4444' }}>
        <XCircle size={14} /> {t('غير متصل', 'Disconnected')}
      </span>
    );
  }

  function renderPlatformCard({ title, logo, config, setConfig, showToken, setShowToken, status, error, onTest, onSync, syncKey }) {
    return (
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{logo}</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: textPrimary, margin: 0 }}>{title}</h3>
            <StatusBadge status={status} />
          </div>
          <button
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: config.enabled ? '#22c55e' : textSecondary }}
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            title={config.enabled ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable')}
          >
            {config.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
          </button>
        </div>

        {/* Description */}
        <p style={{ fontSize: 13, color: textSecondary, margin: '0 0 16px' }}>
          {title === 'Meta Ads'
            ? t('ربط حملات Facebook و Instagram الإعلانية لمزامنة البيانات تلقائياً', 'Connect Facebook & Instagram ad campaigns for automatic data sync')
            : t('ربط حملات Google Ads لمزامنة البيانات تلقائياً', 'Connect Google Ads campaigns for automatic data sync')
          }
        </p>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, opacity: config.enabled ? 1 : 0.5, pointerEvents: config.enabled ? 'auto' : 'none' }}>
          {/* Token */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4, display: 'block' }}>
              {t('رمز الوصول (Access Token)', 'Access Token')}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={config.token}
                onChange={e => setConfig({ ...config, token: e.target.value })}
                placeholder={t('أدخل رمز الوصول...', 'Enter access token...')}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                style={{
                  position: 'absolute',
                  [isRTL ? 'left' : 'right']: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: textSecondary,
                  padding: 4,
                  display: 'flex',
                }}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Account ID */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: textSecondary, marginBottom: 4, display: 'block' }}>
              {t('معرّف الحساب الإعلاني (Account ID)', 'Ad Account ID')}
            </label>
            <input
              type="text"
              value={config.account_id}
              onChange={e => setConfig({ ...config, account_id: e.target.value })}
              placeholder={t('مثال: 123456789', 'e.g. 123456789')}
              style={inputStyle}
            />
          </div>

          {/* Last Sync */}
          {config.last_sync && (
            <p style={{ fontSize: 12, color: textSecondary, margin: 0 }}>
              {t('آخر مزامنة:', 'Last sync:')} {new Date(config.last_sync).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}
            </p>
          )}

          {/* Error */}
          {error && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <button
              style={btnOutline}
              onClick={onTest}
              disabled={!config.token || !config.account_id || status === 'testing'}
            >
              {status === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              {t('اختبار الاتصال', 'Test Connection')}
            </button>
            <button
              style={btnPrimary}
              onClick={onSync}
              disabled={!config.token || !config.account_id || syncing[syncKey]}
            >
              {syncing[syncKey] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t('مزامنة الحملات', 'Sync Campaigns')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ direction: isRTL ? 'rtl' : 'ltr', padding: '0 0 40px', maxWidth: 800 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
          color: toast.type === 'error' ? '#dc2626' : '#16a34a',
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Page Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: textPrimary, margin: 0 }}>
          {t('ربط الإعلانات', 'Ads Integration')}
        </h1>
        <p style={{ fontSize: 14, color: textSecondary, margin: '6px 0 0' }}>
          {t(
            'ربط حسابات الإعلانات لمزامنة الحملات والبيانات تلقائياً مع النظام',
            'Connect your ad accounts to automatically sync campaigns and data with the ERP'
          )}
        </p>
      </div>

      {/* Meta Ads Card */}
      {renderPlatformCard({
        title: 'Meta Ads',
        logo: '\uD83D\uDFE6',
        config: metaConfig,
        setConfig: setMetaConfig,
        showToken: showMetaToken,
        setShowToken: setShowMetaToken,
        status: metaStatus,
        error: metaError,
        onTest: handleTestMeta,
        onSync: handleSyncMeta,
        syncKey: 'meta',
      })}

      {/* Google Ads Card */}
      {renderPlatformCard({
        title: 'Google Ads',
        logo: '\uD83D\uDFE8',
        config: googleConfig,
        setConfig: setGoogleConfig,
        showToken: showGoogleToken,
        setShowToken: setShowGoogleToken,
        status: googleStatus,
        error: googleError,
        onTest: handleTestGoogle,
        onSync: handleSyncGoogle,
        syncKey: 'google',
      })}

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: isRTL ? 'flex-start' : 'flex-end' }}>
        <button style={{ ...btnPrimary, padding: '10px 28px', fontSize: 14 }} onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {t('حفظ الإعدادات', 'Save Settings')}
        </button>
      </div>
    </div>
  );
}
