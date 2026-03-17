import { useState, useEffect, useRef } from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { getSyncStatus, syncNow, subscribe, getPendingCount } from '../../services/syncService';

/**
 * SyncIndicator - Small sync status indicator for the header.
 * Shows: green (synced), yellow (pending), red (offline/failed).
 * Clicking shows a tooltip with details.
 */
export default function SyncIndicator() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [status, setStatus] = useState(getSyncStatus);
  const [showTooltip, setShowTooltip] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef(null);

  // Refresh status on queue changes
  useEffect(() => {
    const unsub = subscribe(() => setStatus(getSyncStatus()));
    return unsub;
  }, []);

  // Listen for online/offline changes
  useEffect(() => {
    const update = () => setStatus(getSyncStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  // Refresh periodically
  useEffect(() => {
    const id = setInterval(() => setStatus(getSyncStatus()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShowTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

  const handleSync = async () => {
    if (syncing || !status.isOnline) return;
    setSyncing(true);
    try {
      await syncNow();
      setStatus(getSyncStatus());
    } finally {
      setSyncing(false);
    }
  };

  // Determine indicator state
  let dotColor, dotShadow, Icon, label;

  if (!status.isOnline) {
    dotColor = '#ef4444';
    dotShadow = '0 0 6px rgba(239,68,68,0.5)';
    Icon = CloudOff;
    label = isRTL ? 'غير متصل' : 'Offline';
  } else if (status.failedItems > 0) {
    dotColor = '#f59e0b';
    dotShadow = '0 0 6px rgba(245,158,11,0.5)';
    Icon = AlertTriangle;
    label = isRTL ? `${status.failedItems} عناصر فشلت` : `${status.failedItems} failed`;
  } else if (status.pending > 0) {
    dotColor = '#f59e0b';
    dotShadow = '0 0 6px rgba(245,158,11,0.5)';
    Icon = RefreshCw;
    label = isRTL ? `${status.pending} في الانتظار` : `${status.pending} pending`;
  } else {
    dotColor = '#22c55e';
    dotShadow = '0 0 6px rgba(34,197,94,0.4)';
    Icon = CheckCircle2;
    label = isRTL ? 'متزامن' : 'Synced';
  }

  const lastSync = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
    : (isRTL ? 'لم تتم بعد' : 'Never');

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setShowTooltip(!showTooltip)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          background: 'transparent',
          color: isDark ? '#94a3b8' : '#64748b',
          fontFamily: 'inherit',
          fontSize: 12,
        }}
        title={label}
      >
        <Cloud size={16} />
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: dotShadow,
            position: 'absolute',
            top: 5,
            [isRTL ? 'left' : 'right']: 5,
          }}
        />
      </button>

      {showTooltip && (
        <div
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            position: 'absolute',
            top: '100%',
            [isRTL ? 'start' : 'end']: 0,
            marginTop: 8,
            width: 220,
            background: isDark ? '#1a1f2e' : '#fff',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 12,
            padding: 12,
            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 200,
            fontSize: 12,
          }}
        >
          {/* Status row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon size={16} style={{ color: dotColor, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: isDark ? '#e2e8f0' : '#1e293b' }}>
              {label}
            </span>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? '#94a3b8' : '#64748b' }}>
              <span>{isRTL ? 'في الانتظار' : 'Pending'}</span>
              <span style={{ fontWeight: 600, color: status.pending > 0 ? '#f59e0b' : (isDark ? '#e2e8f0' : '#1e293b') }}>
                {status.pending}
              </span>
            </div>
            {status.failedItems > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? '#94a3b8' : '#64748b' }}>
                <span>{isRTL ? 'فشلت' : 'Failed'}</span>
                <span style={{ fontWeight: 600, color: '#ef4444' }}>
                  {status.failedItems}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? '#94a3b8' : '#64748b' }}>
              <span>{isRTL ? 'آخر مزامنة' : 'Last sync'}</span>
              <span style={{ fontWeight: 500 }}>{lastSync}</span>
            </div>
          </div>

          {/* Sync Now button */}
          {status.isOnline && status.pending > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                marginTop: 10,
                padding: '7px 0',
                border: 'none',
                borderRadius: 8,
                cursor: syncing ? 'not-allowed' : 'pointer',
                background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)',
                color: isDark ? '#818cf8' : '#6366f1',
                fontWeight: 600,
                fontSize: 12,
                fontFamily: 'inherit',
                opacity: syncing ? 0.6 : 1,
              }}
            >
              <RefreshCw size={13} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              {syncing
                ? (isRTL ? 'جاري المزامنة...' : 'Syncing...')
                : (isRTL ? 'مزامنة الآن' : 'Sync Now')
              }
            </button>
          )}
        </div>
      )}
    </div>
  );
}
